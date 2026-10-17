import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {at, COLORS, FLASH_CUTS, SCENES} from '../config.ts';
import {ease, EASE, useLayout} from '../utils.ts';

/** Flash-cut: короткий спалах кадру на біт музики. */
export const FlashCuts: React.FC = () => {
  const frame = useCurrentFrame();
  let o = 0;
  for (const c of FLASH_CUTS) {
    const f0 = at(c.scene, c.at);
    if (frame >= f0 - 1 && frame <= f0 + c.frames) {
      o = Math.max(
        o,
        c.strength *
          interpolate(frame, [f0 - 1, f0, f0 + c.frames], [0, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE.out,
          }),
      );
    }
  }
  if (o <= 0) return null;
  return <AbsoluteFill style={{background: COLORS.cream, opacity: o, mixBlendMode: 'screen'}} />;
};

/**
 * Маска-шторка між сценами 4 і 5: дві скошені панелі (коралова і кремова)
 * накривають кадр до межі сцен і з'їжджають далі, відкриваючи нову сцену.
 */
export const CurtainWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useLayout();
  const cut = SCENES.s5.from;
  const start = cut - 24;
  const end = cut + 22;
  if (frame < start || frame > end) return null;
  const skew = width * 0.25;
  const panel = (delay: number, color: string) => {
    // прогрес 0..1: заходить зліва (до cut), виходить праворуч
    const inP = ease(frame, [start + delay, cut], [0, 1], EASE.inOut);
    const outP = ease(frame, [cut + delay, end], [0, 1], EASE.inOut);
    const left = -width - skew + (width + skew) * inP + (width + skew) * outP;
    const right = left + width + skew;
    return (
      <AbsoluteFill
        style={{
          background: color,
          clipPath: `polygon(${left + skew}px 0, ${right + skew}px 0, ${right}px ${height}px, ${left}px ${height}px)`,
        }}
      />
    );
  };
  return (
    <AbsoluteFill>
      {panel(0, COLORS.accent)}
      {panel(5, COLORS.cream)}
      {panel(9, COLORS.bg)}
    </AbsoluteFill>
  );
};

/**
 * Morph через збільшення (сцена 5 → 6): коралова крапка росте з центру до
 * повного кадру, а на початку сцени 6 стискається в іскру.
 */
export const MorphZoom: React.FC<{sparkY: number}> = ({sparkY}) => {
  const frame = useCurrentFrame();
  const {width, height} = useLayout();
  const cut = SCENES.s6.from;
  const start = cut - 18;
  const end = cut + 24;
  if (frame < start || frame > end) return null;
  const maxR = Math.hypot(width, height) / 2 + 40;
  const r =
    frame < cut
      ? ease(frame, [start, cut], [0, maxR], EASE.in)
      : ease(frame, [cut, end], [maxR, 0], EASE.out);
  const cy = frame < cut ? height / 2 : ease(frame, [cut, end], [height / 2, height / 2 + sparkY], EASE.out);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: width / 2 - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.accentHot} 0%, ${COLORS.accent} 60%)`,
        }}
      />
    </AbsoluteFill>
  );
};
