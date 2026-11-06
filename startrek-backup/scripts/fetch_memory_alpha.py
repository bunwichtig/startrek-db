"""Lädt Raumschiff-Artikel direkt aus Memory Alpha (CC BY-NC 4.0).

STAPI deckt nur einen Teil der Schiffe ab. Dieses Skript läuft durch die
Raumschiff-Kategorien von Memory Alpha, liest die Infobox jedes Artikels
(Registriernummer, Klasse, Eigentümer, Status …) und einen kurzen Einleitungstext.
Bilder aus Memory Alpha werden nicht übernommen, weil sie urheberrechtlich
geschützte Szenenbilder sind.
Ergebnis: data/raw/memory_alpha_pages.json
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://memory-alpha.fandom.com/api.php"
UA = "startrek-db/0.1 (+https://github.com/bunwichtig/startrek-db)"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw"

ROOTS = ["Category:Spacecraft", "Category:Starships", "Category:Spacecraft classes", "Category:Space stations"]
MAX_DEPTH = 4
SKIP = re.compile(r"image|file|appendices|production|model|staff|real.world|deleted|templates?$|"
                  r"memory alpha|stub|lists?$|starship (equipment|operations|systems|components)|"
                  r"weapon|technology|personnel|crew|captain|people|individuals|novel|comic|game|"
                  r"background|unnamed|merchandise|licens|toy", re.I)


def get(**params):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = f"{API}?{urllib.parse.urlencode(params)}"
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            wait = 2 ** attempt
            print(f"  Fehler: {e} – neuer Versuch in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Abruf fehlgeschlagen: {url}")


def members(cat):
    out, cont = [], {}
    while True:
        data = get(action="query", list="categorymembers", cmtitle=cat, cmlimit=500,
                   cmtype="page|subcat", cmnamespace="0|14", **cont)
        out.extend(data.get("query", {}).get("categorymembers", []))
        if "continue" not in data:
            return out
        cont = {"cmcontinue": data["continue"]["cmcontinue"]}
        time.sleep(0.2)


def crawl():
    pages = {}  # Titel -> Kategorien
    seen, queue = set(), [(c, 0) for c in ROOTS]
    while queue:
        cat, depth = queue.pop(0)
        if cat in seen:
            continue
        seen.add(cat)
        try:
            items = members(cat)
        except RuntimeError as e:
            print(e, file=sys.stderr)
            continue
        name = cat.removeprefix("Category:")
        for m in items:
            if m["ns"] == 14:
                if depth < MAX_DEPTH and not SKIP.search(m["title"].removeprefix("Category:")):
                    queue.append((m["title"], depth + 1))
            elif m["ns"] == 0:
                pages.setdefault(m["title"], set()).add(name)
        print(f"{cat}: {len(items)} Einträge, bisher {len(pages)} Artikel, {len(queue)} Kategorien offen")
        time.sleep(0.2)
    return pages


def template_params(text):
    """Liest die Parameter der ersten Sidebar-Vorlage."""
    m = re.search(r"\{\{\s*sidebar[ _]([^|}]+)", text, re.I)
    if not m:
        return None, {}
    start, depth, i = m.start(), 0, m.start()
    while i < len(text):
        if text.startswith("{{", i):
            depth += 1
            i += 2
            continue
        if text.startswith("}}", i):
            depth -= 1
            i += 2
            if depth == 0:
                break
            continue
        i += 1
    body = text[start + 2:i - 2]
    parts, buf, lvl = [], "", 0
    j = 0
    while j < len(body):
        two = body[j:j + 2]
        if two in ("{{", "[["):
            lvl += 1
            buf += two
            j += 2
            continue
        if two in ("}}", "]]"):
            lvl -= 1
            buf += two
            j += 2
            continue
        if body[j] == "|" and lvl == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += body[j]
        j += 1
    parts.append(buf)
    params = {}
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            params[k.strip().lower()] = v.strip()
    return m.group(1).strip().lower(), params


def intro(text):
    """Erster Absatz des Artikels als Klartext."""
    t = re.sub(r"\{\{[^{}]*\}\}", "", text)
    t = re.sub(r"\{\{[^{}]*\}\}", "", t)
    t = re.sub(r"\{\|.*?\|\}", "", t, flags=re.S)
    t = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    for para in t.split("\n"):
        para = para.strip()
        if not para or para.startswith(("[[File:", "[[Image:", "==", "*", ":", "|", "{", "}", "[[Category")):
            continue
        para = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", para)
        para = re.sub(r"'{2,}", "", para)
        para = re.sub(r"\s+", " ", para).strip()
        if len(para) > 40:
            return para[:700]
    return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pages = crawl()
    titles = sorted(pages)
    result = []
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        data = get(action="query", prop="revisions", rvprop="content", rvslots="main",
                   titles="|".join(chunk), redirects=1)
        for p in data.get("query", {}).get("pages", []):
            revs = p.get("revisions") or []
            if not revs:
                continue
            text = revs[0].get("slots", {}).get("main", {}).get("content", "")
            kind, params = template_params(text)
            result.append({
                "title": p["title"],
                "categories": sorted(pages.get(p["title"], [])),
                "sidebar": kind,
                "infobox": params,
                "intro": intro(text),
            })
        print(f"Artikel {min(i + 50, len(titles))}/{len(titles)}")
        time.sleep(0.3)
    result.sort(key=lambda r: r["title"])
    (OUT / "memory_alpha_pages.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"{len(result)} Memory-Alpha-Artikel gespeichert")


if __name__ == "__main__":
    main()
