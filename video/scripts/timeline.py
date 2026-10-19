# Монтажний таймлайн: 110 BPM, усі склейки — на долю такту.
BPM = 110
BEAT = 60.0 / BPM
FPS = 30
W, H = 1080, 1920

GREEN = (24, 196, 120)    # гори, ліси
BLUE = (30, 120, 235)     # озера
YELLOW = (255, 196, 40)   # рівнини, поля
WHITE = (255, 255, 255)

# Імена дітей — лише ім'я, без прізвища. Порожній рядок = плашка без імені.
NAMES = {
    "petros": "",
    "karpaty": "",
    "krym": "",
    "synevyr": "",
}
SCHOOL = "3 клас · Я досліджую світ"

# speed: число або список (beats, speed) для speed ramp.
# z: зум (Ken Burns) від/до, c: центр кадру (частки ширини/висоти) від/до.
SHOTS = [
    # --- ХУК
    dict(id="hook", src="IMG_6308", tin=0.0, beats=6, z=(1.22, 1.38), c=((0.56, 0.34), (0.58, 0.33)), tr="none", amb=0.35),
    # --- ІНТРО
    dict(id="i1", src="IMG_6293", tin=0.3, beats=3, z=(1.12, 1.22), c=((0.5, 0.45), (0.52, 0.45)), tr="whip", amb=0.25),
    dict(id="i2", src="IMG_6291", tin=1.2, beats=3, z=(1.25, 1.4), c=((0.36, 0.3), (0.33, 0.27)), tr="whip", amb=0.25),
    dict(id="i3", src="IMG_6292", tin=3.4, beats=3, z=(1.15, 1.28), c=((0.5, 0.42), (0.5, 0.4)), tr="zoom", amb=0.25),
    dict(id="i4", src="IMG_6303", tin=0.0, beats=3, z=(1.3, 1.42), c=((0.62, 0.4), (0.63, 0.41)), tr="whip", amb=0.25),
    dict(id="i5", src="IMG_6305", tin=6.8, beats=3, z=(1.15, 1.25), c=((0.5, 0.6), (0.5, 0.62)), tr="whip", amb=0.25),
    # --- ГОРИ: Петрос
    dict(id="g1", src="IMG_6298", tin=0.3, beats=4, z=(1.12, 1.35), c=((0.55, 0.36), (0.55, 0.34)), tr="leak", amb=0.3),
    dict(id="g2", src="IMG_6297", tin=0.3, beats=5, z=(1.8, 1.86), c=((0.40, 0.47), (0.40, 0.47)), tr="cut", amb=1.0, duck=0.2, depth="ПЕТРОС"),
    dict(id="g3", src="IMG_6297", tin=4.0, beats=7, z=(2.05, 2.12), c=((0.40, 0.49), (0.41, 0.49)), tr="cut", amb=1.0, duck=0.2, depth="ПЕТРОС"),
    # --- ГОРИ: Карпати, Говерланський водоспад
    dict(id="g4", src="IMG_6300", tin=0.6, beats=6, z=(1.55, 1.65), c=((0.45, 0.36), (0.46, 0.37)), tr="whip", amb=0.45, duck=0.45),
    dict(id="g5", src="IMG_6300", tin=7.3, beats=4, z=(1.95, 2.15), c=((0.36, 0.355), (0.37, 0.35)), tr="zoom", amb=0.3),
    # --- ГОРИ: Кримські гори
    dict(id="g6", src="IMG_6302", tin=4.0, beats=6, z=(1.7, 1.8), c=((0.6, 0.33), (0.61, 0.34)), tr="whip", amb=0.45, duck=0.45),
    # --- ОЗЕРА: Синевир
    dict(id="o1", src="IMG_6294", tin=2.5, beats=4, z=(1.5, 1.7), c=((0.45, 0.33), (0.46, 0.32)), tr="leak", amb=0.35),
    dict(id="o2", src="IMG_6295", tin=8.6, beats=7, z=(1.75, 1.85), c=((0.58, 0.50), (0.58, 0.51)), tr="cut", amb=0.9, duck=0.35, depth="СИНЕВИР"),
    # --- Слово вчителя як міст до кульмінації
    dict(id="t1", src="IMG_6307", tin=0.0, beats=7, z=(1.3, 1.4), c=((0.55, 0.32), (0.55, 0.33)), tr="whip", amb=1.0, duck=0.2),
    dict(id="p1", src="IMG_6301", tin=2.6, beats=5, z=(1.6, 1.7), c=((0.55, 0.4), (0.6, 0.42)), tr="zoom", amb=0.4),
    # --- КУЛЬМІНАЦІЯ (слоу-мо 50%, speed ramp)
    dict(id="c1", src="IMG_6296", tin=5.3, beats=6, speed=0.5, z=(1.5, 1.62), c=((0.62, 0.42), (0.63, 0.42)), tr="flash", amb=0.6, natural=True),
    dict(id="c2", src="IMG_6296", tin=7.7, beats=6, speed=0.5, z=(1.42, 1.5), c=((0.5, 0.45), (0.5, 0.45)), tr="whip", amb=0.9, natural=True),
    dict(id="c3", src="IMG_6301", tin=8.4, beats=5, speed=[(2, 2.0), (3, 0.5)], z=(1.45, 1.55), c=((0.55, 0.5), (0.58, 0.5)), tr="zoom", amb=0.6, natural=True),
    dict(id="c4", src="IMG_6308", tin=5.0, beats=6, speed=0.5, z=(1.3, 1.42), c=((0.45, 0.45), (0.45, 0.47)), tr="whip", amb=0.7, natural=True),
    dict(id="c5", src="IMG_6304", tin=4.0, beats=4, z=(1.3, 1.38), c=((0.42, 0.6), (0.42, 0.6)), tr="cut", amb=0.6),
    # --- ФІНАЛ
    dict(id="fin", src="IMG_6293", tin=5.6, beats=8, z=(1.3, 1.06), c=((0.5, 0.47), (0.5, 0.45)), tr="leak", amb=0.3),
]

TAIL = 0.7  # затемнення після останнього кадру


def shot_starts():
    t, out = 0.0, []
    for s in SHOTS:
        out.append(t)
        t += s["beats"] * BEAT
    return out, t


def src_time(shot, tl):
    """Час у джерелі для локального часу tl (сек) усередині кадру."""
    sp = shot.get("speed", 1.0)
    if isinstance(sp, (int, float)):
        return shot["tin"] + sp * tl
    acc, t0 = shot["tin"], 0.0
    for beats, v in sp:
        d = beats * BEAT
        if tl <= t0 + d:
            return acc + v * (tl - t0)
        acc += v * d
        t0 += d
    return acc + sp[-1][1] * (tl - t0)
