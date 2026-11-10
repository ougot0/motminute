#!/usr/bin/env python3
"""Visuel PROVISOIRE de MotMinute (icône, splash). À remplacer par l'icône finale."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
PAPER = (246, 241, 231, 255)
INK = (42, 44, 48, 255)
BRICK = (158, 61, 23, 255)
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def mark(size, bg):
    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size / 1024
    quote = ImageFont.truetype(SERIF, int(560 * s))
    d.text((size / 2, size * 0.40), "«", font=quote, fill=INK, anchor="mm")
    # ligne de temps avec repère
    y = size * 0.70
    d.rounded_rectangle([size * 0.20, y - 10 * s, size * 0.80, y + 10 * s], radius=10 * s, fill=(225, 215, 197, 255))
    d.rounded_rectangle([size * 0.20, y - 10 * s, size * 0.56, y + 10 * s], radius=10 * s, fill=BRICK)
    d.ellipse([size * 0.56 - 30 * s, y - 30 * s, size * 0.56 + 30 * s, y + 30 * s], fill=BRICK)
    mono = ImageFont.truetype(MONO, int(92 * s))
    d.text((size / 2, size * 0.83), "18:42", font=mono, fill=BRICK, anchor="mm")
    return img


mark(1024, PAPER).convert("RGB").save(os.path.join(A, "icon.png"))
mark(1024, (0, 0, 0, 0)).save(os.path.join(A, "splash-icon.png"))
mark(1024, (0, 0, 0, 0)).save(os.path.join(A, "android-icon-foreground.png"))
Image.new("RGBA", (1024, 1024), PAPER).save(os.path.join(A, "android-icon-background.png"))
mono = mark(1024, (0, 0, 0, 0))
mono_px = Image.new("RGBA", mono.size, (0, 0, 0, 0))
mono_px.paste((255, 255, 255, 255), mask=mono.split()[3])
mono_px.save(os.path.join(A, "android-icon-monochrome.png"))
mark(48, PAPER).save(os.path.join(A, "favicon.png"))
print("icônes provisoires générées")
