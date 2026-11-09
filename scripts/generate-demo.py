#!/usr/bin/env python3
"""
Génère l'interview démo FICTIVE de MotMinute :
  - assets/demo/demo-interview.m4a  (voix de synthèse espeak-ng + MBROLA)
  - src/data/demoTranscript.json    (blocs minutés)

Les minutages de la transcription sont mesurés sur l'audio produit (début et
fin réels de la parole de chaque bloc), pas estimés. La citation clé est
placée exactement à 18:42.

Prérequis (Linux) : apt-get install espeak-ng mbrola-fr1 mbrola-fr4 ffmpeg
Usage : python3 scripts/generate-demo.py
"""
import array
import json
import os
import subprocess
import tempfile
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_AUDIO = os.path.join(ROOT, "assets", "demo", "demo-interview.m4a")
OUT_JSON = os.path.join(ROOT, "src", "data", "demoTranscript.json")
RATE = 16000
GAP = 0.8  # silence entre deux répliques d'un même chapitre

JOURNALISTE = "mb-fr4"
INVITE = "mb-fr1"
J, I = "J", "I"
VOICES = {J: JOURNALISTE, I: INVITE}

# Chapitres : (ancre en secondes, index du bloc ancré, blocs)
# Le bloc ancré commence exactement à l'ancre ; les autres sont posés autour.
CHAPTERS = [
    (0.5, 0, [
        (J, "Bonjour Marc Delaunay, et merci d'avoir accepté cet entretien."),
        (I, "Merci à vous. Je vous remercie de m'avoir invité, ce n'est pas un exercice facile pour moi."),
        (J, "Vous avez passé douze ans chez Varennes Industries. Comment êtes-vous arrivé là-bas ?"),
        (I, "J'ai quitté Lyon en 2011 pour Paris. J'ai été recruté comme chargé de communication, et le premier jour, je ne connaissais personne."),
    ]),
    (190.0, 0, [
        (J, "Pourquoi avez-vous accepté ce poste à l'époque ?"),
        (I, "Honnêtement, pour le salaire. Je gagnais à peine deux mille euros par mois dans mon ancien journal."),
        (I, "Et puis j'aimais l'idée de raconter l'industrie, les usines, les gens qui y travaillent."),
    ]),
    (465.0, 0, [
        (J, "Vous devenez directeur de la communication en 2017."),
        (I, "Oui. C'était une fierté, je ne vais pas le cacher. Mais c'est aussi là que les choses se compliquent."),
        (I, "La direction voulait des messages très lisses, même quand la réalité ne l'était pas."),
    ]),
    (740.0, 0, [
        (J, "Parlons de la fermeture du site de Saint-Aubin."),
        (I, "La décision a été prise à l'automne 2019, en comité restreint. On m'a demandé de la présenter comme une simple réorganisation."),
        (I, "Il y a eu une démission collective du comité d'entreprise quelques semaines plus tard."),
        (I, "J'avais la trouille, je vous l'avoue. Trois cents familles étaient concernées."),
    ]),
    (930.0, 0, [
        (J, "Est-ce que vous avez essayé de vous y opposer ?"),
        (I, "J'ai écrit une note interne. Elle est restée sans réponse."),
        (I, "C'est une décision collective, m'a-t-on répondu ensuite, et vous n'avez pas à la discuter."),
    ]),
    (1122.0, 2, [
        (J, "Et puis il y a ce matin de janvier 2020."),
        (I, "Je suis entré dans le bureau du président avec une lettre."),
        (I, "J'ai quitté mon poste parce que je ne pouvais plus défendre cette décision."),
        (I, "Mon adjoint, lui, a été remercié six mois plus tard."),
    ]),
    (1260.0, 0, [
        (J, "Est-ce que vous regrettez ?"),
        (I, "Aucun regret. Si c'était à refaire, je partirais peut-être même plus tôt."),
        (I, "Aujourd'hui je forme de jeunes journalistes, et je leur dis de ne jamais signer un texte qu'ils ne pourraient pas défendre."),
        (J, "Marc Delaunay, merci."),
    ]),
]


def tts(voice: str, text: str, tmpdir: str, n: int):
    raw = os.path.join(tmpdir, f"raw{n}.wav")
    out = os.path.join(tmpdir, f"seg{n}.wav")
    subprocess.run(["espeak-ng", "-v", voice, "-s", "155", "-w", raw, text], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", out], check=True)
    with wave.open(out, "rb") as w:
        samples = array.array("h", w.readframes(w.getnframes()))
    # Bornes réelles de la parole (seuil d'amplitude)
    thr = 400
    first = next((i for i, s in enumerate(samples) if abs(s) > thr), 0)
    last = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > thr), len(samples) - 1)
    return samples[first:last + 1]


def main():
    segments = []
    timeline = []  # (start_sec, samples)
    with tempfile.TemporaryDirectory() as tmp:
        n = 0
        for anchor, anchor_idx, lines in CHAPTERS:
            clips = []
            for speaker, text in lines:
                clips.append((speaker, text, tts(VOICES[speaker], text, tmp, n)))
                n += 1
            starts = [0.0] * len(clips)
            starts[anchor_idx] = anchor
            for k in range(anchor_idx - 1, -1, -1):
                starts[k] = starts[k + 1] - GAP - len(clips[k][2]) / RATE
            for k in range(anchor_idx + 1, len(clips)):
                starts[k] = starts[k - 1] + len(clips[k - 1][2]) / RATE + GAP
            for (speaker, text, samples), start in zip(clips, starts):
                start = round(start, 2)
                end = round(start + len(samples) / RATE, 2)
                if segments and start < segments[-1]["end"]:
                    raise SystemExit(f"Chevauchement avant {start}s : {text}")
                segments.append({"start": start, "end": end, "speaker": "Journaliste" if speaker == J else "Invité", "text": text.replace("'", "’")})
                timeline.append((start, samples))

        total = segments[-1]["end"] + 2.0
        buf = array.array("h", bytes(int(total * RATE) * 2))
        for start, samples in timeline:
            off = int(round(start * RATE))
            buf[off:off + len(samples)] = samples
        mix = os.path.join(tmp, "mix.wav")
        with wave.open(mix, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(buf.tobytes())
        os.makedirs(os.path.dirname(OUT_AUDIO), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mix, "-c:a", "aac", "-b:a", "24k", "-ac", "1", "-ar", str(RATE), "-movflags", "+faststart", OUT_AUDIO], check=True)

    data = {
        "title": "Démo — Marc Delaunay, ex-directeur de la communication (fictif)",
        "durationSec": round(total, 2),
        "note": "Interview fictive, voix de synthèse. Minutages mesurés sur l'audio généré.",
        "segments": segments,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{len(segments)} blocs, durée {total:.1f}s → {OUT_AUDIO}")
    key = next(s for s in segments if s["text"].startswith("J’ai quitté mon poste"))
    print(f"Citation clé à {key['start']}s")


if __name__ == "__main__":
    main()
