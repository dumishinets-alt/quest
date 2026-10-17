import React from 'react';
import {COLORS} from '../config.ts';
import {hash} from '../utils.ts';

/**
 * Власний абстрактний символ — «іскра»: тонкі промені різної довжини
 * з крапками на кінцях, орбітальне кільце і сяюче ядро.
 * (Навмисно не схожий на жоден офіційний логотип.)
 */
export const Spark: React.FC<{
  size: number;
  frame: number;
  /** 0..1 — наскільки іскра «розкрита» (поява). */
  reveal?: number;
  /** Сила пульсації. */
  pulse?: number;
  /** 0..1 — фінальний спалах. */
  flash?: number;
  style?: React.CSSProperties;
}> = ({size, frame, reveal = 1, pulse = 1, flash = 0, style}) => {
  const rays = 14;
  const c = 100; // viewBox 200x200
  const beat = Math.sin((frame / 15) * Math.PI); // пульс у ритм 120 BPM
  const breathe = 1 + 0.06 * pulse * beat ** 2;
  const rot = frame * 0.35;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{overflow: 'visible', ...style}}
    >
      <defs>
        <radialGradient id="spark-glow">
          <stop offset="0%" stopColor={COLORS.accentHot} stopOpacity={0.9} />
          <stop offset="35%" stopColor={COLORS.accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="spark-core">
          <stop offset="0%" stopColor={COLORS.cream} />
          <stop offset="55%" stopColor={COLORS.accentHot} />
          <stop offset="100%" stopColor={COLORS.accent} />
        </radialGradient>
      </defs>

      {/* світіння */}
      <circle
        cx={c}
        cy={c}
        r={(70 + 25 * pulse * Math.abs(beat) + flash * 260) * reveal}
        fill="url(#spark-glow)"
        opacity={0.75 + flash * 0.25}
      />

      {/* орбітальне кільце */}
      <circle
        cx={c}
        cy={c}
        r={58 * reveal * breathe}
        fill="none"
        stroke={COLORS.accent}
        strokeWidth={0.8}
        strokeDasharray="2 6"
        opacity={0.55 * reveal}
        transform={`rotate(${-rot * 2} ${c} ${c})`}
      />

      <g transform={`rotate(${rot} ${c} ${c})`}>
        {Array.from({length: rays}).map((_, i) => {
          const long = i % 2 === 0;
          const jitter = (hash(i + 3) - 0.5) * 9;
          const angle = (i / rays) * 360 + jitter;
          const phase = Math.sin(frame / 9 + i * 1.7) * 0.5 + 0.5;
          const len =
            (long ? 78 : 46 + hash(i) * 14) * reveal * breathe * (1 + 0.12 * pulse * phase) +
            flash * 60;
          const r0 = 16 + 4 * hash(i + 7);
          const rad = (angle * Math.PI) / 180;
          const x1 = c + Math.cos(rad) * r0;
          const y1 = c + Math.sin(rad) * r0;
          const x2 = c + Math.cos(rad) * len;
          const y2 = c + Math.sin(rad) * len;
          return (
            <g key={i} opacity={reveal}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={long ? COLORS.accent : COLORS.accentHot}
                strokeWidth={long ? 3.2 : 2}
                strokeLinecap="round"
              />
              {long ? <circle cx={x2} cy={y2} r={3.6 + 1.5 * phase} fill={COLORS.cream} /> : null}
            </g>
          );
        })}
      </g>

      {/* ядро */}
      <circle cx={c} cy={c} r={(11 + 3 * pulse * Math.abs(beat)) * reveal + flash * 30} fill="url(#spark-core)" />
    </svg>
  );
};
