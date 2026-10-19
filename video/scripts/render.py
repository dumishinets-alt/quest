# Рендер відеоряду: кадрування/Ken Burns + стабілізація, грейд, типографіка, переходи.
# python3 -I render.py SCRIPTS SRC WORK FONTS MODEL OUT.mp4 [--preview t1,t2,...]
import sys, os, math, subprocess, functools
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SCR, SRC, WORK, FONTS, MODEL, OUT = sys.argv[1:7]
PREVIEW = None
if "--preview" in sys.argv:
    PREVIEW = [float(x) for x in sys.argv[sys.argv.index("--preview") + 1].split(",")]
sys.path.insert(0, SCR)
from timeline import *

UNB = os.path.join(FONTS, "unbounded-800.ttf")
MX = os.path.join(FONTS, "montserrat-900.ttf")
MB = os.path.join(FONTS, "montserrat-800.ttf")
MS = os.path.join(FONTS, "montserrat-600.ttf")
DARK = (14, 22, 38)

starts, TOTAL = shot_starts()
SID = {s["id"]: i for i, s in enumerate(SHOTS)}
def T(sid):
    return starts[SID[sid]]
def TE(sid):
    i = SID[sid]
    return starts[i] + SHOTS[i]["beats"] * BEAT

# ---------------------------------------------------------------- easing
def clamp01(x):
    return max(0.0, min(1.0, x))
def ease_out_cubic(x):
    x = clamp01(x); return 1 - (1 - x) ** 3
def ease_in_out(x):
    x = clamp01(x); return x * x * (3 - 2 * x)
def ease_out_back(x, s=1.9):
    x = clamp01(x); x -= 1; return 1 + x * x * ((s + 1) * x + s)
def bell(x):
    return math.sin(math.pi * clamp01(x))

# ---------------------------------------------------------------- спрайти тексту
@functools.lru_cache(maxsize=4096)
def font(path, size):
    return ImageFont.truetype(path, size)

@functools.lru_cache(maxsize=2048)
def text_sprite(text, fpath, size, fill=WHITE, tracking=0, shadow=0.55, stroke=0, stroke_fill=DARK):
    f = font(fpath, size)
    widths = [f.getlength(ch) for ch in text]
    tw = int(sum(widths) + tracking * max(0, len(text) - 1))
    asc, desc = f.getmetrics()
    pad = 30 + stroke
    w, h = tw + 2 * pad, asc + desc + 2 * pad
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x = pad
    for ch, cw in zip(text, widths):
        d.text((x, pad), ch, font=f, fill=fill + (255,), stroke_width=stroke, stroke_fill=stroke_fill + (255,))
        x += cw + tracking
    if shadow > 0:
        a = lay.split()[3]
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sh.putalpha(a.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * shadow)))
        base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        base.alpha_composite(sh, (0, 7))
        base.alpha_composite(lay)
        lay = base
    return np.array(lay)

def fit_size(text, fpath, max_w, start):
    s = start
    while s > 20 and font(fpath, s).getlength(text) > max_w:
        s -= 4
    return s

def paste(img, spr, cx, cy, scale=1.0, alpha=1.0, anchor="c"):
    if alpha <= 0.003 or scale <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        spr = cv2.resize(spr, None, fx=scale, fy=scale, interpolation=cv2.INTER_LINEAR if scale < 1 else cv2.INTER_CUBIC)
    h, w = spr.shape[:2]
    x0 = int(round(cx - (w / 2 if anchor == "c" else 0)))
    y0 = int(round(cy - h / 2))
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    s = spr[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0].astype(np.float32)
    a = s[..., 3:4] / 255.0 * alpha
    img[Y0:Y1, X0:X1] = img[Y0:Y1, X0:X1] * (1 - a) + s[..., :3] * a

@functools.lru_cache(maxsize=256)
def pill_sprite(text, fpath, size, bg, fg, padx=34, pady=18, radius=None, shadow=True):
    f = font(fpath, size)
    tw = int(f.getlength(text)); asc, desc = f.getmetrics()
    bw, bh = tw + 2 * padx, asc + desc + 2 * pady
    m = 24
    lay = Image.new("RGBA", (bw + 2 * m, bh + 2 * m), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    r = radius if radius is not None else bh // 2
    if shadow:
        sh = Image.new("RGBA", lay.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((m, m + 8, m + bw, m + bh + 8), r, fill=(0, 0, 0, 120))
        lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    d.rounded_rectangle((m, m, m + bw, m + bh), r, fill=bg + (255,))
    d.text((m + padx, m + pady), text, font=f, fill=fg + (255,))
    return np.array(lay)

# ---------------------------------------------------------------- мапа України (спрощений контур, lon/lat)
UA = [(23.6, 51.5), (24.4, 51.9), (25.5, 51.92), (26.6, 51.8), (27.7, 51.6), (28.7, 51.45), (29.3, 51.4), (30.2, 51.5),
      (30.6, 51.3), (30.9, 52.0), (31.8, 52.1), (32.4, 52.3), (33.2, 52.35), (34.1, 51.7), (34.4, 51.2), (35.1, 51.2),
      (35.4, 50.6), (36.1, 50.4), (37.5, 50.3), (38.0, 49.9), (39.2, 49.9), (40.0, 49.6), (40.1, 49.2), (39.7, 48.8),
      (40.0, 48.3), (39.8, 47.9), (38.8, 47.8), (38.2, 47.1), (37.5, 47.0), (36.7, 46.7), (35.8, 46.6), (35.2, 46.3),
      (35.0, 45.7), (35.5, 45.3), (36.6, 45.4), (36.4, 45.1), (35.9, 45.0), (35.2, 44.8), (34.4, 44.5), (33.6, 44.5),
      (33.4, 44.9), (33.6, 45.1), (32.5, 45.4), (33.6, 45.9), (33.7, 46.1), (32.6, 46.1), (31.8, 46.3), (31.0, 46.6),
      (30.7, 46.4), (30.2, 45.8), (29.7, 45.3), (28.2, 45.5), (28.9, 46.0), (30.1, 46.4), (29.7, 46.9), (29.2, 47.5),
      (29.1, 47.9), (28.2, 48.2), (27.5, 48.5), (26.6, 48.3), (26.2, 48.0), (25.0, 47.7), (24.0, 47.95), (22.9, 47.95),
      (22.7, 48.1), (22.1, 48.4), (22.2, 48.8), (22.6, 49.1), (22.7, 49.6), (23.6, 50.4), (24.1, 50.7), (23.6, 51.5)]
PLACES = {
    "Говерла": ((24.50, 48.16), GREEN), "Петрос": ((24.42, 48.17), GREEN), "Синевир": ((23.68, 48.62), BLUE),
    "Світязь": ((23.86, 51.45), BLUE), "Роман-Кош": ((34.24, 44.61), GREEN),
}
def proj(lon, lat, x0, y0, w):
    k = math.cos(math.radians(48.5))
    minx, maxx, miny, maxy = 22.1 * k, 40.1 * k, 44.5, 52.35
    sc = w / (maxx - minx)
    return x0 + (lon * k - minx) * sc, y0 + (maxy - lat) * sc
def map_h(w):
    k = math.cos(math.radians(48.5))
    return (52.35 - 44.5) * w / ((40.1 - 22.1) * k)

def draw_map(img, x0, y0, w, prog=1.0, alpha=1.0, fill_a=0.35, lw=4, pins=(), pin_t=None):
    """Контур, що промальовується (prog 0..1), і піни, що «падають» на мапу."""
    hh = int(map_h(w)) + 80
    lay = Image.new("RGBA", (int(w) + 80, hh), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pts = [proj(lo, la, 40, 40, w) for lo, la in UA]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    L = sum(seg) * clamp01(prog)
    if prog >= 0.999 and fill_a > 0:
        d.polygon(pts, fill=(10, 20, 40, int(255 * fill_a)))
    out, acc = [pts[0]], 0.0
    for i, s in enumerate(seg):
        if acc + s <= L:
            out.append(pts[i + 1]); acc += s
        else:
            r = (L - acc) / s if s else 0
            out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r))
            break
    if len(out) > 1:
        d.line(out, fill=(255, 255, 255, 235), width=lw, joint="curve")
        hx, hy = out[-1]
        if prog < 0.999:
            d.ellipse((hx - lw * 2, hy - lw * 2, hx + lw * 2, hy + lw * 2), fill=(255, 220, 120, 255))
    arr = np.array(lay)
    paste(img, arr, x0 - 40 + arr.shape[1] / 2, y0 - 40 + arr.shape[0] / 2, alpha=alpha)
    for name, tp in pins:
        if pin_t is None or tp is None:
            continue
        p = (pin_t - tp) / 0.45
        if p <= 0:
            continue
        (lo, la), col = PLACES[name]
        px, py = proj(lo, la, x0, y0, w)
        drop = (1 - ease_out_back(p, 2.6)) * 60
        sc = 0.6 + 0.4 * ease_out_back(p, 2.6)
        draw_pin(img, px, py - drop, col, sc * (w / 900) ** 0.5 * 1.25, alpha)

@functools.lru_cache(maxsize=16)
def pin_sprite(col):
    s = 120
    lay = Image.new("RGBA", (s, s + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.ellipse((30, 128, 90, 148), fill=(0, 0, 0, 90))
    d.polygon([(28, 52), (92, 52), (60, 132)], fill=col + (255,))
    d.ellipse((22, 14, 98, 90), fill=col + (255,), outline=(255, 255, 255, 255), width=6)
    d.ellipse((46, 38, 74, 66), fill=(255, 255, 255, 255))
    return np.array(lay)

def draw_pin(img, x, y, col, scale=1.0, alpha=1.0):
    spr = pin_sprite(col)
    h = spr.shape[0] * scale
    paste(img, spr, x, y - h * 0.40, scale, alpha)

# ---------------------------------------------------------------- грейд
def make_lut(gain):
    x = np.arange(256) / 255.0
    y = np.clip(x * gain, 0, 1)
    y = 0.8 * y + 0.2 * (y * y * (3 - 2 * y))
    y = 0.025 + 0.965 * y
    r = np.clip(y ** 0.97 * 1.025, 0, 1)
    g = y
    b = np.clip(y ** 1.04 * 0.965, 0, 1)
    return [(c * 255).astype(np.uint8) for c in (r, g, b)]

hue = np.arange(180)
def hw(c, w):
    d = np.minimum(abs(hue - c), 180 - abs(hue - c))
    return np.clip(1 - d / w, 0, 1)
SAT_LUT = (1.08 + 0.30 * np.maximum(hw(60, 28), hw(105, 22)) - 0.04 * hw(10, 12)).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - 0.30 * np.clip(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.6)) ** 2, 0, 1.4) ** 1.3)[..., None].astype(np.float32)
del yy, xx

def grade(u8, luts):
    out = np.dstack([cv2.LUT(u8[..., c], luts[c]) for c in range(3)])
    hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV)
    s = hsv[..., 1].astype(np.float32) * SAT_LUT[hsv[..., 0]]
    hsv[..., 1] = np.clip(s, 0, 255).astype(np.uint8)
    out = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB).astype(np.float32)
    return out * VIG

# ---------------------------------------------------------------- джерела
class Source:
    def __init__(self, name, t0, t1):
        cap = cv2.VideoCapture(os.path.join(SRC, name + ".MOV"))
        self.fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        i0 = max(0, int(math.floor(t0 * self.fps)) - 1)
        i1 = min(n - 1, int(math.ceil(t1 * self.fps)) + 1)
        cap.set(cv2.CAP_PROP_POS_FRAMES, i0)
        self.frames, self.i0 = [], i0
        for _ in range(i0, i1 + 1):
            ok, f = cap.read()
            if not ok:
                break
            self.frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
        cap.release()
    def get(self, t):
        fi = t * self.fps - self.i0
        a = int(math.floor(fi)); r = fi - a
        a = max(0, min(len(self.frames) - 1, a)); b = min(len(self.frames) - 1, a + 1)
        if r < 0.08 or a == b:
            return self.frames[a]
        if r > 0.92:
            return self.frames[b]
        return cv2.addWeighted(self.frames[a], 1 - r, self.frames[b], r, 0)

def shot_frames(i):
    st = starts[i]; s = SHOTS[i]
    f0 = int(round(st * FPS)); f1 = int(round((st + s["beats"] * BEAT) * FPS))
    return f0, f1

class ShotState:
    """Кадри, стабілізація, траєкторія кадрування і грейд одного кадру монтажу."""
    def __init__(self, i):
        s = SHOTS[i]; self.s = s; self.i = i
        self.f0, self.f1 = shot_frames(i)
        n = self.f1 - self.f0
        self.dur = s["beats"] * BEAT
        self.tl = [(k) / FPS for k in range(n)]
        self.ts = [src_time(s, t) for t in self.tl]
        self.src = Source(s["src"], min(self.ts), max(self.ts))
        self.raw = [self.src.get(t) for t in self.ts]
        sh, sw = self.raw[0].shape[:2]
        self.sw, self.sh = sw, sh
        # стабілізація: фазова кореляція між сусідніми кадрами
        P = [np.zeros(2)]
        win = cv2.createHanningWindow((sw // 4, sh // 4), cv2.CV_32F)
        prev = cv2.resize(cv2.cvtColor(self.raw[0], cv2.COLOR_RGB2GRAY), (sw // 4, sh // 4)).astype(np.float32)
        for fr in self.raw[1:]:
            cur = cv2.resize(cv2.cvtColor(fr, cv2.COLOR_RGB2GRAY), (sw // 4, sh // 4)).astype(np.float32)
            (dx, dy), resp = cv2.phaseCorrelate(prev, cur, win)
            if resp < 0.05 or abs(dx) > 20 or abs(dy) > 20:
                dx = dy = 0.0
            P.append(P[-1] + np.array([dx, dy]) * 4)
            prev = cur
        P = np.array(P)
        sig = 7.0
        kx = np.arange(-21, 22); g = np.exp(-kx ** 2 / (2 * sig ** 2)); g /= g.sum()
        Sm = np.stack([np.convolve(np.pad(P[:, c], 21, mode="edge"), g, mode="same")[21:-21] for c in range(2)], 1)
        self.P, self.S = P, Sm
        self.centers, self.scales = [], []
        for k, t in enumerate(self.tl):
            p = ease_in_out(t / self.dur)
            z = s["z"][0] + (s["z"][1] - s["z"][0]) * p
            (cx0, cy0), (cx1, cy1) = s["c"]
            cx = (cx0 + (cx1 - cx0) * p) * sw + (P[k, 0] - Sm[k, 0])
            cy = (cy0 + (cy1 - cy0) * p) * sh + (P[k, 1] - Sm[k, 1])
            hw_, hh_ = sw / z / 2, sh / z / 2
            cx = min(max(cx, hw_), sw - hw_); cy = min(max(cy, hh_), sh - hh_)
            self.centers.append((cx, cy)); self.scales.append(W / sw * z)
        lum = np.mean([cv2.cvtColor(self.raw[k], cv2.COLOR_RGB2GRAY).mean() for k in range(0, n, 6)]) / 255.0
        gain = float(np.clip(0.47 / max(lum, 0.05), 0.85, 1.35))
        self.luts = make_lut(gain)
    def n(self):
        return self.f1 - self.f0
    def base(self, k):
        cx, cy = self.centers[k]; s = self.scales[k]
        M = np.float32([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]])
        out = cv2.warpAffine(self.raw[k], M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        amt = 0.25 + 0.12 * (s / 1.5)
        bl = cv2.GaussianBlur(out, (0, 0), 1.3)
        out = cv2.addWeighted(out, 1 + amt, bl, -amt, 0)
        return grade(out, self.luts)
    def track(self, k, out_pt0):
        """Точка, задана у вихідних координатах на першому кадрі, слідує за рухом сцени."""
        cx0, cy0 = self.centers[0]; s0 = self.scales[0]
        q0 = np.array([(out_pt0[0] - W / 2) / s0 + cx0, (out_pt0[1] - H / 2) / s0 + cy0])
        q = q0 + (self.P[k] - self.P[0])
        cx, cy = self.centers[k]; s = self.scales[k]
        return (q[0] - cx) * s + W / 2, (q[1] - cy) * s + H / 2

# ---------------------------------------------------------------- сегментація (текст за людиною)
class Segmenter:
    def __init__(self, path):
        import onnxruntime as ort
        o = ort.SessionOptions(); o.intra_op_num_threads = 4
        self.sess = ort.InferenceSession(path, o, providers=["CPUExecutionProvider"])
        self.prev = {}
    def matte(self, rgb, short=512):
        h, w = rgb.shape[:2]; sc = short / min(h, w)
        nh, nw = max(32, int(round(h * sc / 32)) * 32), max(32, int(round(w * sc / 32)) * 32)
        x = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        x = ((x - 0.5) / 0.5).transpose(2, 0, 1)[None]
        return cv2.resize(self.sess.run(None, {"input": x})[0][0, 0], (w, h))
    def mask(self, key, img_u8, rect):
        x0, y0, x1, y1 = rect
        sub = np.ascontiguousarray(img_u8[y0:y1, x0:x1])
        m = self.matte(sub)
        sc = 0.5
        small = cv2.resize(sub, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
        ms = cv2.resize(m, (small.shape[1], small.shape[0]))
        core = (ms > 0.3).astype(np.uint8)
        near = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
        far = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (121, 121)))
        gc = np.full(ms.shape, cv2.GC_BGD, np.uint8)
        gc[far > 0] = cv2.GC_PR_BGD
        gc[near > 0] = cv2.GC_PR_FGD
        sure = cv2.erode((ms > 0.85).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        gc[sure > 0] = cv2.GC_FGD
        if (gc == cv2.GC_FGD).sum() < 50:
            M = np.zeros((H, W), np.float32)
            self.prev.pop(key, None)
            return M
        bgm = np.zeros((1, 65)); fgm = np.zeros((1, 65))
        try:
            cv2.grabCut(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), gc, None, bgm, fgm, 4, cv2.GC_INIT_WITH_MASK)
            r = np.where((gc == 1) | (gc == 3), 1.0, 0.0).astype(np.float32)
        except cv2.error:
            r = (ms > 0.5).astype(np.float32)
        r[:3] = 0
        r = cv2.resize(r, (x1 - x0, y1 - y0))
        r = cv2.GaussianBlur(r, (0, 0), 2.2)
        if key in self.prev:
            r = 0.55 * r + 0.45 * self.prev[key]
        self.prev[key] = r
        M = np.zeros((H, W), np.float32); M[y0:y1, x0:x1] = r
        return M

SEG = None

# ---------------------------------------------------------------- оверлеї (глобальний час)
POPS = []
def pop_at(t):
    POPS.append(round(t, 3))

def hook_title(img, t, ctx):
    t0 = 0.0
    if t > TE("hook"):
        return
    dim = 0.38 * ease_out_cubic(t / 0.3) * (1 - ease_in_out((t - TE("hook") + 0.4) / 0.4))
    img *= (1 - dim)
    lines = [("3 КЛАС", UNB, YELLOW, 0.0, 150), ("ДОСЛІДЖУЄ", MX, WHITE, BEAT * 1, 170), ("УКРАЇНУ", UNB, WHITE, BEAT * 2, 170)]
    ys = [760, 930, 1100]
    out_p = clamp01((t - (TE("hook") - BEAT * 1.4)) / (BEAT * 1.4))
    for (txt, fp, col, td, sz0), y in zip(lines, ys):
        p = (t - t0 - td) / 0.42
        if p <= 0:
            continue
        sz = fit_size(txt, fp, 960, sz0)
        trk = int(40 * ease_in_out(out_p) * 2) // 4 * 4
        spr = text_sprite(txt, fp, sz, col, tracking=trk)
        sc = 1.0 + 0.9 * (1 - ease_out_back(p, 1.6))
        a = clamp01(p * 2.5) * (1 - ease_in_out(out_p))
        paste(img, spr, W / 2, y, sc, a)
    # синьо-жовта лінія під заголовком
    p = (t - BEAT * 2.4) / 0.5
    if p > 0:
        lw = int(620 * ease_out_cubic(p) * (1 - ease_in_out(out_p)))
        if lw > 4:
            img[1205:1217, W // 2 - lw // 2:W // 2] = img[1205:1217, W // 2 - lw // 2:W // 2] * 0.1 + np.array(BLUE) * 0.9
            img[1205:1217, W // 2:W // 2 + lw // 2] = img[1205:1217, W // 2:W // 2 + lw // 2] * 0.1 + np.array(YELLOW) * 0.9

def intro_words(img, t, ctx):
    a0, a1 = T("i1"), TE("i5")
    if not (a0 <= t <= a1):
        return
    tl = t - a0
    img *= 1 - 0.22 * clamp01(tl / 0.3) * (1 - clamp01((t - a1 + 0.3) / 0.3))
    # мапа, що промальовується, + піни
    mp = ease_in_out(tl / (BEAT * 6))
    exit_p = ease_in_out((t - (a1 - BEAT * 1.2)) / (BEAT * 1.2))
    pins = [("Говерла", a0 + BEAT * 6.5), ("Синевир", a0 + BEAT * 7.5), ("Світязь", a0 + BEAT * 8.5), ("Роман-Кош", a0 + BEAT * 9.5)]
    draw_map(img, 90, 330 - 80 * exit_p, 900, prog=mp, alpha=0.95 * (1 - exit_p), fill_a=0.3, lw=5, pins=pins, pin_t=t)
    words = [("ГОРИ.", GREEN, BEAT * 1), ("ОЗЕРА.", BLUE, BEAT * 3), ("РІВНИНИ.", YELLOW, BEAT * 5)]
    for k, (wtxt, col, td) in enumerate(words):
        p = (tl - td) / 0.4
        if p <= 0:
            continue
        sz = fit_size(wtxt, UNB, 900, 150)
        spr = text_sprite(wtxt, UNB, sz, col, stroke=3, stroke_fill=WHITE)
        sc = 0.35 + 0.65 * ease_out_back(p, 2.2)
        e = clamp01((t - (a1 - BEAT * 1.2) - k * 0.08) / 0.35)
        y = 1080 + k * 175 - 120 * ease_in_out(e)
        paste(img, spr, W / 2, y, sc, clamp01(p * 3) * (1 - e))

def plaque(t0, t1, topic, sub, col, theme, name="", pin=None):
    def draw(img, t, ctx):
        if not (t0 <= t <= t1):
            return
        tl, rem = t - t0, t1 - t
        pin_ = ease_out_cubic(tl / 0.45)
        pout = ease_in_out(1 - rem / 0.35)
        x = -700 + 760 * pin_ - 760 * pout
        y = 250
        spr = text_sprite(topic, UNB, 92, WHITE, shadow=0.0)
        bw, bh = spr.shape[1] + 40, 150
        x0 = int(x); y0 = y
        X0, X1 = max(0, x0), min(W, x0 + bw + (190 if theme else 0))
        if X1 > X0:
            img[y0:y0 + bh, X0:X1] = img[y0:y0 + bh, X0:X1] * 0.08 + np.array(col) * 0.92
            img[y0:y0 + bh, X0:min(W, X0 + 14)] = WHITE
        paste(img, spr, x0 + 20, y0 + bh / 2, anchor="l")
        # тематична анімація праворуч від слова
        ax = x0 + bw + 10
        if theme == "mountain":
            pts = [(0, 100), (40, 60), (62, 78), (100, 22), (128, 58), (150, 44), (180, 100)]
            pr = ease_in_out((tl - 0.3) / 0.9)
            lay = Image.new("RGBA", (190, 130), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
            seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
            L, acc, out = sum(seg) * pr, 0, [pts[0]]
            for i, s_ in enumerate(seg):
                if acc + s_ <= L:
                    out.append(pts[i + 1]); acc += s_
                else:
                    r = (L - acc) / s_; out.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r)); break
            if len(out) > 1:
                d.line(out, fill=(255, 255, 255, 255), width=7, joint="curve")
            if pr > 0.6:
                d.polygon([(88, 38), (100, 22), (112, 38)], fill=(255, 255, 255, int(255 * clamp01((pr - 0.6) / 0.4))))
            paste(img, np.array(lay), ax + 95, y0 + bh / 2 + 5)
        elif theme == "waves":
            lay = Image.new("RGBA", (190, 130), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
            for k in range(3):
                ph = tl * 4 + k * 1.3
                pts = [(xx, 40 + k * 26 + 9 * math.sin(xx / 22 + ph)) for xx in range(5, 186, 6)]
                d.line(pts, fill=(255, 255, 255, 255 - k * 50), width=6, joint="curve")
            paste(img, np.array(lay), ax + 95, y0 + bh / 2 + 5, alpha=ease_out_cubic(tl / 0.6))
        # підпис з ефектом друкарської машинки
        nch = int(len(sub) * clamp01((tl - 0.35) / (0.035 * len(sub))))
        if nch > 0:
            txt = sub[:nch] + ("|" if nch < len(sub) and int(tl * 8) % 2 == 0 else "")
            pill = pill_sprite(txt, MB, 54, WHITE, DARK, padx=26, pady=14, radius=14)
            paste(img, pill, x0 - 10, y0 + bh + 62, anchor="l")
        if name:
            p = (tl - 0.8) / 0.4
            if p > 0:
                pill = pill_sprite(name, MB, 50, YELLOW, DARK, padx=24, pady=12, radius=14)
                paste(img, pill, x0 - 10, y0 + bh + 160, 0.6 + 0.4 * ease_out_back(p), clamp01(p * 3), anchor="l")
        # міні-мапа з піном
        if pin:
            pa = ease_out_cubic(tl / 0.5) * (1 - pout)
            draw_map(img, 760, 230, 270, prog=1.0, alpha=pa, fill_a=0.55, lw=3,
                     pins=[(pin, t0 + 0.6)], pin_t=t)
    pop_at(t0 + 0.05)
    if pin:
        pop_at(t0 + 0.6)
    return draw

def sticker(sid, t0, t1, text, col, anchor_out, offset=(0, -120), fg=WHITE, size=52):
    def draw(img, t, ctx):
        if not (t0 <= t <= t1) or ctx is None or ctx["sid"] != sid:
            return
        st = ctx["state"]; k = ctx["k"]
        ax, ay = st.track(k, anchor_out)
        p = (t - t0) / 0.4
        pout = clamp01((t - (t1 - 0.25)) / 0.25)
        sc = (0.2 + 0.8 * ease_out_back(p, 2.4)) * (1 - 0.6 * pout)
        a = clamp01(p * 3) * (1 - pout)
        sx, sy = ax + offset[0], ay + offset[1]
        # лінія-вказівник + точка
        n = 14
        for j in range(n):
            q = j / n
            px, py = ax + (sx - ax) * q * ease_out_cubic(p), ay + (sy - ay) * q * ease_out_cubic(p)
            cv2.circle(img, (int(px), int(py)), 3, WHITE, -1, cv2.LINE_AA) if a > 0.5 else None
        cv2.circle(img, (int(ax), int(ay)), int(11 * min(1, sc)), col, -1, cv2.LINE_AA)
        cv2.circle(img, (int(ax), int(ay)), int(11 * min(1, sc)), WHITE, 3, cv2.LINE_AA)
        spr = pill_sprite(text, MB, size, col, fg)
        wob = 1 + 0.025 * math.sin((t - t0) * 6)
        paste(img, spr, sx, sy, sc * wob, a)
    pop_at(t0)
    return draw

KEYWORDS = {"гора": GREEN, "гори": GREEN, "Чорногора": GREEN, "країни,": YELLOW, "красу": YELLOW}
def subtitles(chunks):
    """chunks: [(t0, t1, [(word, t_word)])] у глобальному часі. Караоке: поточне слово підсвічене."""
    def draw(img, t, ctx):
        for (c0, c1, words) in chunks:
            if not (c0 <= t <= c1):
                continue
            p_in = (t - c0) / 0.18
            sprs = []
            for j, (wd, tw) in enumerate(words):
                nxt = words[j + 1][1] if j + 1 < len(words) else c1
                active = tw <= t < nxt
                kw = KEYWORDS.get(wd)
                col = kw if kw else (YELLOW if active else WHITE)
                spr = text_sprite(wd, MB, 66, col, shadow=0.75)
                bounce = 1.0
                if t >= tw:
                    q = (t - tw) / 0.28
                    bounce = 1 + (0.22 if kw else 0.10) * bell(q)
                sprs.append((spr, bounce, t >= tw - 0.02))
            gap = 24
            tot = sum(s.shape[1] - 60 + gap for s, _, _ in sprs)
            sc0 = min(1.0, 980 / max(tot, 1)) * (0.85 + 0.15 * ease_out_back(p_in))
            x = W / 2 - tot * sc0 / 2
            for spr, b, said in sprs:
                w_ = (spr.shape[1] - 60) * sc0
                yb = 1650 - (14 * (b - 1) / 0.22 if b > 1 else 0)
                paste(img, spr, x + w_ / 2, yb, sc0 * b, clamp01(p_in * 2) * (1.0 if said else 0.72))
                x += w_ + gap * sc0
    return draw

def final_title(img, t, ctx):
    t0 = T("fin")
    if t < t0:
        return
    tl = t - t0
    img *= 1 - 0.32 * ease_out_cubic(tl / 0.6)
    l1 = "МАЛЕНЬКІ ДОСЛІДНИКИ"
    s1 = fit_size(l1, UNB, 960, 110)
    p = (tl - 0.25) / 0.55
    if p > 0:
        trk = int(30 * (1 - ease_out_cubic(p))) // 3 * 3
        paste(img, text_sprite(l1, UNB, s1, WHITE, tracking=trk), W / 2, 880, 0.9 + 0.1 * ease_out_cubic(p), clamp01(p * 2))
    l2 = "ВЕЛИКОЇ КРАЇНИ"
    s2 = fit_size(l2, UNB, 960, 120)
    nch = int(len(l2) * clamp01((tl - 0.9) / (0.06 * len(l2))))
    if nch > 0:
        spr_full = text_sprite(l2, UNB, s2, YELLOW)
        spr = text_sprite(l2[:nch], UNB, s2, YELLOW)
        x_left = W / 2 - spr_full.shape[1] / 2
        paste(img, spr, x_left, 1035, anchor="l")
    p3 = (tl - 2.1) / 0.5
    if p3 > 0:
        lw = int(700 * ease_out_cubic(p3))
        img[1150:1160, W // 2 - lw // 2:W // 2 + lw // 2] = np.array(BLUE) * 0.9 + img[1150:1160, W // 2 - lw // 2:W // 2 + lw // 2] * 0.1
        spr = text_sprite(SCHOOL, MS, 50, WHITE)
        paste(img, spr, W / 2, 1230, alpha=clamp01(p3 * 2))

LETTERBOX = [(0.0, TE("hook")), (T("fin"), TOTAL + TAIL)]
def letterbox(img, t):
    for a, b in LETTERBOX:
        if a <= t <= b:
            p = min(ease_out_cubic((t - a) / 0.35), 1 - ease_in_out((t - (b - 0.3)) / 0.3) if b < TOTAL else 1.0)
            hb = int(170 * p)
            if hb > 0:
                img[:hb] = 0; img[H - hb:] = 0

# --- збірка оверлеїв
B = BEAT
OVERLAYS = [hook_title, intro_words, final_title]
OVERLAYS.append(plaque(T("g1"), T("g1") + 3.2, "ГОРИ", "гора Петрос", GREEN, "mountain", NAMES.get("petros", ""), pin="Петрос"))
OVERLAYS.append(plaque(T("g4"), T("g4") + 2.9, "ГОРИ", "Карпати", GREEN, "mountain", NAMES.get("karpaty", ""), pin="Говерла"))
OVERLAYS.append(plaque(T("g6"), T("g6") + 2.9, "ГОРИ", "Кримські гори", GREEN, "mountain", NAMES.get("krym", ""), pin="Роман-Кош"))
OVERLAYS.append(plaque(T("o1"), T("o1") + 3.3, "ОЗЕРА", "озеро Синевир", BLUE, "waves", NAMES.get("synevyr", ""), pin="Синевир"))
for i in range(len(SHOTS)):
    pop_at(T("i1") + B * (1 + 2 * 0)) if False else None
for k in range(3):
    pop_at(T("i1") + B * (1 + 2 * k))
for k in range(4):
    pop_at(T("i1") + B * (6.5 + k))
for k in range(3):
    pop_at(B * k)
pop_at(T("fin") + 0.25)

# Стікери (прив'язані трекінгом до руху сцени); якорі — у вихідних координатах першого кадру кадру.
STICKERS = dict(
    g2=("Висота — 2020 м", GREEN, (930, 330), (-230, 170)),
    g4=("Говерла — 2061 м!", GREEN, (560, 520), (0, 190)),
    g5=("Говерланський водоспад", BLUE, (330, 760), (200, -260)),
    g6=("Роман-Кош — 1545 м", GREEN, (560, 560), (0, 190)),
    o2=("«Морське око» Карпат", BLUE, (520, 520), (0, 230)),
)
for sid, (txt, col, anc, off) in STICKERS.items():
    a, b = T(sid) + 0.55, TE(sid) - 0.15
    OVERLAYS.append(sticker(sid, a, b, txt, col, anc, off))

def gs(sid, src_t):
    s = SHOTS[SID[sid]]
    return T(sid) + (src_t - s["tin"])

SUBS = [
    (gs("g2", 0.30), gs("g2", 1.42), [("четверта", gs("g2", 0.30)), ("за", gs("g2", 0.72)), ("висотою", gs("g2", 1.0))]),
    (gs("g2", 1.44), TE("g2"), [("гора", gs("g2", 1.44)), ("країни,", gs("g2", 2.36))]),
    (gs("g3", 4.02), gs("g3", 4.70), [("що", gs("g3", 4.08)), ("входить", gs("g3", 4.16))]),
    (gs("g3", 4.70), gs("g3", 5.16), [("до", gs("g3", 4.70)), ("складу", gs("g3", 4.74))]),
    (gs("g3", 5.18), TE("g3") - 0.05, [("масиву", gs("g3", 5.18)), ("Чорногора", gs("g3", 6.76))]),
    (gs("t1", 0.0), gs("t1", 1.46), [("Ви", gs("t1", 0.0)), ("бачите", gs("t1", 0.82))]),
    (gs("t1", 1.48), gs("t1", 3.12), [("на", gs("t1", 1.48)), ("власні", gs("t1", 2.02)), ("очі", gs("t1", 2.66))]),
    (gs("t1", 3.14), TE("t1") - 0.05, [("цю", gs("t1", 3.14)), ("красу", gs("t1", 3.42))]),
]
OVERLAYS.append(subtitles(SUBS))

DEPTH = {  # id: (слово, колір тіні, y центру, прямокутник сегментації, плавна поява)
    "g2": ("ПЕТРОС", GREEN, 1095, (150, 940, 1080, 1750), True),
    "g3": ("ПЕТРОС", GREEN, 1095, (150, 900, 1080, 1750), False),
    "o2": ("СИНЕВИР", BLUE, 1135, (230, 880, 850, 1650), True),
}

def draw_depth(img, t, ctx):
    sid = ctx["sid"]
    word, col, y, rect, anim = DEPTH[sid]
    tl = t - T(sid)
    p = ease_out_cubic(tl / 0.55) if anim else 1.0
    sz = fit_size(word, UNB, 1000, 240)
    spr = text_sprite(word, UNB, sz, WHITE, shadow=0.0)
    glow = text_sprite(word, UNB, sz, col, shadow=0.0)
    gl = cv2.GaussianBlur(glow, (0, 0), 14)
    sc = 1.18 - 0.18 * p + 0.015 * tl
    paste(img, gl, W / 2, y + 10, sc, 0.9 * p)
    paste(img, spr, W / 2, y, sc, 0.96 * p)

# ---------------------------------------------------------------- переходи
TRN = 5
def whip(img, e, direction):
    dx = int(direction * 760 * e * e)
    k = int(3 + 170 * e)
    out = np.roll(img, dx, axis=1)
    return cv2.blur(out, (k | 1, 1))

def zoomt(img, e):
    out = np.zeros_like(img)
    for j, f in enumerate((0.0, 0.5, 1.0)):
        sc = 1 + (0.45 * e * e) * (1 + 0.12 * f)
        M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, sc)
        out += cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT) / 3
    return out

LEAK = None
def leak(img, strength, t):
    global LEAK
    if LEAK is None:
        yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
        LEAK = (xx, yy)
    xx, yy = LEAK
    cx = (0.15 + 0.7 * ((t * 0.9) % 1.0)) * W / 4
    g1 = np.exp(-(((xx - cx) / 120) ** 2 + ((yy - H / 8) / 260) ** 2))
    g2 = np.exp(-(((xx - W / 4 + cx * 0.6) / 90) ** 2 + ((yy - H / 5) / 200) ** 2))
    L = (g1[..., None] * np.array([255, 150, 60]) + g2[..., None] * np.array([255, 90, 120]) * 0.7) * strength
    L = cv2.resize(L.astype(np.float32), (W, H))
    return 255 - (255 - img) * (255 - np.clip(L, 0, 255)) / 255

# ---------------------------------------------------------------- головний цикл
def render_frame(state, k, t, i):
    img = state.base(k)
    sid = state.s["id"]
    ctx = {"sid": sid, "state": state, "k": k}
    if sid in DEPTH:
        u8 = np.clip(img, 0, 255).astype(np.uint8)
        M = SEG.mask(sid, u8, DEPTH[sid][3])[..., None]
        fg = img.copy()
        draw_depth(img, t, ctx)
        img = img * (1 - M) + fg * M
    for ov in OVERLAYS:
        ov(img, t, ctx)
    n = state.n()
    # вихідний перехід
    if i + 1 < len(SHOTS):
        ntr = SHOTS[i + 1]["tr"]
        if ntr in ("whip", "zoom") and k >= n - TRN:
            e = (k - (n - TRN) + 1) / (TRN + 1)
            img = whip(img, e, -1) if ntr == "whip" else zoomt(img, e)
    tr = state.s["tr"]
    if tr in ("whip", "zoom") and k < TRN:
        e = 1 - (k + 1) / (TRN + 1)
        img = whip(img, e, 1) if tr == "whip" else zoomt(img, e)
    if tr == "flash" and k < 4:
        img = img + (255 - img) * (0.85 * (1 - k / 4))
    # light leaks довкола склейок типу leak
    for j, s in enumerate(SHOTS):
        if s["tr"] == "leak":
            d = t - starts[j]
            if -0.35 < d < 0.55:
                img = leak(img, bell((d + 0.35) / 0.9) * 0.85, t)
    letterbox(img, t)
    return img

def main():
    global SEG
    SEG = Segmenter(MODEL)
    nfr_total = int(round((TOTAL + TAIL) * FPS))
    if PREVIEW:
        for tp in PREVIEW:
            f = int(round(tp * FPS))
            i = max(j for j in range(len(SHOTS)) if shot_frames(j)[0] <= f)
            st = ShotState(i)
            k = min(f - st.f0, st.n() - 1)
            if SHOTS[i]["id"] in DEPTH:
                for kk in range(max(0, k - 2), k):
                    SEG.mask(SHOTS[i]["id"], np.clip(st.base(kk), 0, 255).astype(np.uint8), DEPTH[SHOTS[i]["id"]][3])
            img = render_frame(st, k, f / FPS, i)
            cv2.imwrite(os.path.join(WORK, f"prev_{tp:06.2f}.jpg"), cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
        print("preview ok")
        return
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                           "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    last = None
    fcount = 0
    for i in range(len(SHOTS)):
        st = ShotState(i)
        for k in range(st.n()):
            t = (st.f0 + k) / FPS
            img = render_frame(st, k, t, i)
            last = img
            ff.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
            fcount += 1
        print(f"shot {i+1}/{len(SHOTS)} {SHOTS[i]['id']} done, frames {fcount}", flush=True)
        del st
    # хвіст: затемнення
    while fcount < nfr_total:
        t = fcount / FPS
        a = clamp01((t - TOTAL) / TAIL)
        img = last * (1 - a)
        letterbox(img, t)
        ff.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
        fcount += 1
    ff.stdin.close(); ff.wait()
    with open(os.path.join(WORK, "pops.txt"), "w") as fh:
        fh.write("\n".join(str(p) for p in sorted(set(POPS))))
    print("video ok", fcount, "frames")

if __name__ == "__main__":
    main()
