import sys, json, glob, os
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=4)
out = {}
for f in sorted(glob.glob(os.path.join(sys.argv[2], "*.pcm"))):
    segs, info = m.transcribe(np.fromfile(f,dtype=np.int16).astype(np.float32)/32768.0, language="uk", word_timestamps=True, vad_filter=True, condition_on_previous_text=False, beam_size=5)
    r = []
    for s in segs:
        r.append({"start": s.start, "end": s.end, "text": s.text, "words": [[w.start, w.end, w.word, w.probability] for w in s.words]})
    out[os.path.basename(f).replace(".pcm","")] = r
    print(os.path.basename(f), "|".join(x["text"] for x in r), flush=True)
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
