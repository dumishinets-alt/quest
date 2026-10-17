import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {COLORS} from '../config.ts';
import {hash, useLayout} from '../utils.ts';

/** Плівкове зерно поверх кадру (нове на кожному кадрі). */
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.11}) => {
  const frame = useCurrentFrame();
  const {width, height} = useLayout();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'screen'}}>
      <svg width={width} height={height}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** М'яке віньєтування. */
export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

/** Пил / частинки для паралаксу (детерміновані позиції). */
export const Dust: React.FC<{count?: number; seed?: number; size?: number; opacity?: number; spread?: number}> = ({
  count = 40,
  seed = 1,
  size = 3,
  opacity = 0.5,
  spread = 1.4,
}) => {
  const frame = useCurrentFrame();
  const {width, height, u} = useLayout();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, i) => {
        const x = (hash(seed * 100 + i) - 0.5) * width * spread + width / 2;
        const y = (hash(seed * 200 + i) - 0.5) * height * spread + height / 2;
        const drift = Math.sin(frame / 40 + i) * 6 * u;
        const s = size * u * (0.5 + hash(seed * 300 + i));
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame / 12 + i * 2.3));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y + drift,
              width: s,
              height: s,
              borderRadius: '50%',
              background: i % 5 === 0 ? COLORS.accent : COLORS.cream,
              opacity: opacity * tw,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Теплі розмиті плями світла на фоні. */
export const GlowBlobs: React.FC<{intensity?: number}> = ({intensity = 1}) => {
  const frame = useCurrentFrame();
  const {width, height} = useLayout();
  const blobs = [
    {x: 0.25, y: 0.3, r: 0.55, c: COLORS.accent, a: 0.16},
    {x: 0.78, y: 0.72, r: 0.6, c: COLORS.accentDeep, a: 0.2},
    {x: 0.6, y: 0.15, r: 0.4, c: COLORS.accentHot, a: 0.07},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {blobs.map((b, i) => {
        const r = Math.max(width, height) * b.r;
        const x = b.x * width + Math.sin(frame / 70 + i * 2) * 40;
        const y = b.y * height + Math.cos(frame / 80 + i) * 40;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - r / 2,
              top: y - r / 2,
              width: r,
              height: r,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.c} 0%, rgba(0,0,0,0) 65%)`,
              opacity: b.a * intensity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Перспективна сітка «підлоги» — добре показує наїзди та dolly-zoom. */
export const GridFloor: React.FC<{opacity?: number; offset?: number}> = ({opacity = 0.18, offset = 0}) => {
  const {width, height} = useLayout();
  const size = Math.max(width, height) * 2.4;
  return (
    <AbsoluteFill style={{perspective: 900, pointerEvents: 'none', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: width / 2 - size / 2,
          top: height * 0.55,
          width: size,
          height: size,
          transformOrigin: '50% 0%',
          transform: 'rotateX(76deg)',
          backgroundImage: `linear-gradient(${COLORS.accent} 1.5px, transparent 1.5px), linear-gradient(90deg, ${COLORS.accent} 1.5px, transparent 1.5px)`,
          backgroundSize: '90px 90px',
          backgroundPosition: `0 ${offset}px`,
          opacity,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 45%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 45%)',
        }}
      />
    </AbsoluteFill>
  );
};
