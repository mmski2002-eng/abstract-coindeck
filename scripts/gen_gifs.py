#!/usr/bin/env python3
"""Generate animated GIF NFT cards + chests. Data matches assetUniverse.ts."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PUBLIC      = r"C:\ABSTRACT_COINDECK\frontend\public"
CARDS_DIR   = os.path.join(PUBLIC, "cards-anim")
CHESTS_DIR  = os.path.join(PUBLIC, "chests-anim")
W, H        = 300, 300
FRAMES      = 24
FPS_MS      = 55

FILLS       = ["#D9D3C2", "#7AC7E8", "#26C6A8", "#88FC00"]
LABELS      = ["Small",   "Medium",  "Heavy",   "Super Heavy"]
EGG_SIZES   = [100,       125,       150,       180]

# ── from assetUniverse.ts (exact order) ──────────────────────────────────────
TICKERS = ["BTC","ETH","BNB","XRP","SOL","DOGE","ADA","TRX","AVAX","SHIB",
           "DOT","BCH","LINK","NEAR","LTC","UNI","APT","HBAR","XMR","ICP",
           "ETC","OKB","ATOM","FIL","ARB","POL","XLM","OP","IMX","MNT",
           "VET","CRO","STX","ALGO","RNDR","INJ","GRT","SUI","FTM","THETA",
           "EOS","AAVE","MKR","LDO","SEI","KAS","PEPE","BONK","WIF","ABS"]

NAMES   = ["Bitcoin","Ethereum","BNB","XRP","Solana","Dogecoin","Cardano","TRON",
           "Avalanche","Shiba Inu","Polkadot","Bitcoin Cash","Chainlink","NEAR",
           "Litecoin","Uniswap","Aptos","Hedera","Monero","Internet Comp.",
           "Eth Classic","OKB","Cosmos","Filecoin","Arbitrum","Polygon","Stellar",
           "Optimism","Immutable","Mantle","VeChain","Cronos","Stacks","Algorand",
           "Render","Injective","The Graph","Sui","Fantom","Theta",
           "EOS","Aave","Maker","Lido","Sei","Kaspa","Pepe","Bonk","dogwifhat","Abstract"]

ICONS   = ["/coins/0_BTC.webp","/coins/1_ETH.webp","/coins/2_BNB.webp",
           "/coins/3_XRP.webp","/coins/4_SOL.webp","/coins/5_DOGE.webp",
           "/coins/6_ADA.webp","/coins/7_TRX.webp","/coins/8_AVAX.webp",
           "/coins/9_SHIB.webp","/coins/10_DOT.webp","/coins/11_BCH.webp",
           "/coins/12_LINK.webp","/coins/13_NEAR.webp","/coins/14_LTC.webp",
           "/coins/15_UNI.webp","/coins/16_APT.webp","/coins/17_HBAR.webp",
           "/coins/18_XMR.webp","/coins/19_ICP.webp","/coins/20_ETC.webp",
           "/coins/21_OKB.webp","/coins/22_ATOM.webp","/coins/23_FIL.webp",
           "/coins/24_ARB.webp","/coins/25_POL.webp","/coins/26_XLM.webp",
           "/coins/27_OP.webp","/coins/28_IMX.webp","/coins/29_MNT.webp",
           "/coins/30_VET.webp","/coins/31_CRO.webp","/coins/32_STX.webp",
           "/coins/33_ALGO.webp","/coins/34_RNDR.webp","/coins/35_INJ.webp",
           "/coins/36_GRT.webp","/coins/37_SUI.webp","/coins/38_FTM.webp",
           "/coins/39_THETA.webp","/coins/40_EOS.webp","/coins/41_AAVE.webp",
           "/coins/42_MKR.webp","/coins/43_LDO.webp","/coins/44_SEI.webp",
           "/coins/45_KAS.webp","/coins/46_PEPE.webp","/coins/47_BONK.webp",
           "/coins/48_WIF.webp","/coins/49_ABS.png"]

COLORS  = ["#F7931A","#627EEA","#F3BA2F","#00AAE4","#9945FF","#C2A633","#0033AD",
           "#EF0027","#E84142","#FFA409","#E6007A","#4CC947","#375BD2","#00C08B",
           "#BFBBBB","#FF007A","#00B5C7","#00C89A","#FF6600","#3B00B9","#328332",
           "#6FAEEB","#2E3148","#0290FF","#2D374B","#8247E5","#000000","#FF0420",
           "#17B5EB","#00B4E5","#40A578","#002D74","#5546FF","#009B77","#FF4500",
           "#00ADD8","#6747ED","#6FBCF0","#1969FF","#2BB673","#00B0EB","#B6509E",
           "#1AAB9B","#00A3FF","#9B2CE3","#70C7BA","#ED1EFF","#FF9900","#FF6B35",
           "#00c2d7"]

CHEST_DEFS = [
    {"label": "Small",  "fill": "#D9D3C2", "img": "egg2.webp"},
    {"label": "Medium", "fill": "#7AC7E8", "img": "egg2.webp"},
    {"label": "Heavy",  "fill": "#26C6A8", "img": "egg2.webp"},
]

os.makedirs(CARDS_DIR,  exist_ok=True)
os.makedirs(CHESTS_DIR, exist_ok=True)

def load_font(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

ARIAL  = "C:/Windows/Fonts/arialbd.ttf"
IMPACT = "C:/Windows/Fonts/impact.ttf"

font_rarity = load_font(ARIAL,  12)
font_name   = load_font(ARIAL,  18)
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
    (28, 52, 4, 0.00),(262,48, 3, 0.38),(50, 82, 5, 0.72),(246,90, 3, 0.14),
    (22,172, 4, 0.58),(272,165,3, 0.83),(40,236, 5, 0.28),(256,230,4, 0.52),
    (136,65, 3, 0.19),(76,128, 3, 0.67),(220,140,4, 0.44),(150,198,3, 0.88),
]

def star_alpha(phase, fi, total):
    t = (fi / total + phase) % 1.0
    return int(((math.sin(t * math.pi * 2) + 1) / 2) * 220)

def render_frame(fill_hex, label, ticker, name, coin_color, egg_img, coin_img, frame_idx, show_ticker=True):
    fill_rgb = hex2rgb(fill_hex)
    egg_sz   = egg_img.size[0]
    coin_sz  = coin_img.size[0] if coin_img else 0

    frame = Image.new("RGBA", (W, H), fill_hex)
    draw  = ImageDraw.Draw(frame)

    draw_dots(draw, fill_rgb)
    draw.rectangle([0,0,W-1,H-1], outline="#000000", width=3)

    # Header
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

    # Art
    header_h = 42
    foot_h   = 80
    art_top  = header_h
    art_bot  = H - foot_h
    art_cx   = W // 2
    art_cy   = (art_top + art_bot) // 2

    t    = frame_idx / FRAMES
    y_off = int(-18 * math.sin(t * math.pi * 2) / 2)

    egg_x = art_cx - egg_sz // 2
    egg_y = art_cy - egg_sz // 2 + y_off

    # Stars
    star_layer = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(star_layer)
    for sx,sy,ss,ph in STAR_DEFS:
        a = star_alpha(ph, frame_idx, FRAMES)
        sd.ellipse([sx-ss//2,sy-ss//2,sx+ss//2,sy+ss//2], fill=(255,255,255,a))
    frame.paste(star_layer, (0,0), star_layer)

    # Halo
    halo = make_halo(egg_sz)
    frame.paste(halo, (art_cx-halo.size[0]//2, art_cy-halo.size[1]//2+y_off), halo)

    # Egg
    frame.paste(egg_img, (egg_x, egg_y), egg_img)

    # Coin
    if coin_img:
        frame.paste(coin_img, (art_cx-coin_sz//2, art_cy-coin_sz//2+y_off), coin_img)

    # Footer
    foot_y = H - foot_h
    draw.line([(0,foot_y),(W,foot_y)], fill="#000000", width=2)
    foot_ov = Image.new("RGBA", (W, foot_h), (0,0,0,18))
    frame.paste(foot_ov, (0, foot_y), foot_ov)

    if show_ticker:
        draw.text((13, foot_y+7), name, font=font_name, fill="#000000")
        tbbox = draw.textbbox((0,0), ticker, font=font_ticker)
        tw2,th2 = tbbox[2]-tbbox[0], tbbox[3]-tbbox[1]
        tx = (W - tw2) // 2
        ty = foot_y + 7
        for ox,oy in [(-2,0),(2,0),(0,-2),(0,2),(-1,-1),(1,-1),(-1,1),(1,1)]:
            draw.text((tx+ox, ty+oy), ticker, font=font_ticker, fill="#000000")
        draw.text((tx, ty), ticker, font=font_ticker, fill=coin_color)
    else:
        # Chest: just name centered vertically in footer
        nbbox = draw.textbbox((0,0), name, font=font_brand)
        nw,nh = nbbox[2]-nbbox[0], nbbox[3]-nbbox[1]
        draw.text(((W-nw)//2, foot_y+(foot_h-nh)//2), name, font=font_brand, fill="#000000")

    draw.line([(3,H-3),(W-1,H-3)], fill="#000000", width=5)
    draw.line([(W-3,3),(W-3,H-1)], fill="#000000", width=5)

    return frame.convert("P", palette=Image.ADAPTIVE, colors=200)

def save_gif(frames_list, path):
    frames_list[0].save(path, format="GIF", save_all=True,
        append_images=frames_list[1:], loop=0, duration=FPS_MS,
        optimize=False, disposal=2)

# ── Generate card GIFs ───────────────────────────────────────────────────────
egg_base = Image.open(os.path.join(PUBLIC, "egg.webp")).convert("RGBA")
total = len(TICKERS) * 4
done  = 0

for pid in range(len(TICKERS)):
    icon_path = os.path.join(PUBLIC, ICONS[pid].lstrip('/').replace('/', os.sep))
    coin_raw  = None
    if os.path.exists(icon_path):
        try: coin_raw = Image.open(icon_path).convert("RGBA")
        except: pass

    for tier in range(4):
        egg_sz   = EGG_SIZES[tier]
        coin_sz  = int(egg_sz * 0.43)
        egg_img  = egg_base.resize((egg_sz, egg_sz), Image.LANCZOS)
        coin_img = coin_raw.resize((coin_sz, coin_sz), Image.LANCZOS) if coin_raw else None

        frames = [render_frame(FILLS[tier], LABELS[tier], TICKERS[pid], NAMES[pid],
                               COLORS[pid], egg_img, coin_img, i) for i in range(FRAMES)]
        save_gif(frames, os.path.join(CARDS_DIR, f"{pid}_{tier}.gif"))
        done += 1
        print(f"[{done}/{total}] card {pid}_{tier}.gif", end='\r')

print(f"\nCards done: {done}")

# ── Generate chest GIFs ──────────────────────────────────────────────────────
egg2_base = Image.open(os.path.join(PUBLIC, "egg2.webp")).convert("RGBA")

for ctype, c in enumerate(CHEST_DEFS):
    egg_sz  = 160
    egg_img = egg2_base.resize((egg_sz, egg_sz), Image.LANCZOS)
    frames  = [render_frame(c["fill"], c["label"], "", c["label"]+" Egg",
                            "#000000", egg_img, None, i, show_ticker=False) for i in range(FRAMES)]
    save_gif(frames, os.path.join(CHESTS_DIR, f"{ctype}.gif"))
    print(f"Chest {ctype}.gif done")

print("All done.")
