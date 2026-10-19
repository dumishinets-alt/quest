import sys
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
import os, tempfile
D, OUT = sys.argv[1], sys.argv[2]
for fam, w in [("montserrat", 800), ("montserrat", 900), ("unbounded", 800), ("montserrat", 600)]:
    parts = []
    for sub in ["latin", "cyrillic"]:
        f = TTFont(f"{D}/{fam}/package/files/{fam}-{sub}-{w}-normal.woff")
        f.flavor = None
        p = f"{OUT}/_{fam}-{sub}-{w}.ttf"; f.save(p); parts.append(p)
    try:
        m = Merger().merge(parts); m.save(f"{OUT}/{fam}-{w}.ttf"); print("merged", fam, w)
    except Exception as e:
        print("merge failed", fam, w, e)
