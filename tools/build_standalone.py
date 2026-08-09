#!/usr/bin/env python3
"""
build_standalone.py
--------------------------------------------------------------------------
Regenerates index.standalone.html — a single self-contained file with all
CSS and JS inlined — from the modular source (index.html, css/*, js/*).

Why this exists: mobile file managers often hand an .html file to the
browser via a `content://` URI rather than a real filesystem path. When
that happens, relative references like <link href="css/styles.css"> or
<script src="js/app.js"> cannot be resolved, and the page loads with no
styling and no behavior. Inlining everything into one file removes every
relative reference, so the page works no matter how it was opened.

Run this after editing anything under css/ or js/:
    python3 tools/build_standalone.py

IMPORTANT: this script uses `pattern.sub(lambda m: replacement, html)` —
a callable replacement — rather than `pattern.sub(replacement, html)` with
a plain string. re.sub() treats backslash sequences in a *string*
replacement as escapes/backreferences (so a literal "\n" inside the JS
source, e.g. inside parseCSV's `c === "\n"` check, would silently become
an actual newline character and corrupt the code). A callable replacement
is inserted verbatim, with no escape processing.
--------------------------------------------------------------------------
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

JS_ORDER = [
    "js/utils.js",
    "js/modules/storage.js",
    "js/data/liveDataService.js",
    "js/data/marketDataService.js",
    "js/data/scannerLibrary.js",
    "js/modules/scoring.js",
    "js/modules/checklist.js",
    "js/modules/riskManager.js",
    "js/modules/candidates.js",
    "js/modules/universeScanner.js",
    "js/modules/journal.js",
    "js/modules/analytics.js",
    "js/modules/chartProvider.js",
    "js/views/dashboardView.js",
    "js/views/scannerImportView.js",
    "js/views/scannerLibraryView.js",
    "js/views/candidatesView.js",
    "js/views/tradeWorkspaceView.js",
    "js/views/journalView.js",
    "js/views/analyticsView.js",
    "js/views/marketIntelView.js",
    "js/views/settingsView.js",
    "js/app.js",
]
CSS_ORDER = ["css/styles.css", "css/components.css"]


def main():
    js_parts = []
    for rel in JS_ORDER:
        text = (ROOT / rel).read_text(encoding="utf-8")
        js_parts.append(f"/* ===== {rel} ===== */\n{text}")
    all_js = "\n\n".join(js_parts)

    css_parts = []
    for rel in CSS_ORDER:
        text = (ROOT / rel).read_text(encoding="utf-8")
        css_parts.append(f"/* ===== {rel} ===== */\n{text}")
    all_css = "\n\n".join(css_parts)

    html = (ROOT / "index.html").read_text(encoding="utf-8")

    css_pattern = re.compile(
        r'<link rel="stylesheet" href="css/styles\.css" />\s*\n'
        r'<link rel="stylesheet" href="css/components\.css" />'
    )
    html = css_pattern.sub(lambda m: f"<style>\n{all_css}\n</style>", html)

    script_pattern = re.compile(
        r'<script src="js/utils\.js"></script>\n'
        r'(?:<script src="[^"]+"></script>\n)*'
        r'<script src="js/app\.js"></script>'
    )
    html = script_pattern.sub(lambda m: f"<script>\n{all_js}\n</script>", html)

    out_path = ROOT / "index.standalone.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote {out_path} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
