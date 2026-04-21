#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import os, sys

# Generator of three feature graphics (1024x500)
# Outputs into resources/feature_graphics/


def find_font(size=40):
    candidates = []
    if os.name == 'nt':
        windir = os.environ.get('WINDIR', r'C:\Windows')
        base = os.path.join(windir, 'Fonts')
        candidates += [os.path.join(base, n) for n in ('arialbd.ttf','arial.ttf','verdana.ttf','Tahoma.ttf')]
    else:
        candidates += ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                       '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                       '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def average_color(img):
    img = img.convert('RGBA')
    bg = Image.new('RGBA', img.size, (255,255,255,255))
    bg.paste(img, (0,0), img)
    small = bg.resize((1,1), resample=Image.LANCZOS)
    r,g,b,a = small.getpixel((0,0))
    return (r,g,b)


def adjust_color(rgb, factor):
    def clamp(x):
        return int(max(0, min(255, x)))
    return (clamp(rgb[0]*factor), clamp(rgb[1]*factor), clamp(rgb[2]*factor))


def text_color_for_bg(rgb):
    r,g,b = rgb
    brightness = (r*299 + g*587 + b*114) / 1000
    return (0,0,0) if brightness > 150 else (255,255,255)


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    cur = ''
    for w in words:
        test = cur + (' ' if cur else '') + w
        bbox = draw.textbbox((0,0), test, font=font)
        wwidth = bbox[2] - bbox[0]
        if wwidth <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def save_png(im, path):
    im.save(path, format='PNG', optimize=True)


def create_minimal(icon, outpath):
    W,H = 1024,500
    bgc = average_color(icon)
    bg = adjust_color(bgc, 1.03)
    im = Image.new('RGB', (W,H), bg)
    draw = ImageDraw.Draw(im)

    icon_copy = icon.copy()
    max_icon = int(H*0.5)
    icon_copy.thumbnail((max_icon, max_icon), Image.LANCZOS)
    ix = (W - icon_copy.width)//2
    iy = int(H*0.12)
    im.paste(icon_copy, (ix,iy), icon_copy if icon_copy.mode=='RGBA' else None)

    title = 'El Palomar'
    subtitle = 'Organiza tu hogar y tus comidas'
    title_font = find_font(size=64)
    subtitle_font = find_font(size=28)
    tc = text_color_for_bg(bg)

    title_bbox = draw.textbbox((0,0), title, font=title_font)
    tx = (W - (title_bbox[2]-title_bbox[0]))//2
    ty = iy + icon_copy.height + 12
    draw.text((tx,ty), title, font=title_font, fill=tc)

    sub_bbox = draw.textbbox((0,0), subtitle, font=subtitle_font)
    sx = (W - (sub_bbox[2]-sub_bbox[0]))//2
    sy = ty + (title_bbox[3]-title_bbox[1]) + 8
    draw.text((sx,sy), subtitle, font=subtitle_font, fill=tc)

    save_png(im, outpath)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def create_functional(icon, outpath):
    W,H = 1024,500
    im = Image.new('RGB', (W,H), (250,250,250))
    draw = ImageDraw.Draw(im)

    left_w = int(W*0.54)
    left_h = int(H*0.78)
    left_x = 56
    left_y = (H - left_h)//2
    placeholder_color = (240,240,245)
    rounded_rect(draw, (left_x,left_y,left_x+left_w,left_y+left_h), radius=20, fill=placeholder_color)

    icon_copy = icon.copy()
    icon_size = int(left_h*0.18)
    icon_copy.thumbnail((icon_size,icon_size), Image.LANCZOS)
    ic_x = left_x + 18
    ic_y = left_y + 18
    im.paste(icon_copy, (ic_x, ic_y), icon_copy if icon_copy.mode=='RGBA' else None)

    right_x = left_x + left_w + 32
    max_width = W - right_x - 56
    title = 'Recetas • Compras • Tareas'
    subtitle = 'Todo en un solo lugar'
    title_font = find_font(size=48)
    subtitle_font = find_font(size=26)
    tc = (34,34,34)

    lines = wrap_text(draw, title, title_font, max_width)
    ty = left_y + 20
    for ln in lines:
        bbox = draw.textbbox((0,0), ln, font=title_font)
        draw.text((right_x, ty), ln, font=title_font, fill=tc)
        ty += (bbox[3]-bbox[1]) + 6

    draw.text((right_x, ty+6), subtitle, font=subtitle_font, fill=(90,90,90))

    save_png(im, outpath)


def linear_gradient(size, color1, color2):
    W,H = size
    base = Image.new('RGB', size, color1)
    top = Image.new('RGB', size, color2)
    mask = Image.linear_gradient('L').resize(size)
    return Image.composite(base, top, mask)


def create_promotional(icon, outpath):
    W,H = 1024,500
    avg = average_color(icon)
    c1 = avg
    c2 = adjust_color(avg, 0.6)
    bg = linear_gradient((W,H), c1, c2)
    im = bg
    draw = ImageDraw.Draw(im)

    icon_copy = icon.copy()
    icon_copy.thumbnail((96,96), Image.LANCZOS)
    im.paste(icon_copy, (36,36), icon_copy if icon_copy.mode=='RGBA' else None)

    headline = 'Ahorra tiempo en casa'
    sub = 'Planifica menús y gestiona el hogar fácilmente'
    title_font = find_font(size=72)
    subtitle_font = find_font(size=30)
    tc = text_color_for_bg(((c1[0]+c2[0])//2, (c1[1]+c2[1])//2, (c1[2]+c2[2])//2))

    lines = wrap_text(draw, headline, title_font, int(W*0.9))
    total_h = 0
    line_heights = []
    for ln in lines:
        bbox = draw.textbbox((0,0), ln, font=title_font)
        h = bbox[3]-bbox[1]
        line_heights.append(h)
        total_h += h + 6
    sub_h = draw.textbbox((0,0), sub, font=subtitle_font)[3]
    total_h += sub_h + 10

    start_y = (H - total_h)//2
    x_center = W//2
    y = start_y
    for i, ln in enumerate(lines):
        bbox = draw.textbbox((0,0), ln, font=title_font)
        w = bbox[2]-bbox[0]
        draw.text((x_center - w//2, y), ln, font=title_font, fill=tc)
        y += line_heights[i] + 6

    sbbox = draw.textbbox((0,0), sub, font=subtitle_font)
    sw = sbbox[2]-sbbox[0]
    draw.text((x_center - sw//2, y+8), sub, font=subtitle_font, fill=tc)

    save_png(im, outpath)


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(script_dir, '..'))
    icon_path = os.path.join(root, 'resources', 'icon.png')
    if not os.path.exists(icon_path):
        print('ERROR: icon not found at', icon_path)
        sys.exit(2)

    try:
        icon = Image.open(icon_path).convert('RGBA')
    except Exception as e:
        print('ERROR loading icon:', e)
        sys.exit(3)

    out_dir = os.path.join(root, 'resources', 'feature_graphics')
    os.makedirs(out_dir, exist_ok=True)

    files = []
    try:
        p1 = os.path.join(out_dir, 'feature_minimal.png')
        create_minimal(icon, p1)
        files.append(p1)

        p2 = os.path.join(out_dir, 'feature_functional.png')
        create_functional(icon, p2)
        files.append(p2)

        p3 = os.path.join(out_dir, 'feature_promotional.png')
        create_promotional(icon, p3)
        files.append(p3)

        print('Generated:', ', '.join(os.path.relpath(p, root) for p in files))
    except Exception as e:
        print('ERROR generating images:', e)
        sys.exit(4)

    sys.exit(0)
