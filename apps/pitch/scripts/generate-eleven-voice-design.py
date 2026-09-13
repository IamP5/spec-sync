"""Generate original ElevenLabs Voice Design previews without storing credentials."""

import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brief", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    payload = json.loads(args.brief.read_text())
    request_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output_dir / "voice-design.json"
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text())
        if existing.get("requestSha256") == request_hash:
            print("Using existing Voice Design previews.")
            return
        parser.error("Choose a new output directory for a different request.")
    api_key = os.environ.get("ELEVENLABS_API_KEY") or getpass.getpass("ElevenLabs key (not stored): ")
    request = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-voice/design?output_format=mp3_44100_128",
        data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    print("Generating original Brazilian advertising voice previews...", flush=True)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        detail = body.get("detail", {})
        if isinstance(detail, dict):
            message = str(detail.get("message", ""))
            print(f"ElevenLabs HTTP {error.code}: {detail.get('status', 'unknown')}")
            print(message.replace(api_key, "[redacted]")[:1500])
        else:
            print(f"ElevenLabs HTTP {error.code}: request validation failed.")
        raise SystemExit(1) from None
    previews = result.get("previews", [])
    if not previews:
        raise SystemExit("ElevenLabs did not return voice previews.")
    records = []
    for index, preview in enumerate(previews, start=1):
        path = args.output_dir / f"eleven-presenca-{index:02}.mp3"
        audio = base64.b64decode(preview["audio_base_64"])
        path.write_bytes(audio)
        duration = float(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ], text=True))
        records.append({
            "index": index, "file": str(path),
            "generatedVoiceId": preview["generated_voice_id"],
            "mediaType": preview.get("media_type"),
            "language": preview.get("language"), "durationSeconds": duration,
            "sha256": hashlib.sha256(audio).hexdigest(),
        })
        print(f"Saved {path} ({duration:.2f}s)", flush=True)
    manifest_path.write_text(json.dumps({
        "request": payload, "requestSha256": request_hash,
        "text": result.get("text"), "previews": records,
        "savedAsPermanentVoice": False,
    }, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
