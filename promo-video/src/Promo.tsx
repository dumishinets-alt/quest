import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {COLORS, SCENES, T} from './config.ts';
import {Soundtrack} from './audio/Soundtrack.tsx';
import {Grain, Vignette} from './components/Atmosphere.tsx';
import {GlitchDefs} from './components/Glitch.tsx';
import {CurtainWipe, FlashCuts, MorphZoom} from './transitions/Transitions.tsx';
import {Scene1Spark} from './scenes/Scene1Spark.tsx';
import {Scene2Launch} from './scenes/Scene2Launch.tsx';
import {Scene3Title} from './scenes/Scene3Title.tsx';
import {Scene4Terminal} from './scenes/Scene4Terminal.tsx';
import {Scene5Benefits} from './scenes/Scene5Benefits.tsx';
import {Scene6Finale, sparkOffsetY} from './scenes/Scene6Finale.tsx';
import {PortalReveal} from './scenes/Scene2Launch.tsx';
import {useFontsReady, useLayout} from './utils.ts';

export const Promo: React.FC = () => {
  const ready = useFontsReady();
  const layout = useLayout();
  const lead = T.s2.portalOverlap;

  return (
    <AbsoluteFill style={{background: COLORS.bg, overflow: 'hidden'}}>
      <GlitchDefs />
      {ready ? (
        <>
          <Sequence name="1 · Іскра" from={SCENES.s1.from} durationInFrames={SCENES.s1.duration}>
            <Scene1Spark />
          </Sequence>
          <Sequence name="2 · ЗАПУСК" from={SCENES.s2.from} durationInFrames={SCENES.s2.duration}>
            <Scene2Launch />
          </Sequence>
          {/* Сцена 3 починається раніше — її видно крізь літеру «П» */}
          <Sequence name="3 · Назва курсу" from={SCENES.s3.from - lead} durationInFrames={SCENES.s3.duration + lead}>
            <PortalReveal lead={lead}>
              <Scene3Title lead={lead} />
            </PortalReveal>
          </Sequence>
          <Sequence name="4 · Термінал" from={SCENES.s4.from} durationInFrames={SCENES.s4.duration}>
            <Scene4Terminal />
          </Sequence>
          <Sequence name="5 · Курс дасть" from={SCENES.s5.from} durationInFrames={SCENES.s5.duration}>
            <Scene5Benefits />
          </Sequence>
          <Sequence name="6 · Фінал" from={SCENES.s6.from} durationInFrames={SCENES.s6.duration}>
            <Scene6Finale />
          </Sequence>

          <CurtainWipe />
          <MorphZoom sparkY={sparkOffsetY(layout)} />
          <FlashCuts />
        </>
      ) : null}
      <Vignette />
      <Grain />
      <Soundtrack />
    </AbsoluteFill>
  );
};
