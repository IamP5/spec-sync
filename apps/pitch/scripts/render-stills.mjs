import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  outDir: path.resolve("dist"),
});
const browser = await openBrowser("chrome");
try {
  const composition = await selectComposition({
    serveUrl,
    id: "SpecSyncFord",
    puppeteerInstance: browser,
  });
  await mkdir("out/stills", { recursive: true });
  const frames = process.argv.slice(2).map(Number);
  const storyboard = JSON.parse(
    await readFile("src/data/storyboard.json", "utf8"),
  );
  const reviewFrames = storyboard.flatMap((scene) =>
    [0.25, 0.65].map((progress) =>
      Math.round((scene.start + scene.duration * progress) * 30),
    ),
  );
  for (const frame of frames.length ? frames : reviewFrames) {
    await renderStill({
      serveUrl,
      composition,
      puppeteerInstance: browser,
      frame,
      output: path.resolve(`out/stills/${String(frame).padStart(4, "0")}.png`),
    });
    console.log(`Rendered frame ${frame}`);
  }
} finally {
  await browser.close({ silent: true });
}
