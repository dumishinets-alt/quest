import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, T, TEXT} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs} from '../components/Atmosphere.tsx';
import {Spark} from '../components/Spark.tsx';
import {Letters} from '../components/Letters.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, fitFontSize, flexAxes, useLayout} from '../utils.ts';

/** Сцена 1: темрява → іскра пульсує, камера наїжджає. «Щось починається…» */
export const Scene1Spark: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames: D} = useVideoConfig();
  const {width, vertical, u} = useLayout();

  const reveal = spring({frame: frame - T.s1.sparkIn, fps, config: {damping: 14, mass: 1.4, stiffness: 60}});

  // Камера: повільний наїзд + легкий крен; в останні 20 кадрів — різкий наїзд в іскру
  const push = ease(frame, [0, D - 20], [0.82, 1.22], EASE.inOut);
  const rush = ease(frame, [D - 20, D], [1, 2.6], EASE.in);
  const scale = push * rush;
  const rotate = ease(frame, [0, D], [-3, 1.5]);
  const camY = ease(frame, [0, D], [30 * u, -10 * u]);
  const camX = Math.sin(frame / 50) * 18 * u;

  const sparkSize = (vertical ? 520 : 400) * u;
  const sparkY = (vertical ? -150 : -90) * u;

  // Текст: рідкий тонкий шрифт, що «прокидається» по осях wdth/wght
  const tagStart = T.s1.taglineIn;
  const tagP = ease(frame, [tagStart, tagStart + 40], [0, 1], EASE.out);
  const tagStyle: React.CSSProperties = {
    fontFamily: FONTS.flex,
    fontVariationSettings: flexAxes(60 + 50 * tagP, 200 + 150 * tagP),
  };
  const tagSize = fitFontSize(TEXT.s1Tagline, {...tagStyle, fontVariationSettings: flexAxes(110, 350)}, width * 0.84, 92 * u);

  const darkness = ease(frame, [0, 24], [1, 0], EASE.out);

  return (
    <AbsoluteFill>
      <Camera scale={scale} rotate={rotate} x={camX} y={camY} originY={sparkY}>
        <Parallax depth={0.35}>
          <Dust count={50} seed={1} size={2.6} opacity={0.35 * reveal} spread={1.8} />
        </Parallax>
        <Parallax depth={0.6}>
          <GlowBlobs intensity={reveal} />
        </Parallax>
        <Parallax depth={1}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <Spark
              size={sparkSize}
              frame={frame}
              reveal={Math.max(0, reveal)}
              pulse={ease(frame, [T.s1.sparkIn, 90], [0.4, 1.4])}
              flash={ease(frame, [D - 12, D], [0, 0.8], EASE.in)}
              style={{transform: `translateY(${sparkY}px)`}}
            />
          </AbsoluteFill>
        </Parallax>
        <Parallax depth={1.25}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div
              style={{
                transform: `translateY(${(vertical ? 260 : 230) * u}px)`,
                color: COLORS.cream,
                fontSize: tagSize,
                letterSpacing: `${(1 - tagP) * 0.25}em`,
              }}
            >
              <Letters
                text={TEXT.s1Tagline}
                style={tagStyle}
                letterStyle={(i) => {
                  const p = ease(frame, [tagStart + i * 1.6, tagStart + i * 1.6 + 18], [0, 1], EASE.out);
                  return {
                    opacity: p,
                    transform: `translateY(${(1 - p) * 40 * u}px)`,
                    filter: `blur(${(1 - p) * 10}px)`,
                  };
                }}
              />
            </div>
          </AbsoluteFill>
        </Parallax>
      </Camera>
      <AbsoluteFill style={{background: COLORS.bg, opacity: darkness}} />
    </AbsoluteFill>
  );
};
