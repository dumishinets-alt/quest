import React from 'react';
import {Composition} from 'remotion';
import {FORMATS, FPS, TOTAL_FRAMES} from './config.ts';
import {Promo} from './Promo.tsx';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 16:9 — основна версія */}
    <Composition
      id={FORMATS.landscape.id}
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={FORMATS.landscape.width}
      height={FORMATS.landscape.height}
    />
    {/* 9:16 — Reels / TikTok, адаптована верстка */}
    <Composition
      id={FORMATS.vertical.id}
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={FORMATS.vertical.width}
      height={FORMATS.vertical.height}
    />
  </>
);
