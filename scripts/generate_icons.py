"""
Genera todos los iconos PWA (webp) y los launcher icons de Android (PNG)
para El Palomar usando el logo SVG de www/Captura.svg.

Dependencias: Pillow, pycairo  (instalados en .venv)
Uso:
    python scripts/generate_icons.py
"""

import re, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
import cairo

# ── Palette ───────────────────────────────────────────────────────────────────
ACCENT    = (196, 98, 45)    # --brand-accent  #C4622D
HIGHLIGHT = (215, 120, 65)   # warm top highlight
TRANS     = (0, 0, 0, 0)

RENDER   = 4096   # internal canvas (supersampled)
ROOT     = Path(__file__).resolve().parent.parent
SVG_LOGO = ROOT / "www" / "favicon.svg"


# ── SVG path renderer (pycairo) ───────────────────────────────────────────────

def _apply_transform(ctx, t):
    """Apply a single SVG transform string to the Cairo context."""
    for m in re.finditer(r'(\w+)\(([^)]+)\)', t):
        name, raw = m.group(1), m.group(2)
        vals = [float(v.strip().replace(',', '')) for v in re.split(r'[\s,]+', raw.strip()) if v]
        if name == 'translate':
            ctx.translate(vals[0], vals[1] if len(vals) > 1 else 0)
        elif name == 'scale':
            ctx.scale(vals[0], vals[1] if len(vals) > 1 else vals[0])
        elif name == 'matrix' and len(vals) == 6:
            ctx.transform(cairo.Matrix(*vals))


def _draw_path(ctx, d):
    """Parse SVG path data string and issue Cairo drawing commands."""
    tokens = re.findall(
        r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?',
        d
    )
    i = 0
    n = len(tokens)
    cx, cy = 0.0, 0.0   # current point
    sx, sy = 0.0, 0.0   # subpath start
    px2 = py2 = 0.0     # last cubic control point (for S)
    cmd = 'M'

    def nf():
        nonlocal i
        v = float(tokens[i]); i += 1; return v

    def peek():
        return i < n and not tokens[i].isalpha()

    while i < n:
        if tokens[i].isalpha():
            cmd = tokens[i]; i += 1
        ab = cmd.isupper()

        if cmd in 'Mm':
            dx, dy = nf(), nf()
            cx, cy = (dx, dy) if ab else (cx+dx, cy+dy)
            ctx.move_to(cx, cy); sx, sy = cx, cy
            cmd = 'L' if ab else 'l'

        elif cmd in 'Ll':
            while peek():
                dx, dy = nf(), nf()
                cx, cy = (dx, dy) if ab else (cx+dx, cy+dy)
                ctx.line_to(cx, cy)

        elif cmd in 'Hh':
            while peek():
                v = nf(); cx = v if ab else cx+v
                ctx.line_to(cx, cy)

        elif cmd in 'Vv':
            while peek():
                v = nf(); cy = v if ab else cy+v
                ctx.line_to(cx, cy)

        elif cmd in 'Cc':
            while peek():
                dx1,dy1,dx2,dy2,dx,dy = nf(),nf(),nf(),nf(),nf(),nf()
                if ab:
                    x1,y1,x2,y2,ex,ey = dx1,dy1,dx2,dy2,dx,dy
                else:
                    x1,y1 = cx+dx1,cy+dy1; x2,y2 = cx+dx2,cy+dy2
                    ex,ey = cx+dx, cy+dy
                ctx.curve_to(x1,y1,x2,y2,ex,ey)
                px2,py2 = x2,y2; cx,cy = ex,ey

        elif cmd in 'Ss':
            while peek():
                dx2,dy2,dx,dy = nf(),nf(),nf(),nf()
                x1,y1 = 2*cx-px2, 2*cy-py2
                if ab:
                    x2,y2,ex,ey = dx2,dy2,dx,dy
                else:
                    x2,y2 = cx+dx2,cy+dy2; ex,ey = cx+dx,cy+dy
                ctx.curve_to(x1,y1,x2,y2,ex,ey)
                px2,py2 = x2,y2; cx,cy = ex,ey

        elif cmd in 'Qq':
            while peek():
                dx1,dy1,dx,dy = nf(),nf(),nf(),nf()
                if ab: qx,qy,ex,ey = dx1,dy1,dx,dy
                else:  qx,qy = cx+dx1,cy+dy1; ex,ey = cx+dx,cy+dy
                # Convert quadratic to cubic
                ctx.curve_to(
                    cx+(2/3)*(qx-cx), cy+(2/3)*(qy-cy),
                    ex+(2/3)*(qx-ex), ey+(2/3)*(qy-ey),
                    ex, ey
                )
                px2,py2 = ex+(2/3)*(qx-ex), ey+(2/3)*(qy-ey)
                cx,cy = ex,ey

        elif cmd in 'Zz':
            ctx.close_path(); cx,cy = sx,sy

        else:
            # Skip unsupported command args
            while peek(): i += 1


def svg_to_pil_white(svg_path: Path, pixel_size: int) -> Image.Image:
    """
    Renders svg_path with all paths in white on a transparent background.
    Returns a pixel_size x pixel_size RGBA PIL image.
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # ViewBox
    vb_attr = root.get('viewBox', '0 0 100 100')
    vb = [float(v) for v in vb_attr.split()]
    vb_w, vb_h = vb[2], vb[3]

    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, pixel_size, pixel_size)
    ctx  = cairo.Context(surf)

    # Fit viewBox inside pixel_size, centred
    scale  = pixel_size / max(vb_w, vb_h)
    off_x  = (pixel_size - vb_w * scale) / 2
    off_y  = (pixel_size - vb_h * scale) / 2
    ctx.translate(off_x, off_y)
    ctx.scale(scale, scale)

    # Namespace stripping helper
    def local(tag):
        return tag.split('}')[-1] if '}' in tag else tag

    def render_elem(elem, inherited_fill=(1, 1, 1)):
        t = elem.get('transform', '')
        if t:
            ctx.save(); _apply_transform(ctx, t)

        for child in elem:
            ltag = local(child.tag)
            if ltag == 'g':
                render_elem(child, inherited_fill)
            elif ltag == 'path':
                d = child.get('d', '')
                fill_attr = child.get('fill', '').strip().lower()
                if fill_attr == 'none':
                    if t: ctx.restore()
                    continue
                # Always paint white regardless of original fill
                ctx.set_source_rgba(1, 1, 1, 1)
                _draw_path(ctx, d)
                ctx.fill()

        if t:
            ctx.restore()

    # Also render direct <path> children of root
    ctx.set_source_rgba(1, 1, 1, 1)
    for child in root:
        ltag = local(child.tag)
        if ltag == 'g':
            render_elem(child)
        elif ltag == 'path':
            fill_attr = child.get('fill', '').strip().lower()
            if fill_attr != 'none':
                _draw_path(ctx, child.get('d', ''))
                ctx.fill()

    # Cairo ARGB32 → PIL RGBA
    buf = surf.get_data()
    img = Image.frombuffer('RGBA', (pixel_size, pixel_size), bytes(buf), 'raw', 'BGRA', 0, 1)
    return img.copy()


# ── Icon rendering ────────────────────────────────────────────────────────────

from PIL import ImageDraw

def render_icon(size: int) -> Image.Image:
    """Render one square icon at `size` px."""
    img  = Image.new('RGBA', (RENDER, RENDER), TRANS)
    draw = ImageDraw.Draw(img)

    # Background: rounded terracotta only (no semi-transparent highlight —
    # ImageDraw does not alpha-composite, it would overwrite opaque pixels with
    # semi-transparent ones, making the top appear dark on any dark background)
    R = int(RENDER * 0.195)
    ac = ACCENT + (255,)
    draw.rounded_rectangle([0, 0, RENDER-1, RENDER-1], radius=R, fill=ac)

    # Logo: white, ~76% of canvas
    logo_px  = int(RENDER * 0.76)
    logo_img = svg_to_pil_white(SVG_LOGO, logo_px)
    ox = (RENDER - logo_img.width)  // 2
    oy = (RENDER - logo_img.height) // 2
    img.paste(logo_img, (ox, oy), mask=logo_img)

    return img.resize((size, size), Image.LANCZOS)


# ── Output paths ──────────────────────────────────────────────────────────────

PWA_DIR     = ROOT / "www" / "icons"
ANDROID_SRC = ROOT / "android" / "app" / "src" / "main"

PWA_SIZES = [48, 72, 96, 128, 192, 256, 512]
MIPMAP_DIRS = {
    "mipmap-mdpi":     48,
    "mipmap-hdpi":     72,
    "mipmap-xhdpi":    96,
    "mipmap-xxhdpi":   144,
    "mipmap-xxxhdpi":  192,
}


def main():
    cache: dict[int, Image.Image] = {}
    def get(s):
        if s not in cache: cache[s] = render_icon(s)
        return cache[s]

    PWA_DIR.mkdir(parents=True, exist_ok=True)
    for sz in PWA_SIZES:
        dest = PWA_DIR / f"icon-{sz}.webp"
        get(sz).save(dest, "WEBP", quality=95, method=6)
        print(f"  ok  {dest.relative_to(ROOT)}")

    get(32).save(PWA_DIR / "favicon.png", "PNG")
    print(f"  ok  www/icons/favicon.png")

    res_dir = ANDROID_SRC / "res"
    if not res_dir.exists():
        print(f"  warning: Android res dir not found; skipping mipmaps.")
    else:
        for folder, sz in MIPMAP_DIRS.items():
            out = res_dir / folder
            out.mkdir(parents=True, exist_ok=True)
            get(sz).save(out / "ic_launcher.png", "PNG")
            print(f"  ok  android/.../res/{folder}/ic_launcher.png  ({sz}px)")

    resources_dir = ROOT / "resources"
    resources_dir.mkdir(exist_ok=True)
    get(512).save(resources_dir / "icon.png", "PNG")
    print(f"  ok  resources/icon.png  (512px)")
    print("\nAll icons generated.")


if __name__ == "__main__":
    main()
