import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS, ENTER_FRAME, KEYWORD_FRAMES, T, TEXT, TYPING_SCHEDULE} from '../config.ts';
import {Camera, Parallax} from '../components/Camera.tsx';
import {Dust, GlowBlobs, GridFloor} from '../components/Atmosphere.tsx';
import {DirectionalBlur} from '../components/DirectionalBlur.tsx';
import {Typewriter} from '../components/Typewriter.tsx';
import {FONTS} from '../fonts.ts';
import {ease, EASE, fitFontSize, measureText, useLayout} from '../utils.ts';

/** Розташування ключових слів навколо терміналу (px від центру) і глибина паралаксу. */
const KEYWORD_LAYOUT = {
  landscape: [
    {x: -560, y: -330, depth: 1.45, size: 50, rot: -6},
    {x: 600, y: -250, depth: 0.75, size: 40, rot: 5},
    {x: 330, y: 340, depth: 1.25, size: 46, rot: -3},
  ],
  vertical: [
    {x: -170, y: -560, depth: 1.45, size: 50, rot: -6},
    {x: 210, y: -390, depth: 0.75, size: 40, rot: 5},
    {x: 40, y: 470, depth: 1.25, size: 46, rot: -3},
  ],
};

export const Scene4Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {width, vertical, u} = useLayout();

  // --- вікно терміналу ---
  const winW = vertical ? width * 0.9 : 1260 * u;
  const pad = (vertical ? 34 : 48) * u;
  const monoStyle = {fontFamily: FONTS.mono, fontWeight: 400};
  // у вертикальній версії команда переноситься на 2 рядки — кегль більший
  const fontSize = vertical ? 52 * u : fitFontSize(TEXT.s4Command + '_', monoStyle, winW - pad * 2, 50 * u);
  const fullTextW = measureText(TEXT.s4Command, {...monoStyle, fontSize});
  const typedCount = TYPING_SCHEDULE.filter((t) => frame >= t.frame).length;
  const typedW = measureText(TEXT.s4Command.slice(0, typedCount), {...monoStyle, fontSize});

  // --- камера ---
  // 1) whip-pan in, 2) крупний план, камера стежить за курсором,
  // 3) після Enter — від'їзд, щоб відкрити ключові слова
  const whip = ease(frame, [T.s4.whipIn, T.s4.whipIn + 14], [1, 0], EASE.out);
  const close = vertical ? 1.12 : 1.42;
  const pull = ease(frame, [ENTER_FRAME + 2, ENTER_FRAME + 45], [0, 1], EASE.inOut);
  const pull2 = ease(frame, [ENTER_FRAME + 45, T.s4.curtainOut + 20], [0, 1], EASE.inOut);
  const scale = close + (1 - close) * pull - 0.08 * pull2;
  // центр уже надрукованого тексту відносно центру вікна — за ним стежить камера
  const typedCenterX = -fullTextW / 2 + typedW / 2;
  const camTargetX = vertical ? 0 : -typedCenterX * close;
  const camX = camTargetX * (1 - pull) + whip * width * 1.4;
  const camY = ease(frame, [0, ENTER_FRAME], [30 * u, 0]) * (1 - pull);
  const camRot = ease(frame, [0, T.s4.curtainOut], [-1.5, 1.5]);
  const blurX = whip * 70 * u;

  // dolly-zoom: термінал тримає розмір, а фон «розбігається» через зміну перспективи
  const dolly = ease(frame, [T.s4.typeStart, ENTER_FRAME], [0, 1], EASE.inOut);
  const bgScale = (0.78 + 0.55 * dolly) / scale;
  const gridPersp = 420 + 1100 * dolly;

  const winIn = spring({frame: frame - 2, fps, config: {damping: 15, stiffness: 90}});
  const outputP = ease(frame, [ENTER_FRAME + 3, ENTER_FRAME + 12], [0, 1], EASE.out);
  const kws = vertical ? KEYWORD_LAYOUT.vertical : KEYWORD_LAYOUT.landscape;

  return (
    <AbsoluteFill>
      <DirectionalBlur x={blurX}>
        <Camera x={camX} y={camY} scale={scale} rotate={camRot}>
          <Parallax depth={0.3}>
            <AbsoluteFill style={{transform: `scale(${bgScale})`}}>
              <GridFloor opacity={0.2} perspective={gridPersp} offset={frame * 2} />
              <GlowBlobs intensity={0.8} />
            </AbsoluteFill>
          </Parallax>
          <Parallax depth={0.55}>
            <Dust count={50} seed={4} opacity={0.3} spread={2.2} />
          </Parallax>

          {/* термінал */}
          <Parallax depth={1}>
            <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
              <div
                style={{
                  width: winW,
                  borderRadius: 20 * u,
                  background: COLORS.bgLift,
                  border: `1.5px solid rgba(245,240,232,0.12)`,
                  boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 ${90 * u}px rgba(217,119,87,${0.12 + 0.18 * outputP})`,
                  overflow: 'hidden',
                  transform: `translateY(${(1 - winIn) * 60 * u}px) scale(${0.92 + 0.08 * winIn})`,
                  opacity: Math.min(1, winIn * 1.4),
                }}
              >
                <div
                  style={{
                    height: 58 * u,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12 * u,
                    padding: `0 ${24 * u}px`,
                    borderBottom: '1.5px solid rgba(245,240,232,0.08)',
                  }}
                >
                  {[COLORS.accent, COLORS.muted, COLORS.muted].map((c, i) => (
                    <div key={i} style={{width: 16 * u, height: 16 * u, borderRadius: '50%', background: c}} />
                  ))}
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: FONTS.mono,
                      fontSize: 20 * u,
                      color: COLORS.muted,
                      marginRight: 60 * u,
                    }}
                  >
                    ~/learning — zsh
                  </div>
                </div>
                <div
                  style={{
                    padding: pad,
                    fontFamily: FONTS.mono,
                    fontSize,
                    lineHeight: 1.6,
                    color: COLORS.cream,
                  }}
                >
                  <div style={{whiteSpace: 'pre-wrap'}}>
                    <Typewriter schedule={TYPING_SCHEDULE} frame={frame} hideCursorAfter={ENTER_FRAME} />
                  </div>
                  <div
                    style={{
                      color: COLORS.accent,
                      opacity: outputP,
                      transform: `translateY(${(1 - outputP) * 12 * u}px)`,
                    }}
                  >
                    {TEXT.s4Output}
                  </div>
                  <div style={{opacity: outputP}}>
                    <span style={{color: COLORS.muted}}>&gt; </span>
                    <span style={{color: COLORS.accent, opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0}}>_</span>
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          </Parallax>

          {/* ключові слова на різних глибинах */}
          {TEXT.s4Keywords.map((kw, i) => {
            const k = kws[i];
            const p = spring({frame: frame - KEYWORD_FRAMES[i], fps, config: {damping: 9, stiffness: 150}});
            const float = Math.sin((frame - KEYWORD_FRAMES[i]) / 14 + i * 2) * 10 * u;
            return (
              <Parallax key={kw} depth={k.depth}>
                <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
                  <div
                    style={{
                      transform: `translate(${k.x * u}px, ${k.y * u + float}px) rotate(${k.rot * p}deg) scale(${p})`,
                      opacity: Math.min(1, p * 1.5),
                      fontFamily: FONTS.unbounded,
                      fontWeight: 500,
                      fontSize: k.size * u,
                      color: k.depth < 1 ? COLORS.creamDim : COLORS.cream,
                      padding: `${14 * u}px ${30 * u}px`,
                      borderRadius: 999,
                      border: `2px solid ${COLORS.accent}`,
                      background: 'rgba(14,14,16,0.75)',
                      filter: k.depth < 1 ? 'blur(1.5px)' : undefined,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{color: COLORS.accent}}>#</span>
                    {kw}
                  </div>
                </AbsoluteFill>
              </Parallax>
            );
          })}
        </Camera>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};
