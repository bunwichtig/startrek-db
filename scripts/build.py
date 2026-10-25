"""Baut aus den Rohdaten die Datenbank (data/ships.json) und die Seitendaten (site/data.js).

Die Zuordnung von Organisationen zu Fraktionen und von Fraktionen zu Quadranten
ist redaktionelle Arbeit dieses Projekts (siehe FACTIONS unten).
"""
import datetime as dt
import html
import json
import re
import urllib.parse
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
     r"\bfederation|starfleet|\bufp\b|section 31|daystrom|federation news|temporal integrity|kelvin|utopia planitia", ""),
    ("earth", "Erde (vor der Föderation)", "alpha", "#7fb8d8",
     r"united earth|earth starfleet|^earth |confederation|\bnasa\b|national aeronautics|space agency|space probe agency|esa\b|space shuttle|apollo|gemini|mercury capsule|agena|atlas|\bares\b|\bdy-\d|saturn v|soyuz|vostok|skylab|phoenix|space capsule|olympus|friendship 1|charybdis|merchant marine|madred|\bhuman\b|united nations|\bunsc\b|earth cargo|\becs\b|zefram|confederation of earth|eugenics|augment|european|soviet|united states|us air force|royal navy|terran(?! empire)",
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
     r"caatati|benthan|briori|akritiri|b'omar|banean|dinaali|drayan|entharan|kmada|botha|qomar|varro|vojean|yallitian|nyrian|taresian|rakosan|ramuran|mari\b|vori\b|wysanti|overlooker|brenari|dala\b|kesat|imhotep|tarkan|nasari|ventu|ilari|komar|gree\b|norcadian|ocampa|vaadwaur|devore|kobali|mokra|turei|trabe|sikari|kyrian|vaskan|nygean|benkaran|annari|ledosian|voth|srivani|swarm|nihydron|b'omar|lokirrim|vostigye|hazari|brunali|druoda|pralor|cravic|etanian|mikhal|nezu|haakonian|kraylor|enaran|baneans|numiri|akritiri|tak tak|krowtonan|quarren|zahl|rilnar|ventu|hierarchy|kradin|vau n'akat|delta quadrant|protostar",
     ""),
    ("alpha-other", "Weitere Völker im Alpha- und Beta-Quadranten", "alpha", "#a6b4c8",
     r"bolian|benzite|betazoid|trill|denobula|coridan|axanar|antarian|antedean|antidean|barolian|boslic|kressari|pakled|lissepian|yridian|xepolite|miradorn|zakdorn|bynar|ktarian|lurian|kobliad|kobheerian|valerian|promellian|menthar|tygarian|ornaran|brekkian|mizarian|angosian|arkonian|ardanan|arretan|corvallen|bardeezan|ba'neth|ankari|aksani|satarran|sheliak|paxan|jarada|tarellian|haliian|takaran|elaysian|kaelon|ullian|zalkonian|malcorian|mintakan|selay|antican|tarkalean|kreetassan|klaestron|rigel|tiburon|deltan|efrosian|saurian|caitian|edosian|grazerite|xyrillian|akaali|malurian|yonadan|halkan|medusan|first federation|fesarius|flaxian|frunalian|gallamite|kriosian|ligonian|lysian|mordanite|napean|ramatis|risian|scalosian|tellun|elasian|troyian|zibalian|platonian|metron|excalbian|organian|thasian|talosian|cheron|dramen|elba|mazarite|chalnoth|husnock|douwd|nuu'bari|aenar|wadi|tosk|kobali|coalition of madena|madena|dopterian|hupyrian|tandaran|ikaaran|kantare|kreetassan|enolian|axanar|ventaxian|rutian|ennis|nol-ennis|skagaran|triannon|antaran|vissian|kreechta|arcadian|gallamite|kaferian|evora|kazarite|lethean|letheans|pendari|bolarus|benzar|brekka|ornara|angel one|tiburonian",
     "Kleinere Völker, Mitgliedswelten der Föderation und Unabhängige. Der Quadrant ist bei manchen nur grob bekannt."),
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


PREFIXES = [
    (r"^(USS|NSS|NCV)\b", "federation"),
    (r"^(IKS|IKC|IKV)\b", "klingon"),
    (r"^(IRW|RIS|RSV)\b", "romulan"),
    (r"^(ECS|UES|ESS)\b", "earth"),
    (r"^(ISS)\b", "terran"),
    (r"^(CDS|CUS)\b", "cardassian"),
]
PREFIX_RX = [(re.compile(p), f) for p, f in PREFIXES]

# Stationen und Sonden ohne Eigentümerangabe, deren Name die Herkunft verrät
NAME_RULES = [
    (r"^(starbase|outpost \d|deep space \d|deep space station|relay station|epsilon outpost|spacedock|space station k-|"
     r"regula|jupiter station|utopia planitia|mckinley|deep space outpost|subspace relay|starfleet|argus array|"
     r"emergency medical|federation|mars orbital|lya station|sherman's planet|station salem|memory alpha|"
     r"spacedock one|earth spacedock|copernicus|tango sierra|ds\d|sb-)", "federation"),
    (r"(hubble|ariane|weather balloon|orbiting solar|explorer|pioneer|mariner|sputnik|telescope|nomad|friendship 1|"
     r"voyager \d|viking|vanguard|international space station|mir\b|skylab|cassini|galileo|juno|rosetta|"
     r"kosygin|usgs|earth outpost|botany bay|valiant|lunar|moon base|tranquility)", "earth"),
]
NAME_RX = [(re.compile(p, re.I), f) for p, f in NAME_RULES]


def year(date):
    m = re.search(r"\d{4}", date or "")
    return int(m.group()) if m else None


def from_name(name, registry, date):
    """Leitet die Fraktion aus Schiffspräfix und Registriernummer ab."""
    for rx, fid in PREFIX_RX:
        if rx.search(name or ""):
            return fid
    for rx, fid in NAME_RX:
        if rx.search(name or ""):
            return "earth" if fid == "federation" and year(date) and year(date) < 2161 else fid
    reg = (registry or "").upper()
    y = year(date)
    if reg.startswith(("NCC", "NAR", "NCV", "NDT")):
        return "federation"
    if reg.startswith("NX") or (name or "").startswith("SS "):
        return "earth" if y and y < 2161 else "federation"
    return "none"


MA_URL = "https://memory-alpha.fandom.com/wiki/"
MA_SKIP_CATS = {"Spacecraft sections", "Spacecraft components", "Prefixes", "Starfleet dedication plaques",
                "Dedication plaques", "Spacecraft parts", "Cosmic Duchess locations", "Fictional starships"}
MA_SKIP_SIDEBARS = {"planet", "individual", "star system", "astronomical object", "species"}


def wclean(v):
    """Wikitext einer Infobox-Zeile in Klartext umwandeln."""
    if not v:
        return None
    v = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", v, flags=re.S)
    v = re.sub(r"<br\s*/?>", ", ", v)
    v = re.sub(r"<[^>]+>", "", v)
    for _ in range(6):
        nv = re.sub(r"\{\{([^{}]*)\}\}", lambda m: (m.group(1).split("|") + [""])[1 if "|" in m.group(1) else 0], v)
        if nv == v:
            break
        v = nv
    v = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", v)
    v = re.sub(r"\[https?://\S+ ([^\]]+)\]", r"\1", v)
    v = re.sub(r"'{2,}", "", v)
    v = re.sub(r"\s+", " ", v).strip(" ,;")
    return v or None


def wlinks(v):
    """Linkziele einer Infobox-Zeile."""
    return [m.split("|")[0].strip() for m in re.findall(r"\[\[([^\]]+)\]\]", v or "")]


def ma_kind(page):
    cats = set(page["categories"])
    if page["sidebar"] in MA_SKIP_SIDEBARS or page["title"] in cats:
        return None
    if cats and cats <= MA_SKIP_CATS:
        return None
    if page["sidebar"] == "starship class" or any(re.search(r"classes", c) for c in cats):
        return "class"
    if page["sidebar"] in ("starship", "station"):
        return "ship"
    if any(re.search(r"starships|spacecraft$|spacecraft \(|shuttles|probes|starbases|outposts|space stations|escape pods", c, re.I) for c in cats):
        return "ship"
    return None


def ma_reality(page):
    cats = " ".join(page["categories"]) + " " + page["title"]
    return ("mirror" in cats.lower() or page["title"].startswith("ISS "), "alternate reality" in cats.lower())


def base_title(t):
    return re.sub(r"\s*\([^)]*\)$", "", t)


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
        for key in (it.get("memoryAlpha", "").replace("_", " "),):
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
        if it.get("memoryAlpha") and not rec.get("ma"):
            rec["ma"] = MA_URL + urllib.parse.quote(it["memoryAlpha"].replace(" ", "_"))
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
        class_idx[c["uid"]] = rec["i"]
        classes.append({k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("ships", "i")})

    ma_pages = load("memory_alpha_pages.json", [])
    ma_classes = [p for p in ma_pages if ma_kind(p) == "class"]
    ma_ships = [p for p in ma_pages if ma_kind(p) == "ship"]
    class_by_name = {}
    for c in classes:
        class_by_name.setdefault(norm_name(c["n"]), c)

    def enrich(rec, page):
        rec["ma"] = MA_URL + urllib.parse.quote(page["title"].replace(" ", "_"))
        if page.get("intro") and not rec.get("intro"):
            rec["intro"] = page["intro"]

    seen_class_pages = set()
    for page in ma_classes:
        if page["title"] in seen_class_pages:
            continue
        seen_class_pages.add(page["title"])
        ib = {k: wclean(v) for k, v in page["infobox"].items()}
        c = class_by_name.get(norm_name(page["title"])) or class_by_name.get(norm_name(ib.get("name")))
        if c:
            enrich(c, page)
            continue
        mirror, alt = ma_reality(page)
        split = lambda v: [x.strip() for x in re.split(r",|;", v or "") if x.strip()]  # noqa: E731
        own, op, aff = split(ib.get("owner")), split(ib.get("operator")), split(ib.get("affiliation"))
        active = ib.get("active") or ""
        rec = {
            "i": len(classes), "n": page["title"],
            "f": classify(*aff, *own, *op, *page["categories"], page["title"]),
            "cr": ib.get("crew"), "dk": ib.get("decks"), "m": mirror, "a": alt,
            "fr": active or None,
            "ty": split(ib.get("type")), "ar": split(ib.get("armament")), "df": split(ib.get("defenses")),
            "own": own, "op": op, "aff": aff, "ships": [], "src": "ma",
        }
        if rec["f"] == "terran":
            rec["m"] = True
        enrich(rec, page)
        rec = {k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("ships", "i")}
        classes.append(rec)
        class_by_name[norm_name(page["title"])] = rec

    ships = []
    for s in sorted(ships_raw, key=lambda s: s["name"].lower()):
        cls_uid = (s.get("spacecraftClass") or {}).get("uid")
        ci = class_idx.get(cls_uid, -1)
        cls = classes[ci] if ci >= 0 else None
        own, op, aff = org_name(s.get("owner")), org_name(s.get("operator")), org_name(s.get("affiliation"))
        f = "terran" if s["name"].startswith("ISS ") else classify(aff, own, op)
        if f == "none" and cls:
            f = cls["f"]
        if f == "none":
            f = from_name(s["name"], s.get("registry"), s.get("dateStatus"))
        if f == "none":
            f = classify(s["name"])
        rec = {
            "i": len(ships), "uid": s["uid"], "n": s["name"], "r": s.get("registry"),
            "st": s.get("status"), "d": s.get("dateStatus"), "c": ci, "f": f,
            "own": own, "op": op, "aff": aff,
            "alt": bool(cls and (cls.get("m") or cls.get("a"))) or f == "terran",
        }
        if cls is not None:
            cls["ships"].append(rec["i"])
        ships.append({k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("c", "i")})

    ship_by_key, ship_by_name = {}, {}
    for r in ships:
        ship_by_key.setdefault(norm_name(r["n"]) + norm_name(r.get("r")), r)
        ship_by_name.setdefault(norm_name(r["n"]), []).append(r)
    added, seen_ship_pages = 0, set()
    for page in ma_ships:
        if page["title"] in seen_ship_pages or page["title"].startswith("Unnamed"):
            continue
        seen_ship_pages.add(page["title"])
        raw = page["infobox"]
        ib = {k: wclean(v) for k, v in raw.items()}
        name = base_title(page["title"])
        reg = ib.get("registry")
        r = ship_by_key.get(norm_name(name) + norm_name(reg)) or ship_by_key.get(norm_name(ib.get("name")) + norm_name(reg))
        if not r and len(ship_by_name.get(norm_name(name), [])) == 1 and not reg:
            r = ship_by_name[norm_name(name)][0]
        if r:
            if "ma" not in r:
                enrich(r, page)
            continue
        cls = None
        for target in wlinks(raw.get("class")):
            cls = class_by_name.get(norm_name(target))
            if cls:
                break
        mirror, alt = ma_reality(page)
        own, op, aff = ib.get("owner"), ib.get("operator"), ib.get("affiliation")
        f = "terran" if mirror and name.startswith("ISS ") else classify(aff, own, op, *page["categories"])
        if f == "none" and cls:
            f = cls["f"]
        if f == "none":
            f = from_name(name, reg, ib.get("datestatus"))
        rec = {
            "i": len(ships), "n": name, "r": reg, "st": ib.get("status"), "d": ib.get("datestatus"),
            "c": cls["i"] if cls else -1, "f": f, "own": own, "op": op, "aff": aff,
            "ty": [ib["type"]] if ib.get("type") else [], "cn": None if cls else ib.get("class"),
            "alt": mirror or alt or bool(cls and (cls.get("m") or cls.get("a"))), "src": "ma",
        }
        enrich(rec, page)
        rec = {k: v for k, v in rec.items() if v not in (None, "", [], False) or k in ("c", "i")}
        if cls is not None:
            cls["ships"].append(rec["i"])
        ships.append(rec)
        added += 1
    print(f"Memory Alpha: {len(ma_ships)} Schiffsartikel, {added} neu ergänzt; {len(ma_classes)} Klassenartikel")

    for rec in classes + ships:
        title = urllib.parse.unquote(rec["ma"].removeprefix(MA_URL)).replace("_", " ") if rec.get("ma") else None
        wd_fields([title] if title else [rec["n"]], rec)

    used = {c["f"] for c in classes} | {s["f"] for s in ships}
    factions = [
        {"id": f[0], "name": f[1], "q": f[2], "color": f[3], "note": f[5]}
        for f in FACTIONS if f[0] in used
    ]
    if "none" in used:
        factions.append({"id": "none", "name": "Unabhängige und Unbekannte", "q": "none", "color": "#8a93a6", "note": ""})

    built = dt.date.today().isoformat()
    sources = [
        {"name": "STAPI", "license": "Code: MIT", "url": "https://stapi.co", "licenseUrl": "https://github.com/cezarykluczynski/stapi/blob/master/LICENSE",
         "count": len(ships_raw) + len(classes_raw), "unit": "Datensätze",
         "text": "Freie Star-Trek-Programmierschnittstelle. Liefert Schiffe, Klassen, Bewaffnung, Status und Zugehörigkeit in strukturierter Form."},
        {"name": "Memory Alpha", "license": "CC BY-NC 4.0", "url": "https://memory-alpha.fandom.com", "licenseUrl": "https://creativecommons.org/licenses/by-nc/4.0/deed.de",
         "count": len(ma_pages), "unit": "Artikel ausgewertet",
         "text": "Das Fan-Wiki zum Star-Trek-Kanon. Direkt gelesen werden Kategorien, Infoboxen und der erste Absatz jedes Schiffsartikels. Die Lizenz erlaubt Weitergabe mit Namensnennung, aber keine kommerzielle Nutzung. Bilder aus Memory Alpha werden nicht übernommen."},
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
