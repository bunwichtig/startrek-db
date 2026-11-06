/* Funkenfeld – Bomben-Arena für 2 bis 4 Spieler im Browser.
 *
 * Netzwerk: Peer-to-Peer über WebRTC (PeerJS). Der Browser, der den Raum erstellt,
 * ist der Gastgeber: Er prüft das Passwort, berechnet das Spiel und schickt den
 * Spielstand an alle. Die anderen schicken nur ihre Eingaben.
 * Zum Testen ohne Internet: ?local an die Adresse hängen, dann laufen die Tabs
 * desselben Browsers über einen BroadcastChannel.
 */
(() => {
'use strict';

// ---------- Konstanten ----------
const W = 15, H = 13, T = 48;
const EMPTY = 0, WALL = 1, CRATE = 2;
const MAX_PLAYERS = 4;
const FUSE = 2.5;            // Sekunden bis zur Explosion
const FLAME_TIME = 0.55;     // Sekunden, die das Feuer brennt
const ROUND_TIME = 180;      // Sekunden pro Runde
const WIN_ROUNDS = 3;        // Runden bis zum Gesamtsieg
const KICK_SPEED = 10;       // Felder pro Sekunde für gekickte Bomben
const BASE_SPEED = 3.6, SPEED_STEP = 0.6, MAX_SPEED = 6;
const ITEM_CHANCE = 0.32;
const ITEMS = ['bomb', 'fire', 'speed', 'kick'];
const ITEM_WEIGHTS = [4, 4, 3, 1.5];
const ITEM_ICON = { bomb: '💣', fire: '🔥', speed: '👟', kick: '🦶' };
const COLORS = ['#ff8a3d', '#3dc6ff', '#7ee06a', '#e56bff'];
const SPAWNS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2]];
const TICK = 1 / 60, SEND_EVERY = 3; // Simulation 60 Hz, Senden 20 Hz
const PEER_PREFIX = 'funkenfeld-v1-';

const $ = (id) => document.getElementById(id);
const LOCAL = new URLSearchParams(location.search).has('local');

// ---------- Hilfen ----------
function slug(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}
async function hashPw(room, pw) {
  const text = 'funkenfeld|' + room + '|' + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; // Notlösung ohne sichere Umgebung
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 'f' + (h >>> 0).toString(16);
}
function pickItem() {
  let r = Math.random() * ITEM_WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ITEMS.length; i++) { r -= ITEM_WEIGHTS[i]; if (r <= 0) return ITEMS[i]; }
  return ITEMS[0];
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Transport ----------
// Beide Varianten liefern Verbindungen mit send(obj), onData, onClose, close().
function wrapPeerConn(c) {
  const conn = { send: (o) => { if (c.open) c.send(o); }, close: () => c.close(), onData: null, onClose: null };
  c.on('data', (d) => conn.onData && conn.onData(d));
  c.on('close', () => conn.onClose && conn.onClose());
  c.on('error', () => conn.onClose && conn.onClose());
  return conn;
}
const Net = {
  host(room, onConn) {
    return new Promise((resolve, reject) => {
      if (LOCAL) return resolve(localHost(room, onConn));
      if (!window.Peer) return reject(new Error('Netzwerk-Bibliothek konnte nicht geladen werden.'));
      const peer = new Peer(PEER_PREFIX + room);
      peer.on('open', () => resolve({ close: () => peer.destroy() }));
      peer.on('connection', (c) => c.on('open', () => onConn(wrapPeerConn(c))));
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') reject(new Error('Diesen Raum gibt es schon. Wähle einen anderen Namen oder tritt bei.'));
        else reject(new Error('Verbindungsfehler: ' + e.type));
      });
    });
  },
  join(room) {
    return new Promise((resolve, reject) => {
      if (LOCAL) return resolve(localJoin(room));
      if (!window.Peer) return reject(new Error('Netzwerk-Bibliothek konnte nicht geladen werden.'));
      const peer = new Peer();
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; peer.destroy(); reject(new Error('Keine Antwort vom Gastgeber.')); } }, 15000);
      peer.on('open', () => {
        const c = peer.connect(PEER_PREFIX + room, { reliable: true });
        c.on('open', () => {
          if (done) return; done = true; clearTimeout(timer);
          const conn = wrapPeerConn(c);
          const close = conn.close; conn.close = () => { close(); peer.destroy(); };
          resolve(conn);
        });
      });
      peer.on('error', (e) => {
        if (done) return; done = true; clearTimeout(timer); peer.destroy();
        reject(new Error(e.type === 'peer-unavailable' ? 'Diesen Raum gibt es nicht. Prüfe den Raumnamen.' : 'Verbindungsfehler: ' + e.type));
      });
    });
  },
};
function localHost(room, onConn) {
  const bc = new BroadcastChannel('ff-' + room);
  const conns = new Map();
  bc.onmessage = ({ data: m }) => {
    if (m.to !== 'host') return;
    if (m.hello) {
      const conn = { send: (o) => bc.postMessage({ to: m.from, d: o }), close: () => { bc.postMessage({ to: m.from, bye: 1 }); conns.delete(m.from); }, onData: null, onClose: null };
      conns.set(m.from, conn); onConn(conn);
      bc.postMessage({ to: m.from, ok: 1 });
    } else if (m.bye) { const c = conns.get(m.from); conns.delete(m.from); c && c.onClose && c.onClose(); }
    else { const c = conns.get(m.from); c && c.onData && c.onData(m.d); }
  };
  return { close: () => { for (const [id] of conns) bc.postMessage({ to: id, bye: 1 }); bc.close(); } };
}
function localJoin(room) {
  return new Promise((resolve, reject) => {
    const bc = new BroadcastChannel('ff-' + room);
    const me = Math.random().toString(36).slice(2);
    const conn = { send: (o) => bc.postMessage({ to: 'host', from: me, d: o }), close: () => { bc.postMessage({ to: 'host', from: me, bye: 1 }); bc.close(); }, onData: null, onClose: null };
    const timer = setTimeout(() => { bc.close(); reject(new Error('Diesen Raum gibt es nicht. Prüfe den Raumnamen.')); }, 1500);
    bc.onmessage = ({ data: m }) => {
      if (m.to !== me) return;
      if (m.ok) { clearTimeout(timer); resolve(conn); }
      else if (m.bye) { conn.onClose && conn.onClose(); }
      else conn.onData && conn.onData(m.d);
    };
    bc.postMessage({ to: 'host', from: me, hello: 1 });
  });
}

// ---------- Spiellogik (läuft nur beim Gastgeber) ----------
class Game {
  constructor() {
    this.players = [];     // {id, name, color, slot, score, ...}
    this.phase = 'lobby';  // lobby | play | roundEnd | matchEnd
    this.round = 0;
    this.msg = '';
    this.time = 0;
    this.clock = 0;
    this.phaseTimer = 0;
    this.grid = new Array(W * H).fill(EMPTY);
    this.bombs = []; this.flames = []; this.items = [];
  }
  addPlayer(id, name) {
    const used = new Set(this.players.map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const p = { id, name, slot, color: COLORS[slot], score: 0, alive: false, x: 0, y: 0, dir: 'down', moving: false,
      maxBombs: 1, range: 2, speed: BASE_SPEED, kick: false, input: { dx: 0, dy: 0, bomb: 0 }, lastBomb: 0 };
    this.players.push(p);
    return p;
  }
  removePlayer(id) {
    const p = this.players.find((q) => q.id === id);
    if (!p) return;
    this.players = this.players.filter((q) => q !== p);
    this.bombs = this.bombs.filter((b) => b.owner !== id);
    if (this.phase !== 'lobby' && this.players.length < 2) { this.phase = 'lobby'; this.msg = ''; }
  }
  tile(x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? WALL : this.grid[y * W + x]; }
  setTile(x, y, v) { this.grid[y * W + x] = v; }
  bombAt(x, y) { return this.bombs.find((b) => b.x === x && b.y === y); }

  buildMap() {
    const g = this.grid;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = EMPTY;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) v = WALL;
      else if (Math.random() < 0.72) v = CRATE;
      g[y * W + x] = v;
    }
    // Startecken freiräumen
    for (const [sx, sy] of SPAWNS) {
      const dx = sx === 1 ? 1 : -1, dy = sy === 1 ? 1 : -1;
      for (const [x, y] of [[sx, sy], [sx + dx, sy], [sx, sy + dy]]) if (g[y * W + x] === CRATE) g[y * W + x] = EMPTY;
    }
  }
  startMatch() {
    for (const p of this.players) p.score = 0;
    this.round = 0;
    this.startRound();
  }
  startRound() {
    this.round++;
    this.buildMap();
    this.bombs = []; this.flames = []; this.items = [];
    this.players.forEach((p) => {
      const [x, y] = SPAWNS[p.slot];
      Object.assign(p, { x, y, alive: true, dir: 'down', moving: false, maxBombs: 1, range: 2, speed: BASE_SPEED, kick: false });
      p.lastBomb = p.input.bomb;
    });
    this.clock = ROUND_TIME;
    this.phase = 'play';
    this.phaseTimer = 1.2;
    this.msg = 'Runde ' + this.round;
  }

  blocked(x, y) { return this.tile(x, y) !== EMPTY || !!this.bombAt(x, y); }

  movePlayer(p, dt) {
    const { dx, dy } = p.input;
    p.moving = false;
    if (!dx && !dy) return;
    // Nur eine Richtung gleichzeitig; die zuletzt gedrückte gewinnt (Client sendet nur eine)
    p.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    let dist = p.speed * dt;
    const horiz = dx !== 0;
    const d = horiz ? dx : dy;
    let along = horiz ? p.x : p.y;      // Achse der Bewegung
    let cross = horiz ? p.y : p.x;      // Querachse
    const cc = Math.round(cross);
    const off = cross - cc;
    const ca = Math.round(along);
    const tileAhead = (a) => horiz ? [a + d, cc] : [cc, a + d];

    // Kick: Bombe direkt vor uns anstoßen
    const [ax, ay] = tileAhead(ca);
    const b = this.bombAt(ax, ay);
    if (b && p.kick && !b.vx && !b.vy && Math.abs(off) < 0.3 && (along - ca) * d >= -0.05) {
      if (!this.blocked(ax + (horiz ? d : 0), ay + (horiz ? 0 : d))) { b.vx = horiz ? d : 0; b.vy = horiz ? 0 : d; b.slide = 0; }
    }

    // Erst auf die Mitte der Querachse rutschen (Ecken-Hilfe)
    if (Math.abs(off) > 0.001) {
      const [tx, ty] = tileAhead(ca);
      if (this.blocked(tx, ty) && (along - ca) * d >= 0) return;
      const step = Math.min(dist, Math.abs(off));
      cross -= Math.sign(off) * step;
      dist -= step;
    }
    // Dann entlang der Bewegungsachse
    let na = along + d * dist;
    const [tx, ty] = tileAhead(ca);
    if (this.blocked(tx, ty)) {
      if (d > 0) na = Math.min(na, ca); else na = Math.max(na, ca);
      if ((along - ca) * d > 0) na = along; // schon über die Mitte hinaus (z. B. auf eigener Bombe)
    }
    p.moving = Math.abs(na - along) > 1e-4 || Math.abs(cross - (horiz ? p.y : p.x)) > 1e-4;
    if (horiz) { p.x = na; p.y = cross; } else { p.y = na; p.x = cross; }
  }

  placeBomb(p) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (this.tile(x, y) !== EMPTY || this.bombAt(x, y)) return;
    if (this.bombs.filter((b) => b.owner === p.id).length >= p.maxBombs) return;
    this.bombs.push({ x, y, owner: p.id, range: p.range, fuse: FUSE, vx: 0, vy: 0, slide: 0 });
  }

  explode(first) {
    const queue = [first];
    const born = this.time;
    while (queue.length) {
      const b = queue.shift();
      if (!this.bombs.includes(b)) continue;
      this.bombs = this.bombs.filter((q) => q !== b);
      this.addFlame(b.x, b.y, born);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let i = 1; i <= b.range; i++) {
          const x = b.x + dx * i, y = b.y + dy * i;
          const t = this.tile(x, y);
          if (t === WALL) break;
          if (t === CRATE) {
            this.setTile(x, y, EMPTY);
            this.addFlame(x, y, born);
            if (Math.random() < ITEM_CHANCE) this.items.push({ x, y, type: pickItem(), born: born + 1e-6 });
            break;
          }
          this.addFlame(x, y, born);
          const other = this.bombAt(x, y);
          if (other) { queue.push(other); break; }
          const item = this.items.findIndex((it) => it.x === x && it.y === y && it.born < born);
          if (item >= 0) { this.items.splice(item, 1); break; }
        }
      }
    }
  }
  addFlame(x, y, born) {
    const f = this.flames.find((q) => q.x === x && q.y === y);
    if (f) f.t = FLAME_TIME; else this.flames.push({ x, y, t: FLAME_TIME, born });
  }

  step(dt) {
    this.time += dt;
    if (this.phase === 'lobby' || this.phase === 'matchEnd') return;
    if (this.phase === 'roundEnd') {
      this.phaseTimer -= dt;
      this.flames.forEach((f) => (f.t -= dt)); this.flames = this.flames.filter((f) => f.t > 0);
      if (this.phaseTimer <= 0) this.startRound();
      return;
    }
    // play
    if (this.phaseTimer > 0) { this.phaseTimer -= dt; if (this.phaseTimer <= 0) this.msg = ''; }
    this.clock -= dt;

    for (const p of this.players) {
      if (!p.alive) { p.lastBomb = p.input.bomb; continue; }
      this.movePlayer(p, dt);
      if (p.input.bomb !== p.lastBomb) { p.lastBomb = p.input.bomb; this.placeBomb(p); }
      // Power-ups einsammeln
      const px = Math.round(p.x), py = Math.round(p.y);
      const i = this.items.findIndex((it) => it.x === px && it.y === py);
      if (i >= 0) {
        const it = this.items.splice(i, 1)[0];
        if (it.type === 'bomb') p.maxBombs = Math.min(8, p.maxBombs + 1);
        if (it.type === 'fire') p.range = Math.min(10, p.range + 1);
        if (it.type === 'speed') p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP);
        if (it.type === 'kick') p.kick = true;
      }
    }

    // Gekickte Bomben rollen
    for (const b of this.bombs) {
      if (!b.vx && !b.vy) continue;
      b.slide += dt * KICK_SPEED;
      while (b.slide >= 1 && (b.vx || b.vy)) {
        b.slide -= 1;
        const nx = b.x + b.vx, ny = b.y + b.vy;
        const hitPlayer = this.players.some((p) => p.alive && Math.round(p.x) === nx && Math.round(p.y) === ny);
        const hitItem = this.items.some((it) => it.x === nx && it.y === ny);
        if (this.blocked(nx, ny) || hitPlayer || hitItem) { b.vx = b.vy = 0; b.slide = 0; }
        else { b.x = nx; b.y = ny; }
      }
    }

    // Zünder
    for (const b of [...this.bombs]) {
      b.fuse -= dt;
      if (b.fuse <= 0) this.explode(b);
    }
    // Bomben, die ins Feuer rollen
    for (const b of [...this.bombs]) if (this.flames.some((f) => f.x === b.x && f.y === b.y)) this.explode(b);

    // Feuer
    for (const f of this.flames) {
      f.t -= dt;
      const i = this.items.findIndex((it) => it.x === f.x && it.y === f.y && it.born < f.born);
      if (i >= 0) this.items.splice(i, 1);
    }
    this.flames = this.flames.filter((f) => f.t > 0);
    for (const p of this.players) {
      if (!p.alive) continue;
      const px = Math.round(p.x), py = Math.round(p.y);
      if (this.flames.some((f) => f.x === px && f.y === py)) p.alive = false;
    }
    this.checkRoundEnd(false);
  }

  checkRoundEnd(force) {
    if (this.phase !== 'play') return;
    const alive = this.players.filter((p) => p.alive);
    const solo = this.players.length === 1;
    const over = force || this.clock <= 0 || (solo ? alive.length === 0 : alive.length <= 1);
    if (!over) return;
    if (this.clock <= 0 && alive.length > 1) { this.msg = 'Zeit abgelaufen – unentschieden'; }
    else if (alive.length === 1 && !solo) {
      const w = alive[0]; w.score++;
      if (w.score >= WIN_ROUNDS) { this.phase = 'matchEnd'; this.msg = w.name + ' gewinnt das Spiel! 🏆'; return; }
      this.msg = w.name + ' gewinnt die Runde';
    } else this.msg = solo ? 'Erwischt!' : 'Unentschieden';
    this.phase = 'roundEnd';
    this.phaseTimer = 3;
  }

  snapshot() {
    return {
      t: 'state', phase: this.phase, round: this.round, msg: this.msg, clock: Math.max(0, Math.ceil(this.clock)),
      grid: this.grid.join(''),
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score, alive: p.alive,
        x: +p.x.toFixed(3), y: +p.y.toFixed(3), dir: p.dir, moving: p.moving, bombs: p.maxBombs, range: p.range,
        speed: Math.round((p.speed - BASE_SPEED) / SPEED_STEP), kick: p.kick })),
      bombs: this.bombs.map((b) => [b.x, b.y, +b.fuse.toFixed(2)]),
      flames: this.flames.map((f) => [f.x, f.y]),
      items: this.items.map((i) => [i.x, i.y, i.type]),
    };
  }
}

// ---------- App-Zustand ----------
const S = {
  role: null,        // 'host' | 'client'
  room: '', myId: null,
  game: null, hostNet: null, conns: new Map(), pwHash: '',
  conn: null,        // Verbindung des Clients zum Gastgeber
  view: null,        // zuletzt empfangener / berechneter Spielstand
  disp: new Map(),   // geglättete Positionen für die Anzeige
  input: { dx: 0, dy: 0, bomb: 0 },
  lastSent: '',
};

// ---------- Oberfläche ----------
function show(screen) {
  for (const s of ['start', 'lobby', 'game']) $('screen-' + s).classList.toggle('hidden', s !== screen);
}
function startMsg(text, err) { const m = $('start-msg'); m.textContent = text; m.classList.toggle('err', !!err); }

function readForm() {
  const name = $('in-name').value.trim() || 'Spieler';
  const roomRaw = $('in-room').value.trim();
  const pw = $('in-pass').value;
  try { localStorage.setItem('ff-name', name); localStorage.setItem('ff-room', roomRaw); } catch (e) {}
  if (!slug(roomRaw)) { startMsg('Bitte einen Raumnamen eingeben.', true); return null; }
  if (!pw) { startMsg('Bitte ein Passwort eingeben.', true); return null; }
  return { name: name.slice(0, 12), room: slug(roomRaw), pw };
}
function setBusy(b) { $('btn-host').disabled = b; $('btn-join').disabled = b; }

async function hostRoom() {
  const f = readForm(); if (!f) return;
  setBusy(true); startMsg('Raum wird erstellt …');
  try {
    S.role = 'host'; S.room = f.room; S.pwHash = await hashPw(f.room, f.pw);
    S.game = new Game();
    S.myId = 'host';
    S.game.addPlayer('host', f.name);
    S.hostNet = await Net.host(f.room, onClientConnect);
    startMsg('');
    enterLobby();
    runHostLoop();
  } catch (e) { S.role = null; startMsg(e.message, true); }
  setBusy(false);
}

function onClientConnect(conn) {
  let pid = null;
  const timeout = setTimeout(() => { if (!pid) conn.close(); }, 10000);
  conn.onData = (m) => {
    if (!m || typeof m !== 'object') return;
    if (!pid) {
      if (m.t !== 'join') return;
      clearTimeout(timeout);
      const g = S.game;
      let reason = null;
      if (m.pw !== S.pwHash) reason = 'Falsches Passwort.';
      else if (g.players.length >= MAX_PLAYERS) reason = 'Der Raum ist voll (maximal 4 Spieler).';
      else if (g.phase !== 'lobby') reason = 'Das Spiel läuft schon. Warte, bis die Partie vorbei ist.';
      if (reason) { conn.send({ t: 'reject', reason }); setTimeout(() => conn.close(), 300); return; }
      pid = 'p' + Math.random().toString(36).slice(2, 8);
      g.addPlayer(pid, String(m.name || 'Spieler').slice(0, 12));
      S.conns.set(pid, conn);
      conn.send({ t: 'welcome', id: pid });
      broadcastLobby();
      return;
    }
    if (m.t === 'input') {
      const p = S.game.players.find((q) => q.id === pid);
      if (p) p.input = { dx: Math.sign(m.dx) | 0, dy: Math.sign(m.dy) | 0, bomb: m.bomb | 0 };
    }
  };
  conn.onClose = () => {
    if (!pid) return;
    S.conns.delete(pid);
    S.game.removePlayer(pid);
    pid = null;
    broadcastLobby();
    if (S.game.phase === 'lobby' && inGame()) enterLobby();
  };
}

function broadcastLobby() {
  const msg = { t: 'lobby', players: S.game.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), phase: S.game.phase };
  for (const c of S.conns.values()) c.send(msg);
  renderLobby(msg);
}

async function joinRoom() {
  const f = readForm(); if (!f) return;
  setBusy(true); startMsg('Verbinde mit dem Raum …');
  try {
    const conn = await Net.join(f.room);
    S.role = 'client'; S.room = f.room; S.conn = conn;
    const pw = await hashPw(f.room, f.pw);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Keine Antwort vom Gastgeber.')), 10000);
      conn.onData = (m) => {
        if (m.t === 'welcome') { clearTimeout(timer); S.myId = m.id; resolve(); }
        else if (m.t === 'reject') { clearTimeout(timer); reject(new Error(m.reason)); }
      };
      conn.onClose = () => { clearTimeout(timer); reject(new Error('Verbindung getrennt.')); };
      conn.send({ t: 'join', name: f.name, pw });
    });
    conn.onData = onHostMessage;
    conn.onClose = () => { if (S.role === 'client') leave('Der Gastgeber hat das Spiel verlassen.'); };
    startMsg('');
    enterLobby();
    runClientLoop();
  } catch (e) {
    if (S.conn) S.conn.close();
    S.role = null; S.conn = null;
    startMsg(e.message, true);
  }
  setBusy(false);
}

function onHostMessage(m) {
  if (m.t === 'lobby') {
    renderLobby(m);
    if (m.phase === 'lobby' && !$('screen-game').classList.contains('hidden')) enterLobby();
  } else if (m.t === 'state') {
    S.view = m;
    if (m.phase !== 'lobby' && $('screen-game').classList.contains('hidden')) show('game');
  }
}

function enterLobby() {
  show('lobby');
  $('lobby-room').textContent = '„' + S.room + '“';
  if (S.role === 'host') broadcastLobby();
}
function renderLobby(m) {
  $('lobby-players').innerHTML = m.players.map((p) =>
    `<li><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === 'host' ? ' <small>(Gastgeber)</small>' : ''}${p.id === S.myId ? ' <small>– du</small>' : ''}</li>`).join('');
  const isHost = S.role === 'host';
  $('btn-start').classList.toggle('hidden', !isHost);
  $('lobby-hint').textContent = isHost
    ? (m.players.length < 2 ? 'Warte auf Mitspieler. Gib ihnen Raumname und Passwort. (Allein starten geht zum Ausprobieren.)' : m.players.length + ' von 4 Spielern sind da.')
    : 'Warte, bis der Gastgeber das Spiel startet …';
}

function leave(reason) {
  if (S.role === 'host') {
    for (const c of S.conns.values()) c.close();
    S.hostNet && S.hostNet.close();
  } else if (S.conn) {
    const c = S.conn; S.conn = null; S.role = null; c.close();
  }
  Object.assign(S, { role: null, game: null, hostNet: null, conns: new Map(), conn: null, view: null, myId: null });
  S.disp.clear();
  show('start');
  startMsg(reason || '', !!reason);
}

// ---------- Schleifen ----------
let loopId = 0;
function runHostLoop() {
  const id = ++loopId;
  let last = performance.now(), acc = 0, n = 0;
  const tick = (now) => {
    acc += Math.min(0.25, (now - last) / 1000); last = now;
    const g = S.game;
    const me = g.players.find((p) => p.id === 'host'); if (me) me.input = { ...S.input };
    while (acc >= TICK) {
      g.step(TICK); acc -= TICK;
      if (++n % SEND_EVERY === 0) {
        const snap = g.snapshot();
        for (const c of S.conns.values()) c.send(snap);
      }
    }
  };
  const frame = (now) => {
    if (id !== loopId || S.role !== 'host') return;
    tick(now);
    S.view = S.game.snapshot();
    draw(S.view, true);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // Weiterrechnen, wenn der Tab im Hintergrund ist (requestAnimationFrame pausiert dann)
  const bg = setInterval(() => {
    if (id !== loopId || S.role !== 'host') return clearInterval(bg);
    if (document.hidden) tick(performance.now());
  }, 50);
}
function runClientLoop() {
  const id = ++loopId;
  const frame = () => {
    if (id !== loopId || S.role !== 'client') return;
    const key = S.input.dx + ',' + S.input.dy + ',' + S.input.bomb;
    if (key !== S.lastSent) { S.lastSent = key; S.conn.send({ t: 'input', ...S.input }); }
    if (S.view) draw(S.view, false);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // Eingaben regelmäßig wiederholen, falls eine Nachricht verloren geht
  const iv = setInterval(() => {
    if (id !== loopId || S.role !== 'client') return clearInterval(iv);
    S.conn && S.conn.send({ t: 'input', ...S.input });
  }, 250);
}

// ---------- Eingabe ----------
const held = []; // gedrückte Richtungen, letzte zuerst
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function press(dir) { if (!held.includes(dir)) held.unshift(dir); updateDir(); }
function release(dir) { const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); updateDir(); }
function updateDir() { const d = held[0]; [S.input.dx, S.input.dy] = d ? DIRS[d] : [0, 0]; }
function bomb() { S.input.bomb = (S.input.bomb + 1) % 1000; }
function inGame() { return !$('screen-game').classList.contains('hidden'); }

addEventListener('keydown', (e) => {
  if (!inGame()) return;
  const d = KEYMAP[e.code];
  if (d) { press(d); e.preventDefault(); }
  else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { bomb(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { const d = KEYMAP[e.code]; if (d) release(d); });
addEventListener('blur', () => { held.length = 0; updateDir(); });
document.querySelectorAll('#touch [data-dir]').forEach((btn) => {
  const d = btn.dataset.dir;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(d); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => release(d));
});
$('touch-bomb').addEventListener('pointerdown', (e) => { e.preventDefault(); bomb(); });

$('btn-host').onclick = hostRoom;
$('btn-join').onclick = joinRoom;
$('in-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
$('btn-leave').onclick = () => leave();
$('btn-quit').onclick = () => leave();
$('btn-start').onclick = () => {
  if (S.role !== 'host') return;
  S.game.startMatch();
  broadcastLobby();
  show('game');
};
$('btn-again').onclick = () => {
  if (S.role !== 'host') return;
  S.game.phase = 'lobby';
  for (const p of S.game.players) p.score = 0;
  broadcastLobby();
  enterLobby();
};
try {
  $('in-name').value = localStorage.getItem('ff-name') || '';
  $('in-room').value = localStorage.getItem('ff-room') || '';
} catch (e) {}

// ---------- Zeichnen ----------
const cv = $('cv'), ctx = cv.getContext('2d');
let lastHud = '';
function draw(v, isHost) {
  const now = performance.now() / 1000;
  const grid = v.grid;
  // Boden
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = +grid[y * W + x];
    const px = x * T, py = y * T;
    if (t === WALL) drawWall(px, py);
    else {
      ctx.fillStyle = (x + y) % 2 ? '#2f5a3a' : '#33613f';
      ctx.fillRect(px, py, T, T);
      if (t === CRATE) drawCrate(px, py);
    }
  }
  for (const [x, y, type] of v.items) drawItem(x * T, y * T, type, now);
  for (const [x, y, fuse] of v.bombs) drawBomb(x * T, y * T, fuse, now);
  drawFlames(v.flames, now);

  // Spieler (beim Client geglättet)
  const players = [...v.players].sort((a, b) => a.y - b.y);
  for (const p of players) {
    let d = S.disp.get(p.id);
    if (!d || isHost || Math.hypot(d.x - p.x, d.y - p.y) > 2) d = { x: p.x, y: p.y };
    else { d.x += (p.x - d.x) * 0.35; d.y += (p.y - d.y) * 0.35; }
    S.disp.set(p.id, d);
    if (p.alive) drawPlayer(d.x * T, d.y * T, p, now);
  }

  // Anzeige oben
  const hud = v.players.map((p) =>
    `<span class="hud-p${p.alive || v.phase === 'lobby' ? '' : ' dead'}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)} <b>${'★'.repeat(p.score)}${'☆'.repeat(Math.max(0, WIN_ROUNDS - p.score))}</b>` +
    (p.id === S.myId ? ` <small>💣${p.bombs} 🔥${p.range} 👟${p.speed}${p.kick ? ' 🦶' : ''}</small>` : '') + '</span>').join('') +
    `<span class="hud-t">⏱ ${Math.floor(v.clock / 60)}:${String(v.clock % 60).padStart(2, '0')}</span>`;
  if (hud !== lastHud) { $('hud').innerHTML = hud; lastHud = hud; }
  const ov = $('overlay');
  ov.classList.toggle('hidden', !v.msg);
  if (v.msg && ov.textContent !== v.msg) ov.textContent = v.msg;
  $('btn-again').classList.toggle('hidden', !(isHost && v.phase === 'matchEnd'));
}

function drawWall(px, py) {
  ctx.fillStyle = '#4b4f63'; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = '#5f6479'; ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
  ctx.fillStyle = '#6e7389'; ctx.fillRect(px + 3, py + 3, T - 6, 6);
  ctx.fillStyle = '#3c3f50'; ctx.fillRect(px + 3, py + T - 9, T - 6, 6);
}
function drawCrate(px, py) {
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
  ctx.fillStyle = '#a8713a'; ctx.fillRect(px + 7, py + 7, T - 14, T - 14);
  ctx.strokeStyle = '#6b431e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + T - 8, py + T - 8); ctx.moveTo(px + T - 8, py + 8); ctx.lineTo(px + 8, py + T - 8); ctx.stroke();
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 2; ctx.strokeRect(px + 5, py + 5, T - 10, T - 10);
}
function drawItem(px, py, type, now) {
  const bob = Math.sin(now * 4 + px) * 2;
  ctx.fillStyle = '#1d2033'; roundRect(px + 6, py + 6 + bob, T - 12, T - 12, 8); ctx.fill();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '24px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ITEM_ICON[type], px + T / 2, py + T / 2 + 1 + bob);
}
function drawBomb(px, py, fuse, now) {
  const pulse = 1 + Math.sin(now * (6 + (FUSE - fuse) * 8)) * 0.06;
  const cx = px + T / 2, cy = py + T / 2 + 3, r = 15 * pulse;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, py + T - 7, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fuse < 0.6 && Math.floor(now * 12) % 2 ? '#7a1f1f' : '#1b1c26';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(cx - 5, cy - 5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 6, cy - 12); ctx.quadraticCurveTo(cx + 12, cy - 20, cx + 8, cy - 23); ctx.stroke();
  ctx.fillStyle = Math.floor(now * 16) % 2 ? '#ffe066' : '#ff7b2e';
  ctx.beginPath(); ctx.arc(cx + 8, cy - 23, 3.5, 0, Math.PI * 2); ctx.fill();
}
function drawFlames(flames, now) {
  const set = new Set(flames.map(([x, y]) => x + ',' + y));
  for (const [x, y] of flames) {
    const px = x * T, py = y * T, cx = px + T / 2, cy = py + T / 2;
    const flick = 0.85 + Math.sin(now * 30 + x * 7 + y * 3) * 0.15;
    const h = set.has((x - 1) + ',' + y) || set.has((x + 1) + ',' + y);
    const v = set.has(x + ',' + (y - 1)) || set.has(x + ',' + (y + 1));
    for (const [col, s] of [['#ff5a1f', 1], ['#ffb02e', 0.68], ['#fff3b0', 0.36]]) {
      ctx.fillStyle = col;
      const w = T * s * flick;
      if (h || !v) ctx.fillRect(px, cy - w / 2, T, w);
      if (v || !h) ctx.fillRect(cx - w / 2, py, w, T);
    }
  }
}
function drawPlayer(px, py, p, now) {
  const cx = px + T / 2, base = py + T - 6;
  const bounce = p.moving ? Math.abs(Math.sin(now * 14)) * 3 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, base, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Füße
  ctx.fillStyle = '#1b1c26';
  const step = p.moving ? Math.sin(now * 14) * 4 : 0;
  ctx.beginPath(); ctx.ellipse(cx - 7 + step, base - 2, 6, 4, 0, 0, Math.PI * 2); ctx.ellipse(cx + 7 - step, base - 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Körper (Tropfenform)
  const by = base - 18 - bounce;
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.ellipse(cx, by, 16, 17, 0, 0, Math.PI * 2); ctx.fill();
  // Antenne
  ctx.strokeStyle = p.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, by - 16); ctx.lineTo(cx + 3, by - 25); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 3, by - 26, 3, 0, Math.PI * 2); ctx.fill();
  // Visier und Augen je nach Blickrichtung
  const ox = p.dir === 'left' ? -5 : p.dir === 'right' ? 5 : 0;
  const oy = p.dir === 'up' ? -4 : p.dir === 'down' ? 2 : 0;
  if (p.dir !== 'up') {
    ctx.fillStyle = '#1b1c26'; roundRect(cx - 11 + ox, by - 7 + oy, 22, 11, 5); ctx.fill();
    ctx.fillStyle = '#9ff7ff';
    ctx.fillRect(cx - 7 + ox, by - 4 + oy, 4, 5); ctx.fillRect(cx + 3 + ox, by - 4 + oy, 4, 5);
  }
  // Name
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(p.name, cx + 1, py - 1 - bounce + 1);
  ctx.fillStyle = '#fff'; ctx.fillText(p.name, cx, py - 1 - bounce);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Für Tests von außen erreichbar
window.Funkenfeld = { Game, S };
})();
