#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
semgrep="${SEMGREP_BIN:-semgrep}"
trufflehog="${TRUFFLEHOG_BIN:-trufflehog}"
tmp="$(mktemp -d)"
trap 'rm -r -- "$tmp"' EXIT

cat >"$tmp/Unsafe.java" <<'JAVA'
import javax.crypto.Cipher;

class Unsafe {
    void run() throws Exception {
        Runtime.getRuntime().exec("true");
    }

    Cipher cipher() throws Exception {
        return Cipher.getInstance("AES");
    }
}
JAVA
cat >"$tmp/unsafe.ts" <<'TS'
export function render(element: HTMLElement, sanitizer: { bypassSecurityTrustHtml(value: string): unknown }) {
  element.innerHTML = location.hash;
  return sanitizer.bypassSecurityTrustHtml(location.hash);
}
TS

if "$semgrep" scan --config "$root/.semgrep/security.yml" --metrics=off --error \
  --json --output "$tmp/semgrep.json" --quiet "$tmp/Unsafe.java" "$tmp/unsafe.ts"; then
  echo "Semgrep accepted the synthetic fixtures." >&2
  exit 1
else
  status=$?
  if [ "$status" -ne 1 ]; then
    echo "Semgrep failed for a reason other than detecting the synthetic finding." >&2
    exit 1
  fi
fi
python3 - "$tmp/semgrep.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as result:
    scan = json.load(result)
assert not scan["errors"], "Semgrep could not analyze the synthetic fixtures"
detected = {
    (finding["check_id"].rsplit(".", 1)[-1], finding["path"].rsplit("/", 1)[-1], finding["start"]["line"])
    for finding in scan["results"]
}
expected = {"java-runtime-exec", "java-weak-cipher", "dom-html-injection", "angular-bypass-security-trust"}
missing = expected - {rule for rule, _, _ in detected}
assert not missing, f"Semgrep did not detect the synthetic fixtures for: {sorted(missing)}"
for rule, path, line in sorted(detected):
    print(f"Semgrep fixture: {rule} detected at {path}:{line}")
PY

git -C "$tmp" init -q
git -C "$tmp" config core.autocrlf false
git -C "$tmp" -c user.name=SecurityTest -c user.email=security-test@example.invalid \
  -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q --allow-empty -m base
base="$(git -C "$tmp" rev-parse HEAD)"
printf 'https://%s:%s@%s/path\n' user pass example.com >"$tmp/candidate.txt"
git -C "$tmp" add candidate.txt
git -C "$tmp" -c user.name=SecurityTest -c user.email=security-test@example.invalid \
  -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q -m fixture

if (cd "$tmp" && TRUFFLEHOG_BIN="$trufflehog" bash "$root/scripts/security/scan-secrets.sh" "$base") \
  >"$tmp/trufflehog-summary" 2>"$tmp/trufflehog-error"; then
  echo "TruffleHog accepted a synthetic secret candidate." >&2
  exit 1
else
  status=$?
  if [ "$status" -ne 1 ] || ! grep -Eq '^TruffleHog: [1-9][0-9]* unverified candidates' "$tmp/trufflehog-summary"; then
    echo "TruffleHog did not report and reject the synthetic candidate." >&2
    exit 1
  fi
fi
grep -E '^TruffleHog: |"detector"' "$tmp/trufflehog-summary" | sed 's/^/TruffleHog fixture: /'

echo "Security self-test passed: Semgrep detected the Java and TypeScript fixtures and TruffleHog rejected the Git fixture."
