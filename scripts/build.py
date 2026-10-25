"""Baut aus den Rohdaten die Datenbank (data/ships.json) und die Seitendaten (site/data.js).

Die Zuordnung von Organisationen zu Fraktionen und von Fraktionen zu Quadranten
ist redaktionelle Arbeit dieses Projekts (siehe FACTIONS unten).
"""
import datetime as dt
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

QUADRANTS = [
    {"id": "alpha", "name": "Alpha-Quadrant", "sub": "Erde, Föderation, Cardassia, Ferengi, Bajor"},
    {"id": "beta", "name": "Beta-Quadrant", "sub": "Klingonisches Reich, Romulanisches Sternenimperium"},
    {"id": "gamma", "name": "Gamma-Quadrant", "sub": "Dominion und die Welten jenseits des bajoranischen Wurmlochs"},
    {"id": "delta", "name": "Delta-Quadrant", "sub": "Borg, Kazon, Hirogen und die Reiseroute der Voyager"},
    {"id": "extra", "name": "Jenseits der Galaxis", "sub": "Fluidraum, andere Galaxien, Anomalien"},
    {"id": "none", "name": "Ohne Zuordnung", "sub": "Schiffe und Klassen ohne erkennbare Fraktion"},
]

# (id, Name, Quadrant, Farbe, Muster für Organisations- oder Speziesnamen, Hinweis)
FACTIONS = [
    ("federation", "Vereinigte Föderation der Planeten", "alpha", "#5b9cf0",
     r"federation|starfleet|\bufp\b|section 31|daystrom|federation news|temporal integrity|kelvin|utopia planitia", ""),
    ("earth", "Erde (vor der Föderation)", "alpha", "#7fb8d8",
     r"united earth|earth starfleet|\bnasa\b|united nations|\bunsc\b|earth cargo|\becs\b|zefram|confederation of earth|eugenics|augment|european|soviet|united states|us air force|royal navy|terran(?! empire)",
     "Raumfahrt der Menschen bis zur Gründung der Föderation 2161."),
    ("terran", "Terranisches Imperium", "alpha", "#c9a227", r"terran empire|imperial starfleet", "Spiegeluniversum."),
    ("vulcan", "Vulkan", "alpha", "#c98a52", r"vulcan|v'tosh|syrrannite", ""),
    ("andorian", "Andorianisches Imperium", "alpha", "#6fc7c2", r"andoria", ""),
    ("tellarite", "Tellar", "alpha", "#a3917a", r"tellar", ""),
    ("klingon", "Klingonisches Reich", "beta", "#d0473c", r"klingon|house of|qo'nos|kronos", ""),
    ("romulan", "Romulanisches Sternenimperium", "beta", "#3fae73", r"romulan|tal shiar|zhat vash|qowat milat|free state", ""),
    ("reman", "Remaner", "beta", "#6b8f71", r"reman", ""),
    ("cardassian", "Cardassianische Union", "alpha", "#c8a16a", r"cardassia|obsidian order|true way", ""),
    ("bajoran", "Bajor", "alpha", "#d49bd0", r"bajor", ""),
    ("ferengi", "Ferengi-Allianz", "alpha", "#e2b33c", r"ferengi", ""),
    ("breen", "Breen-Konföderation", "alpha", "#8fa6b8", r"breen", ""),
    ("tholian", "Tholianische Versammlung", "alpha", "#e07b39", r"tholian", ""),
    ("gorn", "Gorn-Hegemonie", "alpha", "#8bb04f", r"\bgorn\b", ""),
    ("orion", "Orion-Syndikat", "alpha", "#59a14f", r"orion", ""),
    ("maquis", "Maquis", "alpha", "#b0763e", r"maquis", ""),
    ("xindi", "Xindi", "alpha", "#a479c9", r"xindi|sphere builder", "Delphische Ausdehnung, Alpha-Quadrant."),
    ("suliban", "Suliban-Kabale", "alpha", "#7d9e5c", r"suliban|cabal", ""),
    ("tzenkethi", "Tzenkethi-Koalition", "alpha", "#b3836b", r"tzenkethi", ""),
    ("nausicaan", "Nausikaaner", "alpha", "#9a8466", r"nausica", ""),
    ("sona", "Son'a", "alpha", "#c2a5c6", r"son'a|ba'ku", ""),
    ("talarian", "Talarianer", "alpha", "#a08870", r"talarian", ""),
    ("tamarian", "Tamarianer", "alpha", "#9b8fc4", r"tamarian|children of tama", ""),
    ("emerald", "Smaragdkette", "alpha", "#4fbf91", r"emerald chain", "32. Jahrhundert."),
    ("dominion", "Dominion", "gamma", "#9b6bd6", r"dominion|jem'hadar|vorta|founder|changeling", ""),
    ("gamma-other", "Weitere Mächte im Gamma-Quadranten", "gamma", "#b48ad8",
     r"karemma|wadi|skrreea|dosi|t-rogoran|hur'q|rakhar|paradas|teplan|vorta", ""),
    ("borg", "Borg-Kollektiv", "delta", "#6fd06a", r"\bborg\b|collective", ""),
    ("kazon", "Kazon-Sekten", "delta", "#d1874a", r"kazon", ""),
    ("vidiian", "Vidiianer", "delta", "#b9a64a", r"vidiian", ""),
    ("hirogen", "Hirogen", "delta", "#8f7f6a", r"hirogen", ""),
    ("malon", "Malon", "delta", "#9a9a4a", r"malon", ""),
    ("krenim", "Krenim-Imperium", "delta", "#c7685d", r"krenim", ""),
    ("talaxian", "Talaxianer", "delta", "#d8a64e", r"talax|haakon", ""),
    ("delta-other", "Weitere Völker im Delta-Quadranten", "delta", "#b7c25a",
     r"ocampa|vaadwaur|devore|kobali|mokra|turei|trabe|sikari|kyrian|vaskan|nygean|benkaran|annari|ledosian|voth|srivani|swarm|nihydron|b'omar|lokirrim|vostigye|hazari|brunali|druoda|pralor|cravic|etanian|mikhal|nezu|haakonian|kraylor|enaran|baneans|numiri|akritiri|tak tak|krowtonan|quarren|zahl|rilnar|ventu|hierarchy|kradin|vau n'akat|delta quadrant|protostar",
     ""),
    ("species8472", "Spezies 8472", "extra", "#e06aa8", r"8472|undine", "Fluidraum."),
    ("kelpien", "Kelpianer und Ba'ul", "extra", "#7ea4c9", r"kelpien|ba'ul", ""),
    ("kelvan", "Kelvanisches Imperium", "extra", "#8888c8", r"kelvan|andromeda", "Andromeda-Galaxie."),
]
COMPILED = [(f[0], re.compile(f[4], re.I)) for f in FACTIONS]


def classify(*names):
    for n in names:
        if not n:
            continue
        for fid, rx in COMPILED:
            if rx.search(n):
                return fid
    return "none"


def org_name(o):
    return (o or {}).get("name") if isinstance(o, dict) else None


def load(name, default):
    p = RAW / name
    return json.loads(p.read_text()) if p.exists() else default


def strip_html(s):
    if not s:
        return s
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def norm_name(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace(" class", ""))


def main():
    ships_raw = load("stapi_spacecraft.json", [])
    classes_raw = load("stapi_spacecraft_classes.json", [])
    wd_items = load("wikidata_items.json", [])
    commons = load("commons_images.json", {})

    # Wikidata über den Memory-Alpha-Titel und den Namen zuordnen
    wd_by_name = {}
    for it in wd_items:
        for key in (it.get("memoryAlpha", "").replace("_", " "), it.get("en")):
            if key:
                wd_by_name.setdefault(norm_name(key), it)

    images = {}

    def image_for(it):
        for f in (it or {}).get("images", []):
            m = commons.get(f)
            if m and (m.get("thumb") or m.get("url")):
                key = f"img{len(images)}" if f not in {v['file'] for v in images.values()} else next(k for k, v in images.items() if v["file"] == f)
                images[key] = {
                    "file": f,
                    "thumb": m.get("thumb") or m.get("url"),
                    "page": m.get("page"),
                    "license": strip_html(m.get("license")),
                    "licenseUrl": m.get("licenseUrl"),
                    "artist": strip_html(m.get("artist")),
                }
                return key
        return None

    def wd_fields(names, rec):
        it = None
        for n in names:
            it = wd_by_name.get(norm_name(n))
            if it:
                break
        if not it:
            return
        rec["wd"] = it["qid"]
        if it.get("de"):
            rec["de"] = it["de"]
        if it.get("descDe") or it.get("descEn"):
            rec["desc"] = it.get("descDe") or it.get("descEn")
        if it.get("memoryAlpha"):
            rec["ma"] = "https://memory-alpha.fandom.com/wiki/" + it["memoryAlpha"].replace(" ", "_")
        img = image_for(it)
        if img:
            rec["img"] = img

    classes, class_idx = [], {}
    for c in sorted(classes_raw, key=lambda c: c["name"].lower()):
        names = lambda key: [org_name(o) for o in c.get(key) or [] if org_name(o)]  # noqa: E731
        own, op, aff = names("owners"), names("operators"), names("affiliations")
        species = org_name(c.get("species"))
        rec = {
            "i": len(classes), "uid": c["uid"], "n": c["name"],
            "f": classify(*aff, *own, *op, species, c["name"]),
            "sp": species, "dk": c.get("numberOfDecks"), "cr": c.get("crew"),
            "w": c.get("warpCapable"), "m": bool(c.get("mirror")), "a": bool(c.get("alternateReality")),
            "fr": c.get("activeFrom"), "to": c.get("activeTo"),
            "ty": [t["name"] for t in c.get("spacecraftTypes") or [] if t.get("name")],
            "ar": [w["name"] for w in c.get("armaments") or [] if w.get("name")],
            "df": [w["name"] for w in c.get("defenses") or [] if w.get("name")],
            "own": own, "op": op, "aff": aff, "ships": [],
        }
        if rec["f"] == "terran" or rec["m"]:
            rec["m"] = True
        wd_fields([c["name"], c["name"] + " class", c["name"].removesuffix(" class")], rec)
        class_idx[c["uid"]] = rec["i"]
        classes.append({k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("ships", "i")})

    ships = []
    for s in sorted(ships_raw, key=lambda s: s["name"].lower()):
        cls_uid = (s.get("spacecraftClass") or {}).get("uid")
        ci = class_idx.get(cls_uid, -1)
        cls = classes[ci] if ci >= 0 else None
        own, op, aff = org_name(s.get("owner")), org_name(s.get("operator")), org_name(s.get("affiliation"))
        f = classify(aff, own, op)
        if f == "none" and cls:
            f = cls["f"]
        if f == "none":
            f = classify(s["name"])
        rec = {
            "i": len(ships), "uid": s["uid"], "n": s["name"], "r": s.get("registry"),
            "st": s.get("status"), "d": s.get("dateStatus"), "c": ci, "f": f,
            "own": own, "op": op, "aff": aff,
            "alt": bool(cls and (cls.get("m") or cls.get("a"))) or f == "terran",
        }
        wd_fields([s["name"], f"{s['name']} ({s.get('registry')})" if s.get("registry") else ""], rec)
        if cls is not None:
            cls["ships"].append(rec["i"])
        ships.append({k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("c", "i")})

    used = {c["f"] for c in classes} | {s["f"] for s in ships}
    factions = [
        {"id": f[0], "name": f[1], "q": f[2], "color": f[3], "note": f[5]}
        for f in FACTIONS if f[0] in used
    ]
    if "none" in used:
        factions.append({"id": "none", "name": "Ohne erkennbare Fraktion", "q": "none", "color": "#8a93a6", "note": ""})

    built = dt.date.today().isoformat()
    sources = [
        {"name": "STAPI", "license": "Code: MIT", "url": "https://stapi.co", "licenseUrl": "https://github.com/cezarykluczynski/stapi/blob/master/LICENSE",
         "count": len(ships_raw) + len(classes_raw), "unit": "Datensätze",
         "text": "Freie Star-Trek-Programmierschnittstelle. Liefert Schiffe, Klassen, Bewaffnung, Status und Zugehörigkeit in strukturierter Form."},
        {"name": "Memory Alpha", "license": "CC BY-NC 4.0", "url": "https://memory-alpha.fandom.com", "licenseUrl": "https://creativecommons.org/licenses/by-nc/4.0/deed.de",
         "count": 0, "unit": "",
         "text": "Das Fan-Wiki zum Star-Trek-Kanon ist die Quelle hinter STAPI. Seine Lizenz erlaubt Weitergabe mit Namensnennung, aber keine kommerzielle Nutzung."},
        {"name": "Wikidata", "license": "CC0", "url": "https://www.wikidata.org", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.de",
         "count": len(wd_items), "unit": "verknüpfte Einträge",
         "text": "Freie Wissensdatenbank. Liefert deutsche Namen, Kurzbeschreibungen und Verknüpfungen zu Bildern."},
        {"name": "Wikimedia Commons", "license": "je Bild", "url": "https://commons.wikimedia.org", "licenseUrl": "",
         "count": len(images), "unit": "Bilder genutzt",
         "text": "Freie Mediensammlung. Jedes Bild bringt Urheber und Lizenz mit, meist CC BY-SA oder gemeinfrei."},
    ]

    db = {"built": built, "quadrants": QUADRANTS, "factions": factions, "sources": sources,
          "classes": classes, "ships": ships, "images": images}
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "ships.json").write_text(json.dumps(db, ensure_ascii=False, indent=1))
    (ROOT / "site").mkdir(exist_ok=True)
    (ROOT / "site" / "data.js").write_text("window.STDB=" + json.dumps(db, ensure_ascii=False, separators=(",", ":")) + ";\n")

    by_f = {}
    for s in ships:
        by_f[s["f"]] = by_f.get(s["f"], 0) + 1
    print(f"{len(classes)} Klassen, {len(ships)} Schiffe, {len(images)} Bilder")
    print("Schiffe je Fraktion:", dict(sorted(by_f.items(), key=lambda x: -x[1])))


if __name__ == "__main__":
    main()
