"""The grand tour's narration, spoken by Qwen3-TTS on this machine (no cloud service).

    design   designs the narrator voices from a description, per language (once):
             voices/<voice>-<locale>.wav + .txt
    samples  speaks one sample per voice and language into work/samples/, to check them by ear
    build    speaks every text in texts.json in every voice; only the ones whose text, voice
             reference or model changed since the manifest was written
    speak    speaks the lines of a JSON file ([{"id", "text"}]) in one voice and language into a
             folder, as loudness-normalized WAV (the supercut's narration: --lines, --out)

--voices and --languages narrow any of them down (e.g. --languages German).

The clips go to packages/app/public/narration/<voice>/<locale>/<id>.webm (Opus) and .mp3,
loudness-normalized, with
packages/app/public/narration/manifest.json (each clip's hash and length; the app's tests check
the hashes against the texts, the tour paces itself by the lengths). See README.md.
"""

import argparse
import hashlib
import json
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

HERE = Path(__file__).resolve().parent
VOICES = HERE / "voices"
WORK = HERE / "work"
TEXTS = HERE / "texts.json"
APP_NARRATION = HERE.parent.parent / "app" / "public" / "narration"
MANIFEST = APP_NARRATION / "manifest.json"

DESIGN_MODEL = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
CLONE_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
# Opus for speech (better than MP3 at half the size), MP3 for browsers without it; the app picks.
# A change here makes every clip stale.
ENCODING = "opus-32k.webm+mp3-64k"
SEED = 1977  # the year the Voyagers set off

# The narrators: two documentary voices, calm and full of wonder, named for constellations. Each is
# designed once per language, from a description and a line in that language - a reference in
# English would carry an English accent into every other language. The clone model learns the
# voice from that line.
VOICE_DESIGNS = {
    "lyra": "A warm, calm female documentary narrator in her forties, with a clear, rich voice. "
    "She speaks slowly and clearly, with quiet wonder, like a planetarium show.",
    "orion": "A warm, calm male documentary narrator in his fifties, with a deep, resonant voice. "
    "He speaks slowly and clearly, with quiet wonder, like a planetarium show.",
}
# Where one voice in one language needs its own description: Lyra's British English came out too
# bright from the shared one; this darker take was picked by ear (seed 1977).
DESIGN_OVERRIDES = {
    ("lyra", "English"): "A warm, calm female documentary narrator in her forties. She speaks slowly and clearly, "
    "with quiet wonder, like a planetarium show. Her voice is low-pitched, dark and velvety, with a rich chest "
    "resonance - not bright, not airy. A native British English speaker: Received Pronunciation, like a BBC "
    "nature documentary.",
}
# Per language: its code in the app, the reference line, and how the narrator speaks it.
LANGUAGES = {
    "English": (
        "en",
        "Far beyond the clouds, the planets wander on their ancient paths around the Sun. "
        "Tonight, we shall visit every one of them.",
        " A native British English speaker: Received Pronunciation, like a BBC nature documentary, "
        "no American accent at all.",
    ),
    "German": (
        "de",
        "Weit jenseits der Wolken ziehen die Planeten auf ihren uralten Bahnen um die Sonne. "
        "Heute Nacht besuchen wir jeden einzelnen von ihnen.",
        " A native German speaker from Germany: flawless standard High German pronunciation, "
        "a natural German r, no foreign accent at all.",
    ),
}
SAMPLE_LINES = {
    "English": "The Sun holds 99.8 percent of the Solar System's mass. Uranus was discovered in 1781, "
    "and Neptune winds reach 2,000 kilometers an hour.",
    "German": "Die Sonne enthält 99,8 Prozent der Masse des Sonnensystems. Uranus wurde 1781 entdeckt, "
    "und auf Neptun erreichen die Winde 2.000 Kilometer pro Stunde. Wirklich wunderbar.",
}


def device() -> str:
    return "mps" if torch.backends.mps.is_available() else "cpu"


def load(model_id: str) -> Qwen3TTSModel:
    print(f"Loading {model_id} on {device()} …", flush=True)
    return Qwen3TTSModel.from_pretrained(model_id, device_map=device(), dtype=torch.bfloat16, attn_implementation="sdpa")


def seeded() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


def design(args: argparse.Namespace) -> None:
    VOICES.mkdir(exist_ok=True)
    model = load(DESIGN_MODEL)
    for voice in args.voices:
        for language in args.languages:
            code, line, accent = LANGUAGES[language]
            seeded()
            instruct = DESIGN_OVERRIDES.get((voice, language), VOICE_DESIGNS[voice] + accent)
            wavs, rate = model.generate_voice_design(text=line, language=language, instruct=instruct)
            sf.write(reference_path(voice, code), wavs[0], rate)
            reference_path(voice, code).with_suffix(".txt").write_text(line + "\n")
            print(f"Designed {reference_path(voice, code).relative_to(HERE)}", flush=True)


def reference_path(voice: str, code: str) -> Path:
    return VOICES / f"{voice}-{code}.wav"


def reference_hash(voice: str, code: str) -> str:
    return hashlib.sha256(reference_path(voice, code).read_bytes()).hexdigest()[:16]


def clone_prompt(model: Qwen3TTSModel, voice: str, code: str):
    reference = reference_path(voice, code)
    if not reference.exists():
        sys.exit(f"No {reference.relative_to(HERE)} - run `design` first.")
    return model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=reference.with_suffix(".txt").read_text().strip())


def speak(model: Qwen3TTSModel, prompt, text: str, language: str) -> tuple[np.ndarray, int]:
    seeded()
    wavs, rate = model.generate_voice_clone(text=text, language=language, voice_clone_prompt=prompt, max_new_tokens=4096)
    return wavs[0], rate


def samples(args: argparse.Namespace) -> None:
    out = WORK / "samples"
    out.mkdir(parents=True, exist_ok=True)
    model = load(CLONE_MODEL)
    for voice in args.voices:
        for language in args.languages:
            code = LANGUAGES[language][0]
            audio, rate = speak(model, clone_prompt(model, voice, code), SAMPLE_LINES[language], language)
            path = out / f"{voice}-{code}.wav"
            sf.write(path, audio, rate)
            print(f"Wrote {path}", flush=True)


def clip_hash(text: str, voice: str, reference: str) -> str:
    # The app's manifest test computes the same (packages/app/test/narrationManifest.test.ts).
    return hashlib.sha256(f"{CLONE_MODEL}\n{ENCODING}\n{voice}\n{reference}\n{text}".encode()).hexdigest()[:16]


def encode(audio: np.ndarray, rate: int, master: Path, target: Path) -> float:
    """Keeps the lossless master (work/masters/, to re-encode without speaking again) and writes
    target.webm (Opus) and target.mp3, loudness-normalized once for both."""
    for path in (master, target):
        path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(master, audio, rate)
    loudness = "loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[opus][mp3]"
    command = [
        FFMPEG, "-loglevel", "error", "-y", "-i", str(master), "-filter_complex", loudness, "-map_metadata", "-1",
        "-map", "[opus]", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k",
        str(target.with_suffix(".webm")),
        "-map", "[mp3]", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", str(target.with_suffix(".mp3")),
    ]
    # close_fds=False and ffmpeg's full path let Python start it with posix_spawn instead of
    # fork: on macOS a forked child of this many-threaded process (PyTorch, Metal) can crash
    # in malloc before it ever runs ffmpeg.
    subprocess.run(command, check=True, close_fds=False)
    return round(len(audio) / rate, 2)


def build(args: argparse.Namespace) -> None:
    texts = [t for t in json.loads(TEXTS.read_text()) if t["language"] in args.languages]
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    if manifest.get("model") != CLONE_MODEL or manifest.get("encoding") != ENCODING:
        manifest = {"model": CLONE_MODEL, "encoding": ENCODING, "voices": {}}
    model = None
    for voice in args.voices:
        entry = manifest["voices"].setdefault(voice, {"references": {}, "clips": {}})
        for language in args.languages:
            code = LANGUAGES[language][0]
            entry["references"][code] = reference_hash(voice, code)
        todo = [t for t in texts if entry["clips"].get(t["locale"], {}).get(t["id"], {}).get("hash") != clip_hash(t["text"], voice, entry["references"][t["locale"]])]
        print(f"{voice}: {len(todo)} of {len(texts)} clips to speak", flush=True)
        prompts = {}
        for number, text in enumerate(todo, 1):
            model = model or load(CLONE_MODEL)
            prompt = prompts.get(text["locale"]) or prompts.setdefault(text["locale"], clone_prompt(model, voice, text["locale"]))
            audio, rate = speak(model, prompt, text["text"], text["language"])
            place = Path(voice) / text["locale"] / text["id"]
            seconds = encode(audio, rate, (WORK / "masters" / place).with_suffix(".wav"), APP_NARRATION / place)
            entry["clips"].setdefault(text["locale"], {})[text["id"]] = {"hash": clip_hash(text["text"], voice, entry["references"][text["locale"]]), "seconds": seconds}
            MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
            print(f"[{number}/{len(todo)}] {voice}/{text['locale']}/{text['id']}: {seconds} s", flush=True)


def speak_lines(args: argparse.Namespace) -> None:
    voice, language = args.voices[0], args.languages[0]
    code = LANGUAGES[language][0]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model = load(CLONE_MODEL)
    prompt = clone_prompt(model, voice, code)
    for line in json.loads(Path(args.lines).read_text()):
        audio, rate = speak(model, prompt, line["text"], language)
        raw = out / f"{line['id']}.raw.wav"
        sf.write(raw, audio, rate)
        target = out / f"{line['id']}.wav"
        command = [FFMPEG, "-loglevel", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", str(target)]
        subprocess.run(command, check=True, close_fds=False)
        raw.unlink()
        print(f"{target}: {round(len(audio) / rate, 2)} s", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    # Each takes one value and may be repeated (--languages German --languages English).
    parser.add_argument("--voices", action="append", choices=sorted(VOICE_DESIGNS))
    parser.add_argument("--languages", action="append", choices=sorted(LANGUAGES))
    commands = parser.add_subparsers(required=True)
    commands.add_parser("design").set_defaults(run=design)
    commands.add_parser("samples").set_defaults(run=samples)
    commands.add_parser("build").set_defaults(run=build)
    speak_parser = commands.add_parser("speak")
    speak_parser.add_argument("--lines", required=True)
    speak_parser.add_argument("--out", required=True)
    speak_parser.set_defaults(run=speak_lines)
    args = parser.parse_args()
    args.voices = args.voices or sorted(VOICE_DESIGNS)
    args.languages = args.languages or sorted(LANGUAGES)
    args.run(args)


if __name__ == "__main__":
    main()
