"""Build the two outputs from src/:
- app.html   : body-only page for the claude.ai artifact (the artifact wraps it in a document skeleton)
- index.html : full HTML document for static hosting (Vercel)
Run: python3 build.py
"""
from pathlib import Path

root = Path(__file__).parent
shell = (root / "src/shell.html").read_text(encoding="utf-8")
css = (root / "src/app.css").read_text(encoding="utf-8")
js = (root / "src/app.js").read_text(encoding="utf-8")
body = shell.replace("/*CSS*/", css).replace("/*JS*/", js)

(root / "app.html").write_text(body, encoding="utf-8")
head, rest = body.split('<header', 1)
(root / "index.html").write_text(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
    "img{max-width:100%}[hidden]{display:none!important}</style>"
    + head + "</head><body><header" + rest + "</body></html>",
    encoding="utf-8",
)
print("built app.html and index.html")
