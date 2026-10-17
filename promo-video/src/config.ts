/**
 * ЄДИНИЙ ФАЙЛ НАЛАШТУВАНЬ ПРОМО-ВІДЕО.
 *
 * Тут усі тексти, кольори, таймінги сцен і таймінги звуків.
 * Усі таймінги — у КАДРАХ (30 fps) і відраховуються ВІД ПОЧАТКУ СЦЕНИ,
 * тож якщо сцена подовжиться (наприклад, через довший голос), усі її ефекти
 * зсунуться разом із нею.
 *
 * Музика — 120 BPM: 1 біт = 15 кадрів, 1 такт = 60 кадрів.
 * Межі сцен і великі акценти поставлені на біти.
 *
 * Файл не імпортує нічого з Remotion — його читає і скрипт генерації музики
 * (scripts/export-timeline.ts), тож музика завжди збігається з відео.
 */
import {voiceManifest} from './voice-manifest.ts';

// ---------------------------------------------------------------------------
// Базові параметри
// ---------------------------------------------------------------------------
export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 кадрів
export const BAR = BEAT * 4; // 60 кадрів

export const FORMATS = {
  landscape: {id: 'Promo', width: 1920, height: 1080},
  vertical: {id: 'PromoVertical', width: 1080, height: 1920},
} as const;

// ---------------------------------------------------------------------------
// Кольори
// ---------------------------------------------------------------------------
export const COLORS = {
  bg: '#0E0E10',
  bgLift: '#17161A', // трохи світліший для панелей/терміналу
  accent: '#D97757', // кораловий / теракотовий
  accentHot: '#F0A07E', // світліший відтінок для світіння
  accentDeep: '#8E4430',
  cream: '#F5F0E8',
  creamDim: 'rgba(245, 240, 232, 0.55)',
  muted: '#6E6A66',
  glitchA: '#FF3B3B',
  glitchB: '#2EE6FF',
};

// ---------------------------------------------------------------------------
// Тексти
// ---------------------------------------------------------------------------
export const TEXT = {
  s1Tagline: 'Щось починається…',
  s2Word: 'ЗАПУСК',
  /** Назва курсу. landscape — рядки для 16:9, vertical — для 9:16. */
  s3Title: {
    landscape: ['AI в освіті:', 'прості кроки — новий результат'],
    vertical: ['AI в освіті:', 'прості кроки —', 'новий результат'],
  },
  s3Kicker: 'новий курс',
  s4Command: '> починаю професійно вивчати Claude',
  s4Output: '[ ok ] навчання розпочато',
  s4Keywords: ['промпти', 'агенти', 'автоматизація'],
  s5Header: 'Курс дасть:',
  s5Theses: ['ВПЕВНЕНІСТЬ', 'ВІРУ', 'НОВЕ БАЧЕННЯ'],
  s6Start: 'Старт — 18 січня',
  /** Рядки фінального тексту для вертикальної версії. */
  s6StartVertical: ['Старт —', '18 січня'],
  /** Третя теза у вертикальній версії — у два рядки. */
  s5Thesis3Vertical: ['НОВЕ', 'БАЧЕННЯ'],
  s6Handle: '@sasha_dum4k',
};

// ---------------------------------------------------------------------------
// Голос
// ---------------------------------------------------------------------------
export const VOICE = {
  /** Кадр усередині сцени 1, коли починається voice1. */
  voice1StartInScene: 18,
  /** Кадр усередині сцени 6, коли починається voice2. */
  voice2StartInScene: 15,
  /** Запас після закінчення голосу до кінця сцени / спалаху. */
  tailPad: 20,
};

const ceilToBeat = (frames: number) => Math.ceil(frames / BEAT) * BEAT;
const voiceFrames = (clip: {durationSec: number} | null) =>
  clip ? Math.ceil(clip.durationSec * FPS) : 0;

export const VOICE1_FRAMES = voiceFrames(voiceManifest.voice1);
export const VOICE2_FRAMES = voiceFrames(voiceManifest.voice2);

// ---------------------------------------------------------------------------
// Сцени. Тривалість сцен 1 і 6 автоматично подовжується під голос
// (з округленням до біта, щоб не збити ритм).
// ---------------------------------------------------------------------------
const S1_BASE = 150; // 5 с
const S6_FLASH_BASE = 120; // спалах іскри у фіналі (кадр усередині сцени 6)
const S6_AFTER_FLASH = 60; // від'їзд камери + затемнення після спалаху

const s1Duration = Math.max(
  S1_BASE,
  ceilToBeat(VOICE.voice1StartInScene + VOICE1_FRAMES + VOICE.tailPad),
);
/** Кадр спалаху у фіналі — після закінчення voice2. */
export const S6_FLASH = Math.max(
  S6_FLASH_BASE,
  ceilToBeat(VOICE.voice2StartInScene + VOICE2_FRAMES + 10),
);

const durations = {
  s1: s1Duration,
  s2: 180, // 6 с
  s3: 240, // 8 с
  s4: 240, // 8 с
  s5: 210, // 7 с
  s6: S6_FLASH + S6_AFTER_FLASH, // 6 с (або довше під голос)
};

export type SceneId = keyof typeof durations;
const order: SceneId[] = ['s1', 's2', 's3', 's4', 's5', 's6'];

export const SCENES = (() => {
  let from = 0;
  const out = {} as Record<SceneId, {from: number; duration: number}>;
  for (const id of order) {
    out[id] = {from, duration: durations[id]};
    from += durations[id];
  }
  return out;
})();

export const TOTAL_FRAMES = SCENES.s6.from + SCENES.s6.duration;

/** Глобальний кадр із (сцена, локальний кадр). */
export const at = (scene: SceneId, local: number) => SCENES[scene].from + local;

// ---------------------------------------------------------------------------
// Ключові кадри анімацій (локальні для кожної сцени)
// ---------------------------------------------------------------------------
export const T = {
  s1: {
    sparkIn: 8,
    taglineIn: 45,
  },
  s2: {
    slam: 0, // слово з'являється (flash-cut)
    stretchStart: 8,
    stretchFull: 60, // слово на весь екран
    distortStart: 75,
    glitch: 98, // RGB-розшарування
    glitchLen: 9,
    panToP: 112, // камера панорамує до «П»
    flyStart: 135, // проліт крізь «П»
    /** За скільки кадрів до кінця сцени 2 у «П» вже видно сцену 3. */
    portalOverlap: 36,
  },
  s3: {
    assembleStart: 0,
    assembleEnd: 60, // літери стали на місця
    shuffleStart: 75,
    shuffleEnd: 135, // фіксація шрифту
    whipOut: 228,
  },
  s4: {
    whipIn: 0,
    typeStart: 18,
    /** Кадрів на символ (середнє) — з невеликою випадковою варіацією. */
    framesPerChar: 2.4,
    curtainOut: 212,
  },
  s5: {
    headerIn: 15,
    theses: [30, 75, 120], // на біти
  },
  s6: {
    morphIn: 0,
    startTextIn: 22,
    handleIn: 52,
  },
};

// ---------------------------------------------------------------------------
// Розклад «перебіжки» шрифтів у сцені 3 (кадри перемикань) — спільний для
// анімації та звуку «tick». Інтервали спершу швидкі, потім сповільнюються.
// ---------------------------------------------------------------------------
export const SHUFFLE_FONTS = [
  'unbounded',
  'playfair',
  'pressStart',
  'lobster',
  'russo',
  'mono',
  'flex',
] as const;
export type ShuffleFont = (typeof SHUFFLE_FONTS)[number] | 'final';

export const SHUFFLE_SCHEDULE: {frame: number; font: ShuffleFont}[] = (() => {
  const gaps = [3, 3, 3, 3, 4, 4, 5, 6, 7, 8, 10];
  const out: {frame: number; font: ShuffleFont}[] = [];
  let f = T.s3.shuffleStart;
  gaps.forEach((g, i) => {
    out.push({frame: f, font: SHUFFLE_FONTS[i % SHUFFLE_FONTS.length]});
    f += g;
  });
  out.push({frame: T.s3.shuffleEnd, font: 'final'});
  return out;
})();

// ---------------------------------------------------------------------------
// Розклад друку в терміналі (сцена 4) — детермінована «людська» варіація.
// ---------------------------------------------------------------------------
const seeded = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

export const TYPING_SCHEDULE: {frame: number; char: string; variant: number; gain: number}[] =
  (() => {
    const chars = [...TEXT.s4Command];
    let f = T.s4.typeStart;
    return chars.map((char, i) => {
      const r = seeded(i + 1);
      const frame = Math.round(f);
      // після пробілу — коротка пауза, як у живої людини
      f += T.s4.framesPerChar * (0.6 + r * 0.9) + (char === ' ' ? 2 : 0);
      return {
        frame,
        char,
        variant: Math.floor(seeded(i + 101) * 6) + 1, // typing_1..6.wav
        gain: 0.65 + seeded(i + 201) * 0.35, // варіація гучності
      };
    });
  })();
export const TYPING_END = TYPING_SCHEDULE[TYPING_SCHEDULE.length - 1].frame;
/** Enter — на найближчому біті після останньої літери. */
export const ENTER_FRAME = ceilToBeat(TYPING_END + 6);
/** Поява ключових слів «промпти / агенти / автоматизація» — на біти після Enter. */
export const KEYWORD_FRAMES = [1, 2, 3].map((i) => ENTER_FRAME + i * BEAT);

// ---------------------------------------------------------------------------
// Звук: баланс
// ---------------------------------------------------------------------------
export const MIX = {
  voice: 1.0,
  sfx: 0.8,
  music: 0.6,
  /** Під час голосу: */
  musicUnderVoice: 0.25,
  sfxUnderVoice: 0.5,
  /** У ключові моменти музика приглушується на 30–40%. */
  musicKeyMoment: 0.65,
  musicFadeInFrames: 45,
  musicFadeOutFrames: 60, // останні 2 с
  /** Плавність входу/виходу приглушення. */
  duckRamp: 8,
};

/** Вікна, у яких музика приглушується на 30–40% (ключові моменти). */
export const MUSIC_KEY_MOMENTS: {scene: SceneId; from: number; to: number; label: string}[] = [
  {scene: 's2', from: T.s2.flyStart - 6, to: durations.s2 + 10, label: 'проліт крізь «П»'},
  {scene: 's3', from: T.s3.assembleEnd - 20, to: T.s3.shuffleEnd + 20, label: 'поява назви курсу'},
  {scene: 's6', from: S6_FLASH - 20, to: S6_FLASH + 40, label: 'фінал'},
];

// ---------------------------------------------------------------------------
// Звукові ефекти. Кожен прив'язаний до кадру анімації (сцена + локальний кадр).
// file — у public/sfx/. gain — 0..1 (до MIX.sfx).
// ---------------------------------------------------------------------------
export type SfxCue = {scene: SceneId; at: number; file: string; gain?: number; label?: string};

export const SFX_CUES: SfxCue[] = [
  // Сцена 1 — іскра
  {scene: 's1', at: T.s1.sparkIn, file: 'shimmer.wav', gain: 0.8, label: 'поява іскри'},
  {scene: 's1', at: T.s1.taglineIn, file: 'sparkle.wav', gain: 0.55, label: 'текст'},
  {scene: 's2', at: -60, file: 'riser.wav', gain: 0.8, label: 'наростання перед ЗАПУСК'},

  // Сцена 2 — ЗАПУСК
  {scene: 's2', at: T.s2.slam, file: 'impact.wav', gain: 0.75, label: 'flash-cut'},
  {scene: 's2', at: T.s2.stretchStart, file: 'whoosh.wav', gain: 0.45, label: 'розширення'},
  {scene: 's2', at: T.s2.stretchFull, file: 'boom.wav', gain: 1.0, label: 'слово на весь екран'},
  {scene: 's2', at: T.s2.glitch, file: 'glitch.wav', gain: 0.8},
  {scene: 's2', at: T.s2.panToP, file: 'whoosh_short.wav', gain: 0.5, label: 'панорама до П'},
  {scene: 's2', at: T.s2.flyStart, file: 'whoosh.wav', gain: 1.0, label: 'проліт крізь П'},

  // Сцена 3 — назва курсу
  {scene: 's3', at: 0, file: 'shimmer.wav', gain: 0.5, label: 'хаос літер'},
  {scene: 's3', at: T.s3.assembleEnd - 4, file: 'impact.wav', gain: 0.7, label: 'літери на місцях'},
  ...SHUFFLE_SCHEDULE.slice(0, -1).map(
    (s, i): SfxCue => ({scene: 's3', at: s.frame, file: `tick_${(i % 3) + 1}.wav`, gain: 0.7}),
  ),
  {scene: 's3', at: T.s3.shuffleEnd, file: 'boom.wav', gain: 0.6, label: 'фіксація шрифту'},
  {scene: 's3', at: T.s3.whipOut, file: 'whoosh.wav', gain: 0.9, label: 'whip-pan'},

  // Сцена 4 — термінал
  ...TYPING_SCHEDULE.filter((t) => t.char !== ' ').map(
    (t): SfxCue => ({scene: 's4', at: t.frame, file: `typing_${t.variant}.wav`, gain: t.gain * 0.9}),
  ),
  ...TYPING_SCHEDULE.filter((t) => t.char === ' ').map(
    (t): SfxCue => ({scene: 's4', at: t.frame, file: 'typing_space.wav', gain: 0.75}),
  ),
  {scene: 's4', at: ENTER_FRAME, file: 'enter.wav', gain: 0.95, label: 'Enter'},
  ...KEYWORD_FRAMES.map(
    (k): SfxCue => ({scene: 's4', at: k, file: 'pop.wav', gain: 0.75, label: 'ключове слово'}),
  ),
  {scene: 's4', at: T.s4.curtainOut, file: 'whoosh.wav', gain: 0.8, label: 'шторка'},

  // Сцена 5 — тези
  {scene: 's5', at: T.s5.headerIn, file: 'pop.wav', gain: 0.6},
  {scene: 's5', at: T.s5.theses[0], file: 'boom.wav', gain: 0.75, label: 'ВПЕВНЕНІСТЬ'},
  {scene: 's5', at: T.s5.theses[0], file: 'pop.wav', gain: 0.6},
  {scene: 's5', at: T.s5.theses[1], file: 'pop.wav', gain: 0.8, label: 'ВІРУ'},
  {scene: 's5', at: T.s5.theses[1], file: 'sparkle.wav', gain: 0.5},
  {scene: 's5', at: T.s5.theses[2], file: 'glitch.wav', gain: 0.75, label: 'НОВЕ БАЧЕННЯ'},
  {scene: 's5', at: T.s5.theses[2] + 4, file: 'pop.wav', gain: 0.7},
  {scene: 's6', at: -60, file: 'riser.wav', gain: 0.75, label: 'наростання перед фіналом'},
  {scene: 's6', at: -12, file: 'whoosh_short.wav', gain: 0.7, label: 'morph'},

  // Сцена 6 — фінал
  {scene: 's6', at: T.s6.morphIn, file: 'impact.wav', gain: 0.6},
  {scene: 's6', at: T.s6.startTextIn, file: 'pop.wav', gain: 0.6},
  {scene: 's6', at: T.s6.handleIn, file: 'pop.wav', gain: 0.6},
  {scene: 's6', at: S6_FLASH - 4, file: 'sparkle.wav', gain: 0.7, label: 'спалах іскри'},
  {scene: 's6', at: S6_FLASH, file: 'swell.wav', gain: 1.0, label: 'swell + reverb'},
  {scene: 's6', at: S6_FLASH + 2, file: 'whoosh.wav', gain: 0.7, label: 'різкий від\'їзд'},
];

/** Голосові кліпи з глобальними кадрами (null — запису немає). */
export const VOICE_CUES = [
  voiceManifest.voice1 && {
    file: voiceManifest.voice1.file,
    from: at('s1', VOICE.voice1StartInScene),
    frames: VOICE1_FRAMES,
  },
  voiceManifest.voice2 && {
    file: voiceManifest.voice2.file,
    from: at('s6', VOICE.voice2StartInScene),
    frames: VOICE2_FRAMES,
  },
].filter(Boolean) as {file: string; from: number; frames: number}[];

// ---------------------------------------------------------------------------
// Flash-cut у ритмі музики (спалахи кадру на біти). strength 0..1
// ---------------------------------------------------------------------------
export const FLASH_CUTS: {scene: SceneId; at: number; strength: number; frames: number}[] = [
  {scene: 's2', at: 0, strength: 1, frames: 6},
  {scene: 's2', at: T.s2.stretchFull, strength: 0.35, frames: 5},
  {scene: 's3', at: T.s3.shuffleEnd, strength: 0.3, frames: 5},
  {scene: 's5', at: T.s5.theses[0], strength: 0.45, frames: 5},
  {scene: 's5', at: T.s5.theses[1], strength: 0.35, frames: 5},
  {scene: 's5', at: T.s5.theses[2], strength: 0.45, frames: 5},
  {scene: 's6', at: S6_FLASH, strength: 1, frames: 14},
];
