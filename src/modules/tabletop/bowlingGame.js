/**
 * 🎳 Bowling — HOST tarafı fizik + 10 frame'lik skor
 *
 * Kulvar x ekseni boyunca uzanır: atış çizgisi solda, lobutlar sağda. 4 oyuncuya kadar sırayla oynanır.
 * Lobutlar (10) gerçek bileşik şekilli gövdeler (geniş karın + ince boyun); top ağır bir küredir.
 * Atış: imleç nişan noktası, fare tuşunu basılı tut = güç, bırak = at. ← → ile başlangıç konumu.
 * Tüm lobutlar durulunca devrilenler sayılır, süpürülür; frame bitince 10 lobut yeniden dizilir.
 *
 * Niyetler: seat, pad {x,z}, padBtn {down}, bowlPos {dz}, gameReset.
 */
import { BaseGame, BOT, clamp, num, rnd } from "./gameBase.js";

export const BOWL = {
  START_X: -17.2,
  HEAD_X: 8,
  ROW_DX: 2.25,
  PIN_SP: 2.6,
  BALL_R: 1.1,
  LANE_HALF: 5,
  GUTTER_HALF: 7,
  BACK_X: 19.4,
  MAX_SPEED: 56,
  MIN_SPEED: 16,
};

export const pinHome = (i) => {
  let row = 0;
  let k = i;
  while (k > row) {
    k -= row + 1;
    row++;
  }
  return { x: BOWL.HEAD_X + row * BOWL.ROW_DX, z: (k - row / 2) * BOWL.PIN_SP };
};

export function cleanBowlSpec(s) {
  if (s.part === "bowlball") return { id: s.id, kind: "game", part: "bowlball" };
  if (s.part === "pin") {
    const idx = Math.round(num(s.idx, -1));
    return idx >= 0 && idx < 10 ? { id: s.id, kind: "game", part: "pin", idx } : null;
  }
  return null;
}

// ───────────────── Skor (saf mantık) ─────────────────
/** Atış listesinden (devrilen lobut sayıları) frame'ler ve toplam */
export function frameScores(rolls) {
  const frames = [];
  let i = 0;
  let cum = 0;
  let known = true;
  const push = (rs, score) => {
    if (score === null) known = false;
    if (known) cum += score;
    frames.push({ rolls: rs, score: known && score !== null ? cum : null });
  };
  for (let f = 1; f <= 9; f++) {
    if (rolls[i] === undefined) break;
    if (rolls[i] === 10) {
      const a = rolls[i + 1];
      const b = rolls[i + 2];
      push([10], a !== undefined && b !== undefined ? 10 + a + b : null);
      i += 1;
    } else {
      const r1 = rolls[i];
      const r2 = rolls[i + 1];
      if (r2 === undefined) {
        push([r1], null);
        return { frames, total: cum };
      }
      if (r1 + r2 === 10) {
        const b = rolls[i + 2];
        push([r1, r2], b !== undefined ? 10 + b : null);
      } else push([r1, r2], r1 + r2);
      i += 2;
    }
  }
  if (frames.length === 9 && rolls[i] !== undefined) {
    const r = rolls.slice(i, i + 3);
    const done = r.length === 3 || (r.length === 2 && r[0] !== 10 && r[0] + r[1] < 10);
    push(r, done ? r.reduce((a, b) => a + b, 0) : null);
  }
  return { frames, total: cum };
}

/** Sıradaki atışın durumu: hangi frame, kaçıncı atış, ayakta kaç lobut var, oyuncu bitti mi */
export function bowlState(rolls) {
  let i = 0;
  for (let frame = 1; frame <= 9; frame++) {
    if (i >= rolls.length) return { frame, ball: 1, standing: 10, done: false };
    if (rolls[i] === 10) {
      i += 1;
      continue;
    }
    if (i + 1 >= rolls.length) return { frame, ball: 2, standing: 10 - rolls[i], done: false };
    i += 2;
  }
  const r = rolls.slice(i);
  if (r.length === 0) return { frame: 10, ball: 1, standing: 10, done: false };
  if (r.length === 1) return { frame: 10, ball: 2, standing: r[0] === 10 ? 10 : 10 - r[0], done: false };
  if (r.length === 2) {
    if (r[0] === 10) return { frame: 10, ball: 3, standing: r[1] === 10 ? 10 : 10 - r[1], done: false };
    if (r[0] + r[1] === 10) return { frame: 10, ball: 3, standing: 10, done: false };
    return { frame: 10, ball: 3, standing: 0, done: true };
  }
  return { frame: 10, ball: 3, standing: 0, done: true };
}

// ───────────────── Oyun ─────────────────
export class BowlingGame extends BaseGame {
  constructor(host) {
    super("bowling", host);
    this.ball = null;
    this.pins = [];
    this.removed = new Array(10).fill(false);
    this.sheets = [[], [], [], []];
    this.cur = 0;
    this.phase = "aim"; // aim | roll | settle | over
    this.startZ = 0;
    this.aimPoint = { x: BOWL.HEAD_X, z: 0 };
    this.down = false;
    this.charge = 0;
    this.rollT = 0;
    this.restT = 0;
    this.settleT = 0;
    this.botT = 0;
    this.msg = "";
    this.lastPowerSent = 0;
    this.standingBefore = 10;
  }

  build() {
    const h = 6;
    const sideZ = BOWL.GUTTER_HALF + 0.6;
    this._wall(BOWL.BACK_X, h, 0.5, 0, h, -sideZ, 0, 0.3);
    this._wall(BOWL.BACK_X, h, 0.5, 0, h, sideZ, 0, 0.3);
    this._wall(0.5, h, sideZ, BOWL.BACK_X + 0.5, h, 0, 0, 0.3);
    this._wall(0.5, h, sideZ, -BOWL.BACK_X - 1.5, h, 0, 0, 0.3);
    this.ball = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "bowlball" }, [BOWL.START_X, BOWL.BALL_R, 0], null);
    for (let i = 0; i < 10; i++) {
      const home = pinHome(i);
      this.pins.push(this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "pin", idx: i }, [home.x, 0.02, home.z], null));
    }
    this.newMatch(true);
  }

  buildBody(o, pos) {
    const R = this.R;
    const w = this.host.world;
    if (o.spec.part === "bowlball") {
      const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setCcdEnabled(true).setLinearDamping(0.02).setAngularDamping(0.05));
      o.collider = w.createCollider(R.ColliderDesc.ball(BOWL.BALL_R).setRestitution(0.25).setFriction(0.25).setDensity(3.2), body);
      return body;
    }
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setCcdEnabled(true).setLinearDamping(0.08).setAngularDamping(0.15));
    // Gerçek lobut şekli: geniş karın (altta) + ince boyun ve baş (üstte)
    o.collider = w.createCollider(R.ColliderDesc.cylinder(0.8, 0.56).setTranslation(0, 0.8, 0).setRestitution(0.4).setFriction(0.45).setDensity(1.7), body);
    w.createCollider(R.ColliderDesc.cylinder(0.95, 0.3).setTranslation(0, 2.55, 0).setRestitution(0.4).setFriction(0.45).setDensity(0.9), body);
    return body;
  }

  // ───────── Meta ─────────
  _publish() {
    this.setMeta({
      info: {
        cur: this.cur,
        frame: bowlState(this.sheets[this.cur] || []).frame,
        ball: bowlState(this.sheets[this.cur] || []).ball,
        pins: this._standingCount(),
        sheets: this.sheets.map((s) => s.slice()),
        msg: this.msg,
        phase: this.phase,
        power: this.charge,
        startZ: this.startZ,
      },
    });
  }

  _occupied() {
    return this.meta.seats.map((s, i) => (s !== null ? i : -1)).filter((i) => i >= 0);
  }

  newMatch(initial = false) {
    this.sheets = [[], [], [], []];
    this.removed.fill(false);
    this.meta = { ...this.meta, winner: null };
    const occ = this._occupied();
    this.cur = occ.length ? occ[0] : 0;
    this.phase = "aim";
    this.msg = initial ? "Koltuğa otur, fareyle nişan al, basılı tut ve bırak." : "Yeni oyun!";
    this.down = false;
    this.charge = 0;
    this.startZ = 0;
    this._resetPins();
    this._ballHome();
    this._publish();
  }

  _seatsChanged() {
    this.down = false;
    this.charge = 0;
    const occ = this._occupied();
    if (occ.length && this.meta.seats[this.cur] === null && this.phase === "aim") {
      this.cur = occ.find((i) => i >= this.cur) ?? occ[0];
    }
    this._publish();
  }

  _serve() {}

  // ───────── Lobut / top ─────────
  _resetPins() {
    const R = this.R;
    for (let i = 0; i < 10; i++) {
      const b = this.pins[i]?.body;
      if (!b) continue;
      const home = pinHome(i);
      b.setBodyType(R.RigidBodyType.Dynamic, true);
      b.setTranslation({ x: home.x, y: 0.02, z: home.z }, true);
      b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.removed[i] = false;
      this.host.touch?.(this.pins[i]);
    }
  }

  _ballHome() {
    const b = this.ball?.body;
    if (!b) return;
    b.setTranslation({ x: BOWL.START_X, y: BOWL.BALL_R, z: this.startZ }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.host.touch?.(this.ball);
  }

  _isStanding(i) {
    if (this.removed[i]) return false;
    const b = this.pins[i]?.body;
    if (!b) return false;
    const p = b.translation();
    const q = b.rotation();
    const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
    return uy > 0.9 && p.y < 0.6 && Math.abs(p.z) < BOWL.LANE_HALF + 0.9 && p.x < BOWL.BACK_X - 0.4;
  }

  _standingCount() {
    let c = 0;
    for (let i = 0; i < 10; i++) if (this._isStanding(i)) c++;
    return c;
  }

  // ───────── Girdi ─────────
  _canAct(pid) {
    return this.phase === "aim" && !this.meta.winner && this.seatOf(pid) === this.cur;
  }

  _pad(pid, it) {
    if (this.seatOf(pid) !== this.cur) return;
    this.aimPoint = { x: clamp(num(it.x), -20, 20), z: clamp(num(it.z), -13, 13) };
  }

  _padBtn(pid, it) {
    if (!this._canAct(pid)) return;
    if (it.down) {
      this.down = true;
      this.charge = 0;
    } else if (this.down) {
      this.down = false;
      const power = this.charge;
      this.charge = 0;
      if (power > 0.04) this.throwBall(power);
      else this._publish();
    }
  }

  _bowlPos(pid, it) {
    if (!this._canAct(pid)) return;
    this.startZ = clamp(this.startZ + clamp(num(it.dz), -1, 1) * 0.6, -3.6, 3.6);
    this._ballHome();
    this._publish();
  }

  throwBall(power, dirOverride = null) {
    const b = this.ball?.body;
    if (!b) return;
    let dir = dirOverride;
    if (!dir) {
      const dx = this.aimPoint.x - BOWL.START_X;
      const dz = this.aimPoint.z - this.startZ;
      dir = dx > 1 ? { x: dx, z: dz } : { x: 1, z: 0 };
    }
    // Açıyı sınırla (±14°) ve normalle
    let ang = Math.atan2(dir.z, dir.x);
    ang = clamp(ang, -0.25, 0.25);
    const speed = BOWL.MIN_SPEED + (BOWL.MAX_SPEED - BOWL.MIN_SPEED) * clamp(power, 0, 1);
    const vx = Math.cos(ang) * speed;
    const vz = Math.sin(ang) * speed;
    this.standingBefore = this._standingCount();
    b.setTranslation({ x: BOWL.START_X, y: BOWL.BALL_R, z: this.startZ }, true);
    b.setLinvel({ x: vx, y: 0, z: vz }, true);
    b.setAngvel({ x: vz / BOWL.BALL_R, y: 0, z: -vx / BOWL.BALL_R }, true); // kayarak değil yuvarlanarak başlasın
    this.phase = "roll";
    this.rollT = 0;
    this.restT = 0;
    this.msg = "";
    this.host.sound?.("shot");
    this._publish();
  }

  // ───────── Döngü ─────────
  step(dt) {
    if (!this.ball?.body) return;
    if (this.down && this.phase === "aim") {
      this.charge = Math.min(1, this.charge + dt / 1.1);
      this.lastPowerSent += dt;
      if (this.lastPowerSent > 0.08) {
        this.lastPowerSent = 0;
        this._publish();
      }
    }
    if (this.phase === "aim") {
      // Top atış çizgisinde bekler
      const b = this.ball.body;
      const p = b.translation();
      if (Math.abs(p.x - BOWL.START_X) > 0.05 || Math.abs(p.z - this.startZ) > 0.05) this._ballHome();
      if (!this.meta.winner && this.meta.seats[this.cur] === BOT) {
        this.botT += dt;
        if (this.botT > 1.3) {
          this.botT = 0;
          this._botThrow();
        }
      } else this.botT = 0;
    }
    if (this.phase === "settle") {
      this.settleT -= dt;
      if (this.settleT <= 0) this._nextTurn();
    }
  }

  post(dt = 1 / 60) {
    if (this.phase !== "roll") return;
    const b = this.ball.body;
    const p = b.translation();
    const v = b.linvel();
    this.rollT += dt;
    // Çukur: kulvarın dışına çıkan top oluğa girer, düz gider ve lobutlara değemez
    if (Math.abs(p.z) > BOWL.LANE_HALF + 0.1 && p.x < BOWL.HEAD_X - 1) {
      const sz = Math.sign(p.z);
      b.setTranslation({ x: p.x, y: BOWL.BALL_R, z: sz * (BOWL.LANE_HALF + 0.6) }, true);
      b.setLinvel({ x: Math.max(v.x, 10), y: 0, z: 0 }, true);
      this.gutter = true;
    }
    const ballSp = Math.hypot(v.x, v.z);
    const ballDone = p.x > BOWL.BACK_X - 1.6 || (this.rollT > 1.2 && ballSp < 0.6);
    let pinsMoving = false;
    for (let i = 0; i < 10; i++) {
      const pb = this.pins[i]?.body;
      if (!pb || this.removed[i]) continue;
      const lv = pb.linvel();
      const av = pb.angvel();
      if (lv.x * lv.x + lv.y * lv.y + lv.z * lv.z > 0.06 || av.x * av.x + av.y * av.y + av.z * av.z > 0.25) {
        pinsMoving = true;
        break;
      }
    }
    this.restT = ballDone && !pinsMoving ? this.restT + dt : 0;
    if ((this.restT > 0.6 && this.rollT > 1.2) || this.rollT > 12) this._endThrow();
  }

  _endThrow() {
    const standing = this._standingCount();
    const knocked = clamp(this.standingBefore - standing, 0, 10);
    // Devrilenleri süpür
    for (let i = 0; i < 10; i++) {
      if (!this._isStanding(i) && !this.removed[i]) {
        const pb = this.pins[i].body;
        pb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        pb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        pb.setBodyType(this.R.RigidBodyType.Fixed, true);
        pb.setTranslation({ x: 0, y: -60, z: 0 }, true);
        this.removed[i] = true;
        this.host.touch?.(this.pins[i]);
      }
    }
    const sheet = this.sheets[this.cur];
    const before = bowlState(sheet);
    sheet.push(knocked);
    const after = bowlState(sheet);
    const strike = knocked === 10 && before.standing === 10;
    const spare = !strike && before.ball > 1 && knocked === before.standing;
    this.msg = strike ? "STRIKE!" : spare ? "Spare!" : knocked === 0 ? (this.gutter ? "Oluk!" : "Iska!") : `${knocked} lobut`;
    this.gutter = false;
    if (strike || spare) this.host.sound?.("win");
    else if (knocked > 0) this.host.sound?.("goal");
    this.phase = "settle";
    this.settleT = 1.8;
    this._ballHome();
    // Oyuncunun sırası sürüyor mu (aynı frame'in sonraki atışı)?
    this.continueTurn = after.frame === before.frame && !after.done;
    this._publish();
  }

  _nextTurn() {
    const occ = this._occupied();
    const unfinished = occ.filter((i) => !bowlState(this.sheets[i]).done);
    if (!unfinished.length) {
      // Oyun bitti
      let best = -1;
      let bestScore = -1;
      for (const i of occ) {
        const t = frameScores(this.sheets[i]).total;
        if (t > bestScore) {
          bestScore = t;
          best = i;
        }
      }
      this.phase = "over";
      this.meta = { ...this.meta, winner: best >= 0 ? best : null };
      this.msg = occ.length > 1 ? "Oyun bitti!" : `Oyun bitti: ${bestScore} puan`;
      this.host.sound?.("win");
      this._publish();
      return;
    }
    if (!this.continueTurn || bowlState(this.sheets[this.cur]).done || this.meta.seats[this.cur] === null) {
      // Sıradaki oyuncu (sırayla), frame'i bitmemiş olan
      let next = this.cur;
      for (let k = 1; k <= 4; k++) {
        const c = (this.cur + k) % 4;
        if (unfinished.includes(c)) {
          next = c;
          break;
        }
      }
      this.cur = next;
      this._resetPins();
    } else if (bowlState(this.sheets[this.cur]).standing === 10) {
      this._resetPins(); // 10. frame'de vurgu/spare sonrası yeniden dizilir
    }
    this.phase = "aim";
    this.startZ = clamp(this.startZ, -3.6, 3.6);
    this._ballHome();
    this._publish();
  }

  // ───────── Bot ─────────
  _botThrow() {
    this.startZ = rnd(-2.2, 2.2);
    this._ballHome();
    // İkinci atışta ayakta kalan bir lobuta, ilkinde ortadaki lobuta nişan al (küçük sapmayla)
    const standing = [];
    for (let i = 0; i < 10; i++) if (this._isStanding(i)) standing.push(i);
    let targetZ = clamp(rnd(-0.7, 0.7) - this.startZ * 0.1, -2.5, 2.5);
    let targetX = BOWL.HEAD_X;
    if (standing.length && standing.length < 10) {
      const pick = standing[Math.floor(Math.random() * standing.length)];
      const h = pinHome(pick);
      targetX = h.x;
      targetZ = h.z + rnd(-0.35, 0.35);
    }
    const dx = targetX - BOWL.START_X;
    const dz = targetZ - this.startZ;
    const power = rnd(0.62, 0.95);
    this.throwBall(power, { x: dx, z: dz });
  }
}
