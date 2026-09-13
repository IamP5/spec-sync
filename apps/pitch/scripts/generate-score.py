"""Create the original SpecSync film score from mathematical oscillators.

All sound is synthesized here: no recordings, downloaded samples, stock music,
external impulse responses, or artist references are used. The arrangement is
reproducible, with a fixed 92 BPM pulse, original minor/add-nine voicings, sparse
FM keys, and tuned percussion. Scene boundaries determine the dynamics rather
than a repeating music-loop edit. The stereo output follows the storyboard duration at 44.1 kHz;
its peak is normalized to 0.30 for mixing underneath the existing narration.

Run with the project's Python environment containing NumPy. The only generated
file is public/audio/score-v5.wav. Mix at 0.45, then master the complete film.
"""

from pathlib import Path
import json
import wave

import numpy as np

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]
STORYBOARD = json.loads((ROOT / "src/data/storyboard.json").read_text())
DURATION = sum(scene["duration"] for scene in STORYBOARD)
VOICE = json.loads((ROOT / "src/data/voice.json").read_text())
CLOSE_VOICE = VOICE[-1]


def close_word_time(token):
    word = next(word for word in CLOSE_VOICE["words"] if word["text"].strip(".,:").lower() == token.lower())
    return CLOSE_VOICE["offset"] + word["startMs"] / 1000


CLOSE_IMPACT = close_word_time("minutos")
CLOSE_BRAND = close_word_time("SpecSync")
CLOSE_CTA = close_word_time("Vamos")
BPM = 92.0
BEAT = 60.0 / BPM
BAR = BEAT * 4
PEAK = 0.30
N = int(RATE * DURATION)
track = np.zeros((N, 2), dtype=np.float64)

# Each phrase opens space for the voice and changes density with the picture.
ENERGIES = [0.56, 0.76, 0.88, 0.70, 0.94, 0.64, 1.00, 0.58]
SCENES = [
    (scene["start"], scene["start"] + scene["duration"], ENERGIES[index], index)
    for index, scene in enumerate(STORYBOARD)
]
BOUNDARIES = [scene["start"] for scene in STORYBOARD[1:]]

# C-sharp minor 9, A major 9, F-sharp minor 9, and a suspended dominant.
CHORDS = [
    (37, [49, 56, 59, 64, 68]),
    (33, [45, 52, 56, 59, 64]),
    (30, [42, 49, 52, 56, 61]),
    (32, [44, 51, 56, 58, 63]),
]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def timeline(seconds):
    return np.arange(max(1, int(seconds * RATE)), dtype=np.float64) / RATE


def smoothstep(values):
    values = np.clip(values, 0.0, 1.0)
    return values * values * (3.0 - 2.0 * values)


def envelope(t, length, attack, release):
    return smoothstep(t / attack) * smoothstep((length - t) / release)


def add(mono, start, gain=1.0, pan=0.0):
    """Equal-power pan and sample-accurate placement without wraparound."""
    pos = int(round(start * RATE))
    if pos >= N:
        return
    if pos < 0:
        mono = mono[-pos:]
        pos = 0
    count = min(len(mono), N - pos)
    angle = (pan + 1.0) * np.pi / 4.0
    track[pos:pos + count, 0] += mono[:count] * gain * np.cos(angle)
    track[pos:pos + count, 1] += mono[:count] * gain * np.sin(angle)


def air_chord(start, duration, notes, strength):
    """Slow bowed-electric texture with restrained, non-bright harmonics."""
    t = timeline(duration)
    env = envelope(t, duration, 1.65, 2.55)
    for index, midi in enumerate(notes):
        frequency = hz(midi)
        phase = index * 0.81
        drift = 0.055 * np.sin(2 * np.pi * 0.105 * t + phase)
        tone = np.sin(2 * np.pi * frequency * t + drift + phase)
        tone += 0.17 * np.sin(2 * np.pi * frequency * 2.001 * t + phase)
        tone += 0.035 * np.sin(2 * np.pi * frequency * 3.002 * t + phase)
        tone *= env * (0.92 + 0.08 * np.sin(2 * np.pi * 0.16 * t + phase))
        add(tone, start, strength * 0.018, -0.62 + index * 0.31)
        # A very quiet detuned counterpart creates width without random noise.
        shimmer = np.sin(2 * np.pi * frequency * 1.0014 * t + phase + 0.5)
        add(shimmer * env, start + 0.035, strength * 0.004, 0.58 - index * 0.29)


def bass_pulse(start, midi, strength, length=1.15):
    t = timeline(length)
    frequency = hz(midi)
    env = smoothstep(t / 0.014) * np.exp(-t * 3.2)
    env *= smoothstep((length - t) / 0.11)
    # Gentle saturation supplies audible definition on smaller speakers.
    raw = np.sin(2 * np.pi * frequency * t)
    raw += 0.16 * np.sin(2 * np.pi * frequency * 2 * t)
    raw = np.tanh(raw * 1.2) / 1.2
    add(raw * env, start, strength * 0.086)


def electric_key(start, midi, strength, pan, length=2.0):
    t = timeline(length)
    frequency = hz(midi)
    env = smoothstep(t / 0.009) * np.exp(-t * 3.7)
    env *= smoothstep((length - t) / 0.18)
    index = 0.7 * np.exp(-t * 5.5)
    tone = np.sin(2 * np.pi * frequency * t + index * np.sin(2 * np.pi * frequency * 2.003 * t))
    tone += 0.07 * np.sin(2 * np.pi * frequency * 4.001 * t) * np.exp(-t * 8)
    tone *= env
    add(tone, start, strength * 0.033, pan)
    add(tone, start + BEAT * 0.75, strength * 0.010, -pan)
    add(tone, start + BEAT * 1.5, strength * 0.004, pan * 0.5)


def low_impact(start, strength):
    """Rounded felt-like percussion, deliberately lacking a click transient."""
    length = 0.65
    t = timeline(length)
    phase = 2 * np.pi * (44 * t + 1.65 * (1 - np.exp(-t * 28)))
    body = np.sin(phase) * np.exp(-t * 9)
    body *= smoothstep(t / 0.006) * smoothstep((length - t) / 0.08)
    add(body, start, strength * 0.068)


def tuned_tap(start, strength, pan):
    """A short resonant stick gesture instead of a high-hat/snare pattern."""
    length = 0.32
    t = timeline(length)
    body = np.sin(2 * np.pi * 391.995 * t) * np.exp(-t * 33)
    body += 0.27 * np.sin(2 * np.pi * 1038.2 * t) * np.exp(-t * 62)
    body *= smoothstep(t / 0.003) * smoothstep((length - t) / 0.04)
    add(body, start, strength * 0.013, pan)


def transition_bloom(boundary, midi, strength):
    """Reverse tonal anticipation followed by a quiet low-frequency landing."""
    length = 1.75
    t = timeline(length)
    rise = smoothstep(t / length) ** 2
    rise *= smoothstep((length - t) / 0.09)
    frequency = hz(midi + 12)
    tone = np.sin(2 * np.pi * frequency * t)
    tone += 0.18 * np.sin(2 * np.pi * frequency * 2.002 * t)
    add(tone * rise, boundary - length - 0.12, strength * 0.023, -0.3)
    add(tone * rise, boundary - length - 0.08, strength * 0.013, 0.4)
    bass_pulse(boundary + 0.07, midi, strength * 0.56, 1.45)


for start, end, energy, scene in SCENES:
    if scene == 7:
        # The last movement follows the measured words, from delivery to impact.
        air_chord(start - 0.45, 10.4, [49, 56, 59, 64, 68], 0.74)
        for offset in (1.85, 3.19, 4.79, 6.10, 7.75):
            electric_key(start + offset, 73, 0.32, -0.35, 1.55)
        air_chord(start + 9.3, CLOSE_BRAND - 8.7, [44, 51, 56, 58, 63], 0.84)
        # An accelerating tonal gesture compresses the visual hour into a pulse.
        for step in range(12):
            progress = step / 11
            offset = CLOSE_IMPACT - 2.2 + 2.08 * (1 - (1 - progress) ** 1.45)
            tuned_tap(start + offset, 0.35 + progress * 0.30, -0.5 + progress)
        transition_bloom(start + CLOSE_IMPACT, 37, 1.0)
        low_impact(start + CLOSE_IMPACT, 1.7)
        bass_pulse(start + CLOSE_IMPACT, 25, 0.8, 2.2)
        electric_key(start + CLOSE_IMPACT + 0.08, 80, 0.5, 0.28, 2.6)
        # Resolve into the brand and leave a scored hold for the final CTA.
        air_chord(start + CLOSE_BRAND - 0.4, end - start - CLOSE_BRAND + 0.6,
                  [49, 56, 61, 63, 68], 0.95)
        bass_pulse(start + CLOSE_BRAND, 37, 0.65, 2.6)
        electric_key(start + CLOSE_BRAND, 73, 0.60, -0.4, 3.1)
        electric_key(start + CLOSE_CTA, 80, 0.46, 0.4, 4.0)
        electric_key(start + CLOSE_CTA + 2.5, 75, 0.24, 0.15, 3.4)
        continue

    for phrase, chord_start in enumerate(np.arange(start - 0.65, end, BAR * 2)):
        chord_index = (phrase + [0, 0, 1, 2, 0, 1, 0][scene]) % len(CHORDS)
        root_note, notes = CHORDS[chord_index]
        chord_length = min(BAR * 2 + 2.65, end + 0.18 - chord_start)
        air_chord(chord_start, chord_length, notes, energy)

    for bar_index, bar_start in enumerate(np.arange(start + 0.30, end - 0.35, BAR)):
        phrase = int((bar_start - (start - 0.65)) / (BAR * 2))
        chord_index = (phrase + [0, 0, 1, 2, 0, 1, 0][scene]) % len(CHORDS)
        root_note, notes = CHORDS[chord_index]
        # Breath around each scene's first sentence; ontology is percussion-free.
        rhythm_gain = energy * (0.50 if bar_index == 0 else 1.0)
        if scene == 0:
            rhythm_gain *= 0.54
        if scene == 5:
            rhythm_gain *= 0.65
        bass_pulse(bar_start, root_note, rhythm_gain)
        if scene in (1, 2, 4, 6) and bar_start + BEAT * 2.5 < end - 0.4:
            bass_pulse(bar_start + BEAT * 2.5, root_note, rhythm_gain * 0.46)
        if scene in (2, 4, 6):
            low_impact(bar_start, energy * 0.60)
            if bar_start + BEAT * 2 < end - 0.4:
                tuned_tap(bar_start + BEAT * 2, energy * 0.65, -0.34 if bar_index % 2 else 0.34)

        # One sparse original four-note cell, with rests rather than constant runs.
        offsets = (0.75, 1.5, 2.75, 3.5) if scene in (2, 4, 6) else (0.75, 2.75)
        for step, offset in enumerate(offsets):
            event = bar_start + offset * BEAT
            if event > end - 0.4 or (scene == 0 and bar_index < 1):
                continue
            note_index = (step * 2 + bar_index) % len(notes)
            midi = notes[note_index] + 12
            note_strength = energy * (0.72 if step % 2 == 0 else 0.44)
            if scene == 5:
                midi += 12
                note_strength *= 0.51
            electric_key(event, midi, note_strength, -0.62 if step % 2 == 0 else 0.62)

for boundary in BOUNDARIES:
    transition_bloom(boundary, 37, 0.80 if boundary in [STORYBOARD[i]["start"] for i in (4, 6, 7)] else 0.52)

# A small deterministic stereo reflection field provides space. Its low level
# avoids washing out the precise interaction sounds mixed separately in Remotion.
dry = track.copy()
for delay, gain in ((0.071, 0.047), (0.113, 0.036), (0.173, 0.026), (0.251, 0.018)):
    samples = int(delay * RATE)
    track[samples:, 0] += dry[:-samples, 1] * gain
    track[samples:, 1] += dry[:-samples, 0] * gain

del dry
seconds = np.arange(N, dtype=np.float64) / RATE
master_env = smoothstep(seconds / 1.6) * smoothstep((DURATION - seconds) / 4.7)

# Surgical gaps make chapter cuts audible without a repeated dramatic whoosh.
for boundary in BOUNDARIES:
    distance = seconds - boundary
    before = smoothstep((-distance - 0.075) / 0.19)
    after = smoothstep((distance - 0.035) / 0.24)
    dip = np.where(distance < 0, before, after)
    master_env *= 0.15 + 0.85 * dip

# Keep the first words of each newly introduced scene clear.
for start, _, _, _ in SCENES[1:]:
    distance = seconds - (start + 0.75)
    duck = np.exp(-0.5 * (distance / 0.70) ** 2)
    master_env *= 1.0 - 0.14 * duck

track *= master_env[:, None]
track -= track.mean(axis=0, keepdims=True)
track *= PEAK / max(np.max(np.abs(track)), 1e-12)
track[0] = 0.0
track[-1] = 0.0

out = ROOT / "public/audio/score-v5.wav"
with wave.open(str(out), "wb") as stream:
    stream.setnchannels(2)
    stream.setsampwidth(2)
    stream.setframerate(RATE)
    stream.writeframes(np.rint(track * 32767).astype("<i2").tobytes())

rms = np.sqrt(np.mean(track ** 2))
print(json.dumps({
    "file": str(out),
    "origin": "Original deterministic oscillator synthesis; no sampled recordings",
    "duration_seconds": DURATION,
    "bpm": BPM,
    "sample_rate": RATE,
    "channels": 2,
    "peak_linear": float(np.max(np.abs(track))),
    "peak_dbfs": float(20 * np.log10(np.max(np.abs(track)))),
    "rms_dbfs": float(20 * np.log10(rms)),
    "crest_db": float(20 * np.log10(PEAK / rms)),
}, indent=2))
