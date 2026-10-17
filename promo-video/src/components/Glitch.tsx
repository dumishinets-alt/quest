import React from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../utils.ts';

/**
 * Коротке glitch-розшарування RGB: вміст розкладається на R/G/B-канали,
 * які зсуваються в різні боки, плюс горизонтальні «зсуви смуг».
 * intensity = 0 — звичайний рендер без жодних накладок.
 */
const channelMatrix = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
};

export const GlitchDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      {Object.entries(channelMatrix).map(([k, m]) => (
        <filter key={k} id={`ch-${k}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={m} />
        </filter>
      ))}
    </defs>
  </svg>
);

export const Glitch: React.FC<{
  intensity: number;
  frame: number;
  /** Максимальний зсув каналів у px. */
  offset?: number;
  slices?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({intensity, frame, offset = 24, slices = 7, children, style}) => {
  if (intensity <= 0.001) {
    return <div style={{position: 'relative', ...style}}>{children}</div>;
  }
  const seed = Math.floor(frame / 2); // дискретні «стрибки», як у справжнього глітчу
  const dx = (k: number) => (hash(seed * 7 + k) - 0.5) * 2 * offset * intensity;

  const layer = (ch: 'r' | 'g' | 'b', x: number, y: number, extra?: React.CSSProperties) => (
    <AbsoluteFill
      style={{
        filter: `url(#ch-${ch})`,
        mixBlendMode: 'screen',
        transform: `translate(${x}px, ${y}px)`,
        ...extra,
      }}
    >
      {children}
    </AbsoluteFill>
  );

  // смуги, що «з'їжджають» вбік
  const bands = Array.from({length: slices}).map((_, i) => {
    const top = hash(seed * 13 + i) * 100;
    const h = 2 + hash(seed * 17 + i) * 12;
    const shift = (hash(seed * 19 + i) - 0.5) * 120 * intensity;
    return {top, h, shift};
  });

  return (
    <div style={{position: 'relative', isolation: 'isolate', ...style}}>
      {/* невидимий оригінал задає розмір блоку */}
      <div style={{visibility: 'hidden'}}>{children}</div>
      {layer('r', dx(1), dx(2) * 0.2)}
      {layer('g', 0, 0)}
      {layer('b', dx(3), dx(4) * 0.2)}
      {bands.map((b, i) => (
        <AbsoluteFill
          key={i}
          style={{
            clipPath: `inset(${b.top}% 0 ${Math.max(0, 100 - b.top - b.h)}% 0)`,
            transform: `translateX(${b.shift}px)`,
            mixBlendMode: 'screen',
            opacity: 0.9,
          }}
        >
          {children}
        </AbsoluteFill>
      ))}
    </div>
  );
};
