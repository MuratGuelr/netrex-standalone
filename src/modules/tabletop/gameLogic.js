/**
 * 🏒⚽ Air Hockey ve Langırt (HOST tarafı fizik + kurallar) ve tüm oyunların kayıt defteri
 *
 * Ortak taban: gameBase.js · Bilardo: poolGame.js · Bowling: bowlingGame.js
 * Bu dosyada three.js YOK ve rapier'ı kendisi içe aktarmaz (host `host.RAPIER` ile verir).
 *
 * Langırt/Air Hockey niyetleri: seat, pad {x,z}, padBtn {down}, rodSel {n}, serve, gameReset.
 */
import { BaseGame, BOT, TEAM_COLORS, TEAM_NAMES, GAME_TYPES, GAME_INFO, isGameType, initialGameMeta, cleanGameMeta, clamp, num, rnd } from "./gameBase.js";
import { PoolGame, cleanPoolSpec } from "./poolGame.js";
import { BowlingGame, cleanBowlSpec } from "./bowlingGame.js";

export { BOT, TEAM_COLORS, TEAM_NAMES, GAME_TYPES, GAME_INFO, isGameType, initialGameMeta, cleanGameMeta };

// ───────────────── Ölçüler (birim ≈ 1 cm; masa 40×26) ─────────────────
export const AH = {
  HX: 17, // saha yarı uzunluk (kale çizgisi)
  HZ: 10.5, // saha yarı genişlik
  GOAL_W: 7.6, // kale ağzı
  POCKET: 2, // kale arkası cep derinliği
  PUCK_R: 1.05,
  PUCK_H: 0.5, // sadece görünüm: fizikte disk ve raket aynı yükseklikte KÜRE (silindir çarpışması derin geçmede temas üretmiyor)
  PAD_R: 1.7,
  PAD_H: 0.9,
  Y: 1.05, // disk ve raket merkez yüksekliği (görünüm bunu yere indirir)
  TARGET: 7,
  PAD_SPEED: 95, // maksimum raket hızı (birim/sn)
  BOT_SPEED: 58,
  PUCK_MAX: 80,
};

const FB_KINDS = ["gk", "def", "mid", "att"];
export const FB = {
  HX: 17,
  HZ: 10,
  GOAL_W: 5.8,
  POCKET: 2,
  BALL_R: 0.9,
  PIV_Y: 3.4, // çubuğun yerden yüksekliği
  FOOT_HX: 0.5,
  FOOT_HY: 1.5,
  FOOT_HZ: 0.5,
  FOOT_CY: -1.7, // oyuncu bloğunun çubuğa göre merkezi
  TARGET: 7,
  SLIDE_SPEED: 52,
  BALL_MAX: 85,
  KINDS: FB_KINDS,
};

// Soldan sağa 8 çubuk (gerçek langırt dizilişi). team 0 = sol takım (+x yönüne vurur), team 1 = sağ takım.
const ROD_LAYOUT = [
  [0, "gk", 1, 0],
  [0, "def", 2, 6.2],
  [1, "att", 3, 5.2],
  [0, "mid", 5, 3.6],
  [1, "mid", 5, 3.6],
  [0, "att", 3, 5.2],
  [1, "def", 2, 6.2],
  [1, "gk", 1, 0],
];
export const FB_RODS = ROD_LAYOUT.map(([team, kind, n, s], i) => {
  const reach = FB.HZ - 0.6 - ((n - 1) * s) / 2;
  const lim = kind === "gk" ? Math.min(4.2, reach) : Math.max(0.8, reach);
  return { i, team, kind, n, s, x: -14.4 + i * (28.8 / 7), lim };
});
export const rodPlayerZ = (def, j) => (j - (def.n - 1) / 2) * def.s;


/** Ağdan gelen oyun nesnesi tanımını sınırlar */
export function cleanGameSpec(s) {
  if (!s || typeof s.id !== "string" || s.id.length > 24) return null;
  const part = s.part;
  if (part === "puck" || part === "ball") return { id: s.id, kind: "game", part };
  if (part === "paddle") return { id: s.id, kind: "game", part, team: s.team === 1 ? 1 : 0 };
  if (part === "rod") {
    const ri = Math.round(num(s.ri, -1));
    if (ri < 0 || ri >= FB_RODS.length) return null;
    return { id: s.id, kind: "game", part, ri, team: FB_RODS[ri].team };
  }
  return cleanPoolSpec(s) || cleanBowlSpec(s);
}

// ───────────────── Ortak saha (kale ağızlı dikdörtgen + yuvarlatılmış köşeler) ─────────────────
class RinkGame extends BaseGame {
  /**
   * İki uzun kenar, kale ağızlı iki kısa kenar, cep (kale arkası) duvarları ve 45° köşe pahları.
   * Köşe pahları topun/diskin köşeye saplanıp ulaşılamaz kalmasını önler (gerçek masalarda da vardır).
   */
  _buildWalls({ HX, HZ, GOAL_W, POCKET }, h = 1.5, corner = 3) {
    const lenX = HX + POCKET + 1.5;
    this._wall(lenX, h, 0.5, 0, h, -(HZ + 0.5));
    this._wall(lenX, h, 0.5, 0, h, HZ + 0.5);
    const segHz = (HZ - GOAL_W / 2) / 2;
    const segZ = GOAL_W / 2 + segHz;
    for (const sx of [-1, 1]) {
      this._wall(0.5, h, segHz + 0.5, sx * (HX + 0.5), h, segZ);
      this._wall(0.5, h, segHz + 0.5, sx * (HX + 0.5), h, -segZ);
      // cep: yan duvarlar + arka duvar
      this._wall(POCKET / 2 + 0.5, h, 0.5, sx * (HX + POCKET / 2 + 0.5), h, GOAL_W / 2 + 0.5);
      this._wall(POCKET / 2 + 0.5, h, 0.5, sx * (HX + POCKET / 2 + 0.5), h, -(GOAL_W / 2 + 0.5));
      this._wall(0.5, h, GOAL_W / 2 + 1, sx * (HX + POCKET + 0.5), h, 0);
      // köşe pahı: iç yüzü (HX-c,±HZ)–(HX,±(HZ-c)) doğrusunda
      for (const sz of [-1, 1]) {
        const t = 0.5;
        const mx = sx * (HX - corner / 2);
        const mz = sz * (HZ - corner / 2);
        this._wall(corner * Math.SQRT1_2 + 0.5, h, t, mx + sx * t * Math.SQRT1_2, h, mz + sz * t * Math.SQRT1_2, (sx * sz > 0 ? 1 : -1) * (Math.PI / 4));
      }
    }
  }
}

// ───────────────── Air Hockey ─────────────────
export class AirHockeyGame extends RinkGame {
  constructor(host) {
    super("airhockey", host);
    this.puck = null;
    this.pads = [null, null];
    this.botT = [0, 0];
    this.pinT = [0, 0];
  }

  get homeX() {
    return AH.HX - 4.2;
  }

  /** Host: duvarları ve nesneleri kur */
  build() {
    this._buildWalls(AH, 1.5);
    const puck = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "puck" }, [0, AH.Y, 0], null);
    this.puck = puck;
    for (let s = 0; s < 2; s++) {
      const home = { x: (s === 0 ? -1 : 1) * this.homeX, z: 0 };
      const o = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "paddle", team: s }, [home.x, AH.Y, 0], null);
      this.pads[s] = { o, home, target: { ...home } };
    }
    this.host.onMeta?.();
  }

  buildBody(o, pos) {
    const R = this.R;
    const w = this.host.world;
    const spec = o.spec;
    if (spec.part === "puck") {
      const body = w.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(pos[0], pos[1], pos[2])
          .setLinearDamping(0.05)
          .setCcdEnabled(true)
          .enabledTranslations(true, false, true)
          .enabledRotations(false, true, false),
      );
      o.collider = w.createCollider(
        R.ColliderDesc.ball(AH.PUCK_R)
          .setRestitution(0.92)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Max)
          .setFriction(0)
          .setFrictionCombineRule(R.CoefficientCombineRule.Min)
          .setDensity(1),
        body,
      );
      return body;
    }
    const body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]).setCanSleep(false));
    o.collider = w.createCollider(R.ColliderDesc.ball(AH.PAD_R).setRestitution(0.4).setFriction(0), body);
    return body;
  }

  _pad(pid, it) {
    const s = this.seatOf(pid);
    if (s < 0 || !this.pads[s]) return;
    this.pads[s].target = { x: clamp(num(it.x), -AH.HX, AH.HX), z: clamp(num(it.z), -AH.HZ, AH.HZ) };
  }

  _padBtn() {}

  _zone(s) {
    const lo = AH.PAD_R + 0.4;
    return s === 0 ? { x0: -AH.HX + lo, x1: -0.6 } : { x0: 0.6, x1: AH.HX - lo };
  }

  _botTarget(s) {
    const sd = s === 0 ? -1 : 1;
    const puck = this.puck?.body;
    const home = this.pads[s].home;
    if (!puck) return home;
    const p = puck.translation();
    const v = puck.linvel();
    const onMySide = p.x * sd > 0.5;
    if (onMySide && Math.abs(v.x) + Math.abs(v.z) < 14) return { x: p.x, z: p.z }; // yavaş disk: üstüne git ve vur
    if (onMySide) return { x: home.x, z: clamp(p.z + v.z * 0.12, -AH.HZ + 2, AH.HZ - 2) }; // hızlı disk: kaleyi savun
    return { x: home.x, z: clamp(p.z * 0.6, -AH.HZ + 2.5, AH.HZ - 2.5) };
  }

  step(dt) {
    if (!this.puck?.body) return;
    for (let s = 0; s < 2; s++) {
      const pad = this.pads[s];
      const body = pad?.o?.body;
      if (!body) continue;
      const seat = this.meta.seats[s];
      let tgt = seat === BOT ? this._botTarget(s) : seat === null ? pad.home : pad.target;
      const z = this._zone(s);
      tgt = {
        x: clamp(tgt.x, z.x0, z.x1),
        z: clamp(tgt.z, -AH.HZ + AH.PAD_R + 0.2, AH.HZ - AH.PAD_R - 0.2),
      };
      const p = body.translation();
      const dx = tgt.x - p.x;
      const dz = tgt.z - p.z;
      const dist = Math.hypot(dx, dz);
      const maxStep = (seat === BOT ? AH.BOT_SPEED : AH.PAD_SPEED) * dt;
      const k = dist > maxStep ? maxStep / dist : 1;
      body.setNextKinematicTranslation({ x: p.x + dx * k, y: p.y, z: p.z + dz * k });
    }
    if (this.pauseT > 0 && this.pauseT !== Infinity) {
      this.pauseT -= dt;
      if (this.pauseT <= 0) {
        this.pauseT = 0;
        this.setMeta({ pause: false });
        this._serve(this.loser, false);
      }
    }
  }

  post(dt = 1 / 60) {
    const body = this.puck?.body;
    if (!body || this.meta.pause) return;
    const R = AH.PUCK_R;
    const p = body.translation();
    const v = body.linvel();
    let { x, z } = p;
    let { x: vx, z: vz } = v;
    let fix = false;

    // Gol: disk kale çizgisini aştı ve ağız içinde
    if (Math.abs(x) > AH.HX + 0.1 && Math.abs(z) < AH.GOAL_W / 2) {
      this._score(x < 0 ? 1 : 0);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setBodyType(this.R.RigidBodyType.Fixed, true);
      return;
    }
    // Sızma koruması (kinematik raket sıkıştırırsa disk duvarın dışına çıkmasın)
    const zl = AH.HZ - R;
    if (z > zl) { z = zl; if (vz > 0) vz = -vz * 0.85; fix = true; }
    else if (z < -zl) { z = -zl; if (vz < 0) vz = -vz * 0.85; fix = true; }
    if (Math.abs(z) > AH.GOAL_W / 2 + 0.05 && Math.abs(x) > AH.HX - R) {
      const lim = AH.HX - R;
      x = clamp(x, -lim, lim);
      if (x * vx > 0) vx = -vx * 0.85;
      fix = true;
    }
    const xl = AH.HX + AH.POCKET - R;
    if (Math.abs(x) > xl) { x = clamp(x, -xl, xl); vx = -vx * 0.5; fix = true; }
    const sp = Math.hypot(vx, vz);
    if (sp > AH.PUCK_MAX) { vx *= AH.PUCK_MAX / sp; vz *= AH.PUCK_MAX / sp; fix = true; }

    // Raketle duvar arasında sıkışan disk: kısa süre sonra duvar boyunca (kaçabileceği yöne) fırlar
    for (let s = 0; s < 2; s++) {
      const pb = this.pads[s]?.o?.body;
      if (!pb) continue;
      const q = pb.translation();
      const dx = x - q.x;
      const dz = z - q.z;
      const d = Math.hypot(dx, dz);
      const sum = AH.PAD_R + R;
      if (d < sum - 0.7) {
        this.pinT[s] += dt;
        if (this.pinT[s] > 0.2) {
          let ux = d > 0.01 ? dx / d : 0;
          let uz = d > 0.01 ? dz / d : 0;
          const inGap = Math.abs(z) < AH.GOAL_W / 2;
          if (!inGap && ((x > AH.HX - R - 0.4 && ux > 0) || (x < -(AH.HX - R - 0.4) && ux < 0))) ux = 0;
          if ((z > AH.HZ - R - 0.4 && uz > 0) || (z < -(AH.HZ - R - 0.4) && uz < 0)) uz = 0;
          let m = Math.hypot(ux, uz);
          if (m < 0.25) { ux = -x; uz = -z; m = Math.hypot(ux, uz) || 1; }
          ux /= m; uz /= m;
          x = q.x + ux * sum * 1.03;
          z = q.z + uz * sum * 1.03;
          vx = ux * 14;
          vz = uz * 14;
          fix = true;
          this.pinT[s] = 0;
        }
      } else this.pinT[s] = 0;
    }
    if (fix) {
      body.setTranslation({ x: clamp(x, -(AH.HX + AH.POCKET - R), AH.HX + AH.POCKET - R), y: p.y, z: clamp(z, -zl, zl) }, true);
      body.setLinvel({ x: vx, y: 0, z: vz }, true);
    }
  }

  _serve(toSide, force) {
    const body = this.puck?.body;
    if (!body) return;
    if (this.meta.pause && !force && this.pauseT > 0) return;
    body.setBodyType(this.R.RigidBodyType.Dynamic, true);
    const sd = toSide === 0 ? -1 : 1;
    body.setTranslation({ x: sd * 4.5, y: AH.Y, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.pauseT = 0;
    if (this.meta.pause && !this.meta.winner) this.setMeta({ pause: false });
  }
}

// ───────────────── Langırt ─────────────────
export class FoosballGame extends RinkGame {
  constructor(host) {
    super("foosball", host);
    this.ball = null;
    this.rods = [];
    this.seatState = [0, 1].map(() => ({ cursor: { x: 0, z: 0 }, down: false, sel: 0, active: null }));
    this.stuckT = 0;
  }

  build() {
    this._buildWalls(FB, 1.5);
    // Tavan: top zıplayıp çubukların üstüne çıkmasın
    const R = this.R;
    this.colliders.push(this.host.world.createCollider(R.ColliderDesc.cuboid(FB.HX + FB.POCKET + 1, 0.5, FB.HZ + 1).setTranslation(0, 2.75, 0).setFriction(0)));
    this.ball = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "ball" }, [0, FB.BALL_R + 0.02, 0], null);
    this.rods = FB_RODS.map((def) => {
      const o = this.host.addObject({ id: this.host.newId("game"), kind: "game", part: "rod", ri: def.i, team: def.team }, [def.x, FB.PIV_Y, 0], null);
      return { o, def, z: 0, targetZ: 0, theta: 0, phase: "idle", charge: 0, windT: 0, cd: 0 };
    });
    this.host.onMeta?.();
  }

  buildBody(o, pos) {
    const R = this.R;
    const w = this.host.world;
    const spec = o.spec;
    if (spec.part === "ball") {
      const body = w.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2]).setLinearDamping(0.14).setAngularDamping(0.15).setCcdEnabled(true),
      );
      o.collider = w.createCollider(R.ColliderDesc.ball(FB.BALL_R).setRestitution(0.55).setFriction(0.3).setDensity(0.8), body);
      return body;
    }
    const def = FB_RODS[spec.ri];
    const body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1], pos[2]).setCanSleep(false));
    for (let j = 0; j < def.n; j++) {
      w.createCollider(
        R.ColliderDesc.cuboid(FB.FOOT_HX, FB.FOOT_HY, FB.FOOT_HZ).setTranslation(0, FB.FOOT_CY, rodPlayerZ(def, j)).setRestitution(0.35).setFriction(0.2),
        body,
      );
    }
    return body;
  }

  _pad(pid, it) {
    const s = this.seatOf(pid);
    if (s < 0) return;
    this.seatState[s].cursor = { x: clamp(num(it.x), -20, 20), z: clamp(num(it.z), -13, 13) };
  }

  _padBtn(pid, it) {
    const s = this.seatOf(pid);
    if (s < 0) return;
    this.seatState[s].down = !!it.down;
  }

  _rodSel(pid, it) {
    const s = this.seatOf(pid);
    if (s < 0) return;
    this.seatState[s].sel = clamp(Math.round(num(it.n)), 0, 4);
  }

  _seatsChanged() {
    this.seatState.forEach((st) => {
      st.down = false;
      st.active = null;
    });
  }

  _mine(team) {
    return this.rods.filter((r) => r.def.team === team);
  }

  /** İnsan oyuncunun şu an kullandığı çubuk: kilitli tuş > vuruş sürüyorsa aynı > imlece en yakın */
  _activeRod(team) {
    const st = this.seatState[team];
    const mine = this._mine(team);
    if (st.sel) {
      const kind = FB_KINDS[st.sel - 1];
      return mine.find((r) => r.def.kind === kind) || null;
    }
    const cur = st.active != null ? mine.find((r) => r.def.i === st.active) : null;
    if (cur && (cur.phase === "wind" || cur.phase === "swing")) return cur;
    let best = null;
    let bd = Infinity;
    for (const r of mine) {
      const d = Math.abs(r.def.x - st.cursor.x) + (cur && r === cur ? -0.8 : 0); // küçük histerezis: çubuk titremesin
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    st.active = best ? best.def.i : null;
    return best;
  }

  _dir(rod) {
    return rod.def.team === 0 ? 1 : -1;
  }

  _swingBegin(rod, charge, sd = this._dir(rod)) {
    rod.phase = "swing";
    rod.sd = sd; // vuruş yönü (bot, arkasındaki topu geri çekmek için ters yönde de vurabilir)
    rod.charge = clamp(charge, 0, 1);
  }

  _humanInput(team, dt) {
    const st = this.seatState[team];
    const rod = this._activeRod(team);
    if (!rod) return;
    rod.targetZ = clamp(st.cursor.z, -rod.def.lim, rod.def.lim);
    if (st.down && (rod.phase === "idle" || rod.phase === "return")) {
      rod.phase = "wind";
      rod.charge = 0;
      rod.windT = 0;
    }
    if (rod.phase === "wind") {
      rod.windT += dt;
      if (!st.down || rod.windT > 3) this._swingBegin(rod, rod.charge);
    }
  }

  _botInput(team, dt) {
    const ball = this.ball?.body;
    if (!ball) return;
    const b = ball.translation();
    for (const rod of this._mine(team)) {
      rod.cd = Math.max(0, rod.cd - dt);
      // En yakın oyuncu topla hizalansın
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < rod.def.n; j++) {
        const d = Math.abs(rod.z + rodPlayerZ(rod.def, j) - b.z);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      const want = b.z - rodPlayerZ(rod.def, best);
      rod.targetZ = clamp(want, -rod.def.lim, rod.def.lim);
      const front = this._dir(rod) * (b.x - rod.def.x); // topun çubuğun önündeki uzaklığı
      const aligned = Math.abs(rod.z + rodPlayerZ(rod.def, best) - b.z) < 0.75;
      if (rod.phase === "idle" && rod.cd === 0 && aligned) {
        if (front > -0.2 && front < 2.6) {
          rod.theta = -this._dir(rod) * 0.4;
          this._swingBegin(rod, 0.45 + Math.random() * 0.4);
          rod.cd = 0.7;
        }
      }
    }
  }

  step(dt) {
    if (!this.ball?.body) return;
    for (let t = 0; t < 2; t++) {
      const seat = this.meta.seats[t];
      if (seat === BOT) this._botInput(t, dt);
      else if (seat !== null) this._humanInput(t, dt);
    }
    for (const rod of this.rods) {
      const body = rod.o?.body;
      if (!body) continue;
      const dir = this._dir(rod);
      // Kayma
      const dz = clamp(rod.targetZ - rod.z, -FB.SLIDE_SPEED * dt, FB.SLIDE_SPEED * dt);
      rod.z = clamp(rod.z + dz, -rod.def.lim, rod.def.lim);
      // Dönme (vuruş evreleri)
      if (rod.phase === "wind") {
        rod.theta = clamp(rod.theta - dir * 6.5 * dt, -1.05, 1.05);
        rod.charge = Math.min(1, rod.charge + dt / 0.55);
      } else if (rod.phase === "swing") {
        const w = 14 + 17 * rod.charge;
        const sd = rod.sd || dir;
        rod.theta += sd * w * dt;
        if (sd * rod.theta >= 1.15) {
          rod.theta = sd * 1.15;
          rod.phase = "return";
        }
      } else {
        const back = 9 * dt;
        if (Math.abs(rod.theta) <= back) {
          rod.theta = 0;
          rod.phase = "idle";
        } else rod.theta -= Math.sign(rod.theta) * back;
      }
      body.setNextKinematicTranslation({ x: rod.def.x, y: FB.PIV_Y, z: rod.z });
      body.setNextKinematicRotation({ x: 0, y: 0, z: Math.sin(rod.theta / 2), w: Math.cos(rod.theta / 2) });
    }
    if (this.pauseT > 0 && this.pauseT !== Infinity) {
      this.pauseT -= dt;
      if (this.pauseT <= 0) {
        this.pauseT = 0;
        this.setMeta({ pause: false });
        this._serve(this.loser, false);
      }
    }
  }

  post(dt) {
    const body = this.ball?.body;
    if (!body || this.meta.pause) return;
    const R = FB.BALL_R;
    const p = body.translation();
    const v = body.linvel();
    let { x, z } = p;
    let { x: vx, y: vy, z: vz } = v;
    let fix = false;

    if (Math.abs(x) > FB.HX + 0.1 && Math.abs(z) < FB.GOAL_W / 2) {
      this._score(x < 0 ? 1 : 0);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setBodyType(this.R.RigidBodyType.Fixed, true);
      return;
    }
    const zl = FB.HZ - R;
    if (z > zl) { z = zl; if (vz > 0) vz = -vz * 0.6; fix = true; }
    else if (z < -zl) { z = -zl; if (vz < 0) vz = -vz * 0.6; fix = true; }
    if (Math.abs(z) > FB.GOAL_W / 2 + 0.05 && Math.abs(x) > FB.HX - R) {
      const lim = FB.HX - R;
      x = clamp(x, -lim, lim);
      if (x * vx > 0) vx = -vx * 0.6;
      fix = true;
    }
    const xl = FB.HX + FB.POCKET - R;
    if (Math.abs(x) > xl) { x = clamp(x, -xl, xl); vx = -vx * 0.4; fix = true; }
    const sp = Math.hypot(vx, vz);
    if (sp > FB.BALL_MAX) { vx *= FB.BALL_MAX / sp; vz *= FB.BALL_MAX / sp; fix = true; }
    if (p.y > 1.9) { vy = Math.min(vy, 0); fix = true; }
    if (fix) {
      body.setTranslation({ x, y: p.y, z }, true);
      body.setLinvel({ x: vx, y: vy, z: vz }, true);
    }
    // Top bir yerde takılı kaldıysa (köşe, çubuk arası): 4 sn boyunca ~1.4 birimden az hareket ettiyse ortala
    if (!this.meta.winner) {
      if (!this.anchor || Math.hypot(p.x - this.anchor.x, p.z - this.anchor.z) > 1.4) {
        this.anchor = { x: p.x, z: p.z };
        this.stuckT = 0;
      } else {
        this.stuckT += dt;
        if (this.stuckT > 4) {
          this.stuckT = 0;
          this.anchor = null;
          this.host.notice?.("Top takıldı, ortalandı.");
          this._serve(Math.random() < 0.5 ? 0 : 1, true);
        }
      }
    }
  }

  _serve(toSide, force) {
    const body = this.ball?.body;
    if (!body) return;
    if (this.meta.pause && !force && this.pauseT > 0) return;
    body.setBodyType(this.R.RigidBodyType.Dynamic, true);
    const sd = toSide === 0 ? -1 : 1;
    body.setTranslation({ x: 0, y: FB.BALL_R + 0.02, z: rnd(-1.5, 1.5) }, true);
    body.setLinvel({ x: sd * 9, y: 0, z: rnd(-2, 2) }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.pauseT = 0;
    this.stuckT = 0;
    if (this.meta.pause && !this.meta.winner) this.setMeta({ pause: false });
  }
}

export function createGame(type, host) {
  if (type === "airhockey") return new AirHockeyGame(host);
  if (type === "foosball") return new FoosballGame(host);
  if (type === "pool") return new PoolGame(host);
  if (type === "bowling") return new BowlingGame(host);
  return null;
}
