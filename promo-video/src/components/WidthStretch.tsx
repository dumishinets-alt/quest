import React from 'react';
import {FONTS} from '../fonts.ts';
import {flexAxes, measureText} from '../utils.ts';

/**
 * Розширення шрифту: анімує вісь wdth (вузький → дуже широкий) і wght
 * (тонкий → чорний) змінного Roboto Flex. Розмір шрифту підібраний так, що на
 * максимальних осях слово займає рівно `fullWidth` — тобто «розтягується на
 * весь екран».
 */
export const WidthStretch: React.FC<{
  text: string;
  /** 0..1 — прогрес розширення (можна передавати spring > 1 для пружності). */
  progress: number;
  fullWidth: number;
  /** Максимальна висота шрифту (щоб у вертикальному форматі не було гігантських літер). */
  maxFontSize?: number;
  wdth?: [number, number];
  wght?: [number, number];
  color?: string;
  style?: React.CSSProperties;
  /** Рендер-проп: отримує готовий стиль шрифту (для обгорток — Letters, Glitch). */
  children?: (fontStyle: React.CSSProperties, fontSize: number) => React.ReactNode;
}> = ({
  text,
  progress,
  fullWidth,
  maxFontSize = 10000,
  wdth = [25, 151],
  wght = [100, 1000],
  color,
  style,
  children,
}) => {
  const wd = wdth[0] + (wdth[1] - wdth[0]) * progress;
  const wg = Math.max(100, Math.min(1000, wght[0] + (wght[1] - wght[0]) * progress));
  const finalW = measureText(text, {
    fontFamily: FONTS.flex,
    fontSize: 100,
    fontVariationSettings: flexAxes(wdth[1], wght[1]),
  });
  const fontSize = Math.min(maxFontSize, (fullWidth / finalW) * 100);
  const fontStyle: React.CSSProperties = {
    fontFamily: FONTS.flex,
    fontSize,
    lineHeight: 1,
    fontVariationSettings: flexAxes(Math.max(25, Math.min(151, wd)), wg),
    color,
    whiteSpace: 'pre',
    ...style,
  };
  if (children) return <>{children(fontStyle, fontSize)}</>;
  return <span style={fontStyle}>{text}</span>;
};
