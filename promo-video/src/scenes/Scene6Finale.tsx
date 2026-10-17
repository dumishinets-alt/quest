import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, S6_FLASH, T, TEXT} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs} from '../components/Atmosphere.tsx';
import {Letters} from '../components/Letters.tsx';
import {Spark} from '../components/Spark.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, fitFontSize, useLayout} from '../utils.ts';

/** Вертикальний зсув іскри у фіналі (до неї ж стискається коло morph-переходу). */
export const sparkOffsetY = (l: {vertical: boolean; u: number}) => (l.vertical ? -380 : -215) * l.u;

/**
 * Сцена 6: «Старт — 18 січня», «@sasha_dum4k». Звучить voice2.
 * Іскра спалахує → камера різко від'їжджає → затемнення.
 */
export const Scene6Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames: D} = useVideoConfig();
  const l = useLayout();
  const {width, vertical, u} = l;
  const sparkY = sparkOffsetY(l);

  // --- іскра ---
  const sparkIn = spring({frame: frame - 14, fps, config: {damping: 12, stiffness: 90}});
  const flash = ease(frame, [S6_FLASH - 6, S6_FLASH], [0, 1], EASE.in) * ease(frame, [S6_FLASH, S6_FLASH + 26], [1, 0.25], EASE.out);

  // --- камера: повільний наїзд → після спалаху різкий від'їзд ---
  const push = ease(frame, [0, S6_FLASH], [1, 1.07], EASE.inOut);
  const pullBack = ease(frame, [S6_FLASH, S6_FLASH + 20], [1, 0.32], EASE.out);
  const spin = ease(frame, [S6_FLASH, S6_FLASH + 24], [0, -9], EASE.out);
  const scale = push * pullBack;
  const camBlur = ease(frame, [S6_FLASH, S6_FLASH + 6], [0, 6]) * ease(frame, [S6_FLASH + 6, S6_FLASH + 20], [1, 0]);
  const dark = ease(frame, [S6_FLASH + 18, D - 4], [0, 1], EASE.inOut);

  // --- тексти ---
  const startLines = vertical ? TEXT.s6StartVertical : [TEXT.s6Start];
  const startStyle: React.CSSProperties = {fontFamily: FONTS.unbounded, fontWeight: 700};
  const startSize = Math.min(
    ...startLines.map((s) => fitFontSize(s, startStyle, width * (vertical ? 0.84 : 0.8), (vertical ? 150 : 120) * u)),
  );
  const handleSize = (vertical ? 64 : 56) * u;
  const handleP = ease(frame, [T.s6.handleIn, T.s6.handleIn + 22], [0, 1], EASE.out);
  const textY = (vertical ? 110 : 95) * u;

  let gi = 0;
  return (
    <AbsoluteFill>
      <Camera scale={scale} rotate={spin} originY={sparkY} style={{filter: camBlur > 0.1 ? `blur(${camBlur}px)` : undefined}}>
        <Parallax depth={0.3}>
          <GlowBlobs intensity={1 + flash} />
          <Dust count={70} seed={6} opacity={0.4} spread={2.6} />
        </Parallax>
        <Parallax depth={0.9}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <Spark
              size={(vertical ? 380 : 300) * u}
              frame={frame}
              reveal={sparkIn}
              pulse={1.2}
              flash={flash}
              style={{transform: `translateY(${sparkY}px)`}}
            />
          </AbsoluteFill>
        </Parallax>
        <Parallax depth={1.1}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
            <div style={{transform: `translateY(${textY}px)`, textAlign: 'center'}}>
              {startLines.map((line, li) => (
                <div key={li}>
                  <Letters
                    text={line}
                    style={{...startStyle, fontSize: startSize, lineHeight: 1.12, color: COLORS.cream}}
                    letterStyle={(i, _n, ch) => {
                      const g = gi++;
                      const p = spring({frame: frame - T.s6.startTextIn - g * 1.2, fps, config: {damping: 12, stiffness: 110}});
                      const isDate = /[0-9]/.test(ch) || (vertical ? li === 1 : i >= line.indexOf('18'));
                      return {
                        color: isDate ? COLORS.accent : COLORS.cream,
                        transform: `translateY(${(1 - p) * 90 * u}px) rotateZ(${(1 - p) * 14}deg)`,
                        opacity: Math.min(1, p * 1.6),
                      };
                    }}
                  />
                </div>
              ))}
              <div
                style={{
                  marginTop: 30 * u,
                  fontFamily: FONTS.flex,
                  fontVariationSettings: '"wdth" 110, "wght" 350',
                  fontSize: (vertical ? 40 : 34) * u,
                  letterSpacing: '0.08em',
                  color: COLORS.creamDim,
                  opacity: handleP,
                  transform: `translateY(${(1 - handleP) * 14 * u}px)`,
                }}
              >
                {TEXT.s6HandleLabel}
              </div>
              <div
                style={{
                  marginTop: 8 * u,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: handleSize,
                  color: COLORS.creamDim,
                  letterSpacing: `${0.04 + (1 - handleP) * 0.4}em`,
                  clipPath: `inset(0 ${(1 - handleP) * 100}% 0 0)`,
                  transform: `translateY(${(1 - handleP) * 20 * u}px)`,
                }}
              >
                <span style={{color: COLORS.accent}}>@</span>
                {TEXT.s6Handle.replace(/^@/, '')}
              </div>
            </div>
          </AbsoluteFill>
        </Parallax>
      </Camera>
      <AbsoluteFill style={{background: '#000', opacity: dark}} />
    </AbsoluteFill>
  );
};
