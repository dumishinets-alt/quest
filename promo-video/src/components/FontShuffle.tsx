import React from 'react';
import type {ShuffleFont} from '../config.ts';
import {SHUFFLE_STYLES} from '../fonts.ts';
import {measureText} from '../utils.ts';

/**
 * Зміна шрифтів у кадрі: текст швидко «перебігає» кілька гарнітур, як на
 * механічному табло, і фіксується на фінальній. Розклад перемикань береться з
 * config.ts (той самий розклад використовує звук «tick»).
 *
 * Кожна гарнітура масштабується так, щоб найдовший рядок займав `maxWidth`.
 */
export const FontShuffle: React.FC<{
  lines: string[];
  frame: number;
  schedule: {frame: number; font: ShuffleFont}[];
  maxWidth: number;
  maxFontSize: number;
  lineHeight?: number;
  /** Як рендерити рядок (можна обгорнути в Letters тощо). */
  renderLine?: (line: string, i: number, style: React.CSSProperties) => React.ReactNode;
  color?: string;
  /** Множник розміру для кожного рядка (наприклад, більший заголовок). */
  lineScale?: number[];
}> = ({lines, frame, schedule, maxWidth, maxFontSize, lineHeight = 1.15, renderLine, color, lineScale}) => {
  let current: ShuffleFont = 'final';
  let since = 0;
  if (frame < schedule[0].frame) {
    current = 'final';
    since = 99;
  } else {
    for (const s of schedule) {
      if (frame >= s.frame) {
        current = s.font;
        since = frame - s.frame;
      }
    }
  }
  const base = SHUFFLE_STYLES[current];
  const scaleOf = (i: number) => lineScale?.[i] ?? 1;
  const widest = Math.max(...lines.map((l, i) => measureText(l, {...base, fontSize: 100}) * scaleOf(i)));
  const fontSize = Math.min(maxFontSize, (maxWidth / widest) * 100);
  // легкий «клац» масштабу на кожному перемиканні
  const bump = since < 3 ? 1 + 0.04 * (3 - since) / 3 : 1;

  return (
    <div style={{textAlign: 'center', color, transform: `scale(${bump})`}}>
      {lines.map((line, i) => {
        const style: React.CSSProperties = {
          ...base,
          fontSize: fontSize * scaleOf(i),
          lineHeight,
          whiteSpace: 'pre',
          display: 'block',
        };
        return (
          <div key={i}>{renderLine ? renderLine(line, i, style) : <span style={style}>{line}</span>}</div>
        );
      })}
    </div>
  );
};

/** Яка гарнітура активна на кадрі (для інших ефектів). */
export const currentShuffleFont = (frame: number, schedule: {frame: number; font: ShuffleFont}[]) => {
  let current: ShuffleFont = 'final';
  for (const s of schedule) if (frame >= s.frame) current = s.font;
  return current;
};
