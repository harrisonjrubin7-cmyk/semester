#!/usr/bin/env python3
"""
Render a two-voice podcast script to an MP3, and emit chapter marks taken from
the real audio positions rather than estimated.

    python3 audio/synth.py audio/scripts/bus1600.json app/public/audio

Voices are Piper neural models. A script is a list of lines, each with a speaker
("v") and text ("t"); a line may open a chapter and may request a pause after it
(used for the self-test, so there is room to answer out loud).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice

VOICE_DIR = Path(
    os.environ.get(
        "PIPER_VOICE_DIR",
        "/tmp/claude-0/-home-claude-repo/b495cbbc-379c-576b-afb6-9b5bae53eb18/scratchpad/voices",
    )
)

# Beats of silence, in seconds. Speech needs room or it reads as a machine
# reading a list; these are what make it sound like two people talking.
GAP_SAME_SPEAKER = 0.32
GAP_TURN = 0.55
GAP_CHAPTER = 1.15


def load_voices(spec: dict[str, str]) -> dict[str, PiperVoice]:
    voices = {}
    for role, name in spec.items():
        onnx = VOICE_DIR / f"{name}.onnx"
        voices[role] = PiperVoice.load(str(onnx), config_path=str(onnx) + ".json")
    return voices


def say(voice: PiperVoice, text: str) -> tuple[np.ndarray, int]:
    """Synthesize one line to a float32 mono array."""
    chunks = []
    rate = None
    for chunk in voice.synthesize(text):
        rate = chunk.sample_rate
        chunks.append(np.frombuffer(chunk.audio_int16_bytes, dtype=np.int16))
    if not chunks:
        return np.zeros(0, dtype=np.float32), rate or 22050
    audio = np.concatenate(chunks).astype(np.float32) / 32768.0
    return audio, rate


def resample(audio: np.ndarray, src: int, dst: int) -> np.ndarray:
    if src == dst or audio.size == 0:
        return audio
    n = int(round(audio.size * dst / src))
    return np.interp(
        np.linspace(0, audio.size - 1, n, dtype=np.float64),
        np.arange(audio.size, dtype=np.float64),
        audio,
    ).astype(np.float32)


def mmss(seconds: float) -> str:
    total = int(round(seconds))
    return f"{total // 60}:{total % 60:02d}"


def main() -> int:
    script_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    script = json.loads(script_path.read_text())
    voices = load_voices(script["voices"])

    rate = max(v.config.sample_rate for v in voices.values())
    pieces: list[np.ndarray] = []
    chapters: list[dict] = []
    position = 0.0  # seconds of audio emitted so far
    prev_speaker: str | None = None

    def add_silence(seconds: float) -> None:
        nonlocal position
        if seconds <= 0:
            return
        pieces.append(np.zeros(int(seconds * rate), dtype=np.float32))
        position += seconds

    total = len(script["lines"])
    for i, line in enumerate(script["lines"], 1):
        speaker = line["v"]
        chapter = line.get("chapter")

        if pieces:
            if chapter:
                add_silence(GAP_CHAPTER)
            elif speaker != prev_speaker:
                add_silence(GAP_TURN)
            else:
                add_silence(GAP_SAME_SPEAKER)

        if chapter:
            chapters.append({"t": mmss(position), "s": int(position), "name": chapter})

        audio, src_rate = say(voices[speaker], line["t"])
        audio = resample(audio, src_rate, rate)
        pieces.append(audio)
        position += audio.size / rate

        add_silence(float(line.get("pause", 0)))
        prev_speaker = speaker

        if i % 20 == 0 or i == total:
            print(f"  {i}/{total} lines · {mmss(position)}", flush=True)

    track = np.concatenate(pieces)

    # Gentle normalisation — leave headroom so the MP3 encoder has room.
    peak = float(np.max(np.abs(track))) or 1.0
    track = track * (0.89 / peak)

    stem = script["id"]
    wav_path = out_dir / f"{stem}.wav"
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((track * 32767).astype(np.int16).tobytes())

    import imageio_ffmpeg

    mp3_path = out_dir / f"{stem}.mp3"
    subprocess.run(
        [
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
            "-i", str(wav_path),
            "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "44100",
            str(mp3_path),
        ],
        check=True,
    )
    wav_path.unlink()

    meta = {
        "id": stem,
        "course": script["course"],
        "title": script["title"],
        "len": mmss(position),
        "seconds": int(position),
        "chapters": chapters,
    }
    meta_path = script_path.with_suffix(".chapters.json")
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")

    size_mb = mp3_path.stat().st_size / 1_000_000
    print(f"\n{mp3_path}  {meta['len']}  {size_mb:.1f} MB  {len(chapters)} chapters")
    print(f"{meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
