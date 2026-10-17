"""Синтез кінематографічного саундтреку (15 с) під таймінг scene.html.

Використання: python3 soundtrack.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 15.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)


def env(a, b, attack, release):
    """Огинаюча: наростання від a, згасання до b (секунди)."""
    e = np.clip((t - a) / attack, 0, 1) * np.clip((b - t) / release, 0, 1)
    return e * e


def lowpass(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * ((f > lo) & (f < hi)), len(x))


def boom(at, f0=70, f1=32, decay=1.4, gain=1.0):
    tt = np.clip(t - at, 0, None)
    phase = 2 * np.pi * (f1 * tt + (f0 - f1) * (1 - np.exp(-tt * 6)) / 6)
    return gain * np.sin(phase) * np.exp(-tt / decay) * (t >= at)


def whoosh(at, length, lo=400, hi=4000, gain=0.25):
    n = bandpass(rng.standard_normal(N), lo, hi)
    n /= np.abs(n).max()
    x = np.clip((t - at) / length, 0, 1)
    return gain * n * np.sin(np.pi * x) ** 2


L = np.zeros(N)
Rch = np.zeros(N)

# Пад: Am(add9) -> F -> C, повільна пульсація, стерео-детюн
chords = [
    (0.0, 6.2, [110, 164.81, 220, 246.94, 329.63]),
    (6.0, 10.5, [87.31, 130.81, 174.61, 220, 261.63]),
    (10.4, 15.0, [65.41, 130.81, 196.0, 261.63, 329.63, 392.0, 523.25]),
]
for a, b, freqs in chords:
    e = env(a, b, 1.2 if a == 0 else 0.4, 1.0)
    for i, f in enumerate(freqs):
        lfo = 0.7 + 0.3 * np.sin(2 * np.pi * (0.25 + i * 0.07) * t + i)
        amp = 0.05 / (1 + i * 0.25)
        L += amp * e * lfo * (np.sin(2 * np.pi * f * 0.998 * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t))
        Rch += amp * e * lfo * (np.sin(2 * np.pi * f * 1.002 * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t))

# Суб-бас
sub = 0.10 * np.sin(2 * np.pi * 55 * t) * env(0, 6.2, 2.0, 0.6)
sub += 0.10 * np.sin(2 * np.pi * 43.65 * t) * env(6.0, 10.5, 0.3, 0.4)
sub += 0.12 * np.sin(2 * np.pi * 32.7 * t) * env(10.45, 15, 0.05, 1.2)

# Тихий «пульс серця» у вступі
for b in [0.9, 1.5, 2.3, 2.9]:
    sub += boom(b, 55, 40, 0.18, 0.35)

# Удари на переходах сцен
hits = boom(3.15, 80, 35, 0.9, 0.7) + boom(6.2, 90, 32, 1.1, 0.8)
# Тики карток
for i in range(4):
    s = 6.55 + i * 0.32
    hits += whoosh(s - 0.15, 0.45, 1500, 7000, 0.12)
    tick = np.sin(2 * np.pi * 1760 * (t - s)) * np.exp(-np.clip(t - s, 0, None) * 30) * (t >= s)
    hits += 0.08 * tick
# Райзер до кульмінації
x = np.clip((t - 7.8) / 2.7, 0, 1) * (t < 10.5)
noise = lowpass(rng.standard_normal(N), 6000)
noise /= np.abs(noise).max()
riser = 0.35 * noise * x ** 3
riser += 0.12 * np.sin(2 * np.pi * (200 * (t - 7.8) + 300 * np.clip(t - 7.8, 0, None) ** 2 / 2.7)) * x ** 2
# Великий удар на титулі
impact = boom(10.5, 110, 30, 1.8, 1.3)
burst = lowpass(rng.standard_normal(N), 3000)
burst /= np.abs(burst).max()
impact += 0.5 * burst * np.exp(-np.clip(t - 10.5, 0, None) * 4) * (t >= 10.5)
# Мерехтіння (дзвіночки) у фіналі
bell = np.zeros(N)
for k, (at, f) in enumerate([(11.0, 1046.5), (11.6, 1318.5), (12.2, 1568.0), (12.9, 2093.0)]):
    tt = np.clip(t - at, 0, None)
    bell += 0.05 * (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 1.8) * (t >= at)

mono = sub + hits + riser + impact
L += mono + bell * 0.8 + whoosh(5.8, 0.7, 300, 3000, 0.15)
Rch += mono + bell * 1.2 + whoosh(5.85, 0.7, 300, 3000, 0.15)

# Простий «реверб»: кілька затриманих загасаючих копій
for d, g in [(0.043, 0.35), (0.071, 0.28), (0.113, 0.2), (0.167, 0.14), (0.241, 0.1)]:
    k = int(d * SR)
    L[k:] += g * Rch[:-k] * 0.6
    Rch[k:] += g * L[:-k] * 0.6

master = np.clip(np.minimum(t / 0.3, 1) * np.clip((DUR - t) / 0.8, 0, 1), 0, 1)
st = np.stack([L, Rch], 1) * master[:, None]
st = np.tanh(st / np.abs(st).max() * 1.4) * 0.89

with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
