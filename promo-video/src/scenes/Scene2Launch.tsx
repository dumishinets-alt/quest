import React from 'react';
import {AbsoluteFill, interpolateColors, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, SCENES, T, TEXT} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs, GridFloor} from '../components/Atmosphere.tsx';
import {Glitch} from '../components/Glitch.tsx';
import {Letters} from '../components/Letters.tsx';
import {WidthStretch} from '../components/WidthStretch.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, flexAxes, measureText, useLayout} from '../utils.ts';

type Layout = ReturnType<typeof useLayout>;

const WORD = TEXT.s2Word;
const P_INDEX = [...WORD].indexOf('П');

/**
 * Геометрія слова на максимальних осях і «просвіту» між ніжками літери «П».
 * Використовується і камерою сцени 2, і порталом, крізь який видно сцену 3.
 */
const wordGeometry = (l: Layout) => {
  const fullWidth = l.width * (l.vertical ? 0.94 : 0.92);
  const axes = flexAxes(151, 1000);
  const w100 = measureText(WORD, {fontFamily: FONTS.flex, fontSize: 100, fontVariationSettings: axes});
  const fontSize = (fullWidth / w100) * 100;
  const m = (t: string) => measureText(t, {fontFamily: FONTS.flex, fontSize, fontVariationSettings: axes});
  const before = m(WORD.slice(0, P_INDEX));
  const pW = m('П');
  const total = m(WORD);
  // центр «П» відносно центру екрана
  const pX = before + pW / 2 - total / 2;
  // просвіт між ніжками: трохи нижче центру рядка (від поперечки до базової лінії)
  const counterY = fontSize * 0.075;
  const counterW = pW * 0.34;
  const counterH = fontSize * 0.5;
  return {fontSize, fullWidth, pX, counterY, counterW, counterH};
};

/** Стан камери в польоті крізь «П» (локальний кадр сцени 2). */
const flyCamera = (f: number, l: Layout) => {
  const g = wordGeometry(l);
  const panP = ease(f, [T.s2.panToP, T.s2.flyStart], [0, 1], EASE.inOut);
  const sPan = 1 + 0.55 * panP;
  const sEnd = Math.max((l.width * 1.25) / g.counterW, (l.height * 1.25) / g.counterH);
  // експоненційний наїзд — швидкість росте, як при справжньому прольоті
  const flyP = ease(f, [T.s2.flyStart, SCENES.s2.duration], [0, 1], EASE.in);
  const scale = sPan * Math.pow(sEnd / sPan, flyP);
  const tx = g.pX * panP;
  const ty = g.counterY * panP;
  return {scale, x: -tx * scale, y: -ty * scale, g};
};

export const Scene2Launch: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l = useLayout();
  const {u} = l;

  // --- розширення wdth / wght ---
  const stretch = spring({
    frame: frame - T.s2.stretchStart,
    fps,
    config: {damping: 11, stiffness: 70, mass: 1.1},
    durationInFrames: T.s2.stretchFull - T.s2.stretchStart,
  });
  const slam = spring({frame: frame - T.s2.slam, fps, config: {damping: 9, stiffness: 160}});

  // --- перекручування (75..112): skew, perspective, хвиля, «викрутка» ---
  const dIn = ease(frame, [T.s2.distortStart, T.s2.distortStart + 10], [0, 1], EASE.out);
  const dOut = ease(frame, [T.s2.panToP - 12, T.s2.panToP], [1, 0], EASE.inOut);
  const d = dIn * dOut;
  const df = frame - T.s2.distortStart;
  const skew = Math.sin(df / 6) * 18 * d;
  const rotY = Math.sin(df / 9) * 28 * d;
  const rotX = Math.cos(df / 11) * 14 * d;
  const twistP = ease(frame, [T.s2.distortStart + 8, T.s2.panToP - 8], [0, 1], EASE.inOut);
  const glitch = ease(frame, [T.s2.glitch, T.s2.glitch + 2], [0, 1]) * ease(frame, [T.s2.glitch + T.s2.glitchLen - 3, T.s2.glitch + T.s2.glitchLen], [1, 0]);

  // --- камера ---
  const fly = flyCamera(frame, l);
  const dolly = ease(frame, [0, T.s2.stretchFull], [1.25, 1], EASE.out);
  const shake = frame >= T.s2.stretchFull && frame < T.s2.stretchFull + 10 ? Math.sin(frame * 3.1) * 10 * u * (1 - (frame - T.s2.stretchFull) / 10) : 0;
  const camRotate = ease(frame, [0, T.s2.stretchFull], [-4, 0], EASE.out) + Math.sin(df / 14) * 2 * d;

  const pColor = interpolateColors(frame, [T.s2.panToP - 6, T.s2.panToP + 8], [COLORS.cream, COLORS.accent]);
  const wordColor = interpolateColors(frame, [T.s2.stretchFull - 4, T.s2.stretchFull + 2], [COLORS.creamDim, COLORS.cream]);

  return (
    <AbsoluteFill>
      <Camera scale={fly.scale * dolly} x={fly.x + shake} y={fly.y} rotate={camRotate}>
        <Parallax depth={0.35}>
          <GridFloor opacity={0.16} offset={frame * 6} />
        </Parallax>
        <Parallax depth={0.5}>
          <GlowBlobs intensity={0.8} />
          <Dust count={45} seed={2} opacity={0.35} />
        </Parallax>
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', perspective: 1200}}>
          <div
            style={{
              transform: `scale(${0.6 + 0.4 * slam}) skewX(${skew}deg) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
            }}
          >
            <WidthStretch text={WORD} progress={stretch} fullWidth={fly.g.fullWidth}>
              {(fontStyle) => (
                <Glitch intensity={glitch} frame={frame} offset={40 * u}>
                  <Letters
                    text={WORD}
                    style={{...fontStyle, color: wordColor, perspective: 900}}
                    letterStyle={(i, n) => {
                      const wave = Math.sin(df * 0.25 - i * 0.8) * 60 * u * d;
                      const k = i / (n - 1);
                      // «викрутка»: кожна літера з затримкою робить повний оберт
                      const tw = EASE.inOut(Math.max(0, Math.min(1, twistP * 1.6 - k * 0.6)));
                      return {
                        color: i === P_INDEX ? pColor : undefined,
                        transform: `translateY(${wave}px) rotateX(${tw * 360}deg)`,
                        transformOrigin: '50% 55%',
                      };
                    }}
                  />
                </Glitch>
              )}
            </WidthStretch>
          </div>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};

/**
 * Портал: сцена 3 видна крізь просвіт літери «П» і росте разом із наїздом
 * камери, доки не заповнить увесь кадр.
 */
export const PortalReveal: React.FC<{lead: number; children: React.ReactNode}> = ({lead, children}) => {
  const frame = useCurrentFrame();
  const l = useLayout();
  const s2Local = SCENES.s2.duration - lead + frame;
  if (frame >= lead) return <>{children}</>;
  const {scale, g} = flyCamera(s2Local, l);
  const w = g.counterW * scale;
  const h = g.counterH * scale;
  const cx = l.width / 2;
  const cy = l.height / 2;
  const top = Math.max(0, cy - h / 2);
  const bottom = Math.max(0, l.height - (cy + h / 2));
  const left = Math.max(0, cx - w / 2);
  const right = Math.max(0, l.width - (cx + w / 2));
  const open = ease(frame, [0, 6], [0, 1], EASE.out);
  const depth = ease(frame, [0, lead], [0.55, 1], EASE.out);
  return (
    <AbsoluteFill
      style={{
        clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${Math.min(w, h) * 0.04}px)`,
        opacity: open,
      }}
    >
      <AbsoluteFill style={{background: COLORS.bg}} />
      <AbsoluteFill style={{transform: `scale(${depth})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
