#!/usr/bin/env python3
"""Génère l'interview d'EXEMPLE importable dans l'aperçu web (fictive, voix de synthèse).
Sorties : assets/samples/podcast-ville.m4a et src/data/samplePodcast.json (minutages mesurés)."""
import array, importlib.util, json, os, subprocess, tempfile, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("demo", os.path.join(ROOT, "scripts", "generate-demo.py"))
demo = importlib.util.module_from_spec(spec); spec.loader.exec_module(demo)

LINES = [
    ("J", "Bienvenue dans Ville durable. Je reçois Inès Martin, maire d'une commune de douze mille habitants."),
    ("I", "Merci de m'accueillir. On parle souvent d'écologie en ville, moi je préfère parler de qualité de vie."),
    ("J", "Qu'avez-vous changé en premier ?"),
    ("I", "Les cours d'école. On a retiré le bitume et on a planté des arbres. Les enfants ont tout de suite vu la différence."),
    ("J", "Et à l'échelle de la ville ?"),
    ("I", "Nous avons planté dix mille arbres en trois ans. C'était notre promesse de campagne."),
    ("J", "Combien cela a-t-il coûté ?"),
    ("I", "Environ quatre cent mille euros, financés pour moitié par la région."),
    ("J", "Il y a eu des oppositions ?"),
    ("I", "Bien sûr. Certains commerçants avaient peur de perdre des places de parking. On a pris le temps de les écouter."),
    ("J", "Votre conseil à un autre maire ?"),
    ("I", "Commencez petit, montrez les résultats, et les habitants vous suivront."),
]
OUT_AUDIO = os.path.join(ROOT, "assets", "samples", "podcast-ville.m4a")
OUT_JSON = os.path.join(ROOT, "src", "data", "samplePodcast.json")

segments, timeline, t = [], [], 0.6
with tempfile.TemporaryDirectory() as tmp:
    for n, (who, text) in enumerate(LINES):
        samples = demo.tts(demo.VOICES[who], text, tmp, n)
        dur = len(samples) / demo.RATE
        segments.append({"start": round(t, 2), "end": round(t + dur, 2), "text": text.replace("'", "’")})
        timeline.append((t, samples)); t += dur + 0.7
    total = t + 1.0
    buf = array.array("h", bytes(int(total * demo.RATE) * 2))
    for start, s in timeline:
        off = int(round(start * demo.RATE)); buf[off:off + len(s)] = s
    mix = os.path.join(tmp, "mix.wav")
    with wave.open(mix, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(demo.RATE); w.writeframes(buf.tobytes())
    os.makedirs(os.path.dirname(OUT_AUDIO), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mix, "-c:a", "aac", "-b:a", "24k", "-ac", "1", "-ar", str(demo.RATE), OUT_AUDIO], check=True)
json.dump({"id": "podcast-ville", "title": "Exemple — Podcast « Ville durable » (fictif)", "fileName": "ville-durable-episode-12.m4a",
           "durationSec": round(total, 2), "segments": segments}, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{len(segments)} blocs, {total:.1f} s")
