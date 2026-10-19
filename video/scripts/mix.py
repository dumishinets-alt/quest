# Мікс: живий звук кліпів (шумоподавлення + вирівнювання), музика з ducking, SFX.
import sys, os, subprocess, numpy as np
sys.path.insert(0, sys.argv[1])
from timeline import SHOTS, BEAT, TAIL, shot_starts
SRC, WORK = sys.argv[2], sys.argv[3]
SR = 48000
starts, total = shot_starts()

music = np.load(os.path.join(WORK, "music.npy"))
drums = np.load(os.path.join(WORK, "drums.npy"))
sfx = np.load(os.path.join(WORK, "sfx.npy"))
N = int((total + TAIL) * SR)

cache = {}
def clip_audio(name):
    if name not in cache:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(SRC, name + ".MOV"), "-af",
                              "highpass=f=110,lowpass=f=8500,afftdn=nf=-28:nt=w,dynaudnorm=f=200:g=11:p=0.9:m=8",
                              "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
        cache[name] = np.frombuffer(raw, np.float32)
    return cache[name]

voice = np.zeros(N, np.float32)
duck = np.ones(N, np.float32)
fade = int(0.03 * SR)
for i, s in enumerate(SHOTS):
    t0 = starts[i]; d = s["beats"] * BEAT
    a = clip_audio(s["src"])
    i0 = int(s["tin"] * SR); n = int(d * SR)
    seg = a[i0:i0 + n].copy()
    if len(seg) < n:
        seg = np.pad(seg, (0, n - len(seg)))
    env = np.ones(n, np.float32); env[:fade] = np.linspace(0, 1, fade); env[-fade:] = np.linspace(1, 0, fade)
    o = int(t0 * SR)
    voice[o:o + n] += (seg * env * s.get("amb", 0.3))[: N - o]
    if "duck" in s:
        duck[o:o + n] = s["duck"]

# плавні рампи ducking (150 мс)
k = int(0.15 * SR)
ker = np.ones(k, np.float32) / k
duck = np.convolve(np.pad(duck, (k, k), mode="edge"), ker, mode="same")[k:-k]

bed = (music[:, :N] + 0.7 * drums[:, :N]) * duck[None, :]
mix = bed * 0.85 + voice[None, :] * 0.9 + sfx[:, :N]
# фінальне затухання
fo = int(1.6 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
mix /= max(1e-6, np.abs(mix).max()) / 0.95
mix.T.astype(np.float32).tofile(os.path.join(WORK, "mix.f32"))
print("mix ok", N / SR)
