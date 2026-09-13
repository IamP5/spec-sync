#!/usr/bin/env python3
"""Generate resumable Eleven v3 narration and frame-aligned Remotion manifests.

API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
The API key is read from the environment or a hidden terminal prompt only.
"""

from __future__ import annotations

import argparse
import base64
from bisect import bisect_left
from datetime import datetime, timezone
import getpass
import hashlib
import json
import math
import os
from pathlib import Path
import re
import runpy
import shutil
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MASTER = ROOT / "scripts/master-voice-auditions.py"
DIRECTIONS = re.compile(r"\[[^\]]*\]")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def clean_text(text: str) -> str:
    return " ".join(DIRECTIONS.sub(" ", text).split())


def canonical_map(text: str) -> tuple[str, list[int]]:
    letters, indices = [], []
    for index, character in enumerate(text):
        for normalized in unicodedata.normalize("NFKD", character).casefold():
            if normalized.isalnum():
                letters.append(normalized)
                indices.append(index)
    return "".join(letters), indices


def load_inputs(storyboard: Path, voice_config: Path) -> tuple[list[dict], dict]:
    scenes, config = read_json(storyboard), read_json(voice_config)
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("Storyboard must be a nonempty array of scenes.")
    seen = set()
    for scene in scenes:
        scene_id = scene.get("id", "")
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]*", scene_id) or scene_id in seen:
            raise ValueError("Scene IDs must be unique, safe file-name components.")
        seen.add(scene_id)
        for field in ("title", "text"):
            if not isinstance(scene.get(field), str) or not scene[field].strip():
                raise ValueError(f"{scene_id}: {field} must be nonempty text.")
        minimum = float(scene.get("minimumDuration", scene.get("duration", 0)))
        if not math.isfinite(minimum) or minimum <= 0:
            raise ValueError(f"{scene_id}: duration must be positive visual seconds.")
        spoken = scene.get("spokenText", scene["text"])
        if not isinstance(spoken, str) or not spoken.strip():
            raise ValueError(f"{scene_id}: spokenText must be nonempty text.")
        if re.search(r"<\s*break\b", spoken, re.IGNORECASE):
            raise ValueError(f"{scene_id}: Eleven v3 uses audio tags/punctuation, not SSML break tags.")
        if canonical_map(clean_text(spoken))[0] != canonical_map(clean_text(scene["text"]))[0]:
            raise ValueError(f"{scene_id}: spokenText must retain text's words; direction tags and punctuation may differ.")
    if not isinstance(config, dict):
        raise ValueError("Voice configuration must be an object.")
    voice_id = config.get("voice_id", config.get("voiceId"))
    if not isinstance(voice_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", voice_id):
        raise ValueError("Voice configuration requires the saved voice_id.")
    if config.get("model_id", config.get("modelId", "eleven_v3")) != "eleven_v3":
        raise ValueError("This generator requires model_id eleven_v3.")
    settings = config.get("voice_settings", config.get("voiceSettings", {}))
    if not isinstance(settings, dict):
        raise ValueError("voice_settings must be an object.")
    if float(settings.get("speed", 1)) != 1:
        raise ValueError("Narration must keep natural speed; voice_settings.speed must be 1.")
    output_format = config.get("output_format", "mp3_44100_128")
    if not isinstance(output_format, str) or not re.fullmatch(r"mp3_\d+_\d+", output_format):
        raise ValueError("output_format must be an ElevenLabs MP3 format.")
    public_config = {
        "voice_id": voice_id,
        "output_format": output_format,
        "model_id": "eleven_v3",
        "language_code": config.get("language_code", "pt"),
        "voice_settings": settings,
    }
    for field in ("seed", "apply_text_normalization", "pronunciation_dictionary_locators"):
        if field in config:
            public_config[field] = config[field]
    return scenes, public_config


def request_details(scene: dict, config: dict) -> tuple[dict, str]:
    payload = {
        "text": scene.get("spokenText", scene["text"]),
        "model_id": "eleven_v3",
        "language_code": config["language_code"],
    }
    for field in ("voice_settings", "seed", "apply_text_normalization", "pronunciation_dictionary_locators"):
        if field in config:
            payload[field] = config[field]
    endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{config['voice_id']}/with-timestamps"
    endpoint += "?" + urllib.parse.urlencode({"output_format": config["output_format"]})
    request = {"url": endpoint, "payload": payload}
    identity = json.dumps(request, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return request, digest(identity)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, "API redirects are disabled", headers, fp)


class Credentials:
    def __init__(self, environment: str):
        self.environment = environment
        self._value = None

    def get(self) -> str:
        if self._value is None:
            self._value = os.environ.get(self.environment, "").strip()
            if not self._value:
                if not sys.stdin.isatty():
                    raise RuntimeError(f"Set {self.environment}, or run in a terminal for a hidden API-key prompt.")
                self._value = getpass.getpass("ElevenLabs API key (hidden): ").strip()
            if not self._value:
                raise RuntimeError("No ElevenLabs API key supplied.")
        return self._value


def fetch_response(
    request: dict, request_hash: str, prefix: Path, credentials: Credentials,
    offline: bool, retry_unresolved: bool, timeout: float,
) -> dict:
    response_path = Path(f"{prefix}.response.json")
    attempt_path = Path(f"{prefix}.attempt.json")
    if response_path.exists():
        cached = read_json(response_path)
        if cached.get("request_hash") != request_hash:
            raise RuntimeError(f"Cache identity mismatch: {response_path}")
        return cached["response"]
    if offline:
        raise RuntimeError(f"Offline cache miss: {prefix.name}")
    if attempt_path.exists() and not retry_unresolved:
        raise RuntimeError(
            f"An earlier request has no cached response: {prefix.name}. "
            "No automatic retry was made. Inspect the earlier failure before using --retry-unresolved."
        )
    secret = credentials.get()
    body = json.dumps(request["payload"], ensure_ascii=False).encode("utf-8")
    api_request = urllib.request.Request(
        request["url"], data=body, method="POST",
        headers={"xi-api-key": secret, "Content-Type": "application/json", "Accept": "application/json"},
    )
    atomic_write(attempt_path, json_bytes({
        "request_hash": request_hash, "request": request,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }))
    try:
        with urllib.request.build_opener(NoRedirect()).open(api_request, timeout=timeout) as response:
            response_body = response.read()
            request_id = response.headers.get("request-id", response.headers.get("x-request-id"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace").replace(secret, "[redacted]")
        raise RuntimeError(f"ElevenLabs HTTP {error.code}: {detail[:900]}; no automatic retry.") from None
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError(f"ElevenLabs request interrupted ({type(error).__name__}); no automatic retry.") from None
    # Save the complete response before decoding audio or performing local work.
    try:
        parsed = json.loads(response_body)
    except (ValueError, UnicodeDecodeError):
        atomic_write(Path(f"{prefix}.invalid-response.txt"), response_body.replace(secret.encode(), b"[redacted]"))
        raise RuntimeError("API returned invalid JSON; response preserved and no retry made.") from None
    atomic_write(response_path, json_bytes({
        "request_hash": request_hash, "request": request, "request_id": request_id,
        "received_at": datetime.now(timezone.utc).isoformat(), "response": parsed,
    }))
    return parsed


def audio_and_timing(response: dict, prefix: Path, request_hash: str) -> tuple[Path, dict]:
    try:
        audio = base64.b64decode(response["audio_base64"], validate=True)
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(f"Cached response has no valid audio: {prefix.name}") from error
    if not audio:
        raise RuntimeError(f"Cached response has empty audio: {prefix.name}")
    raw_path = Path(f"{prefix}.raw.mp3")
    if not raw_path.exists() or digest(raw_path.read_bytes()) != digest(audio):
        atomic_write(raw_path, audio)
    timing = {
        "request_hash": request_hash, "raw_sha256": digest(audio),
        "alignment": response.get("alignment"),
        "normalized_alignment": response.get("normalized_alignment"),
    }
    atomic_write(Path(f"{prefix}.timing.json"), json_bytes(timing))
    return raw_path, timing


def aligned_words(scene: dict, alignment: dict, duration: float) -> list[dict]:
    if not isinstance(alignment, dict):
        raise ValueError(f"{scene['id']}: response has no character alignment.")
    characters = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])
    if not characters or len(characters) != len(starts) or len(starts) != len(ends):
        raise ValueError(f"{scene['id']}: invalid alignment arrays.")
    letters, char_starts, char_ends = [], [], []
    for character, start, end in zip(characters, starts, ends):
        start, end = float(start), float(end)
        if not isinstance(character, str) or not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start:
            raise ValueError(f"{scene['id']}: invalid character timing.")
        for letter in character:
            letters.append(letter)
            char_starts.append(start * 1000)
            char_ends.append(end * 1000)
    aligned = "".join(letters)
    # Keep character positions intact while removing non-spoken direction tags.
    for tag in DIRECTIONS.finditer(aligned):
        letters[tag.start():tag.end()] = " " * (tag.end() - tag.start())
    aligned = "".join(letters)
    normalized_key, normalized_indices = canonical_map(aligned)
    display = clean_text(scene["text"])
    display_key, display_indices = canonical_map(display)
    if normalized_key != display_key:
        raise ValueError(
            f"{scene['id']}: aligned speech differs from storyboard text. "
            f"Expected: {display[:160]!r}; aligned: {clean_text(aligned)[:160]!r}. "
            "Audio/response remain cached; canonical manifests were not replaced."
        )
    words, prefix_text = [], ""
    for match in re.finditer(r"\S+", display):
        first = bisect_left(display_indices, match.start())
        last = bisect_left(display_indices, match.end())
        if first == last:
            if words:
                words[-1]["text"] += " " + match.group()
            else:
                prefix_text += match.group() + " "
            continue
        positions = normalized_indices[first:last]
        start_ms = min(char_starts[index] for index in positions)
        end_ms = max(char_ends[index] for index in positions)
        if start_ms >= duration * 1000 or end_ms > duration * 1000 + 150:
            raise ValueError(f"{scene['id']}: alignment exceeds measured audio duration.")
        if words and start_ms < words[-1]["startMs"]:
            raise ValueError(f"{scene['id']}: word starts are not chronological.")
        end_ms = min(duration * 1000, max(start_ms + 1, end_ms))
        words.append({
            "text": prefix_text + match.group(), "startMs": round(start_ms, 3),
            "endMs": round(end_ms, 3), "timestampMs": round(start_ms, 3), "confidence": None,
        })
        prefix_text = ""
    if not words:
        raise ValueError(f"{scene['id']}: no caption words found.")
    return words


def group_captions(words: list[dict], duration: float, max_chars: int, max_seconds: float, segments: list[str] | None = None) -> list[dict]:
    if segments is not None:
        # Editorial phrase boundaries retain the original word alignment.
        if not segments or any(not isinstance(segment, str) or not segment.strip() for segment in segments):
            raise ValueError("Editorial captions must be nonempty strings.")
        expected = [word["text"] for word in words]
        provided = [token for segment in segments for token in segment.split()]
        if provided != expected:
            raise ValueError("Editorial captions must preserve every aligned word in order.")
        groups, cursor = [], 0
        for segment in segments:
            count = len(segment.split())
            group = words[cursor:cursor + count]
            if len(segment) > max_chars or group[-1]["endMs"] - group[0]["startMs"] > max_seconds * 1000:
                raise ValueError("An editorial caption exceeds the configured reading limits.")
            groups.append(group)
            cursor += count
    else:
        groups, group = [], []
        for word in words:
            if len(word["text"]) > max_chars:
                raise ValueError("A single caption word exceeds the character limit; edit the narration text.")
            proposed = " ".join(item["text"] for item in group + [word])
            if group and (
                len(proposed) > max_chars
                or word["endMs"] - group[0]["startMs"] > max_seconds * 1000
                or word["startMs"] - group[-1]["endMs"] > 550
            ):
                groups.append(group)
                group = []
            group.append(word)
            if re.search(r"[.!?;:][\"'”’)]*$", word["text"]) and len(" ".join(item["text"] for item in group)) >= 18:
                groups.append(group)
                group = []
        if group:
            groups.append(group)
    captions = []
    for index, group in enumerate(groups):
        start = group[0]["startMs"]
        next_start = groups[index + 1][0]["startMs"] if index + 1 < len(groups) else duration * 1000
        end = min(max(item["endMs"] for item in group) + 90, next_start, duration * 1000)
        if end <= start:
            raise ValueError("Character alignment cannot form chronological, non-overlapping captions.")
        captions.append({
            "text": " ".join(item["text"] for item in group),
            "startMs": round(start, 3), "endMs": round(end, 3),
            "timestampMs": round(start, 3), "confidence": None,
        })
    return captions


def master_audio(raw: Path, prefix: Path, request_hash: str, master: dict, ffmpeg: str, ffprobe: str) -> tuple[Path, dict]:
    destination = Path(f"{prefix}.wav")
    report_path = Path(f"{prefix}.master.json")
    identity = {"request_hash": request_hash, "raw_sha256": digest(raw.read_bytes()), "normalizer_sha256": digest(MASTER.read_bytes())}
    if destination.exists() and report_path.exists():
        report = read_json(report_path)
        if report.get("identity") == identity and report.get("output_sha256") == digest(destination.read_bytes()):
            return destination, report["result"]["verified_output"]
    with tempfile.TemporaryDirectory(prefix=".eleven-master-", dir=prefix.parent) as directory:
        result = master["normalize"](ffmpeg, ffprobe, raw, destination, Path(directory))
    atomic_write(report_path, json_bytes({"identity": identity, "output_sha256": digest(destination.read_bytes()), "result": result}))
    return destination, result["verified_output"]


def make_timeline(scenes: list[dict], voices: list[dict], fps: int, end_hold: float) -> list[dict]:
    result, cursor = [], 0
    for scene, voice in zip(scenes, voices):
        minimum = float(scene.get("minimumDuration", scene["duration"]))
        frames = math.ceil(max(minimum, voice["duration"] + voice["offset"] + end_hold) * fps - 1e-9)
        result.append({
            **scene, "minimumDuration": minimum, "start": cursor / fps,
            "duration": frames / fps, "startFrame": cursor, "durationInFrames": frames,
        })
        cursor += frames
    return result


def timestamp(milliseconds: float) -> str:
    value = math.floor(milliseconds + 0.5)
    return f"{value // 3600000:02}:{value // 60000 % 60:02}:{value // 1000 % 60:02},{value % 1000:03}"


def make_srt(scenes: list[dict], voices: list[dict]) -> str:
    entries = []
    for scene, voice in zip(scenes, voices):
        offset = (scene["start"] + voice["offset"]) * 1000
        for caption in voice["captions"]:
            entries.append(
                f"{len(entries) + 1}\n{timestamp(offset + caption['startMs'])} --> "
                f"{timestamp(offset + caption['endMs'])}\n{caption['text']}\n"
            )
    return "\n".join(entries)


def replace_preserving_previous(path: Path, content: bytes, snapshots: Path) -> None:
    if path.exists():
        previous = path.read_bytes()
        if previous == content:
            return
        backup = snapshots / f"{path.stem}-{digest(previous)[:16]}{path.suffix}"
        if not backup.exists():
            atomic_write(backup, previous)
    atomic_write(path, content)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate naturally paced Eleven v3 scene audio, captions, and a measured video timeline.")
    parser.add_argument("--storyboard", type=Path, default=ROOT / "src/data/storyboard.json")
    parser.add_argument("--voice-config", type=Path, default=ROOT / "src/data/eleven-voice.json")
    parser.add_argument("--output-dir", type=Path, default=PUBLIC / "audio/eleven-v1")
    parser.add_argument("--manifest", type=Path, default=ROOT / "src/data/voice.json")
    parser.add_argument("--timed-storyboard", type=Path, help="Measured storyboard destination; defaults to --storyboard")
    parser.add_argument("--srt", type=Path, default=PUBLIC / "specsync-ford.pt-BR.srt")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--offset", type=float, default=0.75, help="Silence before each voice in the composition")
    parser.add_argument("--end-hold", type=float, default=1.0, help="Minimum scene hold after narration")
    parser.add_argument("--caption-chars", type=int, default=70, help="Caption character limit, at most 70")
    parser.add_argument("--caption-seconds", type=float, default=4.5)
    parser.add_argument("--scene", action="append", help="Generate selected scene IDs only; do not replace canonical manifests")
    parser.add_argument("--offline", action="store_true", help="Use cached responses only; never call the API")
    parser.add_argument("--dry-run", action="store_true", help="Validate inputs and show cache misses without writing files or calling the API")
    parser.add_argument("--retry-unresolved", action="store_true", help="Explicitly allow a new request after an earlier uncached API attempt")
    parser.add_argument("--api-key-env", default="ELEVENLABS_API_KEY", help="Environment variable containing the API key; otherwise use a hidden terminal prompt")
    parser.add_argument("--timeout", type=float, default=180, help="HTTP request timeout in seconds; requests are never retried automatically")
    args = parser.parse_args()
    try:
        for field in ("offset", "end_hold", "caption_seconds", "timeout"):
            value = getattr(args, field)
            if not math.isfinite(value) or value < 0 or (field in {"caption_seconds", "timeout"} and value == 0):
                raise ValueError(f"Invalid --{field.replace('_', '-')} value.")
        if args.fps <= 0 or not 1 <= args.caption_chars <= 70:
            raise ValueError("FPS must be positive and caption-chars must be between 1 and 70.")
        scenes, config = load_inputs(args.storyboard.expanduser().resolve(), args.voice_config.expanduser().resolve())
        output_dir = args.output_dir.expanduser().resolve()
        output_dir.relative_to(PUBLIC.resolve())
        requested = set(args.scene or [])
        if requested - {scene["id"] for scene in scenes}:
            raise ValueError("--scene contains unknown scene IDs.")
        selected = [scene for scene in scenes if not requested or scene["id"] in requested]
        prepared = []
        for scene in selected:
            request, request_hash = request_details(scene, config)
            prefix = output_dir / f"{scene['id']}-{request_hash[:16]}"
            cached = Path(f"{prefix}.response.json").exists()
            prepared.append((scene, request, request_hash, prefix))
            print(f"{scene['id']}: {'cached response' if cached else 'API request needed'}; {len(request['payload']['text'])} characters", flush=True)
        if args.dry_run:
            print("Dry run complete; no files written and no API requests made.")
            return 0
        ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
        if not ffmpeg or not ffprobe:
            raise ValueError("ffmpeg and ffprobe must be available on PATH.")
        master = runpy.run_path(str(MASTER))
        output_dir.mkdir(parents=True, exist_ok=True)
        credentials = Credentials(args.api_key_env)
        voices = []
        for scene, request, request_hash, prefix in prepared:
            response = fetch_response(request, request_hash, prefix, credentials, args.offline, args.retry_unresolved, args.timeout)
            raw, timing = audio_and_timing(response, prefix, request_hash)
            audio, measurement = master_audio(raw, prefix, request_hash, master, ffmpeg, ffprobe)
            duration = measurement["duration_seconds"]
            alignment = timing.get("normalized_alignment") or timing.get("alignment")
            words = aligned_words(scene, alignment, duration)
            captions = group_captions(words, duration, args.caption_chars, args.caption_seconds, scene.get("captionSegments"))
            voice = {
                "id": scene["id"], "file": audio.relative_to(PUBLIC.resolve()).as_posix(),
                "duration": duration, "offset": args.offset, "voice": config["voice_id"],
                "rate": 0, "captions": captions, "words": words,
                "model": "eleven_v3", "requestHash": request_hash,
            }
            atomic_write(Path(f"{prefix}.voice.json"), json_bytes(voice))
            voices.append(voice)
            print(f"{scene['id']}: {duration:.3f}s, {measurement['integrated_lufs']:.2f} LUFS, {len(captions)} captions; audio verified", flush=True)
        if requested:
            print("Selected scenes complete. Canonical manifests unchanged; rerun without --scene to assemble the full timeline.")
            return 0
        timed = make_timeline(scenes, voices, args.fps, args.end_hold)
        snapshots = output_dir / "snapshots"
        storyboard_output = (args.timed_storyboard or args.storyboard).expanduser().resolve()
        replace_preserving_previous(storyboard_output, json_bytes(timed), snapshots)
        replace_preserving_previous(args.srt.expanduser().resolve(), make_srt(timed, voices).encode("utf-8"), snapshots)
        replace_preserving_previous(args.manifest.expanduser().resolve(), json_bytes(voices), snapshots)
        total_frames = sum(scene["durationInFrames"] for scene in timed)
        print(f"Complete: {len(voices)} scenes, {total_frames} frames at {args.fps} fps, {total_frames / args.fps:.3f}s. Natural narration speed preserved.")
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
