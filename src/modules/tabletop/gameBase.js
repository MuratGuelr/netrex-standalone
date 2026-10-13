/**
 * 🎮 Masa oyunları — ortak taban (Air Hockey, Langırt, Bilardo, Bowling)
 *
 * Bu dosyada three.js ve rapier YOK (host `host.RAPIER` ile verir): Node'da test edilebilir, hafif parçalar da
 * (arayüz) buradan sabitleri çekebilir.
 *
 * Yetki modeli masayla aynı: fiziği masayı açan kişi (host) hesaplar, diğerleri sadece "niyet" gönderir.
 * Ortak niyetler:
 *   seat {side, bot?}   — koltuk al / bırak (bot: o koltuğa bot koy/kaldır)
 *   pad {x, z}          — imlecin masa üzerindeki konumu (sürekli, kayıpsız olmayan kanal)
 *   padBtn {down}       — fare tuşu
 *   serve {} / gameReset {}
 * Oyunlara özel niyetler ilgili sınıfta (rodSel, bowlPos…).
 */

export const GAME_INFO = {
  airhockey: { seats: 2, target: 7 },
  foosball: { seats: 2, target: 7 },
  pool: { seats: 2, target: 1 },
  bowling: { seats: 4, target: 10 },
};
export const GAME_TYPES = Object.keys(GAME_INFO);
export const isGameType = (t) => typeof t === "string" && Object.prototype.hasOwnProperty.call(GAME_INFO, t);
export const BOT = "@bot";
export const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
export const TEAM_NAMES = ["Kırmızı", "Mavi", "Yeşil", "Sarı"];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const rnd = (a, b) => a + Math.random() * (b - a);

// ───────────────── Meta (skor, koltuklar, oyuna özel bilgi) ─────────────────
export function initialGameMeta(type) {
  const info = GAME_INFO[type] || { seats: 2, target: 7 };
  return { type, seats: new Array(info.seats).fill(null), score: [0, 0], target: info.target, winner: null, pause: false, info: {} };
}

const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").slice(0, max) : "");
const intIn = (v, a, b, d = a) => clamp(Math.round(num(v, d)), a, b);

/** Oyuna özel `info` alanını sınırlar (ağdan gelen veriye güvenilmez) */
function cleanInfo(type, info) {
  const i = info && typeof info === "object" ? info : {};
  if (type === "pool") {
    return {
      turn: intIn(i.turn, 0, 1),
      groups: [0, 1].map((k) => (i.groups?.[k] === "s" || i.groups?.[k] === "t" ? i.groups[k] : "")),
      potted: (Array.isArray(i.potted) ? i.potted : []).slice(0, 16).map((n) => intIn(n, 0, 15)),
      msg: str(i.msg, 90),
      phase: i.phase === "roll" || i.phase === "over" ? i.phase : "aim",
      power: clamp(num(i.power), 0, 1),
    };
  }
  if (type === "bowling") {
    const sheets = (Array.isArray(i.sheets) ? i.sheets : []).slice(0, 4).map((s) => (Array.isArray(s) ? s.slice(0, 21).map((n) => intIn(n, 0, 10)) : []));
    while (sheets.length < 4) sheets.push([]);
    return {
      cur: intIn(i.cur, 0, 3),
      frame: intIn(i.frame, 1, 10, 1),
      ball: intIn(i.ball, 1, 3, 1),
      pins: intIn(i.pins, 0, 10, 10),
      sheets,
      msg: str(i.msg, 90),
      phase: i.phase === "roll" || i.phase === "over" ? i.phase : "aim",
      power: clamp(num(i.power), 0, 1),
      startZ: clamp(num(i.startZ), -4, 4),
    };
  }
  return {};
}

/** Ağdan gelen oyun bilgisini sınırlar */
export function cleanGameMeta(g) {
  if (!g || typeof g !== "object" || !isGameType(g.type)) return null;
  const n = GAME_INFO[g.type].seats;
  const seat = (v) => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : null);
  const sc = (v) => clamp(Math.round(num(v)), 0, 999);
  const seats = Array.isArray(g.seats) ? g.seats : [];
  const score = Array.isArray(g.score) ? g.score : [];
  return {
    type: g.type,
    seats: Array.from({ length: n }, (_, k) => seat(seats[k])),
    score: [sc(score[0]), sc(score[1])],
    target: clamp(Math.round(num(g.target, 7)), 1, 21),
    winner: Number.isInteger(g.winner) && g.winner >= 0 && g.winner < n ? g.winner : null,
    pause: !!g.pause,
    info: cleanInfo(g.type, g.info),
  };
}

// ───────────────── Ortak taban sınıf ─────────────────
export class BaseGame {
  /**
   * @param host { RAPIER, world, myId, newId(kind), addObject(spec,pos,quat), objects:Map, onMeta(), notice(text), sound(name) }
   */
  constructor(type, host) {
    this.type = type;
    this.host = host;
    this.meta = initialGameMeta(type);
    this.colliders = [];
    this.pauseT = 0;
    this.loser = 0;
  }

  get R() {
    return this.host.RAPIER;
  }

  get seatCount() {
    return this.meta.seats.length;
  }

  seatOf(pid) {
    return this.meta.seats.indexOf(pid);
  }

  setMeta(patch) {
    this.meta = { ...this.meta, ...patch };
    this.host.onMeta?.();
  }

  /** Sabit duvar (rot: y ekseni etrafında dönüş, radyan). Sürtünmesiz; sekme katsayısı oyuna göre. */
  _wall(hx, hy, hz, x, y, z, rot = 0, restitution = 0.9) {
    const R = this.R;
    let d = R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRestitution(restitution).setFriction(0).setFrictionCombineRule(R.CoefficientCombineRule.Min);
    if (rot) d = d.setRotation({ x: 0, y: Math.sin(rot / 2), z: 0, w: Math.cos(rot / 2) });
    const c = this.host.world.createCollider(d);
    this.colliders.push(c);
    return c;
  }

  dispose() {
    const w = this.host.world;
    if (w) for (const c of this.colliders) try { w.removeCollider(c, true); } catch (e) {}
    this.colliders = [];
  }

  /** Oyuncu masadan ayrıldı: koltuğu boşalır */
  leave(pid) {
    if (this.seatOf(pid) < 0) return;
    this.setMeta({ seats: this.meta.seats.map((s) => (s === pid ? null : s)) });
    this._seatsChanged?.();
  }

  intent(pid, it) {
    switch (it.k) {
      case "seat":
        this._seat(pid, it);
        break;
      case "pad":
        this._pad(pid, it);
        break;
      case "padBtn":
        this._padBtn(pid, it);
        break;
      case "rodSel":
        this._rodSel?.(pid, it);
        break;
      case "bowlPos":
        this._bowlPos?.(pid, it);
        break;
      case "serve":
        if (!this.meta.winner && (pid === this.host.myId || this.seatOf(pid) >= 0)) this._serve(this.loser, true);
        break;
      case "gameReset":
        if (pid === this.host.myId || this.seatOf(pid) >= 0) this.newMatch();
        break;
      default:
    }
  }

  _seat(pid, it) {
    const side = Math.round(num(it.side, -1));
    const seats = this.meta.seats.slice();
    if (side < 0 || side >= seats.length) {
      this.setMeta({ seats: seats.map((s) => (s === pid ? null : s)) });
      this._seatsChanged?.();
      return;
    }
    if (it.bot) {
      if (seats[side] === BOT) seats[side] = null;
      else if (seats[side] === null) seats[side] = BOT;
      else return this.host.notice?.("Bu koltuk dolu.");
    } else if (seats[side] === pid) {
      seats[side] = null; // tekrar basınca kalk
    } else if (seats[side] === null || seats[side] === BOT) {
      for (let i = 0; i < seats.length; i++) if (seats[i] === pid) seats[i] = null;
      seats[side] = pid;
    } else {
      return this.host.notice?.("Bu koltuk dolu.");
    }
    this.setMeta({ seats });
    this._seatsChanged?.();
  }

  /** İki takımlı oyunlarda gol / sayı */
  _score(team) {
    const score = this.meta.score.slice();
    score[team] += 1;
    const winner = score[team] >= this.meta.target ? team : null;
    this.loser = 1 - team;
    this.host.sound?.(winner !== null ? "win" : "goal");
    this.setMeta({ score, winner, pause: true });
    this.pauseT = winner !== null ? Infinity : 1.5;
  }

  newMatch() {
    this.pauseT = 0;
    this.setMeta({ score: [0, 0], winner: null, pause: false });
    this._serve(Math.random() < 0.5 ? 0 : 1, true);
  }
}
