import React from 'react';
import {Audio, Easing, interpolate, Sequence, staticFile} from 'remotion';
import {at, MIX, MUSIC_KEY_MOMENTS, NARRATION_CUES, SFX_CUES, TOTAL_FRAMES, VOICE_CUES} from '../config.ts';

/**
 * Увесь звук відео: голос диктора, ваші записи, музика і ефекти. Таймінги — з config.ts.
 *
 * Баланс: голос 100%, ефекти ~80%, музика ~60%.
 * Під час голосу музика -> 25%, ефекти -> 50%.
 * У ключові моменти музика приглушується на 35%.
 */
type Range = [number, number];

// будь-який голос (диктор або ваші записи) приглушує музику й ефекти
const voiceRanges: Range[] = [...VOICE_CUES, ...NARRATION_CUES].map((v) => [v.from, v.from + v.frames]);
const keyRanges: Range[] = MUSIC_KEY_MOMENTS.map((m) => [at(m.scene, m.from), at(m.scene, m.to)]);

/** 0..1 — наскільки кадр «всередині» одного з діапазонів (з плавними краями). */
const inside = (f: number, ranges: Range[], ramp = MIX.duckRamp) => {
  let w = 0;
  for (const [a, b] of ranges) {
    w = Math.max(
      w,
      interpolate(f, [a - ramp, a, b, b + ramp], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.sin),
      }),
    );
  }
  return w;
};

const duck = (f: number, ranges: Range[], level: number) => 1 - (1 - level) * inside(f, ranges);

export const musicVolume = (f: number) => {
  const fadeIn = interpolate(f, [0, MIX.musicFadeInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const fadeOut = interpolate(f, [TOTAL_FRAMES - MIX.musicFadeOutFrames, TOTAL_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  return (
    MIX.music *
    fadeIn *
    fadeOut *
    duck(f, voiceRanges, MIX.musicUnderVoice) *
    duck(f, keyRanges, MIX.musicKeyMoment)
  );
};

const sfxVolume = (globalFrame: number, gain: number) =>
  MIX.sfx * gain * duck(globalFrame, voiceRanges, MIX.sfxUnderVoice);

export const Soundtrack: React.FC = () => (
  <>
    <Audio src={staticFile('music.mp3')} volume={musicVolume} />

    {VOICE_CUES.map((v) => (
      <Sequence key={v.file} from={v.from} name={`voice ${v.file}`} layout="none">
        <Audio src={staticFile(v.file)} volume={MIX.voice} />
      </Sequence>
    ))}

    {NARRATION_CUES.map((n) => (
      <Sequence key={n.id} from={n.from} name={`диктор ${n.id}`} layout="none">
        <Audio src={staticFile(n.file)} volume={MIX.voice} />
      </Sequence>
    ))}

    {SFX_CUES.map((cue, i) => {
      const from = at(cue.scene, cue.at);
      return (
        <Sequence key={i} from={from} name={`sfx ${cue.label ?? cue.file}`} layout="none">
          <Audio src={staticFile(`sfx/${cue.file}`)} volume={(f) => sfxVolume(from + f, cue.gain ?? 1)} />
        </Sequence>
      );
    })}
  </>
);
