import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";

const storyboard = JSON.parse(
  await readFile("src/data/storyboard.json", "utf8"),
);
const expectedFrames = storyboard.reduce(
  (sum, scene) => sum + Math.round(scene.duration * 30),
  0,
);
const expectedDuration = expectedFrames / 30;
const file = "out/specsync-ford-pitch.mp4";
const probe = JSON.parse(
  execFileSync(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8" },
  ),
);
const video = probe.streams.find((s) => s.codec_type === "video");
const audio = probe.streams.find((s) => s.codec_type === "audio");
assert.equal(video.width, 1920);
assert.equal(video.height, 1080);
assert.equal(video.r_frame_rate, "30/1");
assert.equal(Number(video.nb_frames), expectedFrames);
assert.equal(video.codec_name, "h264");
assert.equal(audio.codec_name, "aac");
assert.equal(audio.channels, 2);
assert.ok(Math.abs(Number(probe.format.duration) - expectedDuration) < 0.02);

const voices = JSON.parse(await readFile("src/data/voice.json", "utf8"));
const normalized = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
let end = 0;
let captionCount = 0;
for (const [i, scene] of storyboard.entries()) {
  const voice = voices[i];
  assert.ok(
    Math.abs(scene.start - end) < 1 / 30,
    "Scene timings must be contiguous",
  );
  end += scene.duration;
  assert.ok(
    voice.duration + voice.offset <= scene.duration,
    `${scene.id}: audio exceeds scene`,
  );
  assert.equal(
    normalized(scene.text),
    normalized(voice.captions.map((c) => c.text).join(" ")),
    `${scene.id}: caption text differs from narration`,
  );
  let last = 0;
  for (const caption of voice.captions) {
    assert.ok(caption.startMs >= last && caption.endMs > caption.startMs);
    assert.ok(caption.endMs <= voice.duration * 1000 + 200);
    last = caption.startMs;
    captionCount++;
  }
  await stat(`public/${voice.file}`);
}
assert.ok(Math.abs(end - expectedDuration) < 1 / 30);
assert.equal(voices.length, storyboard.length);
assert.ok(
  expectedDuration >= 120 && expectedDuration <= 180,
  "Pitch must stay within 2–3 minutes",
);
const voiceConfig = JSON.parse(
  await readFile("src/data/eleven-voice.json", "utf8"),
);
assert.equal(
  voiceConfig.sourcePreviewIndex,
  1,
  "User selected ElevenLabs preview 01",
);
for (const voice of voices) {
  assert.equal(voice.voice, voiceConfig.voice_id);
  assert.equal(voice.rate, 0, "Narration must retain its natural speed");
  assert.ok(voice.file.startsWith("audio/eleven-v1/"));
}
assert.ok(
  !/desafio|caso proposto|validado com/i.test(
    storyboard.map((s) => s.text).join(" "),
  ),
);
const srt = await readFile("public/specsync-ford.pt-BR.srt", "utf8");
assert.equal((srt.match(/-->/g) || []).length, captionCount);
execFileSync(
  "ffmpeg",
  ["-v", "error", "-xerror", "-i", file, "-f", "null", "-"],
  { stdio: "pipe" },
);
const bytes = await readFile(file);
await writeFile(
  "out/verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      width: video.width,
      height: video.height,
      fps: 30,
      frames: Number(video.nb_frames),
      duration: Number(probe.format.duration),
      videoCodec: video.codec_name,
      audioCodec: audio.codec_name,
      audioChannels: audio.channels,
      scenes: storyboard.length,
      captions: captionCount,
      narrationAligned: true,
      voiceProvider: "ElevenLabs",
      voiceId: voiceConfig.voice_id,
      selectedPreview: 1,
      naturalSpeed: true,
      fullDecode: "passed",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Verified ${expectedDuration}s / 1080p / 30fps, H.264 + stereo AAC, selected ElevenLabs voice, all captions, and full-file decoding.`,
);
