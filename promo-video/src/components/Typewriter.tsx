import React from 'react';
import {COLORS} from '../config.ts';

/**
 * Друк тексту в терміналі з курсором. Розклад символів (кадр кожної літери)
 * береться з config.ts — по ньому ж звучать кліки клавіатури.
 */
export const Typewriter: React.FC<{
  schedule: {frame: number; char: string}[];
  frame: number;
  /** Кадр, після якого курсор перестає блимати і зникає (наприклад, після Enter). */
  hideCursorAfter?: number;
  cursorChar?: string;
  style?: React.CSSProperties;
  cursorColor?: string;
}> = ({schedule, frame, hideCursorAfter = Infinity, cursorChar = '_', style, cursorColor = COLORS.accent}) => {
  const typed = schedule.filter((s) => frame >= s.frame).map((s) => s.char).join('');
  const lastTyped = schedule.filter((s) => frame >= s.frame).pop();
  const typing = lastTyped !== undefined && frame - lastTyped.frame < 6 && typed.length < schedule.length;
  // під час друку курсор світиться постійно, в паузі — блимає (2 рази на секунду, у біт)
  const blinkOn = typing || Math.floor(frame / 8) % 2 === 0;
  const showCursor = frame < hideCursorAfter && blinkOn;
  return (
    <span style={{whiteSpace: 'inherit', ...style}}>
      {typed}
      <span style={{color: cursorColor, opacity: showCursor ? 1 : 0}}>{cursorChar}</span>
    </span>
  );
};
