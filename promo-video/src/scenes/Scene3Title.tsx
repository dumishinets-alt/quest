import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, SHUFFLE_SCHEDULE, T, TEXT} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs} from '../components/Atmosphere.tsx';
import {DirectionalBlur} from '../components/DirectionalBlur.tsx';
import {FontShuffle} from '../components/FontShuffle.tsx';
import {Letters} from '../components/Letters.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, hash, useLayout} from '../utils.ts';

/**
 * Сцена 3: назва курсу. Літери збираються з хаосу → «перебіжка» шрифтів →
 * фіксація → легка хвиля → whip-pan з motion blur.
 * lead — скільки кадрів сцена вже видна крізь «П» до свого офіційного старту.
 */
export const Scene3Title: React.FC<{lead: number}> = ({lead}) => {
  const frame = useCurrentFrame() - lead;
  const {fps} = useVideoConfig();
  const {width, height, vertical, u} = useLayout();
  const lines = vertical ? TEXT.s3Title.vertical : TEXT.s3Title.landscape;

  // глобальні індекси літер (для stagger через усі рядки)
  const offsets = lines.map((_, i) => lines.slice(0, i).reduce((a, l) => a + [...l].length, 0));

  const locked = frame >= T.s3.shuffleEnd;
  const lockP = spring({frame: frame - T.s3.shuffleEnd, fps, config: {damping: 10, stiffness: 140}});
  const waveAmp = ease(frame, [T.s3.shuffleEnd + 10, T.s3.shuffleEnd + 30], [0, 10 * u]);

  // --- камера: повільна панорама + поворот у перспективі; на виході whip-pan ---
  const whip = ease(frame, [T.s3.whipOut, T.s3.whipOut + 12], [0, 1], EASE.in);
  const pan = (vertical ? 35 : 90) * u;
  const camX = ease(frame, [-lead, T.s3.whipOut], [pan, -pan]) - whip * width * 1.4;
  const camRotY = ease(frame, [-lead, T.s3.whipOut], vertical ? [5, -4] : [10, -8]);
  const camScale = ease(frame, [-lead, T.s3.assembleEnd], [1.12, 1], EASE.out) * (1 + 0.03 * lockP * (locked ? 1 : 0));
  const blurX = whip * 70 * u;

  const kickerP = ease(frame, [T.s3.assembleEnd - 10, T.s3.assembleEnd + 15], [0, 1], EASE.out);
  const barP = ease(frame, [T.s3.shuffleEnd + 4, T.s3.shuffleEnd + 30], [0, 1], EASE.out);

  return (
    <AbsoluteFill>
      <DirectionalBlur x={blurX}>
        <Camera x={camX} rotateY={camRotY} scale={camScale}>
          <Parallax depth={0.4}>
            <GlowBlobs intensity={0.9} />
            <Dust count={40} seed={3} opacity={0.3} />
          </Parallax>
          <Parallax depth={1}>
            <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 34 * u,
                  letterSpacing: '0.45em',
                  color: COLORS.accent,
                  textTransform: 'uppercase',
                  marginBottom: 34 * u,
                  opacity: kickerP,
                  transform: `translateY(${(1 - kickerP) * 20 * u}px)`,
                }}
              >
                {TEXT.s3Kicker}
              </div>
              <FontShuffle
                lines={lines}
                frame={frame}
                schedule={SHUFFLE_SCHEDULE}
                maxWidth={width * (vertical ? 0.8 : 0.86)}
                maxFontSize={(vertical ? 118 : 104) * u}
                lineHeight={1.22}
                lineScale={vertical ? [1.08, 1, 1] : [1.7, 1]}
                renderLine={(line, li, style) => (
                  <Letters
                    text={line}
                    style={{...style, color: li === 0 ? COLORS.accent : COLORS.cream}}
                    letterStyle={(i) => {
                      const g = offsets[li] + i;
                      // хаос: кожна літера стартує з випадкової точки, кута й масштабу
                      const p = spring({
                        frame: frame - g * 0.9,
                        fps,
                        config: {damping: 14, stiffness: 70, mass: 0.9},
                      });
                      const drift = Math.sin((frame + g * 13) / 9) * 30 * u;
                      const dx = (hash(g + 1) - 0.5) * width * 1.1 + drift;
                      const dy = (hash(g + 50) - 0.5) * height * 1.0 - drift;
                      const rot = (hash(g + 99) - 0.5) * 540;
                      const s0 = 0.3 + hash(g + 7) * 2.4;
                      const q = 1 - p;
                      const wave = Math.sin(frame * 0.16 - g * 0.45) * waveAmp;
                      return {
                        transform: `translate(${dx * q}px, ${dy * q + wave}px) rotate(${rot * q}deg) scale(${s0 + (1 - s0) * p})`,
                        filter: q > 0.02 ? `blur(${q * 10}px)` : undefined,
                        opacity: 0.25 + 0.75 * Math.min(1, p),
                      };
                    }}
                  />
                )}
              />
              <div
                style={{
                  marginTop: 36 * u,
                  height: 6 * u,
                  width: width * (vertical ? 0.5 : 0.36),
                  background: COLORS.accent,
                  transform: `scaleX(${barP})`,
                  borderRadius: 3 * u,
                }}
              />
            </AbsoluteFill>
          </Parallax>
          <Parallax depth={1.8}>
            <Dust count={10} seed={33} size={7} opacity={0.25} />
          </Parallax>
        </Camera>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};
