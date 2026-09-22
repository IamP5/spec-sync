# Capturing official sources for the gap audit

Goal: for one source URL, produce `<outDir>/captures/<slug>/<key>.txt` (plain
text, UTF-8) and `<outDir>/captures/<slug>/<key>.meta.json`
(`{ "key", "url", "kind": "page" | "pdf", "method", "sha256", "bytes", "capturedAt" }`).
`sha256` is the digest of the ORIGINAL bytes (PDF or HTML), never of the text.
Compare it with `knownSources[].sha256` in the model file: equal means the
catalog already saw exactly this revision; different means source drift.

## 1. Try the command line first (fast, exact hash)

```sh
curl -sL -A "Mozilla/5.0" -o /tmp/src.bin -w "%{http_code} %{content_type}\n" "<url>"
file /tmp/src.bin && shasum -a 256 /tmp/src.bin
pdftotext -layout /tmp/src.bin <outDir>/captures/<slug>/<key>.txt   # PDFs
```

For HTML, strip tags to text (for example `node -e` with a regex, or the
`textutil -convert txt` command on macOS). If the response is an HTML "Access
Denied" page, a 403, or a CAPTCHA (Ford, Toyota, Porsche and Mercedes-Benz
media endpoints do this), go to step 2. Never retry a blocked host more than
twice.

## 2. Fall back to the Browser pane (own tab, then close it)

Load the tools with ToolSearch if they are deferred:
`mcp__Claude_Browser__tabs_create`, `navigate`, `get_page_text`,
`javascript_tool`, `tabs_close`. Create a tab with `tabs_create` and pass its
`tabId` to every call; other agents share the pane. Close the tab when done.

Pages: `navigate` to the URL, wait for load, `get_page_text` (max_chars 60000).
Decline cookie banners; never accept terms.

PDFs: navigate to any page on the same origin first, then run in
`javascript_tool` (same-origin fetch reuses the CDN cookies):

```js
const r = await fetch('<pdf-url>', { credentials: 'include' });
const b = await r.arrayBuffer();
const hash = Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', b)),
)
  .map((x) => x.toString(16).padStart(2, '0'))
  .join('');
const mod = await import(
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
);
mod.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
const doc = await mod.getDocument({ data: b.slice(0) }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  let line = '',
    lastY = null;
  const lines = [];
  for (const it of tc.items) {
    if (!('str' in it)) continue;
    const y = Math.round(it.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(line);
      line = '';
    }
    line += (line && !line.endsWith(' ') ? ' ' : '') + it.str;
    lastY = y;
  }
  lines.push(line);
  pages.push(`===== PAGE ${p} =====\n` + lines.join('\n'));
}
({
  status: r.status,
  bytes: b.byteLength,
  hash,
  pages: doc.numPages,
  text: pages.join('\n'),
});
```

Write the returned `text` to the `.txt` file with a heredoc or `Write`. A page
that yields no text is an image (cover art, scanned table): record
`"imagePages": [n]` in the meta file and do not invent its contents.

## 3. Record what failed

If a source cannot be captured after both methods, do not create a `.txt`
file. Report it in the stage result under `failures` with the last HTTP
status or error. Silent gaps are worse than reported ones.
