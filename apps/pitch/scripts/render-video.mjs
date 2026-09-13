import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const cliPackage = require.resolve("@remotion/cli/package.json");
const cli = path.resolve(
  path.dirname(cliPackage),
  require(cliPackage).bin.remotion,
);
const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });

const storyboard = JSON.parse(
  await readFile("src/data/storyboard.json", "utf8"),
);
const duration = storyboard.reduce((sum, scene) => sum + scene.duration, 0);
await mkdir("out", { recursive: true });
if (!process.argv.includes("--master-only"))
  await run(process.execPath, [
    cli,
    "render",
    "src/index.ts",
    "SpecSyncFord",
    "out/specsync-ford-pitch.raw.mp4",
    "--codec",
    "h264",
    "--crf",
    "18",
  ]);
// Preserve the Remotion video while mastering the dialogue/music mix for playback.
await run("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  "out/specsync-ford-pitch.raw.mp4",
  "-map",
  "0:v:0",
  "-map",
  "0:a:0",
  "-c:v",
  "copy",
  "-af",
  "loudnorm=I=-16:TP=-1.5:LRA=9",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-t",
  String(duration),
  "-movflags",
  "+faststart",
  "-metadata",
  "title=SpecSync para Ford — Das especificações às decisões",
  "out/specsync-ford-pitch.mp4",
]);
await copyFile("out/specsync-ford-pitch.mp4", "out/specsync-ford-pitch-v7.mp4");
console.log("Finished: out/specsync-ford-pitch-v7.mp4");
