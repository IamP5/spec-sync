"""Generate scene audio and aligned Remotion captions using a generic pt-BR voice."""

import asyncio
import json
import os
import re
from pathlib import Path
import subprocess

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
STORYBOARD = json.loads((ROOT / "src/data/storyboard.json").read_text())
VOICE = os.environ.get("PITCH_VOICE", "pt-BR-AntonioNeural")


def duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], text=True).strip())


async def generate(scene):
    path = ROOT / "public/audio" / (scene["id"] + ".mp3")
    sidecar = path.with_suffix(".json")
    identity = {"text": scene["text"], "voice": VOICE}
    if path.exists() and sidecar.exists():
        cached = json.loads(sidecar.read_text())
        if cached.get("identity") == identity:
            return cached["result"]
    rate = 0
    for attempt in range(3):
        words = []
        communicate = edge_tts.Communicate(
            scene["text"], VOICE, rate=f"{rate:+d}%", boundary="WordBoundary"
        )
        with path.open("wb") as stream:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    stream.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    words.append({
                        "text": chunk["text"],
                        "startMs": chunk["offset"] / 10000,
                        "endMs": (chunk["offset"] + chunk["duration"]) / 10000,
                        "timestampMs": chunk["offset"] / 10000,
                        "confidence": None,
                    })
        seconds = duration(path)
        if seconds <= scene["duration"] - 1.5:
            break
        rate += 8
    if seconds > scene["duration"] - 1.5:
        raise ValueError(f"Narration too long: {scene['id']} ({seconds}s)")
    captions = []
    group = []
    for word in words:
        if group and (len(" ".join(w["text"] for w in group)) + len(word["text"]) > 65
                      or word["startMs"] - group[0]["startMs"] > 3500):
            captions.append({
                "text": " ".join(w["text"] for w in group),
                "startMs": group[0]["startMs"], "endMs": group[-1]["endMs"] + 90,
                "timestampMs": group[0]["startMs"], "confidence": None,
            })
            group = []
        group.append(word)
    if group:
        captions.append({
            "text": " ".join(w["text"] for w in group),
            "startMs": group[0]["startMs"], "endMs": group[-1]["endMs"] + 200,
            "timestampMs": group[0]["startMs"], "confidence": None,
        })
    result = {"id": scene["id"], "file": f"audio/{path.name}",
              "duration": seconds, "offset": 0.75, "voice": VOICE,
              "rate": rate, "captions": captions, "words": words}
    sidecar.write_text(json.dumps({"identity": identity, "result": result}, ensure_ascii=False, indent=2))
    print(scene["id"], f"{seconds:.2f}s", f"{len(captions)} captions", flush=True)
    return result


async def main():
    (ROOT / "public/audio").mkdir(parents=True, exist_ok=True)
    results = []
    for scene in STORYBOARD:
        result = await generate(scene)
        original = scene["text"].split()
        spoken = [word["text"] for word in result["words"]]
        normalize = lambda text: re.sub(r"\W", "", text).lower()
        if len(original) != len(spoken) or any(normalize(a) != normalize(b) for a, b in zip(original, spoken)):
            raise ValueError(f"Caption words need manual alignment: {scene['id']}")
        cursor = 0
        for caption in result["captions"]:
            count = len(caption["text"].split())
            caption["text"] = " ".join(original[cursor:cursor + count])
            cursor += count
        results.append(result)
    (ROOT / "src/data/voice.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    srt = []
    def timestamp(ms):
        ms = round(ms)
        return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
    for scene, voice in zip(STORYBOARD, results):
        for cap in voice["captions"]:
            offset = (scene["start"] + voice["offset"]) * 1000
            srt.append(f"{len(srt)+1}\n{timestamp(cap['startMs']+offset)} --> {timestamp(cap['endMs']+offset)}\n{cap['text']}\n")
    (ROOT / "public/specsync-ford.pt-BR.srt").write_text("\n".join(srt))


asyncio.run(main())
