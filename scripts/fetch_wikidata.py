"""Lädt Star-Trek-Einträge aus Wikidata (CC0) samt Bildern von Wikimedia Commons.

Gesucht werden alle Wikidata-Objekte mit einer Memory-Alpha-ID. Für jedes
verknüpfte Bild (P18) werden Urheber und Lizenz von Commons abgefragt, damit
die Seite jedes Bild korrekt kennzeichnen kann.
Ergebnis: data/raw/wikidata_items.json, data/raw/commons_images.json
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "startrek-db/0.1 (+https://github.com/bunwichtig/startrek-db)"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw"
SPARQL = "https://query.wikidata.org/sparql"
COMMONS = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Wikidata verknüpft Memory-Alpha-Artikel über die Eigenschaft P6262 (Fandom-Artikel-ID),
# Werte haben die Form "memory-alpha:Artikel_Titel".
QUERY = """
SELECT ?item ?fid ?de ?descDe ?descEn ?image WHERE {
  VALUES ?fid { %s }
  ?item wdt:P6262 ?fid .
  OPTIONAL { ?item rdfs:label ?de FILTER(LANG(?de) = "de") }
  OPTIONAL { ?item schema:description ?descDe FILTER(LANG(?descDe) = "de") }
  OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
  OPTIONAL { ?item wdt:P18 ?image }
}
"""


def fetch(url, data=None):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=data, headers={
                "User-Agent": UA,
                "Accept": "application/sparql-results+json, application/json",
            })
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            wait = 5 * 2 ** attempt
            print(f"  Fehler: {e} – neuer Versuch in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Abruf fehlgeschlagen: {url}")


def sparql(query):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    return fetch(SPARQL, data=body)["results"]["bindings"]


def ma_titles():
    """Alle Memory-Alpha-Titel aus den Rohdaten."""
    pages = json.loads((OUT / "memory_alpha_pages.json").read_text()) if (OUT / "memory_alpha_pages.json").exists() else []
    return sorted({p["title"] for p in pages})


def lit(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def wikidata():
    titles = ma_titles()
    rows = []
    for i in range(0, len(titles), 150):
        chunk = titles[i:i + 150]
        values = " ".join(lit("memory-alpha:" + t.replace(" ", "_")) + " " + lit("memory-alpha:" + t) for t in chunk)
        try:
            part = sparql(QUERY % values)
        except RuntimeError as e:
            print(f"Abschnitt {i} übersprungen: {e}", file=sys.stderr)
            continue
        rows.extend(part)
        print(f"Titel {min(i + 150, len(titles))}/{len(titles)}: {len(part)} Treffer")
        time.sleep(1)
    for r in rows:
        r["ma"] = {"value": r["fid"]["value"].removeprefix("memory-alpha:").replace("_", " ")}
    items = {}
    for r in rows:
        v = {k: x["value"] for k, x in r.items()}
        qid = v["item"].rsplit("/", 1)[-1]
        it = items.setdefault(qid, {"qid": qid, "memoryAlpha": v["ma"], "images": []})
        for k in ("de", "descEn", "descDe"):
            if k in v:
                it[k] = v[k]
        if "image" in v:
            name = urllib.parse.unquote(v["image"].rsplit("/", 1)[-1]).replace("_", " ")
            if name not in it["images"]:
                it["images"].append(name)
    print(f"{len(items)} Wikidata-Objekte mit Memory-Alpha-ID")
    return sorted(items.values(), key=lambda i: int(i["qid"][1:]))


def commons(files):
    meta = {}
    files = sorted(set(files))
    for i in range(0, len(files), 40):
        chunk = files[i:i + 40]
        params = {
            "action": "query", "format": "json", "prop": "imageinfo",
            "iiprop": "url|extmetadata|size", "iiurlwidth": 800,
            "titles": "|".join("File:" + f for f in chunk),
        }
        data = fetch(f"{COMMONS}?{urllib.parse.urlencode(params)}")
        for page in (data.get("query", {}).get("pages") or {}).values():
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                continue
            em = info.get("extmetadata", {})
            val = lambda k: em.get(k, {}).get("value")  # noqa: E731
            meta[page["title"].removeprefix("File:")] = {
                "page": info.get("descriptionurl"),
                "url": info.get("url"),
                "thumb": info.get("thumburl"),
                "width": info.get("width"),
                "height": info.get("height"),
                "license": val("LicenseShortName"),
                "licenseUrl": val("LicenseUrl"),
                "artist": val("Artist"),
                "credit": val("Credit"),
                "description": val("ImageDescription"),
                "restrictions": val("Restrictions"),
            }
        time.sleep(0.5)
    print(f"{len(meta)} Commons-Bilder mit Lizenzangaben")
    return meta


def download(images):
    """Vorschaubilder lokal ablegen, damit die Seite auch ohne Commons-Zugriff Bilder zeigt."""
    import hashlib
    img_dir = OUT.parent.parent / "site" / "img"
    img_dir.mkdir(parents=True, exist_ok=True)
    for name, meta in images.items():
        url = meta.get("thumb") or meta.get("url")
        if not url:
            continue
        ext = Path(urllib.parse.urlparse(url).path).suffix.lower() or ".jpg"
        local = img_dir / (hashlib.sha1(name.encode()).hexdigest()[:16] + ext)
        if not local.exists():
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    local.write_bytes(r.read())
                time.sleep(0.5)
            except Exception as e:  # noqa: BLE001
                print(f"  Bild nicht geladen: {name}: {e}", file=sys.stderr)
                continue
        meta["local"] = "img/" + local.name


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = wikidata()
    (OUT / "wikidata_items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    images = commons(f for it in items for f in it["images"])
    download(images)
    (OUT / "commons_images.json").write_text(json.dumps(images, ensure_ascii=False, indent=1, sort_keys=True))


if __name__ == "__main__":
    main()
