"""Fasst site/ zu einer einzelnen HTML-Datei zusammen (für eine Vorschau ohne Server).

Aufruf: python scripts/bundle.py <ziel.html>
"""
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


def main(out):
    page = (SITE / "index.html").read_text()
    body = re.search(r"<!--BODY-->(.*)<!--/BODY-->", page, re.S).group(1)
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts[^"]+)">', page).group(1)
    parts = [
        "<title>Sternenregister</title>",
        '<meta name="claude:viewport-fit-sides" content="cover">',
        f'<link rel="stylesheet" href="{fonts}">',
        "<style>\n" + (SITE / "styles.css").read_text() + "\n</style>",
        body,
        "<script>\n" + (SITE / "data.js").read_text() + "\n</script>",
        "<script>\n" + (SITE / "app.js").read_text() + "\n</script>",
    ]
    Path(out).write_text("\n".join(parts))


if __name__ == "__main__":
    main(sys.argv[1])
