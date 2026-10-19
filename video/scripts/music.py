# Синтез кінематографічного надихаючого треку 110 BPM (без слів) + SFX.
import sys, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
sys.path.insert(0, sys.argv[1])
from timeline import BEAT, SHOTS, shot_starts

SR = 48000
rng = np.random.default_rng(7)
starts, total = shot_starts()
LEN = total + 3.0
N = int(LEN * SR)

def beat_t(b):
    return b * BEAT

def idx(t):
    return int(round(t * SR))

def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)

def note_hz(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def add(buf, sig, t, gain=1.0, pan=0.0):
    i = idx(t)
    if i >= buf.shape[1]:
        return
    s = sig[: buf.shape[1] - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(s)] += s * gain * l * 1.414
    buf[1, i:i + len(s)] += s * gain * r * 1.414

def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na + nd] = np.linspace(1, s, nd)
    if nr > 0 and nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e

def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1

# Акорди по тактах: Dm – Bb – F – C (i – VI – III – VII)
PROG = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]]
ROOTS = [38, 34, 41, 36]

# Секції (у долях)
HOOK_END, INTRO_END = 6, 21
CLIMAX = 76
RISER = 72
FINAL = 103
END_B = 111

music = np.zeros((2, N))
drums = np.zeros((2, N))

def chord_at(b):
    return int(b // 4) % 4

# --- Пади (supersaw через ФНЧ), по такту
for bar in range(0, int(np.ceil(END_B / 4)) + 2):
    b0 = bar * 4
    if b0 >= END_B + 4:
        break
    ch = PROG[bar % 4]
    dur = 4 * BEAT + 0.6
    n = int(dur * SR)
    if b0 < INTRO_END:
        cutoff, g = 900 + 1800 * (b0 / INTRO_END), 0.10
    elif b0 < CLIMAX:
        cutoff, g = 2400, 0.11
    elif b0 < FINAL:
        cutoff, g = 4200, 0.13
    else:
        cutoff, g = 1500, 0.12
    for side, pan in ((0, -0.6), (1, 0.6)):
        sig = np.zeros(n)
        for nt in ch + [ch[0] - 12]:
            for k, det in enumerate((-0.12, -0.05, 0.0, 0.06, 0.11)):
                f = note_hz(nt) * 2 ** ((det + (0.02 if side else -0.02)) / 12)
                sig += saw(f, n, rng.random())
        sig = lp(sig / 20, cutoff) * env_adsr(n, 0.35, 0.4, 0.85, 0.6)
        add(music, sig, beat_t(b0), g, pan)

# --- Бас (з sidechain під бочку з інтро)
for b in range(HOOK_END, END_B):
    if b >= FINAL and b % 4:
        continue
    root = ROOTS[chord_at(b)]
    for half in (0, 0.5):
        n = int(BEAT / 2 * SR)
        f = note_hz(root)
        sig = np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.3 * lp(saw(f, n), 400)
        e = env_adsr(n, 0.005, 0.08, 0.7, 0.05)
        if b >= CLIMAX and b < FINAL:
            g = 0.22
        elif b >= INTRO_END:
            g = 0.17
        else:
            g = 0.11
        add(music, sig * e, beat_t(b + half), g)

# --- Арпеджіо (pluck) восьмими
def pluck(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.5 for h in (1, 2, 3, 4))
    return sig * np.exp(-t * 7)

for b2 in range(HOOK_END * 2, FINAL * 2):
    b = b2 / 2
    if RISER <= b < CLIMAX:
        continue
    ch = PROG[chord_at(b)]
    pattern = [0, 1, 2, 1, 0, 2, 1, 2]
    nt = ch[pattern[b2 % 8]] + 12
    g = 0.06 if b < INTRO_END else (0.075 if b < CLIMAX else 0.09)
    add(music, pluck(note_hz(nt), 0.5), beat_t(b), g, pan=0.35 if b2 % 2 else -0.35)

# --- Мелодія кульмінації (lead)
MELODY = [(0, 74, 2), (2, 76, 1), (3, 77, 1), (4, 74, 2), (6, 72, 2), (8, 77, 2), (10, 76, 1), (11, 74, 1),
          (12, 72, 3), (15, 69, 1), (16, 74, 2), (18, 76, 1), (19, 77, 1), (20, 81, 3), (23, 79, 1), (24, 77, 3)]
for off, nt, ln in MELODY:
    b = CLIMAX + off
    if b >= FINAL:
        break
    dur = ln * BEAT
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.3, 0, 1)
    f = note_hz(nt)
    ph = np.cumsum(f * vib / SR)
    sig = lp(2 * (ph % 1.0) - 1 + 0.5 * (2 * ((ph * 2.003) % 1.0) - 1), 3000)
    sig *= env_adsr(n, 0.04, 0.2, 0.7, 0.25)
    add(music, sig, beat_t(b), 0.07)

# --- Піаноподібні акорди у фіналі
for b in range(FINAL, END_B + 2, 4):
    ch = PROG[chord_at(b)]
    for k, nt in enumerate(ch + [ch[0] + 12]):
        n = int(4 * SR)
        t = np.arange(n) / SR
        f = note_hz(nt)
        sig = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (1.2 + h)) / h for h in (1, 2, 3, 4, 5))
        add(music, sig, beat_t(b) + k * 0.03, 0.08)

# --- Ударні
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + 0.3 * np.exp(-t * 200) * rng.standard_normal(n)

def snare():
    n = int(0.3 * SR); t = np.arange(n) / SR
    return 0.6 * bp(rng.standard_normal(n), 1200, 8000) * np.exp(-t * 14) + 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25)

def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (12 if open_ else 70))

def tom(f0=95):
    n = int(0.8 * SR); t = np.arange(n) / SR
    f = f0 * (0.7 + 0.3 * np.exp(-t * 8))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) + 0.25 * lp(rng.standard_normal(n), 900) * np.exp(-t * 12)

K, S, Ho, Hc = kick(), snare(), hat(True), hat()
kick_times = []
for b in range(HOOK_END, FINAL):
    if RISER <= b < CLIMAX:
        continue
    in_intro = b < INTRO_END
    add(drums, K, beat_t(b), 0.55 if not in_intro else 0.4)
    kick_times.append(beat_t(b))
    if not in_intro and b % 2 == 1:
        add(drums, S, beat_t(b), 0.32)
    if not in_intro:
        add(drums, Hc, beat_t(b + 0.5), 0.07, 0.4)
        if b % 4 == 3:
            add(drums, Ho, beat_t(b + 0.5), 0.05, 0.4)
    if b >= CLIMAX:
        add(drums, tom(80 if b % 2 else 100), beat_t(b), 0.28, -0.3 if b % 2 else 0.3)
        if b % 4 == 3:
            add(drums, tom(120), beat_t(b + 0.5), 0.2, 0.3)

# Snare-рол перед кульмінацією
for i in range(16):
    b = RISER + i * 0.25
    add(drums, S, beat_t(b), 0.08 + 0.3 * (i / 16) ** 2)

# Sidechain на музику
sc = np.ones(N)
for kt in kick_times:
    i = idx(kt); n = int(0.25 * SR)
    seg = sc[i:i + n]
    seg *= 1 - 0.45 * np.exp(-np.arange(len(seg)) / SR * 14)
music *= sc

# --- Реверб (синтетична IR)
irn = int(2.4 * SR); it = np.arange(irn) / SR
ir = np.stack([rng.standard_normal(irn) * np.exp(-it * 2.6), rng.standard_normal(irn) * np.exp(-it * 2.6)])
ir[:, :int(0.01 * SR)] = 0
for c in range(2):
    music[c] += 0.22 * fftconvolve(music[c], ir[c])[:N] / 30
    drums[c] += 0.1 * fftconvolve(drums[c], ir[c])[:N] / 30

# --- SFX
sfx = np.zeros((2, N))

def whoosh(d=0.45):
    n = int(d * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    seg = n // 12
    for k in range(12):
        fc = 400 + 4000 * np.sin(np.pi * (k + 0.5) / 12)
        out[k * seg:(k + 1) * seg] = bp(x, fc * 0.6, min(fc * 1.6, 20000))[k * seg:(k + 1) * seg]
    return lp(out, 6000) * np.sin(np.pi * t / d) ** 2

def pop():
    n = int(0.09 * SR); t = np.arange(n) / SR
    f = 380 + 700 * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)

def impact(d=2.5):
    n = int(d * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.8)
    hit = lp(rng.standard_normal(n), 2500) * np.exp(-t * 9)
    return boom + 0.5 * hit

def riser(d):
    n = int(d * SR); t = np.arange(n) / SR
    p = t / d
    x = rng.standard_normal(n)
    out = np.zeros(n); seg = n // 24
    for k in range(24):
        fc = 300 * 2 ** (5.5 * (k + 0.5) / 24)
        out[k * seg:(k + 1) * seg] = bp(x, fc * 0.7, min(fc * 1.4, 20000))[k * seg:(k + 1) * seg]
    tone = np.sin(2 * np.pi * np.cumsum(200 * 2 ** (3 * p)) / SR)
    return (out * 0.8 + 0.25 * tone) * p ** 2

events = []  # (t, kind) для звіту
for i, s in enumerate(SHOTS):
    t = starts[i]
    if s["tr"] in ("whip", "zoom"):
        add(sfx, whoosh(), t - 0.22, 0.35 if s["tr"] == "whip" else 0.25, pan=0.0)
    if s["tr"] == "leak":
        add(sfx, whoosh(0.8), t - 0.4, 0.15)
add(sfx, impact(), 0.0, 0.5)
add(sfx, impact(), beat_t(CLIMAX), 0.55)
add(sfx, impact(3.0), beat_t(FINAL), 0.45)
add(sfx, riser(beat_t(CLIMAX) - beat_t(RISER - 1)), beat_t(RISER - 1), 0.45)

# Pop-и на появі тексту — моменти задає рендерер (pops.txt) або дефолтно
import os
pf = os.path.join(sys.argv[2], "pops.txt")
if os.path.exists(pf):
    for line in open(pf):
        if line.strip():
            add(sfx, pop(), float(line), 0.22)

np.save(os.path.join(sys.argv[2], "music.npy"), music.astype(np.float32))
np.save(os.path.join(sys.argv[2], "drums.npy"), drums.astype(np.float32))
np.save(os.path.join(sys.argv[2], "sfx.npy"), sfx.astype(np.float32))
print("music ok", LEN, "s")
