import {useEffect, useState} from 'react';
import {continueRender, delayRender, Easing, interpolate, useVideoConfig} from 'remotion';
import {fontsReady} from './fonts.ts';

/** Плавні easing-криві, що використовуються всюди (без лінійних рухів). */
export const EASE = {
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Різкий старт + довге гальмування — для whip-pan і різких від'їздів. */
  whip: Easing.bezier(0.85, 0, 0.15, 1),
};

/** interpolate з clamp і easing за замовчуванням. */
export const ease = (
  frame: number,
  input: [number, number],
  output: [number, number],
  easing: (t: number) => number = EASE.inOut,
) =>
  interpolate(frame, input, output, {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Детермінований псевдовипадковий шум (для дрижання, хаосу літер тощо). */
export const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Адаптивна верстка: u — одиниця масштабу (1 = 1080 px по короткій стороні). */
export const useLayout = () => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return {width, height, vertical, u};
};

/** Чекає на шрифти й повертає true — до того сцени не рендеряться і не вимірюються. */
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('fonts-ready'));
  useEffect(() => {
    fontsReady.then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};

// ---------------------------------------------------------------------------
// Вимірювання ширини тексту в реальному DOM (з урахуванням осей змінного шрифту)
// ---------------------------------------------------------------------------
const cache = new Map<string, number>();

export const measureText = (text: string, style: React.CSSProperties): number => {
  const key = text + '|' + JSON.stringify(style);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const el = document.createElement('span');
  Object.assign(el.style, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre',
    left: '-99999px',
    top: '0',
    lineHeight: '1',
  });
  for (const [k, v] of Object.entries(style)) {
    // @ts-expect-error — динамічне присвоєння CSS-властивостей
    el.style[k] = typeof v === 'number' && k === 'fontSize' ? `${v}px` : String(v);
  }
  el.textContent = text;
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width;
  document.body.removeChild(el);
  cache.set(key, w);
  return w;
};

/** Розмір шрифту, при якому текст займає рівно maxWidth (але не більше maxSize). */
export const fitFontSize = (
  text: string,
  style: React.CSSProperties,
  maxWidth: number,
  maxSize: number,
) => {
  const w = measureText(text, {...style, fontSize: 100});
  return Math.min(maxSize, (maxWidth / w) * 100);
};

export const flexAxes = (wdth: number, wght: number) => `"wdth" ${wdth.toFixed(2)}, "wght" ${wght.toFixed(1)}`;
