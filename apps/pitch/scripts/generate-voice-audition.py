"""Generate a directed narration audition through Vertex AI using existing ADC."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import wave


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brief", type=Path)
    parser.add_argument("--take", required=True)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT"))
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if not args.project:
        parser.error("Pass --project or set GOOGLE_CLOUD_PROJECT.")

    brief = json.loads(args.brief.read_text())
    take = next((item for item in brief["takes"] if item["id"] == args.take), None)
    if take is None:
        parser.error("The requested take is not in the brief.")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / f"{args.take}.wav"
    sidecar = output.with_suffix(".json")
    prompt = "\n\n".join([brief["direction"], take["direction"], "### TRANSCRIPT\n" + brief["text"]])
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "languageCode": "pt-BR",
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": take["voice"]}},
            },
        },
    }
    identity = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    if output.exists():
        cached = json.loads(sidecar.read_text()) if sidecar.exists() else {}
        if cached.get("requestSha256") == identity and cached.get("model") == brief["model"]:
            print(f"Cached: {output}")
            return
        parser.error("An audition already exists at this path. Choose a new output directory.")

    auth = subprocess.run(
        ["gcloud", "auth", "application-default", "print-access-token"],
        capture_output=True, text=True, check=False,
    )
    if auth.returncode or not auth.stdout.strip():
        raise SystemExit("Application Default Credentials are unavailable; refresh the local gcloud login.")
    model = brief["model"]
    endpoint = (
        f"https://aiplatform.googleapis.com/v1beta1/projects/{args.project}"
        f"/locations/global/publishers/google/models/{model}:generateContent"
    )
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={
            "Authorization": "Bearer " + auth.stdout.strip(),
            "x-goog-user-project": args.project,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    print(f"Generating {args.take}: {model}, {take['voice']}", flush=True)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        detail = json.loads(error.read()).get("error", {})
        (args.output_dir / f"{args.take}.error.json").write_text(
            json.dumps({"model": model, "error": detail}, ensure_ascii=False, indent=2) + "\n"
        )
        raise SystemExit(f"TTS request failed ({error.code}): {detail.get('message', 'Unknown API error')}") from None

    candidate = result.get("candidates", [{}])[0]
    if candidate.get("finishReason") != "STOP":
        raise SystemExit(f"Incomplete generation: {candidate.get('finishReason', 'No candidate')}")
    pcm = bytearray()
    for part in candidate.get("content", {}).get("parts", []):
        data = part.get("inlineData", {})
        if data:
            mime = data.get("mimeType", "")
            if not mime.lower().startswith("audio/l16") or "rate=24000" not in mime:
                raise SystemExit(f"Unexpected audio encoding: {mime}")
            pcm.extend(base64.b64decode(data["data"]))
    if not pcm or len(pcm) % 2:
        raise SystemExit("The API did not return valid 16-bit PCM audio.")
    with wave.open(str(output), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(pcm)
    metadata = {
        "model": model, "voice": take["voice"], "take": args.take,
        "text": brief["text"], "prompt": prompt, "requestSha256": identity,
        "durationSeconds": len(pcm) / 48000,
        "finishReason": candidate["finishReason"],
        "usage": result.get("usageMetadata"),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    sidecar.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {output} ({metadata['durationSeconds']:.2f}s)", flush=True)


if __name__ == "__main__":
    main()
