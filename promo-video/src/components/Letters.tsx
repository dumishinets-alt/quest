import React from 'react';

/**
 * Розбиває текст на окремі літери (inline-block) і дає кожній власний стиль.
 * На цьому побудовані LetterWave, Twist і «збирання з хаосу».
 */
export const Letters: React.FC<{
  text: string;
  letterStyle: (i: number, n: number, char: string) => React.CSSProperties;
  style?: React.CSSProperties;
}> = ({text, letterStyle, style}) => {
  const chars = [...text];
  return (
    <span style={{display: 'inline-block', whiteSpace: 'pre', ...style}}>
      {chars.map((ch, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            ...letterStyle(i, chars.length, ch),
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
};

/** Хвильова деформація: кожна літера з затримкою (stagger). */
export const LetterWave: React.FC<{
  text: string;
  frame: number;
  amplitude: number; // px
  /** Затримка між літерами (у радіанах фази). */
  stagger?: number;
  speed?: number;
  /** Додаткове масштабування літер у пікові хвилі. */
  scaleAmount?: number;
  style?: React.CSSProperties;
}> = ({text, frame, amplitude, stagger = 0.55, speed = 0.18, scaleAmount = 0, style}) => (
  <Letters
    text={text}
    style={style}
    letterStyle={(i) => {
      const s = Math.sin(frame * speed - i * stagger);
      return {
        transform: `translateY(${-s * amplitude}px) scale(${1 + Math.max(0, s) * scaleAmount})`,
      };
    }}
  />
);

/** Ефект «викрутки»: літери провертаються навколо осі Y з наростаючою фазою. */
export const Twist: React.FC<{
  text: string;
  /** Кут закрутки в градусах на всю довжину слова. */
  twist: number;
  /** Загальний поворот (для анімації «розкручування»). */
  base?: number;
  axis?: 'X' | 'Y';
  perspective?: number;
  style?: React.CSSProperties;
}> = ({text, twist, base = 0, axis = 'Y', perspective = 800, style}) => (
  <Letters
    text={text}
    style={{perspective, ...style}}
    letterStyle={(i, n) => {
      const k = n > 1 ? i / (n - 1) - 0.5 : 0;
      return {transform: `rotate${axis}(${base + k * twist}deg)`};
    }}
  />
);
