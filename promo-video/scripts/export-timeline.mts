// Друкує таймлайн із src/config.ts як JSON — його читають scripts/generate_audio.py
// (музика під сцени) і scripts/narration.py (репліки диктора).
import {
  BPM, FPS, SCENES, TOTAL_FRAMES, S6_FLASH, ENTER_FRAME, KEYWORD_FRAMES, TYPING_END,
  NARRATOR, NARRATION_LINES, NARRATION_CUES,
} from '../src/config.ts';

console.log(
  JSON.stringify(
    {
      fps: FPS, bpm: BPM, scenes: SCENES, totalFrames: TOTAL_FRAMES, s6Flash: S6_FLASH,
      enter: ENTER_FRAME, keywords: KEYWORD_FRAMES, typingEnd: TYPING_END,
      narrator: NARRATOR, narration: NARRATION_LINES, narrationCues: NARRATION_CUES,
    },
    null,
    2,
  ),
);
