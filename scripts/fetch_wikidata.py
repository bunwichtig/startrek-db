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

QUERY = """
SELECT ?item ?ma ?en ?de ?descEn ?descDe ?image ?type ?typeLabel WHERE {
  VALUES ?wdt { %s }
  ?item ?wdt ?ma .
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?de FILTER(LANG(?de) = "de") }
  OPTIONAL { ?item schema:description ?descEn FILTER(LANG(?descEn) = "en") }
  OPTIONAL { ?item schema:description ?descDe FILTER(LANG(?descDe) = "de") }
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "en") }
}
"""


def fetch(url, data=None):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, data=data, headers={
                "User-Agent": UA,
                "Accept": "application/sparql-results+json, application/json",
            })
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            wait = 5 * 2 ** attempt
            print(f"  Fehler: {e} – neuer Versuch in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Abruf fehlgeschlagen: {url}")


PROP_QUERY = """
SELECT ?prop ?wdt ?l WHERE {
  ?prop a wikibase:Property ; wikibase:directClaim ?wdt ; rdfs:label ?l .
  FILTER(LANG(?l) = "en" && CONTAINS(LCASE(?l), "memory alpha"))
}
"""


def sparql(query):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    return fetch(SPARQL, data=body)["results"]["bindings"]


def wikidata():
    props = sparql(PROP_QUERY)
    for p in props:
        print("Memory-Alpha-Eigenschaft:", p["prop"]["value"], p["l"]["value"])
    wdts = " ".join("<%s>" % p["wdt"]["value"] for p in props)
    if not wdts:
        raise RuntimeError("Keine Memory-Alpha-Eigenschaft in Wikidata gefunden")
    rows = sparql(QUERY % wdts)
    items = {}
    for r in rows:
        v = {k: x["value"] for k, x in r.items()}
        qid = v["item"].rsplit("/", 1)[-1]
        it = items.setdefault(qid, {"qid": qid, "memoryAlpha": v["ma"], "types": [], "images": []})
        for k in ("en", "de", "descEn", "descDe"):
            if k in v:
                it[k] = v[k]
        if "typeLabel" in v and v["typeLabel"] not in it["types"]:
            it["types"].append(v["typeLabel"])
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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = wikidata()
    (OUT / "wikidata_items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    images = commons(f for it in items for f in it["images"])
    (OUT / "commons_images.json").write_text(json.dumps(images, ensure_ascii=False, indent=1, sort_keys=True))


if __name__ == "__main__":
    main()
