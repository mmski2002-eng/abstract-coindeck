#!/usr/bin/env python3
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PUBLIC    = r"C:\ABSTRACT_COINDECK\frontend\public"
CARDS_DIR = os.path.join(PUBLIC, "cards-anim")
W, H      = 300, 300
FRAMES    = 24
FPS_MS    = 55

FILLS     = ["#D9D3C2", "#7AC7E8", "#26C6A8", "#88FC00"]
LABELS    = ["Small",   "Medium",  "Heavy",   "Super Heavy"]
EGG_SIZES = [100, 125, 150, 180]

PID    = 49
TICKER = "MOVE"
NAME   = "Movement"
COLOR  = "#00c2d7"
ICON   = r"C:\ABSTRACT_COINDECK\frontend\public\coins\49_MOVE.webp"

ARIAL  = "C:/Windows/Fonts/arialbd.ttf"
IMPACT = "C:/Windows/Fonts/impact.ttf"

def load_font(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

font_rarity = load_font(ARIAL, 12)
font_name   = load_font(ARIAL, 18)
font_brand  = load_font(IMPACT, 26)
font_ticker = load_font(IMPACT, 48)

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))

def draw_dots(draw, bg_rgb):
    r,g,b = bg_rgb
    dc = (max(0,r-35), max(0,g-35), max(0,b-35), 50)
    for y in range(0, H, 14):
        for x in range(0, W, 14):
            draw.ellipse([x, y, x+1, y+1], fill=dc)

def make_halo(egg_size):
    s = int(egg_size * 1.6)
    layer = Image.new("RGBA", (s, s), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    cx, cy = s//2, s//2
    for i in range(6, 0, -1):
        r = int(egg_size * 0.5 * i / 6)
        alpha = int(28 + 16*(6-i))
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(255,255,255,alpha))
    return layer.filter(ImageFilter.GaussianBlur(egg_size // 5))

def draw_rounded_rect(draw, xy, r, fill, outline, width=2):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)

STAR_DEFS = [
    (28,52,4,0.00),(262,48,3,0.38),(50,82,5,0.72),(246,90,3,0.14),
    (22,172,4,0.58),(272,165,3,0.83),(40,236,5,0.28),(256,230,4,0.52),
    (136,65,3,0.19),(76,128,3,0.67),(220,140,4,0.44),(150,198,3,0.88),
]

def star_alpha(phase, fi, total):
    t = (fi / total + phase) % 1.0
    return int(((math.sin(t * math.pi * 2) + 1) / 2) * 220)

def render_frame(fill_hex, label, ticker, name, coin_color, egg_img, coin_img, frame_idx):
    fill_rgb = hex2rgb(fill_hex)
    egg_sz   = egg_img.size[0]
    coin_sz  = coin_img.size[0] if coin_img else 0

    frame = Image.new("RGBA", (W, H), fill_hex)
    draw  = ImageDraw.Draw(frame)
    draw_dots(draw, fill_rgb)
    draw.rectangle([0,0,W-1,H-1], outline="#000000", width=3)

    lbl_upper = label.upper()
    lw = int(draw.textlength(lbl_upper, font=font_rarity)) + 22
    bx0,by0,bx1,by1 = 12,10,12+lw,33
    draw_rounded_rect(draw,[bx0,by0,bx1,by1],6,fill=(255,255,255,150),outline="#000000",width=2)
    bbox = draw.textbbox((0,0), lbl_upper, font=font_rarity)
    tw,th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    draw.text((bx0+(lw-tw)//2, by0+(by1-by0-th)//2-1), lbl_upper, font=font_rarity, fill="#000000")

    brand = "HeavyEggs"
    bbbox = draw.textbbox((0,0), brand, font=font_brand)
    bw = bbbox[2]-bbbox[0]
    draw.text((W-bw-12, 6), brand, font=font_brand, fill="#000000")

    header_h = 42; foot_h = 80
    art_top = header_h; art_bot = H - foot_h
    art_cx = W // 2; art_cy = (art_top + art_bot) // 2

    t = frame_idx / FRAMES
    y_off = int(-18 * math.sin(t * math.pi * 2) / 2)
    egg_x = art_cx - egg_sz // 2
    egg_y = art_cy - egg_sz // 2 + y_off

    star_layer = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(star_layer)
    for sx,sy,ss,ph in STAR_DEFS:
        a = star_alpha(ph, frame_idx, FRAMES)
        sd.ellipse([sx-ss//2,sy-ss//2,sx+ss//2,sy+ss//2], fill=(255,255,255,a))
    frame.paste(star_layer, (0,0), star_layer)

    halo = make_halo(egg_sz)
    frame.paste(halo, (art_cx-halo.size[0]//2, art_cy-halo.size[1]//2+y_off), halo)
    frame.paste(egg_img, (egg_x, egg_y), egg_img)
    if coin_img:
        frame.paste(coin_img, (art_cx-coin_sz//2, art_cy-coin_sz//2+y_off), coin_img)

    foot_y = H - foot_h
    draw.line([(0,foot_y),(W,foot_y)], fill="#000000", width=2)
    foot_ov = Image.new("RGBA", (W, foot_h), (0,0,0,18))
    frame.paste(foot_ov, (0, foot_y), foot_ov)

    draw.text((13, foot_y+7), name, font=font_name, fill="#000000")
    tbbox = draw.textbbox((0,0), ticker, font=font_ticker)
    tw2 = tbbox[2]-tbbox[0]
    tx = (W - tw2) // 2; ty = foot_y + 7
    for ox,oy in [(-2,0),(2,0),(0,-2),(0,2),(-1,-1),(1,-1),(-1,1),(1,1)]:
        draw.text((tx+ox, ty+oy), ticker, font=font_ticker, fill="#000000")
    draw.text((tx, ty), ticker, font=font_ticker, fill=coin_color)

    draw.line([(3,H-3),(W-1,H-3)], fill="#000000", width=5)
    draw.line([(W-3,3),(W-3,H-1)], fill="#000000", width=5)
    return frame.convert("P", palette=Image.ADAPTIVE, colors=200)

def save_gif(frames_list, path):
    frames_list[0].save(path, format="GIF", save_all=True,
        append_images=frames_list[1:], loop=0, duration=FPS_MS,
        optimize=False, disposal=2)

egg_base = Image.open(os.path.join(PUBLIC, "egg.webp")).convert("RGBA")
coin_raw = Image.open(ICON).convert("RGBA")

for tier in range(4):
    egg_sz   = EGG_SIZES[tier]
    coin_sz  = int(egg_sz * 0.43)
    egg_img  = egg_base.resize((egg_sz, egg_sz), Image.LANCZOS)
    coin_img = coin_raw.resize((coin_sz, coin_sz), Image.LANCZOS)
    frames   = [render_frame(FILLS[tier], LABELS[tier], TICKER, NAME, COLOR, egg_img, coin_img, i) for i in range(FRAMES)]
    out = os.path.join(CARDS_DIR, f"{PID}_{tier}.gif")
    save_gif(frames, out)
    print(f"49_{tier}.gif done")

print("All 4 GIFs generated.")
