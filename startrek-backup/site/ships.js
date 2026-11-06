/* Schiffsgrafiken (eigene Zeichnung, CC0). Draufsicht, Bug links.
   Zwei Stile: "bauplan" (feine Linien) und "modell" (schattiert). Bekannte Klassen haben eigene Vorlagen. */
(function (root) {
  "use strict";
  const N = (v) => Math.round(v * 10) / 10;
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
  }
  function mix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }

  const CY = 90;
  // Geschlossene, glatte Kurve durch Punkte (Catmull-Rom).
  function curve(P) {
    const n = P.length, g = (i) => P[(i + n) % n];
    let d = `M${N(P[0][0])} ${N(P[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      d += `C${N(p1[0] + (p2[0] - p0[0]) / 6)} ${N(p1[1] + (p2[1] - p0[1]) / 6)} ${N(p2[0] - (p3[0] - p1[0]) / 6)} ${N(p2[1] - (p3[1] - p1[1]) / 6)} ${N(p2[0])} ${N(p2[1])}`;
    }
    return d + "Z";
  }
  const poly = (P) => "M" + P.map((p) => `${N(p[0])} ${N(p[1])}`).join("L") + "Z";
  // Obere Hälfte (x, Abstand zur Mittellinie) spiegeln. Endpunkte mit Abstand 0 liegen auf der Achse.
  function sym(pts) {
    const up = pts.map(([x, w]) => [x, CY - w]);
    const lo = pts.filter(([, w]) => w > 0).reverse().map(([x, w]) => [x, CY + w]);
    return up.concat(lo);
  }
  const symCurve = (pts) => curve(sym(pts));
  const symPoly = (pts) => poly(sym(pts));
  const both = (fn) => fn(-1) + fn(1);

  const GLOW = {
    federation: ["#ff5a3c", "#6fc8ff"], earth: ["#ff7a4a", "#8fd0ff"], vulcan: ["#ff9a4a", "#ffd27a"],
    klingon: ["#ff4a2a", "#ff9a4a"], romulan: ["#7dff9e", "#4fd27a"], reman: ["#7dff9e", "#4fd27a"],
    cardassian: ["#ffb347", "#ffd27a"], dominion: ["#c79bff", "#8f6bff"], borg: ["#6dff7a", "#3fd25a"],
    ferengi: ["#ff9a3c", "#ffd27a"],
  };

  function styles(c, style, fac) {
    const [warm, cool] = GLOW[fac] || ["#ff7a4a", "#7fd0ff"];
    const k = c.slice(1);
    if (style === "bauplan") {
      // Linienfarbe mischt die Fraktionsfarbe mit der Textfarbe der Seite, damit sie im hellen und dunklen Modus lesbar bleibt.
      const lc = `color-mix(in srgb, ${c} 62%, var(--fg, #e4e8f1))`;
      const st = (o) => `style="stroke:${lc}"${o}`;
      return {
        defs: "",
        hull: `fill="${c}" fill-opacity="0.10" stroke-width="1" stroke-linejoin="round" ${st("")}`,
        hull2: `fill="${c}" fill-opacity="0.22" stroke-width="0.8" stroke-linejoin="round" ${st("")}`,
        hull3: `fill="${c}" fill-opacity="0.34" stroke-width="0.7" stroke-linejoin="round" ${st("")}`,
        strut: (w) => `fill="none" stroke-opacity="0.55" stroke-width="${w}" stroke-linecap="round" ${st("")}`,
        line: `fill="none" stroke-opacity="0.5" stroke-width="0.55" ${st("")}`,
        seam: `fill="none" stroke-opacity="0.32" stroke-width="0.5" stroke-dasharray="2 1.5" ${st("")}`,
        win: `style="fill:${lc}" fill-opacity="0.9"`,
        warm: `style="fill:${lc}"`, cool: `style="fill:${lc}" fill-opacity="0.7"`,
        wrap: (body, glow) => `<path d="M8 ${CY}H312" fill="none" stroke-opacity="0.18" stroke-width="0.5" stroke-dasharray="6 3 1 3" ${st("")}/>${body}${glow}`,
      };
    }
    const hi = mix(c, "#ffffff", 0.55), mid = mix(c, "#6a7480", 0.25), lo = mix(c, "#05070a", 0.6);
    const defs = `<defs>
<radialGradient id="h${k}" cx="0.35" cy="0.25" r="0.95"><stop offset="0" stop-color="${hi}"/><stop offset="0.45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
<radialGradient id="i${k}" cx="0.4" cy="0.3" r="0.9"><stop offset="0" stop-color="${mix(hi, lo, 0.25)}"/><stop offset="1" stop-color="${mix(lo, "#000000", 0.3)}"/></radialGradient>
<filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.55"/></filter>
</defs>`;
    return {
      defs,
      hull: `fill="url(#h${k})" stroke="${mix(c, "#ffffff", 0.35)}" stroke-opacity="0.7" stroke-width="0.7" stroke-linejoin="round"`,
      hull2: `fill="url(#i${k})" stroke="${mix(c, "#ffffff", 0.3)}" stroke-opacity="0.55" stroke-width="0.6" stroke-linejoin="round"`,
      hull3: `fill="${mix(c, "#ffffff", 0.2)}" fill-opacity="0.9" stroke="${lo}" stroke-width="0.5"`,
      strut: (w) => `fill="none" stroke="${mid}" stroke-width="${w}" stroke-linecap="round"`,
      line: `fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="0.55"`,
      seam: `fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="0.6"`,
      win: `fill="#fff3c4" fill-opacity="0.85"`,
      warm: `fill="${warm}" filter="url(#gl)"`, cool: `fill="${cool}" filter="url(#gl)"`,
      wrap: (body, glow) => `<g filter="url(#sh)">${body}</g>${glow}`,
    };
  }

  /* ---------- Zeichner. Jeder gibt {body, glow} zurück; S = Stile, r = Zufall, p = Vorgaben ---------- */
  const el = (tag, attrs, s) => `<${tag} ${attrs} ${s}/>`;
  const P = (d, s) => `<path d="${d}" ${s}/>`;
  function windowsArc(cx, cy, rx, ry, a0, a1, n, S, skip) {
    let o = "";
    for (let i = 0; i < n; i++) {
      if (skip && skip(i)) continue;
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      o += `<circle cx="${N(cx + Math.cos(a) * rx)}" cy="${N(cy + Math.sin(a) * ry)}" r="0.65" ${S.win}/>`;
    }
    return o;
  }
  function nacelle(x0, x1, y, h, S, opt = {}) {
    const r = h / 2;
    let b = P(`M${x0 + r} ${y - r}H${x1 - r * 1.6}Q${x1} ${y - r} ${x1} ${y}Q${x1} ${y + r} ${x1 - r * 1.6} ${y + r}H${x0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y - r}Z`, S.hull);
    b += P(`M${x0 + h} ${y - r * 0.15}H${x1 - h}`, S.line);
    for (let x = x0 + h * 1.4; x < x1 - h; x += (x1 - x0) / 7) b += P(`M${N(x)} ${y - r}V${y + r}`, S.seam);
    let g = `<ellipse cx="${x0 + r * 0.9}" cy="${y}" rx="${r * 0.95}" ry="${r * 0.78}" ${opt.coolBussard ? S.cool : S.warm}/>`;
    const gy = opt.inner > 0 ? y + r * 0.35 : y - r * 0.35 - 1.6;
    g += `<rect x="${x0 + h * 1.6}" y="${N(gy)}" width="${N((x1 - x0) * 0.62)}" height="1.6" rx="0.8" ${S.cool}/>`;
    return { b, g };
  }

  function federation(S, r, p) {
    let b = "", g = "";
    const sx = p.sx, srx = p.srx, sry = p.sry;
    // Maschinenhülle
    if (p.sec) {
      const [a, e, w] = p.sec;
      b += P(symCurve([[a, 0], [a + 8, w * 0.8], [a + (e - a) * 0.4, w], [e - 12, w * 0.7], [e, w * 0.35], [e + 2, 0]]), S.hull);
      b += P(`M${a + 14} ${CY}H${e - 10}`, S.line);
      for (let i = 1; i < 5; i++) { const x = a + ((e - a) * i) / 5; b += P(`M${N(x)} ${N(CY - w * 0.75)}V${N(CY + w * 0.75)}`, S.seam); }
      for (let i = 0; i < 10; i++) { const x = a + 16 + i * ((e - a - 34) / 9); b += `<circle cx="${N(x)}" cy="${N(CY - w * 0.55)}" r="0.6" ${S.win}/><circle cx="${N(x)}" cy="${N(CY + w * 0.55)}" r="0.6" ${S.win}/>`; }
      g += `<rect x="${e - 4}" y="${CY - 2.5}" width="4" height="5" rx="1.5" ${S.warm}/>`;
    }
    // Pylonen und Warpgondeln
    for (const y of p.nac) {
      const s = Math.sign(y) || 1, ny = CY + y;
      const [px0, px1] = p.pyl;
      b += P(poly([[px0, CY + s * p.pylIn], [px0 + 14, CY + s * p.pylIn], [px1 + 14, ny - s * p.nh * 0.3], [px1, ny - s * p.nh * 0.3]]), S.hull2);
      const n = nacelle(p.nx[0], p.nx[1], ny, p.nh, S, { inner: -s });
      b += n.b; g += n.g;
    }
    // Hals: verbindet Untertasse und Maschinenhülle
    if (p.sec) {
      const n0 = sx + srx * 0.55, n1 = Math.max(p.sec[0] + 16, n0 + 20), nw = p.neck || 6;
      b += P(symCurve([[n0, 0], [n0, nw], [n0 + (n1 - n0) * 0.6, nw * 0.8], [n1, nw * 0.65], [n1 + 4, 0]]), S.hull2);
      b += P(`M${N(n0 + 4)} ${CY}H${N(n1)}`, S.line);
    }
    // Untertassensektion
    if (p.arrow) {
      b += P(symCurve([[sx - srx, 0], [sx - srx * 0.7, sry * 0.55], [sx, sry * 0.95], [sx + srx * 0.75, sry], [sx + srx * 1.1, sry * 0.75], [sx + srx * 1.25, 0]]), S.hull);
    } else {
      b += el("ellipse", `cx="${sx}" cy="${CY}" rx="${srx}" ry="${sry}"`, S.hull);
    }
    b += el("ellipse", `cx="${sx}" cy="${CY}" rx="${N(srx * 0.66)}" ry="${N(sry * 0.66)}"`, S.line);
    b += el("ellipse", `cx="${sx}" cy="${CY}" rx="${N(srx * 0.86)}" ry="${N(sry * 0.86)}"`, S.seam);
    const sp = p.spokes || 12;
    for (let i = 0; i < sp; i++) {
      const a = (i / sp) * Math.PI * 2 + Math.PI / sp;
      b += P(`M${N(sx + Math.cos(a) * srx * 0.3)} ${N(CY + Math.sin(a) * sry * 0.3)}L${N(sx + Math.cos(a) * srx * 0.66)} ${N(CY + Math.sin(a) * sry * 0.66)}`, S.seam);
    }
    b += windowsArc(sx, CY, srx * 0.93, sry * 0.93, 0, Math.PI * 2, 64, S, (i) => i % 8 === 0);
    b += windowsArc(sx, CY, srx * 0.76, sry * 0.76, 0, Math.PI * 2, 44, S, (i) => i % 5 === 0);
    b += el("ellipse", `cx="${sx}" cy="${CY}" rx="${N(srx * 0.24)}" ry="${N(sry * 0.24)}"`, S.hull2);
    b += el("ellipse", `cx="${sx}" cy="${CY}" rx="${N(srx * 0.1)}" ry="${N(sry * 0.1)}"`, S.hull3);
    g += `<rect x="${N(sx + srx * 0.9)}" y="${N(CY - sry * 0.32)}" width="3.2" height="${N(sry * 0.64)}" rx="1.4" ${S.warm}/>`;
    if (p.roll) b += P(`M${sx + srx * 0.55} ${CY - p.roll}h10v${p.roll * 2}h-10Z`, S.hull2);
    return { b, g };
  }

  const FED = {
    galaxy: { sx: 100, srx: 52, sry: 62, sec: [128, 240, 17], pyl: [196, 206], pylIn: 10, nac: [-42, 42], nx: [182, 298], nh: 11 },
    constitution: { sx: 92, srx: 46, sry: 46, neck: 5, sec: [150, 238, 11], pyl: [204, 214], pylIn: 6, nac: [-34, 34], nx: [188, 300], nh: 10, spokes: 8 },
    intrepid: { sx: 112, srx: 66, sry: 44, arrow: true, sec: [150, 250, 20], pyl: [208, 216], pylIn: 16, nac: [-32, 32], nx: [196, 282], nh: 8 },
    miranda: { sx: 125, srx: 62, sry: 62, sec: null, pyl: [150, 160], pylIn: 40, nac: [-46, 46], nx: [150, 270], nh: 10, roll: 30 },
    excelsior: { sx: 84, srx: 46, sry: 50, sec: [118, 250, 15], pyl: [210, 220], pylIn: 10, nac: [-34, 34], nx: [176, 302], nh: 10 },
    sovereign: { sx: 98, srx: 60, sry: 48, arrow: true, sec: [140, 262, 16], pyl: [212, 222], pylIn: 10, nac: [-36, 36], nx: [176, 304], nh: 9 },
  };
  function fedParams(item, r) {
    const n = (item.n || "").toLowerCase();
    for (const k of Object.keys(FED)) if (n.startsWith(k)) return FED[k];
    const srx = 42 + r() * 20, sry = srx * (0.85 + r() * 0.35), sx = 80 + r() * 30;
    const nh = 8 + r() * 3, ny = 30 + r() * 14, x0 = 170 + r() * 20;
    const four = r() < 0.1;
    return {
      sx, srx, sry, arrow: r() < 0.3, sec: (r(), [sx + srx * 0.5, 225 + r() * 25, 11 + r() * 8]),
      pyl: [x0 + 14, x0 + 26], pylIn: 8, nac: four ? [-ny, ny, -ny - 16, ny + 16] : [-ny, ny], nx: [x0, x0 + 100 + r() * 20], nh,
    };
  }

  function defiant(S) {
    let b = P(symCurve([[52, 0], [70, 14], [120, 34], [190, 42], [250, 40], [262, 24], [258, 0]]), S.hull);
    b += P(symPoly([[90, 0], [140, 20], [230, 22], [244, 0]]), S.hull2);
    b += both((s) => nacelle(150, 262, CY + s * 46, 16, S, { inner: -s }).b);
    let g = both((s) => nacelle(150, 262, CY + s * 46, 16, S, { inner: -s }).g);
    b += P(`M120 ${CY}H236M150 ${CY - 30}L210 ${CY - 32}M150 ${CY + 30}L210 ${CY + 32}`, S.line);
    b += el("ellipse", `cx="112" cy="${CY}" rx="12" ry="8"`, S.hull3);
    g += both((s) => `<rect x="70" y="${CY + s * 18 - 1}" width="18" height="2" rx="1" transform="rotate(${s * 22} 70 ${CY + s * 18})" ${S.warm}/>`);
    g += `<rect x="252" y="${CY - 10}" width="5" height="20" rx="2" ${S.warm}/>`;
    return { b, g };
  }

  function bird(S, r) {
    const span = 66 + r() * 14, sw = 20 + r() * 14, neck = 70 + r() * 25;
    let b = "", g = "";
    b += both((s) => P(curve([[150, CY + s * 16], [175 - sw * 0.2, CY + s * span * 0.6], [150 + sw * 0.3, CY + s * span], [172 + sw * 0.3, CY + s * (span + 4)], [214, CY + s * 34], [238, CY + s * 20]]), S.hull2));
    b += both((s) => [0.3, 0.55, 0.8].map((t) => P(`M${N(182 - t * 10)} ${N(CY + s * 22)}L${N(158 + sw * 0.3 + t * 10)} ${N(CY + s * (16 + (span - 16) * t))}`, S.seam)).join(""));
    b += both((s) => P(`M${N(140 + sw * 0.3)} ${N(CY + s * (span + 1))}h34v${s * 4}h-34Z`, S.hull3));
    g += both((s) => `<circle cx="${N(140 + sw * 0.3)}" cy="${N(CY + s * (span + 3))}" r="2" ${S.warm}/>`);
    b += P(symCurve([[140, 0], [150, 14], [185, 26], [228, 22], [248, 10], [252, 0]]), S.hull);
    b += P(`M160 ${CY}H240M175 ${CY - 12}C200 ${CY - 18} 225 ${CY - 14} 240 ${CY - 6}M175 ${CY + 12}C200 ${CY + 18} 225 ${CY + 14} 240 ${CY + 6}`, S.line);
    const hx = 150 - neck;
    b += P(symCurve([[hx + 20, 0], [hx + 35, 5], [148, 9], [160, 0]]), S.hull2);
    b += P(symCurve([[hx - 8, 0], [hx - 2, 9], [hx + 14, 15], [hx + 32, 12], [hx + 40, 0]]), S.hull);
    b += P(`M${hx} ${CY}H${hx + 34}`, S.line);
    b += windowsArc(hx + 16, CY, 11, 8, -1.2, 1.2, 6, S);
    g += `<circle cx="${hx - 5}" cy="${CY}" r="2.4" ${S.warm}/>`;
    g += `<rect x="244" y="${CY - 9}" width="5" height="18" rx="2" ${S.warm}/>`;
    return { b, g };
  }

  function warbird(S, r) {
    const span = 70 + r() * 10;
    // Flügelbogen wölbt sich nach vorne: Spitzen zeigen zum Bug, verbunden am Heck.
    const M = (pts) => pts.map(([x, y]) => [406 - x, y]);
    let b = "", g = "";
    b += P(curve(M([[110, CY], [150, CY - span * 0.5], [210, CY - span], [270, CY - span * 0.92], [296, CY - span * 0.55], [262, CY - 30], [250, CY], [262, CY + 30], [296, CY + span * 0.55], [270, CY + span * 0.92], [210, CY + span], [150, CY + span * 0.5]])), S.hull);
    b += P(curve(M([[150, CY], [180, CY - span * 0.4], [235, CY - span * 0.62], [266, CY - span * 0.52], [240, CY - 22], [225, CY], [240, CY + 22], [266, CY + span * 0.52], [235, CY + span * 0.62], [180, CY + span * 0.4]])), S.hull2);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      b += both((s) => P(`M${N(406 - 160 - t * 70)} ${N(CY + s * (12 + t * 6))}Q${N(406 - 200 - t * 60)} ${N(CY + s * span * (0.55 + t * 0.3))} ${N(406 - 230 - t * 50)} ${N(CY + s * span * (0.75 + t * 0.12))}`, S.seam));
    }
    b += P(symCurve([[60, 0], [80, 6], [140, 9], [176, 0]]), S.hull2);
    b += P(symCurve([[28, 0], [34, 10], [54, 14], [70, 8], [76, 0]]), S.hull);
    b += P(`M34 ${CY}H72`, S.line);
    b += windowsArc(52, CY, 12, 8, -1.3, 1.3, 7, S);
    g += `<circle cx="214" cy="${CY}" r="6" ${S.warm}/>`;
    g += both((s) => `<rect x="116" y="${N(CY + s * span * 0.7 - 1)}" width="22" height="2" rx="1" transform="rotate(${-s * 32} 138 ${N(CY + s * span * 0.7)})" ${S.cool}/>`);
    g += `<rect x="290" y="${CY - 7}" width="5" height="14" rx="2" ${S.warm}/>`;
    g += `<circle cx="26" cy="${CY}" r="2" ${S.warm}/>`;
    return { b, g };
  }

  function galor(S, r) {
    const ww = 54 + r() * 12;
    let b = "", g = "";
    b += both((s) => P(curve([[178, CY + s * 16], [240, CY + s * ww], [268, CY + s * (ww + 2)], [286, CY + s * (ww - 8)], [262, CY + s * 22]]), S.hull2));
    b += both((s) => P(`M200 ${CY + s * 22}L262 ${N(CY + s * (ww - 4))}`, S.seam));
    b += P(symCurve([[46, 0], [64, 6], [130, 12], [210, 22], [270, 24], [292, 14], [296, 0]]), S.hull);
    for (let i = 0; i < 9; i++) { const x = 100 + i * 20, w = 8 + i * 1.8; b += P(`M${x} ${N(CY - w)}Q${x + 6} ${CY} ${x} ${N(CY + w)}`, S.seam); }
    b += P(`M70 ${CY}H290`, S.line);
    b += P(symCurve([[44, 0], [50, 18], [72, 26], [96, 20], [104, 0]]), S.hull);
    b += el("ellipse", `cx="76" cy="${CY}" rx="18" ry="14"`, S.hull2);
    g += `<ellipse cx="62" cy="${CY}" rx="6" ry="9" ${S.warm}/>`;
    g += both((s) => `<rect x="236" y="${N(CY + s * 30 - 1)}" width="40" height="2" rx="1" ${S.cool}/>`);
    for (let i = 0; i < 14; i++) b += `<circle cx="${130 + i * 10}" cy="${CY - 9 - i * 0.6}" r="0.6" ${S.win}/><circle cx="${130 + i * 10}" cy="${CY + 9 + i * 0.6}" r="0.6" ${S.win}/>`;
    return { b, g };
  }

  function jemhadar(S, r) {
    let b = "", g = "";
    b += both((s) => P(curve([[150, CY + s * 18], [210, CY + s * 58], [250, CY + s * 62], [272, CY + s * 48], [246, CY + s * 26]]), S.hull2));
    b += P(symCurve([[40, 0], [54, 12], [100, 24], [170, 30], [250, 26], [282, 14], [288, 0]]), S.hull);
    b += P(symPoly([[30, 6], [62, 9], [62, 2], [44, 2]]).replace(/Z$/, "Z"), S.hull3);
    for (let i = 0; i < 8; i++) { const x = 90 + i * 22; b += P(`M${x} ${CY - 22}Q${x - 8} ${CY} ${x} ${CY + 22}`, S.seam); }
    b += P(`M60 ${CY}H280`, S.line);
    g += both((s) => `<rect x="110" y="${N(CY + s * 16 - 1.5)}" width="120" height="3" rx="1.5" ${S.cool}/>`);
    g += both((s) => `<rect x="200" y="${N(CY + s * 46 - 1)}" width="50" height="2" rx="1" transform="rotate(${s * 8} 200 ${CY + s * 46})" ${S.cool}/>`);
    g += `<rect x="280" y="${CY - 8}" width="5" height="16" rx="2" ${S.warm}/>`;
    return { b, g };
  }

  function dkora(S) {
    let b = "", g = "";
    b += P(curve([[44, CY - 44], [110, CY - 70], [210, CY - 66], [280, CY - 36], [296, CY], [280, CY + 36], [210, CY + 66], [110, CY + 70], [44, CY + 44], [70, CY + 24], [118, CY + 12], [132, CY], [118, CY - 12], [70, CY - 24]]), S.hull);
    b += P(curve([[150, CY - 40], [220, CY - 44], [268, CY - 22], [276, CY], [268, CY + 22], [220, CY + 44], [150, CY + 40], [140, CY]]), S.hull2);
    for (let i = 0; i < 6; i++) { const t = i / 5; b += both((s) => P(`M${N(70 + t * 160)} ${N(CY + s * (30 - t * 4))}Q${N(110 + t * 140)} ${N(CY + s * 62)} ${N(110 + t * 150)} ${N(CY + s * (68 - t * 16))}`, S.seam)); }
    b += P(`M140 ${CY}H276`, S.line);
    b += el("ellipse", `cx="196" cy="${CY}" rx="22" ry="14"`, S.hull3);
    b += windowsArc(196, CY, 50, 60, -2.2, -0.7, 14, S) + windowsArc(196, CY, 50, 60, 0.7, 2.2, 14, S);
    g += `<rect x="286" y="${CY - 16}" width="6" height="32" rx="3" ${S.warm}/>`;
    g += both((s) => `<circle cx="50" cy="${CY + s * 42}" r="2.4" ${S.cool}/>`);
    return { b, g };
  }

  function cube(S, r) {
    const s = 56, cx = 160;
    const T = CY - 38, a = [cx - s, T + 20], bT = [cx, T], c = [cx + s, T + 20], d = [cx, T + 40], h = 2 * s * 0.85;
    let b = P(poly([a, bT, c, d]), S.hull) + P(poly([a, d, [d[0], d[1] + h * 0.6], [a[0], a[1] + h * 0.6]]), S.hull2) + P(poly([d, c, [c[0], c[1] + h * 0.6], [d[0], d[1] + h * 0.6]]), S.hull2);
    b += P(poly([d, c, [c[0], c[1] + h * 0.6], [d[0], d[1] + h * 0.6]]), `fill="#000" fill-opacity="0.25"`);
    let g = "";
    const face = (o, u, v, glowFace) => {
      let out = "";
      const pt = (i, j) => [o[0] + u[0] * i + v[0] * j, o[1] + u[1] * i + v[1] * j];
      for (let k = 1; k < 8; k++) { const p1 = pt(k / 8, 0), p2 = pt(k / 8, 1), q1 = pt(0, k / 8), q2 = pt(1, k / 8); out += P(`M${N(p1[0])} ${N(p1[1])}L${N(p2[0])} ${N(p2[1])}M${N(q1[0])} ${N(q1[1])}L${N(q2[0])} ${N(q2[1])}`, S.seam); }
      for (let k = 0; k < 34; k++) {
        const i = r(), j = r(), L = 0.05 + r() * 0.18, hor = r() < 0.5;
        const p1 = pt(i, j), p2 = hor ? pt(Math.min(1, i + L), j) : pt(i, Math.min(1, j + L));
        out += P(`M${N(p1[0])} ${N(p1[1])}L${N(p2[0])} ${N(p2[1])}`, S.line);
      }
      if (glowFace) for (let k = 0; k < 10; k++) { const p1 = pt(r(), r()); g += `<circle cx="${N(p1[0])}" cy="${N(p1[1])}" r="${N(0.8 + r())}" ${S.warm}/>`; }
      return out;
    };
    b += face(a, [bT[0] - a[0], bT[1] - a[1]], [d[0] - a[0], d[1] - a[1]], false);
    b += face(a, [d[0] - a[0], d[1] - a[1]], [0, h * 0.6], true);
    b += face(d, [c[0] - d[0], c[1] - d[1]], [0, h * 0.6], true);
    return { b, g };
  }

  function station(S, r) {
    const cx = 160, R = 74;
    let b = "", g = "";
    const pyl = 3;
    for (let i = 0; i < pyl * 2; i++) {
      const an = (i / (pyl * 2)) * Math.PI * 2 + 0.35;
      const x1 = cx + Math.cos(an) * (R - 4), y1 = CY + Math.sin(an) * (R - 4) * 0.98, x2 = cx + Math.cos(an + 0.08) * (R + 14), y2 = CY + Math.sin(an + 0.08) * (R + 14) * 0.98;
      b += P(`M${N(x1)} ${N(y1)}Q${N(cx + Math.cos(an + 0.2) * (R + 10))} ${N(CY + Math.sin(an + 0.2) * (R + 10))} ${N(x2)} ${N(y2)}`, S.strut(3));
      g += `<circle cx="${N(x2)}" cy="${N(y2)}" r="1.6" ${S.warm}/>`;
    }
    b += `<circle cx="${cx}" cy="${CY}" r="${R}" ${S.hull}/><circle cx="${cx}" cy="${CY}" r="${R - 9}" fill="var(--surface-2, #10151c)" ${S.line}/>`;
    b += windowsArc(cx, CY, R - 4.5, R - 4.5, 0, Math.PI * 2, 90, S, (i) => i % 6 === 0);
    for (let i = 0; i < 3; i++) { const an = (i / 3) * Math.PI * 2 + Math.PI / 6; b += P(`M${N(cx + Math.cos(an) * 26)} ${N(CY + Math.sin(an) * 26)}L${N(cx + Math.cos(an) * (R - 8))} ${N(CY + Math.sin(an) * (R - 8))}`, S.strut(5)); }
    b += `<circle cx="${cx}" cy="${CY}" r="42" ${S.hull}/><circle cx="${cx}" cy="${CY}" r="30" ${S.hull2}/>`;
    b += windowsArc(cx, CY, 37, 37, 0, Math.PI * 2, 48, S, (i) => i % 4 === 0);
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; b += P(`M${N(cx + Math.cos(an) * 30)} ${N(CY + Math.sin(an) * 30)}L${N(cx + Math.cos(an) * 42)} ${N(CY + Math.sin(an) * 42)}`, S.seam); }
    b += `<circle cx="${cx}" cy="${CY}" r="13" ${S.hull3}/>`;
    g += `<circle cx="${cx}" cy="${CY}" r="4" ${S.cool}/>`;
    return { b, g };
  }

  function shuttle(S, r) {
    let b = "", g = "";
    b += both((s) => nacelle(150, 232, CY + s * 30, 9, S, { inner: -s, coolBussard: true }).b);
    g += both((s) => nacelle(150, 232, CY + s * 30, 9, S, { inner: -s, coolBussard: true }).g);
    b += P(symCurve([[88, 0], [92, 14], [110, 24], [210, 26], [236, 22], [240, 0]]), S.hull);
    b += P(symPoly([[120, 0], [126, 18], [200, 18], [204, 0]]), S.hull2);
    b += P(`M126 ${CY}H200M160 ${CY - 18}V${CY + 18}`, S.line);
    g += P(symCurve([[94, 0], [98, 10], [106, 16], [112, 8], [112, 0]]), S.cool);
    g += `<rect x="234" y="${CY - 14}" width="4" height="28" rx="2" ${S.warm}/>`;
    return { b, g };
  }

  function sphere(S, r) {
    const cx = 160, R = 68;
    let b = `<circle cx="${cx}" cy="${CY}" r="${R}" ${S.hull}/>`, g = "";
    for (let i = 1; i < 6; i++) { const y = CY - R + (2 * R * i) / 6, w = Math.sqrt(R * R - (y - CY) ** 2); b += `<ellipse cx="${cx}" cy="${N(y)}" rx="${N(w)}" ry="${N(w * 0.12)}" ${S.seam}/>`; }
    for (let i = 1; i < 3; i++) b += `<ellipse cx="${cx}" cy="${CY}" rx="${N(R * Math.cos((i * Math.PI) / 6))}" ry="${R}" ${S.line}/>`;
    b += P(`M${cx} ${CY - R}V${CY + R}`, S.line);
    for (let k = 0; k < 40; k++) {
      const an = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 6), x = cx + Math.cos(an) * d, y = CY + Math.sin(an) * d, L = 3 + r() * 9;
      b += P(r() < 0.5 ? `M${N(x)} ${N(y)}h${N(L)}` : `M${N(x)} ${N(y)}v${N(L * 0.6)}`, S.line);
    }
    for (let k = 0; k < 12; k++) { const an = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 10); g += `<circle cx="${N(cx + Math.cos(an) * d)}" cy="${N(CY + Math.sin(an) * d)}" r="${N(0.8 + r())}" ${S.warm}/>`; }
    return { b, g };
  }

  // Völker ohne eigene Vorlage: eine aus dem Namen abgeleitete, aber feste Grundform.
  function alien(S, r) {
    let b = "", g = "";
    const L0 = 40 + r() * 30, L1 = 270 + r() * 25, w = 20 + r() * 22, k = r();
    const hull = [[L0, 0], [L0 + 10 + r() * 20, w * (0.3 + r() * 0.3)], [L0 + (L1 - L0) * (0.3 + r() * 0.15), w * (0.7 + r() * 0.3)], [L0 + (L1 - L0) * 0.7, w], [L1 - 8, w * (0.5 + r() * 0.4)], [L1, 0]];
    if (r() < 0.65) {
      const x0 = L0 + (L1 - L0) * (0.35 + r() * 0.25), span = Math.min(w + 22 + r() * 36, 78), sweep = (r() - 0.35) * 60;
      b += both((s) => P(curve([[x0, CY + s * w * 0.6], [x0 + sweep + 10, CY + s * span], [x0 + sweep + 34, CY + s * (span + 2)], [x0 + 60, CY + s * w * 0.8]]), S.hull2));
      b += both((s) => P(`M${N(x0 + 14)} ${N(CY + s * w * 0.75)}L${N(x0 + sweep + 22)} ${N(CY + s * (span - 4))}`, S.seam));
      if (r() < 0.6) g += both((s) => `<circle cx="${N(x0 + sweep + 20)}" cy="${N(CY + s * span)}" r="1.8" ${S.warm}/>`);
    } else if (r() < 0.6) {
      const ny = w + 8 + r() * 10, x0 = L0 + (L1 - L0) * 0.45;
      for (const s of [-1, 1]) { b += P(poly([[x0 + 20, CY + s * w * 0.6], [x0 + 34, CY + s * w * 0.6], [x0 + 44, CY + s * ny], [x0 + 30, CY + s * ny]]), S.hull2); const n = nacelle(x0 + 10, L1 + 2, CY + s * ny, 9, S, { inner: -s }); b += n.b; g += n.g; }
    }
    b += P(k < 0.5 ? symCurve(hull) : symPoly(hull), S.hull);
    b += P(symCurve([[L0 + 20, 0], [L0 + 30, w * 0.35], [L1 - 60, w * 0.45], [L1 - 30, 0]]), S.hull2);
    b += P(`M${N(L0 + 8)} ${CY}H${N(L1 - 6)}`, S.line);
    const ribs = 4 + Math.floor(r() * 5);
    for (let i = 1; i <= ribs; i++) { const x = L0 + ((L1 - L0) * i) / (ribs + 1); b += P(`M${N(x)} ${N(CY - w * 0.8)}Q${N(x + 5)} ${CY} ${N(x)} ${N(CY + w * 0.8)}`, S.seam); }
    for (let i = 0; i < 10; i++) { const x = L0 + 30 + i * ((L1 - L0 - 70) / 9); b += `<circle cx="${N(x)}" cy="${N(CY - w * 0.55)}" r="0.6" ${S.win}/><circle cx="${N(x)}" cy="${N(CY + w * 0.55)}" r="0.6" ${S.win}/>`; }
    g += `<circle cx="${N(L0 + 8)}" cy="${CY}" r="2.4" ${S.cool}/>`;
    g += `<rect x="${N(L1 - 6)}" y="${N(CY - w * 0.35)}" width="4.5" height="${N(w * 0.7)}" rx="2" ${S.warm}/>`;
    return { b, g };
  }

  function arch(item) {
    const n = (item.n || "").toLowerCase(), t = (item.ty || []).join(" ").toLowerCase(), f = item.f || "";
    if (/station|starbase|outpost|space dock|spacedock|drydock|depot|array|platform|colony/.test(n + " " + t)) return "station";
    if (/shuttle|pod|runabout|craft|capsule|bee|skimmer/.test(n + " " + t) && !/cruiser/.test(n)) return "shuttle";
    if (/sphere/.test(n)) return "sphere";
    if (/cube/.test(n) || f === "borg") return "cube";
    if (/^defiant/.test(n)) return "defiant";
    if (f === "klingon") return "bird";
    if (f === "romulan" || f === "reman") return "warbird";
    if (f === "cardassian") return "galor";
    if (f === "dominion") return "jemhadar";
    if (f === "ferengi") return "dkora";
    if (["federation", "earth", "terran"].includes(f)) return "federation";
    return "alien";
  }

  function shipArt(item, color, style) {
    const c = color || "#88aaaa";
    const S = styles(c, style, item.f);
    const r = rng(hash(item.n + (item.id || "")));
    const a = arch(item);
    const fn = { station, shuttle, cube, sphere, defiant, bird, warbird, galor, jemhadar, dkora, alien };
    const out = a === "federation" ? federation(S, r, fedParams(item, r)) : fn[a](S, r);
    return `<svg viewBox="0 0 320 180" role="img" aria-label="Schematische Silhouette">${S.defs}${S.wrap(out.b, `<g>${out.g}</g>`)}</svg>`;
  }
  root.shipArt = shipArt;
})(typeof window !== "undefined" ? window : globalThis);
