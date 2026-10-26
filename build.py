"""Build the two outputs from src/:
- app.html   : body-only page for the claude.ai artifact (the artifact wraps it in a document skeleton)
- index.html : full HTML document for static hosting (Vercel)
src/features/*.css are appended to src/app.css.
Run: python3 build.py
"""
from pathlib import Path

root = Path(__file__).parent
shell = (root / "src/shell.html").read_text(encoding="utf-8")
css = (root / "src/app.css").read_text(encoding="utf-8")
css += "".join("\n" + f.read_text(encoding="utf-8") for f in sorted((root / "src/features").glob("*.css")))
js = (root / "src/app.js").read_text(encoding="utf-8")
# feature modules are inserted inside the app closure, right before boot
feats = "".join((f.read_text(encoding="utf-8") + "\n") for f in sorted((root / "src/features").glob("*.js")))
marker = "/* ================= boot ================= */"
assert marker in js, "boot marker missing"
js = js.replace(marker, feats + marker, 1)
body = shell.replace("/*CSS*/", css).replace("/*JS*/", js)

(root / "app.html").write_text(body.replace("<!--BODY-->", ""), encoding="utf-8")
head, rest = body.split('<!--BODY-->', 1)
(root / "index.html").write_text(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
    "img{max-width:100%}[hidden]{display:none!important}</style>"
    '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0E6E55">'
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Stalong"><meta property="og:title" content="Stalong 思龙 - học tiếng Trung cùng Tiểu Long"><meta property="og:description" content="Stalong (Stalis\'s Hànyǔ): học tiếng Trung HSK 1-9 cho người Việt cùng rồng con Tiểu Long. Thẻ từ lặp lại ngắt quãng, Hán Việt, nghe, nói, đọc, viết, ngữ pháp, thi thử, trò chơi."><meta property="og:url" content="https://hanyu-ecru.vercel.app/"><meta property="og:image" content="https://hanyu-ecru.vercel.app/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">'
    '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">'
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-title" content="Stalong">'
    + head + "</head><body>" + rest + "</body></html>",
    encoding="utf-8",
)
print("built app.html and index.html")
