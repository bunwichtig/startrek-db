"""Lädt Raumschiffe und Schiffsklassen von STAPI (https://stapi.co).

STAPI-Code steht unter MIT-Lizenz; die Daten stammen aus Memory Alpha
(CC BY-NC 4.0). Ergebnis: data/raw/stapi_*.json
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://stapi.co/api"
UA = "startrek-db/0.1 (+https://github.com/bunwichtig/startrek-db)"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw"


def get(path, **params):
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            wait = 2 ** attempt
            print(f"  Fehler bei {url}: {e} – neuer Versuch in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Abruf fehlgeschlagen: {url}")


def page_all(path, key):
    items, page = [], 0
    while True:
        data = get(path, pageNumber=page, pageSize=100)
        items.extend(data.get(key) or [])
        info = data["page"]
        print(f"{path}: Seite {page + 1}/{info['totalPages']}")
        if info.get("lastPage", True):
            return items
        page += 1
        time.sleep(0.3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    ships = page_all("/v2/rest/spacecraft/search", "spacecrafts")
    ships.sort(key=lambda s: s["uid"])
    (OUT / "stapi_spacecraft.json").write_text(json.dumps(ships, ensure_ascii=False, indent=1))
    print(f"{len(ships)} Raumschiffe")

    class_index = page_all("/v2/rest/spacecraftClass/search", "spacecraftClasses")
    classes = []
    for i, c in enumerate(sorted(class_index, key=lambda c: c["uid"])):
        full = get("/v3/rest/spacecraftClass", uid=c["uid"]).get("spacecraftClass") or c
        classes.append(full)
        if i % 50 == 0:
            print(f"Klassen-Details {i}/{len(class_index)}")
        time.sleep(0.15)
    (OUT / "stapi_spacecraft_classes.json").write_text(json.dumps(classes, ensure_ascii=False, indent=1))
    print(f"{len(classes)} Schiffsklassen")


if __name__ == "__main__":
    main()
