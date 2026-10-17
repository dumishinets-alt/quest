#!/usr/bin/env python3
"""
Синтез усіх звуків для промо (без жодних завантажень з інтернету).

  python3 scripts/generate_audio.py            # SFX + музика
  python3 scripts/generate_audio.py --sfx-only
  python3 scripts/generate_audio.py --music-only

SFX  -> public/sfx/*.wav
Музика -> public/music.mp3 (тільки якщо там ще немає ВАШОГО треку;
          синтезований трек позначається файлом public/.music-generated)

Таймлайн музики береться з src/config.ts через scripts/export-timeline.mts,
тож бас і барабани вступають саме на «ЗАПУСК», а фінал збігається зі спалахом.
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(ROOT, "public", "sfx")
PUBLIC = os.path.join(ROOT, "public")
rng = np.random.default_rng(20260118)


# ---------------------------------------------------------------------------
# Утиліти
# ---------------------------------------------------------------------------
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def noise(n):
    return rng.uniform(-1, 1, n)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def svf_sweep(x, fc_curve, q=0.7):
    """Смуговий фільтр зі змінною частотою (Chamberlin SVF) — для whoosh/riser."""
    low = band = 0.0
    out = np.zeros_like(x)
    damp = 1.0 / q
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc_curve[i], SR / 6) / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        out[i] = band
    return out


def env_adsr(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = n - a - d - r if sustain_len is None else int(sustain_len * SR)
    sl = max(sl, 0)
    e = np.concatenate([
        np.linspace(0, 1, a, endpoint=False) ** 2 if a else [],
        np.linspace(1, s, d, endpoint=False) if d else [],
        np.full(sl, s),
        np.linspace(s, 0, r) if r else [],
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def reverb(x, decay=2.0, mix=0.35, predelay=0.012, tone=6000, width=1.0):
    """Конволюційний реверб з експоненційно згасаючим шумом (стерео)."""
    n = int(decay * SR)
    tt = np.arange(n) / SR
    irs = []
    for _ in range(2):
        ir = noise(n) * np.exp(-6.9 * tt / decay)
        ir = lp(ir, tone)
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    mono = x if x.ndim == 1 else x.mean(axis=1)
    wet = np.stack([signal.fftconvolve(mono, irs[0]), signal.fftconvolve(mono, irs[1])], axis=1)
    side = (wet[:, 0] - wet[:, 1]) / 2 * width
    mid = (wet[:, 0] + wet[:, 1]) / 2
    wet = np.stack([mid + side, mid - side], axis=1)
    dry = stereo(x)
    dry = np.pad(dry, ((0, len(wet) - len(dry)), (0, 0)))
    return dry * (1 - mix) + wet * mix


def stereo(x, pan=0.0):
    if x.ndim == 2:
        return x
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], axis=1)


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


def normalize(x, peak_db=-3.0):
    p = np.max(np.abs(x))
    return x if p == 0 else x * (10 ** (peak_db / 20) / p)


def trim_tail(x, thresh_db=-70):
    th = 10 ** (thresh_db / 20)
    mono = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    idx = np.where(mono > th)[0]
    return x[: idx[-1] + 1] if len(idx) else x


def write_wav(name, x, peak_db=-3.0):
    x = fade(trim_tail(normalize(stereo(x), peak_db)))
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    path = os.path.join(SFX_DIR, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  sfx/{name:18s} {len(x) / SR:5.2f} s")


def saw(freq_curve):
    phase = np.cumsum(freq_curve) / SR
    return 2 * (phase % 1.0) - 1


def sine(freq_curve, phase0=0.0):
    return np.sin(2 * np.pi * np.cumsum(freq_curve) / SR + phase0)


# ---------------------------------------------------------------------------
# SFX
# ---------------------------------------------------------------------------
def sfx_whoosh(dur=0.9, f0=300, f1=4500, f2=600, name="whoosh.wav"):
    tt = t_axis(dur)
    n = len(tt)
    k = tt / dur
    # частота «пролітає» вгору і назад — як повітря повз камеру
    fc = np.where(k < 0.55, f0 * (f1 / f0) ** (k / 0.55), f1 * (f2 / f1) ** ((k - 0.55) / 0.45))
    x = svf_sweep(noise(n), fc, q=1.4)
    x += 0.5 * svf_sweep(noise(n), fc * 0.5, q=0.9)
    e = np.sin(np.pi * np.clip(k, 0, 1)) ** 2.2
    x *= e
    pan = np.linspace(-0.8, 0.8, n)
    l = x * np.cos((pan + 1) * np.pi / 4)
    r = x * np.sin((pan + 1) * np.pi / 4)
    write_wav(name, reverb(np.stack([l, r], axis=1), decay=0.8, mix=0.2))


def sfx_riser(dur=2.0):
    tt = t_axis(dur)
    k = tt / dur
    n = len(tt)
    fc = 250 * (7000 / 250) ** (k ** 1.6)
    nz = svf_sweep(noise(n), fc, q=2.0)
    tone = np.zeros(n)
    for det in (-0.6, 0, 0.7):
        f = 110 * 2 ** (k * 2.5) * 2 ** (det / 12)
        tone += saw(f) * 0.3
    tone = lp(tone, 3000)
    # тремоло, що прискорюється
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(2 + 18 * k ** 2) / SR)
    x = (nz * 0.9 + tone * 0.6) * trem * (k ** 2.4)
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    write_wav("riser.wav", reverb(x, decay=1.2, mix=0.25))


def sfx_impact(name="impact.wav", depth=1.0, decay=2.2):
    dur = 2.6
    tt = t_axis(dur)
    n = len(tt)
    f = 35 + (95 * depth) * np.exp(-tt * 9)
    sub = sine(f) * np.exp(-tt * (2.2 / depth))
    click = hp(noise(n), 1500) * np.exp(-tt * 90) * 0.6
    body = lp(noise(n), 900) * np.exp(-tt * 14) * 1.2
    x = np.tanh((sub * 1.3 + click + body) * 1.6)
    write_wav(name, reverb(x, decay=decay, mix=0.28, tone=3500), peak_db=-2.0)


def sfx_glitch():
    dur = 0.36
    n = int(dur * SR)
    x = np.zeros(n)
    pos = 0
    while pos < n:
        seg = int(rng.uniform(0.008, 0.04) * SR)
        kind = rng.integers(0, 4)
        tt = np.arange(seg) / SR
        if kind == 0:
            s = np.sign(np.sin(2 * np.pi * rng.uniform(80, 1800) * tt))
        elif kind == 1:
            s = noise(seg)
        elif kind == 2:
            s = np.zeros(seg)
        else:
            s = np.sin(2 * np.pi * rng.uniform(2000, 6000) * tt)
        x[pos:pos + seg] = s[: n - pos] * rng.uniform(0.3, 1.0)
        pos += seg
    # bit-crush + sample & hold
    hold = 6
    x = np.repeat(x[::hold], hold)[:n]
    x = np.round(x * 6) / 6
    l, r = x.copy(), np.roll(x, 90)
    write_wav("glitch.wav", np.stack([l, r], axis=1) * 0.8, peak_db=-4.0)


def sfx_tick(i, freq):
    dur = 0.06
    tt = t_axis(dur)
    x = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 140)
    x += bp(noise(len(tt)), 2500, 9000) * np.exp(-tt * 260) * 0.8
    write_wav(f"tick_{i}.wav", stereo(x, pan=rng.uniform(-0.3, 0.3)), peak_db=-4.0)


def key_click(pitch=1.0, heavy=1.0):
    dur = 0.12
    tt = t_axis(dur)
    n = len(tt)
    # натискання: клац + «тук» корпусу
    press = bp(noise(n), 1800 * pitch, 5200 * pitch) * np.exp(-tt * 420)
    thock = sine(np.full(n, 190 * pitch)) * np.exp(-tt * 70) * 0.5 * heavy
    # відпускання клавіші через ~35 мс
    rel = np.zeros(n)
    off = int(0.035 * SR)
    rel[off:] = bp(noise(n - off), 2500 * pitch, 7000 * pitch) * np.exp(-tt[: n - off] * 600) * 0.35
    return press + thock + rel


def sfx_typing():
    pitches = [0.88, 0.94, 1.0, 1.05, 1.12, 1.18]
    for i, p in enumerate(pitches, 1):
        x = key_click(p * rng.uniform(0.98, 1.02))
        write_wav(f"typing_{i}.wav", stereo(x, pan=rng.uniform(-0.25, 0.25)), peak_db=-6.0)
    write_wav("typing_space.wav", key_click(0.75, heavy=1.6), peak_db=-6.0)
    # Enter — важче натискання + маленький «дзинь»
    tt = t_axis(0.5)
    n = len(tt)
    x = np.pad(key_click(0.7, heavy=2.2), (0, n - int(0.12 * SR)))
    x += sine(np.full(n, 1760)) * np.exp(-tt * 9) * 0.12
    write_wav("enter.wav", reverb(x, decay=0.6, mix=0.15), peak_db=-4.0)


def sfx_shimmer():
    dur = 2.4
    tt = t_axis(dur)
    n = len(tt)
    x = np.zeros((n, 2))
    for _ in range(26):
        f = rng.uniform(1800, 7500)
        glide = 1 + 0.04 * tt / dur
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(4, 13) * tt + rng.uniform(0, 6))
        start = rng.uniform(0, 0.9)
        e = np.clip((tt - start) / 0.25, 0, 1) * np.exp(-np.clip(tt - start, 0, None) * rng.uniform(1.5, 3))
        s = sine(f * glide) * trem * e * rng.uniform(0.3, 1)
        x += stereo(s, pan=rng.uniform(-0.9, 0.9))
    write_wav("shimmer.wav", reverb(x, decay=2.5, mix=0.45, tone=9000), peak_db=-5.0)


def bell(f, dur, amp=1.0):
    tt = t_axis(dur)
    mod = np.sin(2 * np.pi * f * 3.5 * tt) * 2.0 * np.exp(-tt * 6)
    return np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt * 5) * amp


def sfx_sparkle():
    dur = 1.0
    n = int(dur * SR)
    x = np.zeros((n, 2))
    notes = [1318.5, 1760, 2217.5, 2637, 3520]  # E6 A6 C#7 E7 A7
    for i, f in enumerate(notes):
        off = int(i * 0.045 * SR)
        b = bell(f, dur - i * 0.045, 1 - i * 0.1)
        x[off:off + len(b)] += stereo(b, pan=-0.6 + i * 0.3)[: n - off]
    write_wav("sparkle.wav", reverb(x, decay=1.8, mix=0.4, tone=9000), peak_db=-5.0)


def sfx_pop():
    dur = 0.3
    tt = t_axis(dur)
    f = 260 + 900 * np.exp(-tt * 45)
    x = sine(f) * np.exp(-tt * 22)
    x += hp(noise(len(tt)), 3000) * np.exp(-tt * 400) * 0.3
    write_wav("pop.wav", reverb(x, decay=0.5, mix=0.12), peak_db=-4.0)


def sfx_swell():
    # акорд A-мінор add9 наростає 1.2 с, «спалах», далі довгий хвіст реверберації
    dur = 5.5
    tt = t_axis(dur)
    n = len(tt)
    chord = [110, 220, 261.63, 329.63, 493.88, 659.25, 987.77]
    x = np.zeros(n)
    for f in chord:
        for det in (-0.08, 0.08):
            x += saw(np.full(n, f * 2 ** (det / 12))) * 0.12
    x = lp(x, 2600)
    up = np.clip(tt / 1.2, 0, 1) ** 2.5
    down = np.exp(-np.clip(tt - 1.2, 0, None) * 1.6)
    x *= up * down
    air = hp(noise(int(0.4 * SR)), 2000) * np.exp(-t_axis(0.4) * 8) * 0.4
    start = int(1.18 * SR)
    x[start:start + len(air)] += air
    write_wav("swell.wav", reverb(x, decay=4.0, mix=0.55, tone=5000, width=1.0), peak_db=-3.0)


def generate_sfx():
    os.makedirs(SFX_DIR, exist_ok=True)
    print("SFX:")
    sfx_whoosh()
    sfx_whoosh(dur=0.45, f0=500, f1=6000, f2=1200, name="whoosh_short.wav")
    sfx_riser()
    sfx_impact("impact.wav", depth=0.7, decay=1.6)
    sfx_impact("boom.wav", depth=1.2, decay=2.8)
    sfx_glitch()
    for i, f in enumerate([3200, 3600, 4100], 1):
        sfx_tick(i, f)
    sfx_typing()
    sfx_shimmer()
    sfx_sparkle()
    sfx_pop()
    sfx_swell()


# ---------------------------------------------------------------------------
# Музика: пульсуючий бас + атмосферний пад, 120 BPM, під таймлайн із config.ts
# ---------------------------------------------------------------------------
def load_timeline():
    out = subprocess.run(
        ["node", os.path.join(ROOT, "scripts", "export-timeline.mts")],
        capture_output=True, text=True, check=True, cwd=ROOT,
    )
    return json.loads(out.stdout)


def generate_music():
    tl = load_timeline()
    fps, bpm = tl["fps"], tl["bpm"]
    sc = tl["scenes"]
    sec = lambda frames: frames / fps
    total = sec(tl["totalFrames"]) + 1.0
    n = int(total * SR)
    tt = np.arange(n) / SR
    beat = 60 / bpm
    bar = beat * 4

    s2 = sec(sc["s2"]["from"])
    s4 = sec(sc["s4"]["from"])
    s5 = sec(sc["s5"]["from"])
    s6 = sec(sc["s6"]["from"])
    flash = s6 + sec(tl["s6Flash"])
    enter = s4 + sec(tl["enter"])

    # Акорди по тактах: Am – F – C – G (корені баса)
    prog = [(110.0, [220, 261.63, 329.63]),  # Am
            (87.31, [174.61, 220, 261.63]),  # F
            (130.81, [196, 261.63, 329.63]),  # C
            (98.0, [196, 246.94, 293.66])]  # G
    bar_idx = (tt // bar).astype(int) % 4

    # --- Пад: розстроєні пилки, повільна атака, м'який фільтр ---
    pad = np.zeros((n, 2))
    for ci, (_, notes) in enumerate(prog):
        mask = (bar_idx == ci).astype(float)
        mask = np.convolve(mask, np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
        for f in notes:
            for det, side in ((-0.12, 0), (0.12, 1), (0.0, None)):
                v = saw(np.full(n, f * 2 ** (det / 12))) * mask * 0.05
                if side is None:
                    pad += stereo(v)
                else:
                    pad[:, side] += v
    pad = lp(pad, 1400)
    pad *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * tt))[:, None]

    # --- Бас: восьмі ноти з «насосом» (sidechain) ---
    root = np.array([prog[i][0] for i in range(4)])[bar_idx]
    bass = saw(root) * 0.6 + sine(root / 2) * 0.7
    bass = lp(bass, 420)
    eighth = beat / 2
    ph8 = (tt % eighth) / eighth
    bass *= np.exp(-ph8 * 3.2) * 0.9 + 0.1

    # sidechain «pump» від кіка на кожну долю
    phb = (tt % beat) / beat
    pump = 0.35 + 0.65 * np.clip(phb / 0.45, 0, 1) ** 0.7

    # --- Кік ---
    kick = np.zeros(n)
    kt = t_axis(0.35)
    k1 = sine(45 + 110 * np.exp(-kt * 30)) * np.exp(-kt * 9)
    k1 += hp(noise(len(kt)), 2000) * np.exp(-kt * 200) * 0.2
    # --- Хет ---
    ht = t_axis(0.08)
    h1 = hp(noise(len(ht)), 7000) * np.exp(-ht * 70)

    hats = np.zeros(n)
    pulse = np.zeros(n)  # «серцебиття» в інтро
    b = 0.0
    while b < total:
        i = int(b * SR)
        in_s4 = s4 <= b < s5
        if s2 <= b < flash:
            # у терміналі кік тільки на 1 і 3 долі, щоб чути клавіатуру
            beat_no = int(round(b / beat)) % 4
            if not in_s4 or beat_no in (0, 2) or b >= enter:
                seg = k1[: max(0, min(len(k1), n - i))]
                kick[i:i + len(seg)] += seg
            off = int((b + beat / 2) * SR)
            seg = h1[: max(0, min(len(h1), n - off))]
            hats[off:off + len(seg)] += seg * 0.5
        elif b < s2:
            seg = (k1 * 0.5)[: max(0, min(len(k1), n - i))]
            if int(round(b / beat)) % 2 == 0:
                pulse[i:i + len(seg)] += lp(seg, 200)
        b += beat

    # --- секції ---
    def ramp(t0, t1):
        return np.clip((tt - t0) / max(t1 - t0, 1e-3), 0, 1)

    bass_gain = ramp(s2 - 0.05, s2) * (1 - ramp(flash, flash + 0.4))
    drums_gain = ramp(s2 - 0.01, s2) * (1 - ramp(flash, flash + 0.05))
    pad_gain = 0.6 + 0.4 * ramp(s2 - 2, s2)

    pump_on = 1 - (1 - pump) * bass_gain  # без «насоса» в інтро
    mix = pad * (pad_gain * pump_on)[:, None]
    mix += stereo(bass * bass_gain * pump)
    mix += stereo(kick * drums_gain * 0.9)
    mix += np.stack([hats * drums_gain * 0.6, np.roll(hats, 240) * drums_gain * 0.6], axis=1)
    mix += stereo(pulse * 0.6)
    mix = reverb(mix, decay=1.6, mix=0.18, tone=4000)[:n]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix = normalize(mix, -3.0)

    wav_path = os.path.join(PUBLIC, ".music-tmp.wav")
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-b:a", "256k",
                    os.path.join(PUBLIC, "music.mp3")], check=True)
    os.remove(wav_path)
    open(os.path.join(PUBLIC, ".music-generated"), "w").write("synth\n")
    print(f"music.mp3: синтезовано {total:.1f} с, 120 BPM (бас вступає на {s2:.2f} с, фінал {flash:.2f} с)")


if __name__ == "__main__":
    args = set(sys.argv[1:])
    if "--music-only" not in args:
        generate_sfx()
    if "--sfx-only" not in args:
        music = os.path.join(PUBLIC, "music.mp3")
        user_track = os.path.exists(music) and not os.path.exists(os.path.join(PUBLIC, ".music-generated"))
        if user_track:
            print("public/music.mp3 — ваш трек, синтез музики пропущено.")
        else:
            generate_music()
