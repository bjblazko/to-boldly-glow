# Narration

The grand tour's narrator is spoken by [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
(Apache-2.0, code and weights) on your own machine - no cloud service. The clips are committed
(`packages/app/public/narration/`), so building the app and CI need none of this; only changing a
narration text does.

The texts live in the app: `packages/app/src/narration/scripts/<locale>.ts`. A unit test
(`packages/app/test/narrationManifest.test.ts`) fails while a text has no up-to-date clip.

## Setup (once)

Python 3.12 (PyTorch has no wheels for newer ones yet), then:

```sh
cd packages/data-pipeline
python3.12 -m venv narration/.venv
narration/.venv/bin/pip install --no-deps -r narration/requirements.txt
```

`requirements.txt` pins every package, so `--no-deps` installs exactly that list. It has to: Pillow
is at 13 for its security fixes, while gradio 6.17.3 (which qwen-tts pulls in for its web demo, never
loaded here) caps it below 13 - and the gradio releases that allow Pillow 13 need a newer
huggingface-hub than transformers 4.57.3 takes. qwen-tts 0.1.1 pins transformers 4.57.3 exactly and
does not run on transformers 5 (`check_model_inputs` changed); move on once a qwen-tts release does.
Tested 2026-11-20: Pillow 13 changes no sample of the spoken clips.

The models (several GB) download from Hugging Face on first use, into `~/.cache/huggingface`.
On Apple silicon they run on the GPU (MPS); 8 GB of memory is enough.

## Voices

Two narrators, Lyra and Orion, are designed from a description by the 1.7B VoiceDesign model, once
per language, and kept in `voices/` (`<voice>-<locale>.wav` and the line it says, `.txt`). The
reference is spoken in its own language: one in English would carry an English accent into
German. Every clip is then spoken by the 0.6B Base model, cloning that reference - the same voice
in every run.

```sh
narration/.venv/bin/python narration/synthesize.py design                       # every voice and language
narration/.venv/bin/python narration/synthesize.py --languages German samples    # work/samples/: listen
```

## Speaking the clips

```sh
npm run narrate      # in packages/data-pipeline
```

exports the texts (`narration/texts.json`) and speaks, in every voice, those whose text, voice
reference or model changed since `packages/app/public/narration/manifest.json` was written -
loudness-normalized (−16 LUFS), as mono Opus at 32 kbit/s in WebM (libopus) and as MP3 at 64
kbit/s (LAME), both by ffmpeg; the app plays Opus where the browser can and MP3 elsewhere. The
lossless takes stay in `work/masters/` (not committed), to re-encode without speaking again. The manifest records each clip's hash and length;
the tour paces itself by the lengths.

A new language: add its script and catalog in the app, its name in `TTS_LANGUAGES`
(`narrationSegments.ts`), and run `npm run narrate` again.
