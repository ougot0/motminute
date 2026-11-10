#!/usr/bin/env python3
"""Redessine le symbole MotMinute (onde blanche + point menthe) sur fond TRANSPARENT,
pour l'écran de lancement : assets/splash-logo.png (et un aperçu sur fond bleu).
Coordonnées relevées sur l'icône d'origine (1254 × 1254). À remplacer par le fichier
vectoriel du logo dès qu'il est disponible."""
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WHITE, MINT, BLUE = (255, 255, 255, 255), (99, 240, 199, 255), (43, 0, 255, 255)
STROKE = 60
SS = 4  # suréchantillonnage pour des bords lisses

def line(a, b):
    n = max(2, int(math.dist(a, b)))
    return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]

def arc(c, r, t0, t1):
    n = max(8, int(abs(t1 - t0) * r))
    return [(c[0] + r * math.cos(t0 + (t1 - t0) * i / n), c[1] - r * math.sin(t0 + (t1 - t0) * i / n)) for i in range(n + 1)]

pi = math.pi
path = (
    line((260, 745), (260, 600)) + arc((344, 600), 84, pi, 0) + line((428, 600), (428, 715))
    + arc((478, 715), 50, pi, 2 * pi) + line((528, 715), (528, 500)) + arc((612, 500), 84, pi, 0)
    + line((696, 500), (696, 715)) + arc((741, 715), 45, pi, 2 * pi) + line((786, 715), (786, 608))
    + arc((856, 608), 70, pi, 0) + line((926, 608), (926, 688)) + arc((948, 688), 22, pi, 1.45 * pi)
)
DOT = ((1015, 715), 27)
X0, Y0, X1, Y1 = 220, 376, 1052, 815  # cadre du symbole (avec marge)

def render(bg):
    w, h = (X1 - X0) * SS, (Y1 - Y0) * SS
    img = Image.new("RGBA", (w, h), bg)
    d = ImageDraw.Draw(img)
    r = STROKE / 2 * SS
    for x, y in path:
        cx, cy = (x - X0) * SS, (y - Y0) * SS
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    (dx, dy), dr = DOT
    d.ellipse([(dx - X0 - dr) * SS, (dy - Y0 - dr) * SS, (dx - X0 + dr) * SS, (dy - Y0 + dr) * SS], fill=MINT)
    return img.resize((w // SS * 3 // 2, h // SS * 3 // 2), Image.LANCZOS)  # 1248 px de large

render((0, 0, 0, 0)).save(os.path.join(ROOT, "assets", "splash-logo.png"))
print("assets/splash-logo.png", render((0, 0, 0, 0)).size)
