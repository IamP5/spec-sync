#!/usr/bin/env python3
"""Create measured, normalized voice auditions without modifying their sources."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave


LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=9"
AUDIO_FORMAT = "aformat=sample_rates=48000:channel_layouts=stereo"
MEASURE_KEYS = {"input_i", "input_tp", "input_lra", "input_thresh", "target_offset"}


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(
            f"{Path(command[0]).name} failed ({result.returncode}):\n"
            f"{result.stderr[-6000:]}"
        )
    return result


def parse_loudnorm(log: str) -> dict[str, object]:
    """Read JSON objects inside FFmpeg output, allowing trailing log messages."""
    decoder = json.JSONDecoder()
    candidates = []
    for match in re.finditer(r"\{", log):
        try:
            value, _ = decoder.raw_decode(log[match.start() :])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and MEASURE_KEYS.issubset(value):
            candidates.append(value)
    if not candidates:
        raise RuntimeError("FFmpeg did not return loudnorm measurements.")
    return candidates[-1]


def measure(ffmpeg: str, path: Path) -> dict[str, object]:
    result = run([
        ffmpeg, "-hide_banner", "-nostats", "-xerror", "-i", str(path),
        "-map", "0:a:0", "-vn", "-af",
        f"{AUDIO_FORMAT},{LOUDNORM}:print_format=json", "-f", "null", "-",
    ])
    return parse_loudnorm(result.stderr)


def probe(ffprobe: str, path: Path) -> dict[str, object]:
    result = run([
        ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries",
        "format=duration:stream=codec_name,sample_rate,channels,sample_fmt,bits_per_sample",
        "-of", "json", str(path),
    ])
    data = json.loads(result.stdout)
    if not data.get("streams"):
        raise RuntimeError(f"No audio stream found in {path}.")
    duration = float(data.get("format", {}).get("duration", "nan"))
    if not math.isfinite(duration) or duration <= 0:
        raise RuntimeError(f"No valid audio duration found in {path}.")
    return data


def verify(ffmpeg: str, ffprobe: str, path: Path) -> dict[str, object]:
    run([
        ffmpeg, "-hide_banner", "-v", "error", "-xerror", "-i", str(path),
        "-map", "0:a:0", "-vn", "-f", "null", "-",
    ])
    metadata = probe(ffprobe, path)
    stream = metadata["streams"][0]
    if (
        stream.get("codec_name") != "pcm_s16le"
        or int(stream.get("sample_rate", 0)) != 48000
        or int(stream.get("channels", 0)) != 2
        or int(stream.get("bits_per_sample", 0)) != 16
    ):
        raise RuntimeError(f"Expected stereo 48 kHz, 16-bit PCM WAV: {path}")
    measured = measure(ffmpeg, path)
    with wave.open(str(path), "rb") as wav:
        sample_count = wav.getnframes()
    return {
        "duration_seconds": sample_count / 48000,
        "sample_count": sample_count,
        "codec": stream["codec_name"],
        "sample_rate_hz": int(stream["sample_rate"]),
        "channels": int(stream["channels"]),
        "bits_per_sample": int(stream["bits_per_sample"]),
        "integrated_lufs": float(measured["input_i"]),
        "true_peak_dbtp": float(measured["input_tp"]),
        "loudness_range_lu": float(measured["input_lra"]),
        "full_decode_passed": True,
        "loudnorm_measurement": measured,
    }


def normalize(
    ffmpeg: str, ffprobe: str, source: Path, destination: Path, scratch: Path
) -> dict[str, object]:
    first_pass = measure(ffmpeg, source)
    for key in MEASURE_KEYS:
        if not math.isfinite(float(first_pass[key])):
            raise RuntimeError(f"Cannot normalize silent or unmeasurable audio: {source}")
    options = ":".join([
        f"measured_I={first_pass['input_i']}",
        f"measured_TP={first_pass['input_tp']}",
        f"measured_LRA={first_pass['input_lra']}",
        f"measured_thresh={first_pass['input_thresh']}",
        f"offset={first_pass['target_offset']}",
        "linear=true", "print_format=json",
    ])
    temporary = scratch / destination.name
    result = run([
        ffmpeg, "-hide_banner", "-nostats", "-xerror", "-y", "-i", str(source),
        "-map", "0:a:0", "-vn", "-af", f"{AUDIO_FORMAT},{LOUDNORM}:{options}",
        "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(temporary),
    ])
    report = {
        "source": str(source),
        "output": str(destination),
        "target": {"integrated_lufs": -16, "true_peak_dbtp": -1.5, "loudness_range_lu": 9},
        "first_pass": first_pass,
        "second_pass": parse_loudnorm(result.stderr),
        "verified_output": verify(ffmpeg, ffprobe, temporary),
    }
    temporary.replace(destination)
    return report


def mix_score(
    ffmpeg: str, ffprobe: str, voice: Path, score: Path, score_start: float,
    voice_duration: float, destination: Path, scratch: Path,
) -> dict[str, object]:
    sample_count = round(voice_duration * 48000) + 76800
    duration = sample_count / 48000
    score_duration = float(probe(ffprobe, score)["format"]["duration"])
    if score_start >= score_duration:
        raise RuntimeError(
            f"Score start ({score_start:g}s) must precede its end ({score_duration:g}s)."
        )
    graph = (
        f"[0:a:0]{AUDIO_FORMAT},asetpts=PTS-STARTPTS,adelay=600:all=1[voice];"
        f"[1:a:0]{AUDIO_FORMAT},asetpts=PTS-STARTPTS,atrim=end_sample={sample_count},"
        "volume=0.65,afade=t=in:st=0:d=0.6,"
        f"afade=t=out:st={duration - 1.5:.6f}:d=1.5[score];"
        "[voice][score]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,"
        "alimiter=limit=0.89:level=false:latency=true,"
        f"apad=whole_len={sample_count},atrim=end_sample={sample_count},"
        f"asetpts=PTS-STARTPTS,{AUDIO_FORMAT}[out]"
    )
    temporary = scratch / destination.name
    run([
        ffmpeg, "-hide_banner", "-nostats", "-xerror", "-y", "-i", str(voice),
        "-stream_loop", "-1", "-ss", str(score_start), "-i", str(score),
        "-filter_complex", graph, "-map", "[out]",
        "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(temporary),
    ])
    verified = verify(ffmpeg, ffprobe, temporary)
    if verified["sample_count"] != sample_count:
        raise RuntimeError(
            f"Unexpected duration for mixed audition: {temporary}; "
            f"expected {sample_count} samples, got {verified['sample_count']}"
        )
    report = {
        "voice": str(voice), "score": str(score), "output": str(destination),
        "mix": {
            "voice_start_seconds": 0.6, "score_start_seconds": score_start,
            "score_volume": 0.65, "score_fade_in_seconds": 0.6,
            "score_fade_out_seconds": 1.5, "duration_seconds": duration,
            "sample_count": sample_count,
            "limiter_amplitude": 0.89, "limiter_auto_level": False,
        },
        "verified_output": verified,
    }
    temporary.replace(destination)
    return report


def save_report(destination: Path, report: dict[str, object]) -> None:
    destination.with_suffix(".json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    verified = report["verified_output"]
    print(
        f"{destination}\n"
        f"  {verified['duration_seconds']:.3f}s | "
        f"{verified['integrated_lufs']:.2f} LUFS | "
        f"{verified['true_peak_dbtp']:.2f} dBTP | "
        f"LRA {verified['loudness_range_lu']:.2f} LU | full decode passed"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize MP3/WAV voice auditions using two-pass loudnorm and verify the resulting WAVs.",
        epilog="Creates <stem>-review.wav and measured JSON. With --score, also creates <stem>-com-trilha.wav and JSON. Source files are preserved.",
    )
    parser.add_argument("files", metavar="VOICE", nargs="+", type=Path, help="MP3 or WAV source files")
    parser.add_argument("--output-dir", type=Path, required=True, help="Directory for audition WAVs and measurement JSON")
    parser.add_argument("--score", type=Path, help="Optional backing track; loops if the selected segment is too short")
    parser.add_argument("--score-start", type=float, default=75.0, help="Backing-track start in seconds (default: 75)")
    args = parser.parse_args()
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        parser.error("ffmpeg and ffprobe must be available on PATH")
    if not math.isfinite(args.score_start) or args.score_start < 0:
        parser.error("--score-start must be a finite, nonnegative number")
    sources = [path.expanduser().resolve() for path in args.files]
    score = args.score.expanduser().resolve() if args.score else None
    for source in sources:
        if not source.is_file() or source.suffix.lower() not in {".mp3", ".wav"}:
            parser.error(f"Expected an existing MP3 or WAV file: {source}")
    if score is not None and not score.is_file():
        parser.error(f"Backing track does not exist: {score}")
    if len({path.stem.casefold() for path in sources}) != len(sources):
        parser.error("Source stems must be unique to prevent output-name collisions")
    output_dir = args.output_dir.expanduser().resolve()
    protected = set(sources) | ({score} if score else set())
    for source in sources:
        for suffix in ("review", "com-trilha"):
            for extension in ("wav", "json"):
                target = output_dir / f"{source.stem}-{suffix}.{extension}"
                if target.resolve() in protected:
                    parser.error(f"Output would overwrite a source file: {target}")
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix=".voice-master-", dir=output_dir) as directory:
            scratch = Path(directory)
            for source in sources:
                review = output_dir / f"{source.stem}-review.wav"
                report = normalize(ffmpeg, ffprobe, source, review, scratch)
                save_report(review, report)
                if score is not None:
                    mixed = output_dir / f"{source.stem}-com-trilha.wav"
                    mixed_report = mix_score(
                        ffmpeg, ffprobe, review, score, args.score_start,
                        report["verified_output"]["duration_seconds"], mixed, scratch,
                    )
                    save_report(mixed, mixed_report)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
