import {continueRender, delayRender, staticFile} from 'remotion';
import {loadFont as loadUnbounded} from '@remotion/google-fonts/Unbounded';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadRusso} from '@remotion/google-fonts/RussoOne';
import {loadFont as loadPressStart} from '@remotion/google-fonts/PressStart2P';
import {loadFont as loadLobster} from '@remotion/google-fonts/Lobster';
import type {ShuffleFont} from './config.ts';

const subsets = ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'] as const;

/**
 * Roboto Flex: @remotion/google-fonts віддає лише статичний інстанс 400,
 * без осей. Тому підключаємо повний змінний шрифт (wdth 25–151, wght 100–1000)
 * з public/fonts — це ті самі файли з Google Fonts, лише з усіма осями.
 */
const FLEX_FAMILY = 'Roboto Flex Var';
const flexRanges: Record<(typeof subsets)[number], string> = {
  'cyrillic-ext': 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
};

const loadFlex = () =>
  Promise.all(
    subsets.map((s) => {
      const face = new FontFace(
        FLEX_FAMILY,
        `url(${staticFile(`fonts/RobotoFlex-${s}.woff2`)}) format('woff2')`,
        {weight: '100 1000', stretch: '25% 151%', unicodeRange: flexRanges[s]},
      );
      return face.load().then((f) => {
        (document.fonts as unknown as Set<FontFace>).add(f);
      });
    }),
  );

const opts = {subsets: [...subsets].filter((s) => s !== 'cyrillic-ext' && s !== 'latin-ext')};
const unbounded = loadUnbounded('normal', {weights: ['300', '500', '700', '900'], ...opts});
const mono = loadMono('normal', {weights: ['400', '700'], ...opts});
const playfair = loadPlayfair('normal', {weights: ['900'], ...opts});
const russo = loadRusso('normal', {weights: ['400'], ...opts});
const pressStart = loadPressStart('normal', {weights: ['400'], ...opts});
const lobster = loadLobster('normal', {weights: ['400'], ...opts});

export const FONTS = {
  flex: `"${FLEX_FAMILY}", sans-serif`,
  unbounded: `${unbounded.fontFamily}, sans-serif`,
  mono: `${mono.fontFamily}, monospace`,
  playfair: `${playfair.fontFamily}, serif`,
  russo: `${russo.fontFamily}, sans-serif`,
  pressStart: `${pressStart.fontFamily}, monospace`,
  lobster: `${lobster.fontFamily}, cursive`,
};

/** Стиль кожної гарнітури для «перебіжки» шрифтів (табло). */
export const SHUFFLE_STYLES: Record<ShuffleFont, React.CSSProperties> = {
  unbounded: {fontFamily: FONTS.unbounded, fontWeight: 900},
  playfair: {fontFamily: FONTS.playfair, fontWeight: 900, fontStyle: 'normal'},
  pressStart: {fontFamily: FONTS.pressStart, fontWeight: 400},
  lobster: {fontFamily: FONTS.lobster, fontWeight: 400},
  russo: {fontFamily: FONTS.russo, fontWeight: 400},
  mono: {fontFamily: FONTS.mono, fontWeight: 700},
  flex: {fontFamily: FONTS.flex, fontVariationSettings: '"wdth" 25, "wght" 900'},
  final: {fontFamily: FONTS.unbounded, fontWeight: 700},
};

/** Проміс завантаження ВСІХ шрифтів (рендер чекає на нього). */
export const fontsReady: Promise<void> = (() => {
  const handle = delayRender('Loading fonts');
  const p = Promise.all([
    loadFlex(),
    unbounded.waitUntilDone(),
    mono.waitUntilDone(),
    playfair.waitUntilDone(),
    russo.waitUntilDone(),
    pressStart.waitUntilDone(),
    lobster.waitUntilDone(),
  ]).then(() => document.fonts.ready.then(() => undefined));
  p.then(() => continueRender(handle));
  return p;
})();
