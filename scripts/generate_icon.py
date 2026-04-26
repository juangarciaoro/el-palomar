"""
Genera resources/icon.png (1024x1024) con el glífo de la casa de El Palomar.
Técnica: polígonos rellenos + supersampling 4x, sin strokes Pillow.
"""
import os, math
from PIL import Image, ImageDraw

# Raíz del proyecto (un nivel arriba de scripts/)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RENDER = 4096
OUT    = 1024
ACCENT = (196, 98, 45, 255)
WHITE  = (255, 255, 255, 255)

img  = Image.new("RGBA", (RENDER, RENDER), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

R_BG = int(RENDER * 0.195)
draw.rounded_rectangle([0, 0, RENDER-1, RENDER-1], radius=R_BG, fill=ACCENT)

S = RENDER / 32  # escala: viewport 32x32 -> RENDER px

def v(x, y):
    return (x * S, y * S)

def thick_line(x0, y0, x1, y1, w, color=WHITE):
    px0, py0 = x0*S, y0*S
    px1, py1 = x1*S, y1*S
    hw = w * S / 2
    dx, dy = px1-px0, py1-py0
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux, uy = -dy/length, dx/length
    poly = [
        (px0+ux*hw, py0+uy*hw),
        (px1+ux*hw, py1+uy*hw),
        (px1-ux*hw, py1-uy*hw),
        (px0-ux*hw, py0-uy*hw),
    ]
    draw.polygon(poly, fill=color)
    draw.ellipse([px0-hw, py0-hw, px0+hw, py0+hw], fill=color)
    draw.ellipse([px1-hw, py1-hw, px1+hw, py1+hw], fill=color)

def thick_arc(cx, cy, r, a0, a1, w, color=WHITE, steps=120):
    pcx, pcy = cx*S, cy*S
    pr = r*S
    hw = w*S/2
    angles = [a0 + (a1-a0)*i/steps for i in range(steps+1)]
    outer = [(pcx+(pr+hw)*math.cos(a), pcy-(pr+hw)*math.sin(a)) for a in angles]
    inner = [(pcx+(pr-hw)*math.cos(a), pcy-(pr-hw)*math.sin(a)) for a in angles]
    draw.polygon(outer + list(reversed(inner)), fill=color)
    for a in [a0, a1]:
        ex, ey = pcx+pr*math.cos(a), pcy-pr*math.sin(a)
        draw.ellipse([ex-hw, ey-hw, ex+hw, ey+hw], fill=color)

SW  = 2.05
SW2 = 1.50

# tejado
thick_line(4,16, 16,6, SW)
thick_line(16,6, 28,16, SW)

# paredes
thick_line(7,16, 7,26, SW)
thick_line(7,26, 25,26, SW)
thick_line(25,26, 25,16, SW)

# ventana
for seg in [((19,18),(22,18)),((22,18),(22,21)),((22,21),(19,21)),((19,21),(19,18))]:
    (ax,ay),(bx,by) = seg
    thick_line(ax,ay, bx,by, SW2)

# puerta
thick_line(14,26, 14,21, SW2)
thick_line(18,21, 18,26, SW2)
thick_arc(cx=16, cy=21, r=2, a0=0, a1=math.pi, w=SW2)

result = img.resize((OUT, OUT), Image.LANCZOS)
os.makedirs(os.path.join(ROOT, "resources"), exist_ok=True)
result.save(os.path.join(ROOT, "resources", "icon.png"), "PNG")
print(f"✓  resources/icon.png  ({OUT}x{OUT} px)")
