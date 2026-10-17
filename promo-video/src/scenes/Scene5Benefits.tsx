import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, T, TEXT} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs} from '../components/Atmosphere.tsx';
import {Glitch} from '../components/Glitch.tsx';
import {Letters} from '../components/Letters.tsx';
import {WidthStretch} from '../components/WidthStretch.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, fitFontSize, flexAxes, useLayout} from '../utils.ts';

/** Сцена 5: «Курс дасть:» + три тези, кожна з власним кінетичним ефектом. */
export const Scene5Benefits: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames: D} = useVideoConfig();
  const {width, vertical, u} = useLayout();
  const [t1, t2, t3] = T.s5.theses;
  const [w1, w2, w3] = TEXT.s5Theses;

  // --- позиції рядків (px від центру) ---
  const Y = vertical
    ? {header: -640, a: -400, b: -110, c: 300}
    : {header: -390, a: -190, b: 40, c: 270};

  // --- камера: «удар» на кожну тезу в біт + повільна панорама вниз ---
  const punch = (t: number) => {
    const p = frame - t;
    return p < 0 ? 0 : Math.exp(-p / 6) * Math.sin(Math.min(p, 6) / 6 * Math.PI * 0.5);
  };
  const punches = punch(t1) + punch(t2) + punch(t3);
  const exitP = ease(frame, [D - 28, D], [0, 1], EASE.in);
  const scale = (1.06 - 0.06 * ease(frame, [0, t3 + 30], [0, 1])) * (1 + 0.035 * punches) * (1 + 0.9 * exitP);
  const camY = ease(frame, [0, t3 + 40], [90 * u, -30 * u], EASE.inOut);
  const camRot = Math.sin(frame / 30) * 1.2 + punches * (frame > t2 ? -1.5 : 1.5);

  // --- заголовок ---
  const headerP = ease(frame, [T.s5.headerIn, T.s5.headerIn + 22], [0, 1], EASE.out);

  // --- 1. ВПЕВНЕНІСТЬ: розширення wdth/wght + skew ---
  const s1 = spring({frame: frame - t1, fps, config: {damping: 12, stiffness: 90}});
  const skew1 = (1 - s1) * -28;

  // --- 2. ВІРУ: літери перевертаються по черзі + хвиля ---
  const s2size = (vertical ? 250 : 200) * u;
  const waveAmp = ease(frame, [t2 + 20, t2 + 40], [0, 12 * u]);

  // --- 3. НОВЕ БАЧЕННЯ: перспектива по X + RGB-глітч ---
  const s3 = spring({frame: frame - t3, fps, config: {damping: 13, stiffness: 80}});
  const glitch3 = frame >= t3 && frame < t3 + 12 ? ease(frame, [t3, t3 + 12], [1, 0], EASE.out) : 0;
  const lines3 = vertical ? TEXT.s5Thesis3Vertical : [w3];
  const style3: React.CSSProperties = {fontFamily: FONTS.flex, fontVariationSettings: flexAxes(112, 900)};
  const size3 = Math.min(
    ...lines3.map((l) => fitFontSize(l, style3, width * (vertical ? 0.86 : 0.8), (vertical ? 230 : 175) * u)),
  );

  const row = (y: number, children: React.ReactNode, extra?: React.CSSProperties) => (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `translateY(${y * u}px)`, ...extra}}>{children}</div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{opacity: 1 - exitP * 0.6}}>
      <Camera scale={scale} y={camY} rotate={camRot}>
        <Parallax depth={0.35}>
          <GlowBlobs intensity={0.9} />
          <Dust count={50} seed={5} opacity={0.3} spread={1.8} />
        </Parallax>

        <Parallax depth={1.15}>
          {row(
            Y.header,
            <div
              style={{
                fontFamily: FONTS.flex,
                fontVariationSettings: flexAxes(70 + 50 * headerP, 300),
                fontSize: (vertical ? 76 : 64) * u,
                color: COLORS.cream,
                letterSpacing: `${0.12 + (1 - headerP) * 0.3}em`,
                opacity: headerP,
                clipPath: `inset(0 ${(1 - headerP) * 100}% 0 0)`,
              }}
            >
              {TEXT.s5Header.replace(':', '')}
              <span style={{color: COLORS.accent}}>:</span>
            </div>,
          )}
        </Parallax>

        {/* 1 — розширення шрифту */}
        <Parallax depth={1}>
          {row(
            Y.a,
            frame >= t1 - 1 ? (
              <div style={{transform: `skewX(${skew1}deg) translateX(${(1 - s1) * -120 * u}px)`, opacity: Math.min(1, s1 * 2)}}>
                <WidthStretch
                  text={w1}
                  progress={s1}
                  fullWidth={width * (vertical ? 0.8 : 0.82)}
                  wght={[250, 1000]}
                  color={COLORS.cream}
                />
              </div>
            ) : null,
          )}
        </Parallax>

        {/* 2 — перевертання літер + хвиля */}
        <Parallax depth={1.08}>
          {row(
            Y.b,
            frame >= t2 - 1 ? (
              <Letters
                text={w2}
                style={{
                  fontFamily: FONTS.unbounded,
                  fontWeight: 900,
                  fontSize: s2size,
                  lineHeight: 1,
                  color: COLORS.accent,
                  perspective: 700,
                }}
                letterStyle={(i) => {
                  const p = spring({frame: frame - t2 - i * 3, fps, config: {damping: 11, stiffness: 120}});
                  const wave = Math.sin(frame * 0.2 - i * 0.9) * waveAmp;
                  return {
                    transform: `translateY(${(1 - p) * 80 * u + wave}px) rotateY(${(1 - p) * 100}deg) scale(${0.6 + 0.4 * p})`,
                    opacity: Math.min(1, p * 1.5),
                  };
                }}
              />
            ) : null,
          )}
        </Parallax>

        {/* 3 — перспектива + glitch */}
        <Parallax depth={0.94}>
          {row(
            Y.c,
            frame >= t3 - 1 ? (
              <div style={{perspective: 900}}>
                <div
                  style={{
                    transform: `rotateX(${(1 - s3) * 75}deg) translateY(${(1 - s3) * 60 * u}px)`,
                    transformOrigin: '50% 100%',
                    opacity: Math.min(1, s3 * 2),
                  }}
                >
                  <Glitch intensity={glitch3} frame={frame} offset={34 * u}>
                    <div style={{textAlign: 'center'}}>
                      {lines3.map((l) => (
                        <div
                          key={l}
                          style={{...style3, fontSize: size3, lineHeight: 1.05, color: COLORS.cream, whiteSpace: 'pre'}}
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                  </Glitch>
                </div>
              </div>
            ) : null,
          )}
        </Parallax>
      </Camera>
    </AbsoluteFill>
  );
};
