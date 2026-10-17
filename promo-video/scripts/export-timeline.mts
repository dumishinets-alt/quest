// Друкує таймлайн із src/config.ts як JSON — його читає scripts/generate_audio.py,
// щоб синтезована музика збігалася зі сценами.
import {BPM, FPS, SCENES, TOTAL_FRAMES, S6_FLASH, ENTER_FRAME, KEYWORD_FRAMES, TYPING_END} from '../src/config.ts';

console.log(
  JSON.stringify({fps: FPS, bpm: BPM, scenes: SCENES, totalFrames: TOTAL_FRAMES, s6Flash: S6_FLASH, enter: ENTER_FRAME, keywords: KEYWORD_FRAMES, typingEnd: TYPING_END}, null, 2),
);
