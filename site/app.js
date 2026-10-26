/* Sternenregister – Oberfläche der Schiffsdatenbank. Liest window.STDB aus data.js. */
(function () {
  "use strict";
  const D = window.STDB;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => n.toLocaleString("de-DE");

  const factions = new Map(D.factions.map((f) => [f.id, f]));
  const STATUS_DE = {
    Active: "Aktiv", Destroyed: "Zerstört", Derelict: "Wrack", Retired: "Ausgemustert", Crashed: "Abgestürzt",
    Abandoned: "Aufgegeben", Adrift: "Treibend", Decommissioned: "Außer Dienst", Recovered: "Geborgen",
    Transported: "Transportiert", Assimilated: "Assimiliert", Captured: "Erbeutet", Missing: "Vermisst",
    Unknown: "Unbekannt", Scrapped: "Verschrottet", Lost: "Verschollen", Stolen: "Gestohlen", Museum: "Museum",
    Mothballed: "Eingemottet", Inactive: "Inaktiv", Reserve: "Reserve", Damaged: "Beschädigt", Disabled: "Manövrierunfähig", Salvaged: "Geborgen", Preserved: "Erhalten", Wrecked: "Wrack", Scuttled: "Selbst versenkt", Cannibalized: "Ausgeschlachtet", Impounded: "Beschlagnahmt", Classified: "Geheim", Disappeared: "Verschwunden", Incomplete: "Unvollendet",
  };
  const statusDe = (s) => (s ? STATUS_DE[s] || s : "");
  const statusTone = (s) => (/Active/.test(s || "") ? "ok" : /Destroy|Crash|Lost|Assimil|Scrap/.test(s || "") ? "bad" : "");

  /* ---------- Schiffsgrafiken ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  }
  // Zeichenstil der Schiffsgrafiken (ships.js). Standard ist der Bauplan, die Wahl merkt sich der Browser.
  const ART_KEY = "sternenregister-grafik";
  let artStyle = "bauplan";
  try { if (localStorage.getItem(ART_KEY) === "modell") artStyle = "modell"; } catch (e) { /* ohne Speicher gilt der Standard */ }
  const shipSVG = (item, color) => window.shipArt(item, color, artStyle);
  let drawerArt = null;

  function artHTML(item, color) {
    const img = item.img && D.images[item.img];
    if (img && img.thumb) {
      return `<img src="${esc(img.thumb)}" alt="${esc(item.n)}" loading="lazy" data-fallback="1">`;
    }
    return shipSVG(item, color);
  }

  /* ---------- Suche ---------- */
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  D.classes.forEach((c) => {
    const fac = factions.get(c.f);
    c._s = norm([c.n, c.de, c.sp, fac && fac.name, (c.ty || []).join(" ")].join(" "));
  });
  D.ships.forEach((s) => {
    const fac = factions.get(s.f);
    const cls = s.c >= 0 ? D.classes[s.c] : null;
    s._s = norm([s.n, s.de, s.r, cls && cls.n, fac && fac.name, s.own, s.op].join(" "));
  });

  const state = { q: "", main: true, withShips: false, status: "", open: new Set(["alpha"]) };

  function filterAll() {
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    const hit = (s) => terms.every((t) => s.includes(t));
    const shipOk = (s) => (!state.status || s.st === state.status) && (!state.main || !s.alt);
    const ships = D.ships.filter((s) => shipOk(s) && (!terms.length || hit(s._s)));
    const shipSet = new Set(ships.map((s) => s.i));
    const classes = D.classes.filter((c) => {
      if (state.main && (c.m || c.a)) return false;
      const own = c.ships.filter((i) => shipSet.has(i));
      if (state.withShips && !c.ships.length) return false;
      if (state.status && !own.length) return false;
      return !terms.length || hit(c._s) || own.length > 0;
    });
    return { ships, shipSet, classes, terms };
  }

  /* ---------- Darstellung ---------- */
  function quadGlyph(q) {
    const cells = { alpha: [0, 1], beta: [1, 1], gamma: [0, 0], delta: [1, 0] }[q.id];
    let s = `<svg class="quad-glyph" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" stroke-opacity="0.35"/>`;
    s += `<path d="M28 2 V54 M2 28 H54" stroke="currentColor" stroke-opacity="0.35"/>`;
    if (cells) {
      const [x, y] = cells;
      const sx = x ? 28 : 2, sy = y ? 28 : 2;
      s += `<path d="M28 28 L${x ? 54 : 2} 28 A26 26 0 0 ${x === y ? 0 : 1} 28 ${y ? 54 : 2} Z" fill="var(--accent)" fill-opacity="0.75"/>`;
      void sx; void sy;
    } else {
      s += `<circle cx="28" cy="28" r="8" fill="none" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
    }
    return s + `<circle cx="28" cy="28" r="2" fill="currentColor"/></svg>`;
  }

  function cardHTML(c, shipCount) {
    const fac = factions.get(c.f);
    const color = fac ? fac.color : "#88aa99";
    const era = !c.fr && !c.to ? "" : c.fr === c.to || !c.to ? c.fr : `${c.fr || "?"}–${c.to}`;
    const tags = [];
    if (c.m) tags.push('<span class="tag alt">Spiegeluniversum</span>');
    if (c.a) tags.push('<span class="tag alt">Kelvin-Zeitlinie</span>');
    if (c.w === false) tags.push('<span class="tag">ohne Warp</span>');
    if (shipCount) tags.push(`<span class="tag">${shipCount} ${shipCount === 1 ? "Schiff" : "Schiffe"}</span>`);
    const sub = [c.de && c.de !== c.n ? c.de : "", (c.ty || [])[0], era].filter(Boolean).join(" · ");
    return `<button type="button" class="card" style="--fc:${color}" data-class="${c.i}">
      <div class="card-art">${artHTML(c, color)}</div>
      <div class="card-body"><div class="card-t">${esc(c.n)}</div>
      ${sub ? `<div class="card-s">${esc(sub)}</div>` : ""}
      <div class="tags">${tags.join("")}</div></div></button>`;
  }

  const LIMIT = 60;
  function render() {
    const { ships, shipSet, classes, terms } = filterAll();
    const searching = terms.length > 0 || state.status;
    const byFac = new Map();
    const bucket = (f) => { if (!byFac.has(f)) byFac.set(f, { classes: [], loose: [] }); return byFac.get(f); };
    classes.forEach((c) => bucket(c.f).classes.push(c));
    ships.forEach((s) => {
      const cls = s.c >= 0 ? D.classes[s.c] : null;
      const clsShown = cls && classes.includes(cls);
      if (!clsShown || terms.length) bucket(s.f).loose.push(s);
    });

    $("#db-summary").innerHTML = searching
      ? `${fmt(classes.length)} Klassen und ${fmt(ships.length)} Schiffe gefunden`
      : `${fmt(D.classes.length)} Schiffsklassen · ${fmt(D.ships.length)} benannte Schiffe · ${fmt(D.factions.length)} Fraktionen`;

    let html = "";
    for (const q of D.quadrants) {
      const facs = D.factions.filter((f) => f.q === q.id && byFac.has(f.id));
      if (!facs.length) continue;
      let nC = 0, nS = 0;
      facs.forEach((f) => { const b = byFac.get(f.id); nC += b.classes.length; nS += shipTotal(b, shipSet); });
      const open = searching || state.open.has(q.id);
      html += `<details class="quad" data-q="${q.id}" ${open ? "open" : ""}><summary>${quadGlyph(q)}
        <div><div class="quad-name">${esc(q.name)}<span class="chev">›</span></div><div class="quad-sub">${esc(q.sub)}</div></div>
        <div class="quad-count"><b>${fmt(nC)}</b> Klassen · ${fmt(nS)} Schiffe</div></summary><div class="quad-body">`;
      facs.sort((a, b) => sizeOf(byFac.get(b.id)) - sizeOf(byFac.get(a.id)));
      for (const f of facs) {
        const b = byFac.get(f.id);
        const shipsIn = shipTotal(b, shipSet);
        const fOpen = searching || facs.length === 1;
        html += `<details class="fac" style="--fc:${f.color}" data-f="${f.id}" ${fOpen ? "open" : ""}><summary><span class="fac-dot"></span>
          <span class="fac-name">${esc(f.name)}<span class="chev">›</span></span>
          <span class="fac-meta">${fmt(b.classes.length)} Kl. · ${fmt(shipsIn)} Sch.</span></summary>
          <div class="fac-body" data-lazy="1"></div></details>`;
      }
      html += `</div></details>`;
    }
    $("#quadrants").innerHTML = html || `<div class="empty">Keine Treffer. Andere Schreibweise versuchen oder Filter lockern.</div>`;
    current = { byFac, shipSet };
    document.querySelectorAll(".fac[open] .fac-body[data-lazy]").forEach(fillFaction);
  }
  function shipTotal(b, shipSet) {
    const ids = new Set(b.loose.map((s) => s.i));
    b.classes.forEach((c) => c.ships.forEach((i) => shipSet.has(i) && ids.add(i)));
    return ids.size;
  }
  const sizeOf = (b) => b.classes.length * 3 + b.loose.length;
  let current = null;

  function fillFaction(body, all) {
    const fid = body.parentElement.dataset.f;
    const f = factions.get(fid);
    const b = current.byFac.get(fid);
    if (!b) return;
    body.removeAttribute("data-lazy");
    const cls = b.classes.slice().sort((x, y) => y.ships.length - x.ships.length || x.n.localeCompare(y.n));
    const lim = all ? Infinity : LIMIT;
    let h = f.note ? `<p class="fac-note">${esc(f.note)}</p>` : "";
    if (cls.length) {
      h += `<div class="grid">${cls.slice(0, lim).map((c) => cardHTML(c, c.ships.filter((i) => current.shipSet.has(i)).length)).join("")}</div>`;
      if (cls.length > lim) h += `<button type="button" class="btn-ghost more" data-all="${fid}">Alle ${fmt(cls.length)} Klassen zeigen</button>`;
    }
    if (b.loose.length) {
      const loose = b.loose.slice().sort((x, y) => x.n.localeCompare(y.n));
      h += `<div class="loose"><h4>${cls.length && !state.q.trim() ? "Weitere Schiffe" : "Schiffe"} (${fmt(loose.length)})</h4><ul class="shiplist">${loose
        .slice(0, all ? Infinity : 120)
        .map((s) => `<li><button type="button" data-ship="${s.i}"><span class="sn">${esc(s.n)}</span><span class="sr-reg">${esc(s.r || "")}</span></button></li>`)
        .join("")}</ul>${loose.length > 120 && !all ? `<button type="button" class="btn-ghost more" data-all="${fid}">Alle ${fmt(loose.length)} Schiffe zeigen</button>` : ""}</div>`;
    }
    body.innerHTML = h;
  }

  /* ---------- Detailansicht ---------- */
  function imgBlock(item, color) {
    const img = item.img && D.images[item.img];
    drawerArt = { item, color };
    let h = `<div class="d-art">${artHTML(item, color)}</div>`;
    if (img) {
      h += `<p class="credit">Bild: ${esc(img.artist || "unbekannt")} · <a href="${esc(img.licenseUrl || img.page)}" target="_blank" rel="noopener">${esc(img.license || "Lizenz siehe Commons")}</a> · <a href="${esc(img.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`;
    } else {
      h += `<p class="credit">Schematische Zeichnung nach Klasse und Fraktion. Eigene Grafik, kein offizieller Entwurf.</p>`;
    }
    return h;
  }
  function introBlock(item) {
    if (!item.intro) return "";
    return `<p class="d-intro">${esc(item.intro)}</p><p class="credit">Text: <a href="${esc(item.ma)}" target="_blank" rel="noopener">Memory Alpha</a>, CC BY-NC 4.0, auf Englisch.</p>`;
  }
  function spec(rows) {
    return `<dl class="specs">${rows.filter((r) => r[1] !== undefined && r[1] !== null && r[1] !== "").map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  }
  function links(item) {
    const l = [`<a href="${esc(item.ma || "https://memory-alpha.fandom.com/wiki/Special:Search?query=" + encodeURIComponent(item.n))}" target="_blank" rel="noopener">Memory Alpha</a>`];
    if (item.wd) l.push(`<a href="https://www.wikidata.org/wiki/${esc(item.wd)}" target="_blank" rel="noopener">Wikidata ${esc(item.wd)}</a>`);
    if (item.uid) l.push(`<a href="https://stapi.co/api/v2/rest/${item.kind}?uid=${esc(item.uid)}" target="_blank" rel="noopener">STAPI-Datensatz</a>`);
    return `<div class="d-links">${l.join("")}</div>`;
  }
  function openClass(i) {
    const c = D.classes[i];
    const f = factions.get(c.f);
    const color = f ? f.color : "#88aa99";
    const ships = c.ships.map((j) => D.ships[j]).sort((a, b) => a.n.localeCompare(b.n));
    let h = `<div style="--fc:${color}"><p class="d-kicker">Schiffsklasse · ${esc(f ? f.name : "")}</p><h3 class="d-title" id="d-title">${esc(c.n)}</h3>`;
    if (c.desc) h += `<p class="d-sub">${esc(c.desc)}</p>`;
    h += imgBlock(c, color) + introBlock(c);
    h += spec([
      ["Deutsch", c.de && c.de !== c.n ? esc(c.de) : ""],
      ["Spezies", esc(c.sp || "")],
      ["Typ", esc((c.ty || []).join(", "))],
      ["Im Dienst", !c.fr && !c.to ? "" : c.fr === c.to ? esc(c.fr) : esc(`${c.fr || "?"} bis ${c.to || "?"}`)],
      ["Decks", c.dk || ""],
      ["Besatzung", esc(c.cr || "")],
      ["Warp", c.w === true ? "ja" : c.w === false ? "nein" : ""],
      ["Eigentümer", esc((c.own || []).join(", "))],
      ["Betreiber", esc((c.op || []).join(", "))],
      ["Zugehörigkeit", esc((c.aff || []).join(", "))],
      ["Bewaffnung", esc((c.ar || []).join(", "))],
      ["Verteidigung", esc((c.df || []).join(", "))],
      ["Realität", c.m ? "Spiegeluniversum" : c.a ? "Kelvin-Zeitlinie" : ""],
    ]);
    if (ships.length) {
      h += `<h4 class="d-h">Bekannte Schiffe (${ships.length})</h4><ul class="d-ships">${ships.map((s) => `<li><button type="button" data-ship="${s.i}"><span>${esc(s.n)}</span><span class="sr-reg">${esc([s.r, statusDe(s.st)].filter(Boolean).join(" · "))}</span></button></li>`).join("")}</ul>`;
    }
    h += links({ ...c, kind: "spacecraftClass" }) + `</div>`;
    showDrawer(h);
  }
  function openShip(i) {
    const s = D.ships[i];
    const f = factions.get(s.f);
    const color = f ? f.color : "#88aa99";
    const cls = s.c >= 0 ? D.classes[s.c] : null;
    // Ohne eigenes Foto zeigt ein Schiff das Bild oder die Zeichnung seiner Klasse.
    const art = s.img ? s : cls && cls.img ? { ...cls, n: s.n } : cls ? { ...cls, f: s.f || cls.f } : s;
    let h = `<div style="--fc:${color}"><p class="d-kicker">Raumschiff · ${esc(f ? f.name : "Ohne Zuordnung")}</p><h3 class="d-title" id="d-title">${esc(s.n)}</h3>`;
    if (s.desc) h += `<p class="d-sub">${esc(s.desc)}</p>`;
    h += imgBlock(art, color) + introBlock(s);
    h += spec([
      ["Registrierung", esc(s.r || "")],
      ["Klasse", cls ? `<a href="#" data-class="${cls.i}">${esc(cls.n)}</a>` : esc(s.cn || "")],
      ["Status", s.st ? `<span class="tag ${statusTone(s.st)}">${esc(statusDe(s.st))}</span>${s.d ? ` <span class="muted">(${esc(s.d)})</span>` : ""}${s.sd ? `<br><span class="muted">${esc(s.sd)}</span>` : ""}` : ""],
      ["Eigentümer", esc(s.own || "")],
      ["Betreiber", esc(s.op || "")],
      ["Zugehörigkeit", esc(s.aff || "")],
      ["Typ", esc((s.ty || []).join(", "))],
      ["Deutsch", s.de && s.de !== s.n ? esc(s.de) : ""],
    ]);
    h += links({ ...s, kind: "spacecraft" }) + `</div>`;
    showDrawer(h);
  }
  let lastFocus = null;
  function showDrawer(h) {
    if ($("#drawer").hidden) lastFocus = document.activeElement;
    $("#drawer-body").innerHTML = h;
    $("#drawer").hidden = false;
    $(".drawer-panel").scrollTop = 0;
    $(".drawer .close").focus();
    wireImages($("#drawer-body"));
  }
  function closeDrawer() {
    $("#drawer").hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  // Bilder, die nicht laden (z. B. offline), durch die Silhouette ersetzen.
  function wireImages(root) {
    root.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.addEventListener("error", () => {
        const host = img.closest("[data-class],[data-ship]") || img.closest(".d-art");
        const btn = img.closest("[data-class]");
        const item = btn ? D.classes[+btn.dataset.class] : null;
        const fac = item && factions.get(item.f);
        img.replaceWith(document.createRange().createContextualFragment(shipSVG(item || { n: img.alt }, fac ? fac.color : "#88aa99")));
        void host;
      }, { once: true });
    });
  }

  /* ---------- Datenbasis ---------- */
  function renderBasis() {
    $("#basis-built").textContent = `Stand der Daten: ${new Date(D.built).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}`;
    $("#sources").innerHTML = D.sources.map((s) => `<div class="src">
      <div class="src-n">${esc(s.name)}</div><span class="src-lic">${esc(s.license)}</span>
      ${s.count ? `<div class="src-num">${fmt(s.count)}<small>${esc(s.unit)}</small></div>` : ""}
      <p>${esc(s.text)}</p><p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\//, ""))}</a>${s.licenseUrl ? ` · <a href="${esc(s.licenseUrl)}" target="_blank" rel="noopener">Lizenztext</a>` : ""}</p></div>`).join("");
    const imgs = Object.keys(D.images).length;
    $("#hero-stats").innerHTML = `<b>${fmt(D.classes.length)}</b> Schiffsklassen, <b>${fmt(D.ships.length)}</b> benannte Schiffe und <b>${fmt(D.factions.length)}</b> Fraktionen aus frei lizenzierten Quellen, dazu <b>${fmt(imgs)}</b> Bilder von Wikimedia Commons mit Lizenzangabe.`;
  }

  /* ---------- Sternenfeld ---------- */
  function starfield() {
    const cv = $("#starfield");
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars = [], w = 0, h = 0, t = 0;
    const rgb = () => getComputedStyle(document.documentElement).getPropertyValue("--star").trim() || "220,230,255";
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = rng(7);
      stars = Array.from({ length: Math.round((w * h) / 2600) }, () => ({ x: r() * w, y: r() * h, z: r() }));
    }
    function draw() {
      const c = rgb();
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const x = (s.x - t * (0.15 + s.z * 0.6)) % w;
        ctx.fillStyle = `rgba(${c},${0.25 + s.z * 0.6})`;
        ctx.fillRect(x < 0 ? x + w : x, s.y, s.z > 0.85 ? 2 : 1, s.z > 0.85 ? 2 : 1);
      }
    }
    function loop() { t += 0.4; draw(); if (!document.hidden) requestAnimationFrame(loop); }
    size(); draw();
    addEventListener("resize", () => { size(); draw(); });
    if (!reduce) { requestAnimationFrame(loop); document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); }); }
  }

  /* ---------- Ereignisse ---------- */
  function wire() {
    let tmr;
    $("#q").addEventListener("input", (e) => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = e.target.value; render(); }, 160); });
    $("#f-main").addEventListener("change", (e) => { state.main = e.target.checked; render(); });
    $("#f-ships").addEventListener("change", (e) => { state.withShips = e.target.checked; render(); });
    const st = [...new Set(D.ships.map((s) => s.st).filter(Boolean))].sort((a, b) => statusDe(a).localeCompare(statusDe(b)));
    $("#f-status").insertAdjacentHTML("beforeend", st.map((s) => `<option value="${esc(s)}">${esc(statusDe(s))}</option>`).join(""));
    $("#f-status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
    const setArt = (v) => {
      artStyle = v;
      try { localStorage.setItem(ART_KEY, v); } catch (e) { /* nicht schlimm */ }
      document.querySelectorAll(".card[data-class] .card-art svg").forEach((svg) => {
        const c = D.classes[+svg.closest(".card").dataset.class], f = factions.get(c.f);
        svg.outerHTML = shipSVG(c, f ? f.color : "#88aa99");
      });
      const d = $("#drawer-body .d-art svg");
      if (d && drawerArt) d.outerHTML = shipSVG(drawerArt.item, drawerArt.color);
    };
    document.querySelectorAll('input[name="art"]').forEach((el) => {
      el.checked = el.value === artStyle;
      el.addEventListener("change", () => el.checked && setArt(el.value));
    });
    $("#expand-all").addEventListener("click", () => {
      document.querySelectorAll(".quad, .fac").forEach((d) => (d.open = true));
    });
    $("#collapse-all").addEventListener("click", () => {
      document.querySelectorAll(".quad, .fac").forEach((d) => (d.open = false));
      state.open.clear();
    });
    $("#quadrants").addEventListener("toggle", (e) => {
      const d = e.target;
      if (d.classList.contains("quad")) { d.open ? state.open.add(d.dataset.q) : state.open.delete(d.dataset.q); }
      if (d.classList.contains("fac") && d.open) {
        const body = d.querySelector(".fac-body[data-lazy]");
        if (body) { fillFaction(body); wireImages(body); }
      }
    }, true);
    document.addEventListener("click", (e) => {
      const all = e.target.closest("[data-all]");
      if (all) { fillFaction(all.closest(".fac-body"), true); wireImages(all.closest(".fac") || document); return; }
      const c = e.target.closest("[data-class]");
      if (c) { e.preventDefault(); openClass(+c.dataset.class); return; }
      const s = e.target.closest("[data-ship]");
      if (s) { openShip(+s.dataset.ship); return; }
      if (e.target.closest("[data-close]")) closeDrawer();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });

    const tabs = [...document.querySelectorAll(".tabs a")];
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) tabs.forEach((t) => t.classList.toggle("on", t.dataset.view === en.target.id)); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".view").forEach((v) => io.observe(v));
    if (location.hash && /^#[\w-]+$/.test(location.hash)) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }

  renderBasis();
  render();
  wire();
  wireImages(document);
  starfield();
})();
