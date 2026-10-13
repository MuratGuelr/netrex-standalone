/**
 * 🎱 Bilardo (8 top) — HOST tarafı fizik + kurallar
 *
 * Masa: 36×18 oyun alanı, 6 cep. Toplar küre; y ekseninde kilitli, yuvarlanma görünümü için açısal hız
 * elle ayarlanır (kayma yok). Yavaşlama elle uygulanan sürtünme modeli ile (gerçekçi: hızlı top uzun,
 * yavaş top kısa sürede durur).
 *
 * Kurallar (basitleştirilmiş 8 top):
 *  - Açık masada ilk sokulan top kişinin grubunu (düz 1-7 / çizgili 9-15) belirler.
 *  - Sıra: kendi grubundan top sokarsan devam, yoksa rakibe geçer.
 *  - Faul: beyaz top cebe girer, hiçbir topa değmez, ya da yanlış gruptan topa ilk değer.
 *    Faulde sıra rakibe geçer, beyaz top başlangıç noktasına konur.
 *  - 8 numara: grubun bittikten sonra sokulursa kazanırsın; erken ya da faulle sokulursa kaybedersin.
 *
 * Niyetler: seat, pad {x,z} (nişan noktası), padBtn {down} (basılı tut: güç, bırak: vur), serve, gameReset.
 */
import { BaseGame, BOT, clamp, num, rnd } from "./gameBase.js";

export const POOL = {
  HX: 18,
  HZ: 9,
  BALL_R: 0.62,
  CORNER_MOUTH: 1.9, // köşe cebi ağzı (cushion bu kadar kısa kalır)
  SIDE_MOUTH: 1.15, // orta cep ağzı yarım genişlik
  CORNER_CAPTURE: 1.5,
  SIDE_CAPTURE: 1.3,
  MAX_SPEED: 64,
  HEAD_X: -9,
  FOOT_X: 8.5,
  CUE_LEN: 22,
};

export const POCKETS = [
  { x: -POOL.HX - 0.2, z: -POOL.HZ - 0.2, r: POOL.CORNER_CAPTURE },
  { x: 0, z: -POOL.HZ - 0.35, r: POOL.SIDE_CAPTURE },
  { x: POOL.HX + 0.2, z: -POOL.HZ - 0.2, r: POOL.CORNER_CAPTURE },
  { x: -POOL.HX - 0.2, z: POOL.HZ + 0.2, r: POOL.CORNER_CAPTURE },
  { x: 0, z: POOL.HZ + 0.35, r: POOL.SIDE_CAPTURE },
  { x: POOL.HX + 0.2, z: POOL.HZ + 0.2, r: POOL.CORNER_CAPTURE },
];

export const isSolid = (n) => n >= 1 && n <= 7;
export const isStripe = (n) => n >= 9 && n <= 15;
export const groupOf = (n) => (isSolid(n) ? "s" : isStripe(n) ? "t" : "");
const TRAY_Z = POOL.HZ + 2.4;

export function cleanPoolSpec(s) {
  if (s.part === "poolball") {
    const n = Math.round(num(s.n, -1));
    return n >= 0 && n <= 15 ? { id: s.id, kind: "game", part: "poolball", n } : null;
  }
  if (s.part === "cue") return { id: s.id, kind: "game", part: "cue" };
  return null;
}

/** Üçgen dizilişi: 8 ortada, köşelerde bir düz bir çizgili */
export function rackOrder() {
  const solids = [1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
  const stripes = [9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
  const cornerA = solids.pop();
  const cornerB = stripes.pop();
  const rest = [...solids, ...stripes].sort(() => Math.random() - 0.5);
  // 15 yuva: satır i (0..4), i+1 top. 8 numara: satır 2 ortası (indeks 4); köşeler: son satır uçları (10 ve 14)
  const order = new Array(15).fill(0);
  order[4] = 8;
  order[10] = cornerA;
  order[14] = cornerB;
  let k = 0;
  for (let i = 0; i < 15; i++) if (!order[i]) order[i] = rest[k++];
  return order;
}

export class PoolGame extends BaseGame {
  constructor(host) {
    super("pool", host);
    this.balls = new Array(16).fill(null); // 0 = beyaz
    this.cue = null;
    this.phase = "aim"; // aim | roll | over
    this.turn = 0;
    this.groups = ["", ""];
    this.potted = []; // sokulan numaralar (görünüm)
    this.pottedShot = [];
    this.firstHit = null;
    this.cuePotted = false;
    this.aimPoint = { x: 0, z: 0 };
    this.down = false;
    this.charge = 0;
    this.restT = 0;
    this.rollT = 0;
    this.botT = 0;
    this.msg = "";
    this.lastPowerSent = 0;
    this.trayCount = 0;
  }

  // ───────── Kurulum ─────────
  build() {
    const { HX, HZ, CORNER_MOUTH: cm, SIDE_MOUTH: sm } = POOL;
    const t = 0.7; // bant kalınlığı (yarım)
    const rest = 0.6; // bant sekmesi (top-bant ≈ 0.77)
    // Uzun bantlar: orta cep için ikiye bölünür
    const lx0 = sm;
    const lx1 = HX - cm;
    const lhx = (lx1 - lx0) / 2;
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) this._wall(lhx, 1, t, sx * (lx0 + lhx), 1, sz * (HZ + t), 0, rest);
    }
    // Kısa bantlar
    const ez0 = 0;
    const ez1 = HZ - cm;
    for (const sx of [-1, 1]) this._wall(t, 1, ez1 - ez0, sx * (HX + t), 1, 0, 0, rest);
    // Cep arkaları (top kaçmasın)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._wall(2.2, 1, 0.6, sx * (HX + 1.4), 1, sz * (HZ + 2.7), 0, 0.2);
    this._wall(2.2, 1, 0.6, 0, 1, -(HZ + 3.2), 0, 0.2);
    this._wall(2.2, 1, 0.6, 0, 1, HZ + 3.2, 0, 0.2);

    this.balls[0] = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "poolball", n: 0 }, [POOL.HEAD_X, POOL.BALL_R, 0], null);
    for (let n = 1; n <= 15; n++) {
      this.balls[n] = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "poolball", n }, [0, POOL.BALL_R, 0], null);
    }
    this.cue = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "cue" }, [0, -40, 0], null);
    this._rack();
    this._publish();
  }

  buildBody(o, pos) {
    const R = this.R;
    const w = this.host.world;
    if (o.spec.part === "cue") {
      return w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]).setCanSleep(false));
    }
    const body = w.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setCcdEnabled(true).enabledTranslations(true, false, true),
    );
    o.collider = w.createCollider(
      R.ColliderDesc.ball(POOL.BALL_R)
        .setRestitution(0.93)
        .setFriction(0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Min)
        .setDensity(1.4),
      body,
    );
    return body;
  }

  _rack() {
    const order = rackOrder();
    const dx = POOL.BALL_R * 2 * 0.8661 + 0.02;
    const dz = POOL.BALL_R * 2 + 0.03;
    let k = 0;
    for (let row = 0; row < 5; row++) {
      for (let j = 0; j <= row; j++) {
        const n = order[k++];
        this._place(n, POOL.FOOT_X + row * dx, (j - row / 2) * dz);
      }
    }
    this._place(0, POOL.HEAD_X, 0);
    this.trayCount = 0;
    this.potted = [];
  }

  _place(n, x, z) {
    const b = this.balls[n]?.body;
    if (!b) return;
    b.setBodyType(this.R.RigidBodyType.Dynamic, true);
    b.setTranslation({ x, y: POOL.BALL_R, z }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.host.touch?.(this.balls[n]);
  }

  // ───────── Meta ─────────
  _publish() {
    this.setMeta({
      winner: this.meta.winner,
      info: {
        turn: this.turn,
        groups: this.groups.slice(),
        potted: this.potted.slice(),
        msg: this.msg,
        phase: this.phase,
        power: this.charge,
      },
    });
  }

  newMatch() {
    this.phase = "aim";
    this.turn = Math.random() < 0.5 ? 0 : 1;
    this.groups = ["", ""];
    this.potted = [];
    this.pottedShot = [];
    this.firstHit = null;
    this.cuePotted = false;
    this.down = false;
    this.charge = 0;
    this.msg = "Yeni oyun. Açılış vuruşu sende değilse sıra rakipte.";
    this.meta = { ...this.meta, winner: null };
    this._rack();
    this._publish();
  }

  _serve() {
    // Beyaz topu başlangıç noktasına al (yalnızca nişan aşamasında)
    if (this.phase !== "aim") return;
    this._respawnCue();
  }

  _seatsChanged() {
    this.down = false;
    this.charge = 0;
  }

  _canShoot(pid) {
    return this.phase === "aim" && !this.meta.winner && this.seatOf(pid) === this.turn;
  }

  _pad(pid, it) {
    if (this.seatOf(pid) !== this.turn) return;
    this.aimPoint = { x: clamp(num(it.x), -22, 22), z: clamp(num(it.z), -14, 14) };
  }

  _padBtn(pid, it) {
    if (this.seatOf(pid) !== this.turn) return;
    if (this.phase !== "aim" || this.meta.winner) return;
    if (it.down) {
      this.down = true;
      this.charge = 0;
    } else if (this.down) {
      this.down = false;
      const power = this.charge;
      this.charge = 0;
      if (power > 0.03) this.shoot(power);
      else this._publish();
    }
  }

  // ───────── Vuruş ─────────
  _aimDir() {
    const c = this.balls[0].body.translation();
    const dx = this.aimPoint.x - c.x;
    const dz = this.aimPoint.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) return null;
    return { x: dx / d, z: dz / d };
  }

  shoot(power, dirOverride = null) {
    const dir = dirOverride || this._aimDir();
    const cue = this.balls[0]?.body;
    if (!dir || !cue) return;
    const speed = 5 + (POOL.MAX_SPEED - 5) * Math.pow(clamp(power, 0, 1), 1.25);
    cue.setLinvel({ x: dir.x * speed, y: 0, z: dir.z * speed }, true);
    this.phase = "roll";
    this.pottedShot = [];
    this.firstHit = null;
    this.cuePotted = false;
    this.restT = 0;
    this.rollT = 0;
    this.msg = "";
    this.host.sound?.("shot");
    this._hideCue();
    this._publish();
  }

  _hideCue() {
    this.cue?.body?.setNextKinematicTranslation({ x: 0, y: -40, z: 0 });
  }

  _updateCue(dt) {
    const body = this.cue?.body;
    const cueBall = this.balls[0]?.body;
    if (!body || !cueBall) return;
    const aiming = this.phase === "aim" && !this.meta.winner && this.meta.seats[this.turn] !== null;
    const dir = aiming ? this._aimDir() : null;
    if (!dir) return this._hideCue();
    const c = cueBall.translation();
    const pull = this.down ? this.charge * 6 : 0;
    const gap = POOL.BALL_R + 0.5 + pull;
    // Istaka: ucu beyaz topun arkasında, yönü nişan doğrultusunda
    const cx = c.x - dir.x * (gap + POOL.CUE_LEN / 2);
    const cz = c.z - dir.z * (gap + POOL.CUE_LEN / 2);
    body.setNextKinematicTranslation({ x: cx, y: POOL.BALL_R + 0.55, z: cz });
    const th = Math.atan2(-dir.z, dir.x);
    body.setNextKinematicRotation({ x: 0, y: Math.sin(th / 2), z: 0, w: Math.cos(th / 2) });
  }

  // ───────── Kare döngüsü ─────────
  step(dt) {
    if (!this.balls[0]?.body) return;
    // Güç yükleme
    if (this.down && this.phase === "aim") {
      this.charge = Math.min(1, this.charge + dt / 1.15);
      this.lastPowerSent += dt;
      if (this.lastPowerSent > 0.08) {
        this.lastPowerSent = 0;
        this._publish();
      }
    }
    // Bot
    if (this.phase === "aim" && !this.meta.winner && this.meta.seats[this.turn] === BOT) {
      this.botT += dt;
      if (this.botT > 1.4) {
        this.botT = 0;
        this._botShoot();
      }
    } else this.botT = 0;
    this._updateCue(dt);
  }

  _inPlay(n) {
    return !this.potted.includes(n) && !(n === 0 && this.cuePotted);
  }

  post(dt = 1 / 60) {
    if (!this.balls[0]?.body) return;
    const R = POOL.BALL_R;
    let maxSp = 0;
    for (let n = 0; n <= 15; n++) {
      if (!this._inPlay(n)) continue;
      const b = this.balls[n].body;
      const p = b.translation();
      const v = b.linvel();
      let vx = v.x;
      let vz = v.z;
      let sp = Math.hypot(vx, vz);

      // Cep
      for (const k of POCKETS) {
        if (Math.hypot(p.x - k.x, p.z - k.z) < k.r) {
          this._pot(n);
          sp = 0;
          break;
        }
      }
      if (!this._inPlay(n)) continue;

      // Sürtünme: sabit + hızla orantılı (hızlı top uzun, yavaş top çabuk durur)
      if (sp > 0) {
        const ns = Math.max(0, sp - (0.7 + 0.32 * sp) * dt);
        const f = ns / sp;
        vx *= f;
        vz *= f;
        sp = ns;
        if (sp < 0.04) {
          vx = 0;
          vz = 0;
          sp = 0;
        }
      }
      if (sp > POOL.MAX_SPEED) {
        vx *= POOL.MAX_SPEED / sp;
        vz *= POOL.MAX_SPEED / sp;
        sp = POOL.MAX_SPEED;
      }
      // Güvenlik: bantların dışına çıkmasın (cep ağızları hariç)
      let { x, z } = p;
      let fix = false;
      const nearPocket = POCKETS.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 2.2);
      if (!nearPocket) {
        const lx = POOL.HX - R;
        const lz = POOL.HZ - R;
        if (Math.abs(x) > lx + 0.3) { x = clamp(x, -lx, lx); vx = -vx * 0.6; fix = true; }
        if (Math.abs(z) > lz + 0.3) { z = clamp(z, -lz, lz); vz = -vz * 0.6; fix = true; }
      }
      b.setLinvel({ x: vx, y: 0, z: vz }, true);
      // Yuvarlanma: açısal hız hızla uyumlu (kayma yok)
      b.setAngvel({ x: vz / R, y: 0, z: -vx / R }, true);
      if (fix) b.setTranslation({ x, y: p.y, z }, true);
      maxSp = Math.max(maxSp, sp);
    }

    if (this.phase === "roll") {
      this.rollT += dt;
      // İlk temas: beyaz top ilk hangi topa değdi
      if (this.firstHit === null && !this.cuePotted) {
        const c = this.balls[0].body.translation();
        for (let n = 1; n <= 15; n++) {
          if (!this._inPlay(n)) continue;
          const q = this.balls[n].body.translation();
          if (Math.hypot(c.x - q.x, c.z - q.z) < POOL.BALL_R * 2 + 0.05) {
            this.firstHit = n;
            break;
          }
        }
      }
      this.restT = maxSp < 0.12 ? this.restT + dt : 0;
      if (this.restT > 0.5 || this.rollT > 30) this._endShot();
    }
  }

  _pot(n) {
    const b = this.balls[n].body;
    this.host.sound?.("goal");
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (n === 0) {
      this.cuePotted = true;
      b.setBodyType(this.R.RigidBodyType.Fixed, true);
      b.setTranslation({ x: 0, y: -20, z: 0 }, true);
      this.host.touch?.(this.balls[0]);
      return;
    }
    this.potted.push(n);
    this.pottedShot.push(n);
    b.setBodyType(this.R.RigidBodyType.Fixed, true);
    // Cep tepsisi: alt kenarda sıra sıra
    const k = this.trayCount++;
    b.setTranslation({ x: -15 + (k % 15) * 1.45, y: POOL.BALL_R, z: TRAY_Z + 0.2 }, true);
    this.host.touch?.(this.balls[n]);
  }

  _respawnCue() {
    const cue = this.balls[0]?.body;
    if (!cue) return;
    let x = POOL.HEAD_X;
    const free = (px) => {
      for (let n = 1; n <= 15; n++) {
        if (!this._inPlay(n)) continue;
        const q = this.balls[n].body.translation();
        if (Math.hypot(px - q.x, 0 - q.z) < POOL.BALL_R * 2 + 0.1) return false;
      }
      return true;
    };
    for (let i = 0; i < 10 && !free(x); i++) x -= 1.6;
    this.cuePotted = false;
    cue.setBodyType(this.R.RigidBodyType.Dynamic, true);
    cue.setTranslation({ x, y: POOL.BALL_R, z: 0 }, true);
    cue.setLinvel({ x: 0, y: 0, z: 0 }, true);
    cue.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.host.touch?.(this.balls[0]);
  }

  remaining(g) {
    let c = 0;
    for (let n = 1; n <= 15; n++) if (groupOf(n) === g && !this.potted.includes(n)) c++;
    return c;
  }

  _endShot() {
    const me = this.turn;
    const other = 1 - me;
    const open = !this.groups[me];
    const pottedNow = this.pottedShot.slice();
    const eight = pottedNow.includes(8);
    let foul = false;
    let why = "";

    if (this.cuePotted) {
      foul = true;
      why = "Beyaz top cebe girdi";
    } else if (this.firstHit === null) {
      foul = true;
      why = "Hiçbir topa değmedi";
    } else if (!open) {
      const mineLeft = this.remaining(this.groups[me]) + pottedNow.filter((n) => groupOf(n) === this.groups[me]).length;
      // Vuruş öncesinde grubunda kaç top vardı: şimdiki kalan + bu vuruşta sokulanlar
      const target = mineLeft === 0 ? "8" : this.groups[me];
      const hitG = this.firstHit === 8 ? "8" : groupOf(this.firstHit);
      if (hitG !== target) {
        foul = true;
        why = "Önce yanlış topa vurdun";
      }
    } else if (this.firstHit === 8) {
      foul = true;
      why = "Açılışta 8 numaraya ilk vurulmaz";
    }

    if (eight) {
      const ownLeft = open ? 99 : this.remaining(this.groups[me]);
      const legal = !foul && ownLeft === 0;
      const winner = legal ? me : other;
      this.phase = "over";
      this.msg = legal ? "8 numara sokuldu: kazandın!" : `8 numara erken/faulle sokuldu: ${winner === me ? "" : "rakip kazandı"}`;
      this.meta = { ...this.meta, winner };
      this.host.sound?.("win");
      if (this.cuePotted) this._respawnCue();
      this._hideCue();
      this._publish();
      return;
    }

    // Grup ataması
    if (open && !foul) {
      const first = pottedNow.find((n) => n !== 8);
      if (first) {
        const g = groupOf(first);
        this.groups[me] = g;
        this.groups[other] = g === "s" ? "t" : "s";
      }
    }
    const myG = this.groups[me];
    const scored = !foul && pottedNow.some((n) => n !== 8 && (!myG || groupOf(n) === myG));

    if (this.cuePotted) this._respawnCue();
    this.phase = "aim";
    if (foul) {
      this.turn = other;
      this.msg = `Faul: ${why}. Sıra rakipte.`;
    } else if (scored) {
      this.msg = "Güzel vuruş, sıra sende.";
    } else {
      this.turn = other;
      this.msg = "Sıra rakibe geçti.";
    }
    this.pottedShot = [];
    this.firstHit = null;
    this._publish();
  }

  // ───────── Bot ─────────
  _botShoot() {
    const cue = this.balls[0].body.translation();
    const me = this.turn;
    const myG = this.groups[me];
    const left = myG ? this.remaining(myG) : 99;
    const targets = [];
    for (let n = 1; n <= 15; n++) {
      if (!this._inPlay(n)) continue;
      if (!myG) {
        if (n !== 8) targets.push(n);
      } else if (left === 0 ? n === 8 : groupOf(n) === myG) targets.push(n);
    }
    if (!targets.length) {
      for (let n = 1; n <= 15; n++) if (this._inPlay(n)) targets.push(n);
    }
    const others = [];
    for (let n = 1; n <= 15; n++) if (this._inPlay(n)) others.push({ n, ...this.balls[n].body.translation() });

    const clear = (ax, az, bx, bz, skip) => {
      // a→b doğrusu üzerinde başka top var mı
      const dx = bx - ax;
      const dz = bz - az;
      const L2 = dx * dx + dz * dz || 1;
      for (const o of others) {
        if (skip.includes(o.n)) continue;
        const t = clamp(((o.x - ax) * dx + (o.z - az) * dz) / L2, 0, 1);
        if (Math.hypot(ax + dx * t - o.x, az + dz * t - o.z) < POOL.BALL_R * 2 * 0.98) return false;
      }
      return true;
    };

    let best = null;
    for (const n of targets) {
      const tp = this.balls[n].body.translation();
      for (const k of POCKETS) {
        const tx = k.x - tp.x;
        const tz = k.z - tp.z;
        const td = Math.hypot(tx, tz) || 1;
        const gx = tp.x - (tx / td) * POOL.BALL_R * 2;
        const gz = tp.z - (tz / td) * POOL.BALL_R * 2;
        const cx = gx - cue.x;
        const cz = gz - cue.z;
        const cd = Math.hypot(cx, cz) || 1;
        // kesme açısı: beyazın gidiş yönü ile hedef→cep yönü arası
        const cos = (cx * tx + cz * tz) / (cd * td);
        if (cos < 0.35) continue;
        if (!clear(cue.x, cue.z, gx, gz, [n]) || !clear(tp.x, tp.z, k.x, k.z, [n])) continue;
        const score = cd + td * 1.2 + (1 - cos) * 30;
        if (!best || score < best.score) best = { score, dx: cx / cd, dz: cz / cd, cd, td };
      }
    }
    let dir;
    let power;
    if (best) {
      dir = { x: best.dx, z: best.dz };
      power = clamp((8 + 1.0 * best.cd + 1.6 * best.td) / POOL.MAX_SPEED, 0.2, 0.85);
    } else {
      // Kesin atış yok: en yakın hedefe düz vur
      const n = targets.sort((a, b) => {
        const pa = this.balls[a].body.translation();
        const pb = this.balls[b].body.translation();
        return Math.hypot(pa.x - cue.x, pa.z - cue.z) - Math.hypot(pb.x - cue.x, pb.z - cue.z);
      })[0];
      const tp = this.balls[n].body.translation();
      const d = Math.hypot(tp.x - cue.x, tp.z - cue.z) || 1;
      dir = { x: (tp.x - cue.x) / d, z: (tp.z - cue.z) / d };
      power = 0.45;
    }
    // Bot hatası: ±1.6°
    const err = rnd(-0.028, 0.028);
    const c = Math.cos(err);
    const s = Math.sin(err);
    dir = { x: dir.x * c - dir.z * s, z: dir.x * s + dir.z * c };
    this.aimPoint = { x: cue.x + dir.x * 6, z: cue.z + dir.z * 6 };
    this.shoot(power, dir);
  }
}
