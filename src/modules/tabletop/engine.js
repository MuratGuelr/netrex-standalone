/**
 * 🎲 Masa motoru (3D) — three.js (görüntü) + rapier (fizik)
 *
 * Kontroller Tabletop Simulator'ı örnek alır (resmi bilgi tabanındaki varsayılanlar):
 *   Sol tık: nesneyi al / bırak, hızla bırakırsan FIRLAR (Shift + sol tık: destenin üstündeki kartı al)
 *   Boş yerde sol tık sürükle: KUTU İLE ÇOKLU SEÇİM → seçililerden birini tutunca hepsi birlikte taşınır
 *   Sağ tık (tıklama): bağlam menüsü · Sağ tık sürükle: kamerayı çevir · Orta tuş sürükle: kaydır · Tekerlek: yakınlaş
 *   WASD: kamerayı kaydır · Boşluk: kamerayı sıfırla · Alt: üzerine gelinen kartı büyüt
 *   Elde / üzerinde / seçili: Q-E döndür (15°) · F çevir · R zar at / karıştır · G grupla (desteleri birleştir) · Delete sil · 1-9: kart çek
 *
 * ÖNEMLİ: Bu dosya yalnızca masa açılınca `import()` ile yüklenir; ana pakete GİRMEZ.
 * Yetki modeli: fiziği MASAYI AÇAN kişi (host) hesaplar; diğerleri durumu görür ve host'a "niyet" gönderir.
 * Nesne türleri: die (zar), piece (parça), deck (kart/taş destesi; tek kart = 1'lik deste), board (sabit tahta).
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { Sfx } from "./sfx.js";

// ── Ölçüler (birim ≈ 1 cm) ──
export const TABLE = { w: 40, d: 26 };
const GRAVITY = -60;
const HOLD_Y = 3.4;
const MAX_OBJECTS = 200;
const MAX_HAND = 30;
export const TILE_SLOTS = 24; // ıstaka: 2 sıra × 12 yuva
const MAX_GROUP = 60;
const DIE_SIZE = 2;
const PIECE_R = 1.1;
const PIECE_H = 0.8;
const BOARD_T = 0.2;
const MERGE_DIST = 1.5;
const ROT_STEP = Math.PI / 12; // 15°
const FLIP_MS = 300;
const THROW_MAX = 45; // fırlatma hız sınırı
const OKEY_DEAL = 21; // 101 Okey: herkese 21, başlayana 22

const DIMS = {
  card: { w: 2.6, h: 3.6, t: 0.05, maxT: 2.4, px: [180, 250], edge: 0xe9e4d6, r: 14 },
  tile: { w: 2.3, h: 3.1, t: 0.9, maxT: 4.2, px: [140, 190], edge: 0xdccfa8, r: 16 },
};
const thick = (n, dim) => Math.max(DIMS[dim].t, Math.min(DIMS[dim].maxT, n * DIMS[dim].t));

const FACE_VALUES = { px: 1, nx: 6, py: 2, ny: 5, pz: 3, nz: 4 };

const rnd = (a, b) => a + Math.random() * (b - a);
const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const strList = (v, max = MAX_GROUP) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length <= 24).slice(0, max) : []);

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePipTexture(value) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f4efe2";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = value === 1 ? "#c0392b" : "#1b1b1f";
  const P = { l: 36, c: 64, r: 92 };
  const spots = {
    1: [[P.c, P.c]],
    2: [[P.l, P.l], [P.r, P.r]],
    3: [[P.l, P.l], [P.c, P.c], [P.r, P.r]],
    4: [[P.l, P.l], [P.r, P.l], [P.l, P.r], [P.r, P.r]],
    5: [[P.l, P.l], [P.r, P.l], [P.c, P.c], [P.l, P.r], [P.r, P.r]],
    6: [[P.l, P.l], [P.r, P.l], [P.l, P.c], [P.r, P.c], [P.l, P.r], [P.r, P.r]],
  }[value];
  spots.forEach(([x, y]) => {
    g.beginPath();
    g.arc(x, y, value === 1 ? 18 : 12, 0, Math.PI * 2);
    g.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Masa örtüsü / ahşap için tekrar eden doku (gürültü ile) */
function makeNoiseTexture(base, amp, wood = false) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * amp;
    g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    if (wood) g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 60, 1);
    else g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TableEngine {
  /**
   * @param {HTMLElement} container
   * @param {object} opts
   *   isHost, myId, onIntent(intent), onSnapshot(rows), onResult({id,value,by}),
   *   onChange(update) host · onHand(playerId, cards) host · onHands(counts) · onFullReload() host
   *   onContext(info|null)  — sağ tık menüsü (info: nesne bilgisi + x,y ekran konumu + multi[] seçiliyse)
   *   onPreview(view|null)  — Alt ile kart büyütme
   *   onBox(rect|null)      — kutu seçim dikdörtgeni (ekran koordinatı)
   *   onSelection(ids[])    — seçim değişti
   *   onMeta(meta)          — oyun bilgisi değişti (örn. okey taşı)
   *   onNotice(text)        — kullanıcıya kısa uyarı
   *   isOverHand(x, y)      — bırakılan nokta el şeridi üstünde mi
   *   keysEnabled()         — klavye şu an masaya mı gitsin (paneller açıkken false)
   *   getPlayerIds()        — host: kart dağıtılacak oyuncular
   */
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.isHost = opts.isHost;
    this.objects = new Map();
    this.pipTextures = null;
    this.faceTex = new Map();
    this.imgCache = new Map();
    this.assetTex = new Map();
    this.mod = { name: "", faces: [], assets: {}, table: { color: "#1f5c3a" }, objects: [] };
    this.meta = {}; // oyun bilgisi (örn. { okey: { text, color } })
    this.world = null;
    this.raf = 0;
    this.lastT = 0;
    this.snapAcc = 0;
    this.counter = 0;
    this.nonce = Math.random().toString(36).slice(2, 6);
    this.holds = new Map(); // playerId -> { id, members:[{id,dx,dz,dy}], start, t0, travel, target, yaw, yawDone, prev, vel, hist }
    this.hands = new Map();
    this.handCounts = {};
    this.changed = new Set();
    this.removed = new Set();
    this.sel = new Set(); // yerel seçim (başkalarıyla paylaşılmaz)
    this.hoverId = null;
    this.myHold = null;
    this.disposed = false;
    this.keys = new Set();
    this.altDown = false;
    this.numBuf = "";
    this.numTimer = null;
    this.cam = { theta: 0, phi: 0.95, radius: 38 };
    this.camTarget = new THREE.Vector3(0, 0, 0);
    this.autoCursor = { deck: 0, piece: 0 };
    this.sfx = new Sfx();
    this._qa = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
    this._yAxis = new THREE.Vector3(0, 1, 0);
  }

  async init() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 500;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.touchAction = "none";
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = "none";
    this.container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 400);
    this._updateCamera();

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x303846, 0.95));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
    sun.position.set(12, 40, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera;
    sc.left = -TABLE.w / 2 - 4; sc.right = TABLE.w / 2 + 4; sc.top = TABLE.d / 2 + 4; sc.bottom = -TABLE.d / 2 - 4;
    sc.near = 5; sc.far = 100;
    this.scene.add(sun);

    // Masa: kumaş örtü + ahşap çerçeve (dokulu)
    const feltTex = makeNoiseTexture("#ffffff", 0.06);
    feltTex.repeat.set(10, 6);
    this.feltMat = new THREE.MeshStandardMaterial({ color: 0x1f5c3a, roughness: 0.96, map: feltTex });
    this.feltDefaultMap = feltTex;
    const felt = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 1, TABLE.d), this.feltMat);
    felt.position.y = -0.5;
    felt.receiveShadow = true;
    this.scene.add(felt);
    const woodTex = makeNoiseTexture("#5a3a22", 0.1, true);
    woodTex.repeat.set(6, 1);
    const wood = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTex, roughness: 0.55, metalness: 0.05 });
    const rim = (rw, rd, x, z) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(rw, 1.8, rd, 3, 0.35), wood);
      m.position.set(x, 0.1, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    rim(TABLE.w + 3.6, 1.8, 0, -TABLE.d / 2 - 0.9);
    rim(TABLE.w + 3.6, 1.8, 0, TABLE.d / 2 + 0.9);
    rim(1.8, TABLE.d + 3.6, -TABLE.w / 2 - 0.9, 0);
    rim(1.8, TABLE.d + 3.6, TABLE.w / 2 + 0.9, 0);

    this.raycaster = new THREE.Raycaster();
    this.holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);

    if (this.isHost) {
      await RAPIER.init();
      if (this.disposed) return;
      this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(TABLE.w / 2 + 2, 1, TABLE.d / 2 + 2).setTranslation(0, -1, 0).setFriction(0.9).setRestitution(0.2));
      const wall = (hx, hz, x, z) => this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 8, hz).setTranslation(x, 8, z).setRestitution(0.4));
      wall(TABLE.w / 2 + 2, 0.5, 0, -TABLE.d / 2 - 0.5);
      wall(TABLE.w / 2 + 2, 0.5, 0, TABLE.d / 2 + 0.5);
      wall(0.5, TABLE.d / 2 + 2, -TABLE.w / 2 - 0.5, 0);
      wall(0.5, TABLE.d / 2 + 2, TABLE.w / 2 + 0.5, 0);
    }

    this._bindInput();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.container);

    this.lastT = performance.now();
    const loop = (t) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this._moveCamera(dt);
      if (this.isHost && this.world) this._hostStep(dt);
      else this._remoteStep(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setMuted(m) {
    this.sfx.muted = !!m;
  }

  // ───────────────── Mod / masa örtüsü ─────────────────
  setMod(mod) {
    this.mod = mod;
    this.faceTex.forEach((t) => t.dispose());
    this.faceTex.clear();
    this.assetTex.forEach((t) => t.dispose());
    this.assetTex.clear();
    this.imgCache.clear();
    this._applyTable();
    this.objects.forEach((o) => this._rebuildVisual(o));
  }

  _applyTable() {
    const t = this.mod.table || {};
    if (t.image && this.mod.assets?.[t.image]) {
      this.feltMat.map = this._assetTexture(t.image);
      this.feltMat.color.set("#ffffff");
    } else {
      this.feltMat.map = this.feltDefaultMap;
      this.feltMat.color.set(t.color || "#1f5c3a");
    }
    this.feltMat.needsUpdate = true;
  }

  _loadImage(key) {
    if (this.imgCache.has(key)) return this.imgCache.get(key);
    const src = this.mod.assets?.[key];
    const p = new Promise((resolve, reject) => {
      if (!src) return reject(new Error("görsel yok"));
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    p.catch(() => {});
    this.imgCache.set(key, p);
    return p;
  }

  _assetTexture(key) {
    if (this.assetTex.has(key)) return this.assetTex.get(key);
    const tex = new THREE.Texture();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.assetTex.set(key, tex);
    this._loadImage(key)
      .then((img) => {
        if (this.disposed) return;
        tex.image = img;
        tex.needsUpdate = true;
      })
      .catch(() => {});
    return tex;
  }

  /** Kart/taş yüzü dokusu (yuvarlak köşeli; görsel yüklendikçe güncellenir) */
  _faceTexture(idx, dim) {
    const key = `${dim}:${idx}`;
    if (this.faceTex.has(key)) return this.faceTex.get(key);
    const f = this.mod.faces?.[idx] || { color: "#ffffff" };
    const [W, H] = DIMS[dim].px;
    const R = DIMS[dim].r;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const draw = (img) => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, W, H);
      g.save();
      g.beginPath();
      g.roundRect(0, 0, W, H, R);
      g.clip();
      g.fillStyle = f.color || "#ffffff";
      g.fillRect(0, 0, W, H);
      if (img) {
        const s = Math.max(W / img.width, H / img.height);
        const iw = img.width * s;
        const ih = img.height * s;
        g.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      }
      if (f.text) {
        let size = Math.round(H * 0.34);
        g.textAlign = "center";
        g.textBaseline = "middle";
        do {
          g.font = `bold ${size}px sans-serif`;
          size -= 4;
        } while (g.measureText(f.text).width > W * 0.84 && size > 12);
        if (img) {
          g.lineWidth = Math.max(3, size / 8);
          g.strokeStyle = "rgba(0,0,0,0.65)";
          g.strokeText(f.text, W / 2, H / 2);
        }
        g.fillStyle = f.textColor || "#111111";
        g.fillText(f.text, W / 2, H / 2);
      }
      g.restore();
      g.strokeStyle = "rgba(0,0,0,0.28)";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(1.5, 1.5, W - 3, H - 3, R);
      g.stroke();
      tex.needsUpdate = true;
    };
    draw(null);
    if (f.image) {
      this._loadImage(f.image)
        .then((img) => {
          if (!this.disposed) draw(img);
        })
        .catch(() => {});
    }
    this.faceTex.set(key, tex);
    return tex;
  }

  getFaceView(idx) {
    const f = this.mod.faces?.[idx] || {};
    return { color: f.color || "#ffffff", text: f.text || "", textColor: f.textColor || "#111111", image: f.image ? this.mod.assets?.[f.image] : undefined };
  }

  // ───────────────── Nesne görselleri ─────────────────
  _getPip() {
    if (!this.pipTextures) this.pipTextures = [1, 2, 3, 4, 5, 6].map(makePipTexture);
    return this.pipTextures;
  }

  _labelTexture(bg, label, fg) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = fg || "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold 84px sans-serif";
    g.fillText(label, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _deckTop(spec) {
    const n = spec.cards.length;
    return spec.up ? spec.cards[n - 1] : spec.back;
  }

  _buildMesh(spec) {
    let mesh;
    if (spec.kind === "die") {
      const t = this._getPip();
      const order = [FACE_VALUES.px, FACE_VALUES.nx, FACE_VALUES.py, FACE_VALUES.ny, FACE_VALUES.pz, FACE_VALUES.nz];
      const mats = order.map((v) => new THREE.MeshStandardMaterial({ map: t[v - 1], roughness: 0.35, metalness: 0.02 }));
      mesh = new THREE.Mesh(new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 3, 0.3), mats);
    } else if (spec.kind === "piece") {
      const base = new THREE.MeshStandardMaterial({ color: spec.color || "#e74c3c", roughness: 0.4, metalness: 0.15 });
      const topMat = spec.label ? new THREE.MeshStandardMaterial({ map: this._labelTexture(spec.color || "#e74c3c", spec.label, spec.labelColor), roughness: 0.4 }) : base;
      if (spec.shape === "cube") {
        const s = PIECE_R * 1.5;
        mesh = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 3, 0.15), [base, base, topMat, base, base, base]);
      } else {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(PIECE_R, PIECE_R * 1.04, PIECE_H, 32), [base, topMat, base]);
      }
    } else if (spec.kind === "deck") {
      mesh = new THREE.Mesh(this._deckGeometry(spec), this._deckMaterials(spec));
    } else if (spec.kind === "board") {
      const mat = new THREE.MeshStandardMaterial({ color: spec.color || "#cbb58a", roughness: 0.85 });
      const side = new THREE.MeshStandardMaterial({ color: "#6b5436", roughness: 0.8 });
      if (spec.image && this.mod.assets?.[spec.image]) {
        mat.map = this._assetTexture(spec.image);
        mat.color.set("#ffffff");
      }
      mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, BOARD_T, spec.d), [side, side, mat, side, side, side]);
    }
    mesh.castShadow = spec.kind !== "board";
    mesh.receiveShadow = true;
    mesh.userData.id = spec.id;
    this.scene.add(mesh);
    return mesh;
  }

  _deckGeometry(spec) {
    const d = DIMS[spec.dim];
    const t = thick(spec.cards.length, spec.dim);
    return spec.dim === "tile" ? new RoundedBoxGeometry(d.w, t, d.h, 2, Math.min(0.2, t / 2 - 0.01)) : new THREE.BoxGeometry(d.w, t, d.h);
  }

  _deckMaterials(spec) {
    const side = new THREE.MeshStandardMaterial({ color: DIMS[spec.dim].edge, roughness: 0.8 });
    const opts = spec.dim === "card" ? { alphaTest: 0.5, transparent: false } : {};
    const top = new THREE.MeshStandardMaterial({ map: this._faceTexture(this._deckTop(spec), spec.dim), roughness: 0.55, ...opts });
    const bottom = new THREE.MeshStandardMaterial({ map: this._faceTexture(spec.up ? spec.back : spec.cards[0], spec.dim), roughness: 0.55, ...opts });
    return [side, side, top, bottom, side, side];
  }

  _disposeMesh(mesh) {
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
  }

  _rebuildVisual(o) {
    const spec = o.spec;
    if (spec.kind !== "deck" && spec.kind !== "piece" && spec.kind !== "board") return;
    const keepPos = o.mesh.position.clone();
    const keepQuat = o.mesh.quaternion.clone();
    const oldThick = spec.kind === "deck" ? (o.thickness ?? thick(spec.cards.length, spec.dim)) : 0;
    this.scene.remove(o.mesh);
    this._disposeMesh(o.mesh);
    o.mesh = this._buildMesh(spec);
    o.mesh.position.copy(keepPos);
    o.mesh.quaternion.copy(keepQuat);
    if (spec.kind === "deck") {
      const nt = thick(spec.cards.length, spec.dim);
      o.thickness = nt;
      if (o.body && this.world && Math.abs(nt - oldThick) > 1e-6) {
        if (o.collider) this.world.removeCollider(o.collider, true);
        const d = DIMS[spec.dim];
        o.collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.w / 2, nt / 2, d.h / 2).setRestitution(0.1).setFriction(0.9).setDensity(2), o.body);
        const t = o.body.translation();
        o.body.setTranslation({ x: t.x, y: t.y + (nt - oldThick) / 2, z: t.z }, true);
      }
    }
    this._applyEmissive(o);
  }

  _buildBody(o, pos, quat) {
    const spec = o.spec;
    if (spec.kind === "board") {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos[0], BOARD_T / 2, pos[2]));
      o.collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(spec.w / 2, BOARD_T / 2, spec.d / 2).setFriction(0.9), body);
      o.static = true;
      return body;
    }
    const desc = (spec.locked ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
      .setTranslation(pos[0], pos[1], pos[2]);
    if (!spec.locked) desc.setLinearDamping(0.3).setAngularDamping(0.6).setCcdEnabled(true);
    if (spec.kind === "deck" && !spec.locked) desc.enabledRotations(false, true, false);
    if (quat) desc.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] });
    const body = this.world.createRigidBody(desc);
    let col;
    if (spec.kind === "die") col = RAPIER.ColliderDesc.cuboid(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2).setRestitution(0.35).setFriction(0.7).setDensity(1.2);
    else if (spec.kind === "piece") {
      col = spec.shape === "cube"
        ? RAPIER.ColliderDesc.cuboid(PIECE_R * 0.75, PIECE_R * 0.75, PIECE_R * 0.75)
        : RAPIER.ColliderDesc.cylinder(PIECE_H / 2, PIECE_R);
      col.setRestitution(0.2).setFriction(0.9).setDensity(1.5);
    } else {
      const d = DIMS[spec.dim];
      const t = thick(spec.cards.length, spec.dim);
      col = RAPIER.ColliderDesc.cuboid(d.w / 2, t / 2, d.h / 2).setRestitution(0.1).setFriction(0.9).setDensity(2);
    }
    o.collider = this.world.createCollider(col, body);
    return body;
  }

  // ───────────────── Nesne ekle/çıkar ─────────────────
  _newId(kind) {
    return `${kind[0]}${this.nonce}${(this.counter++).toString(36)}`;
  }

  _addObject(spec, pos, quat) {
    if (this.objects.has(spec.id) || this.objects.size >= MAX_OBJECTS) return null;
    const o = { spec, mesh: null, body: null, collider: null, target: null, rolling: false, restFrames: 0 };
    o.mesh = this._buildMesh(spec);
    if (spec.kind === "deck") o.thickness = thick(spec.cards.length, spec.dim);
    const y = spec.kind === "board" ? BOARD_T / 2 : pos[1];
    o.mesh.position.set(pos[0], y, pos[2]);
    if (quat) o.mesh.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    o.basePos = o.mesh.position.clone();
    o.baseQuat = o.mesh.quaternion.clone();
    if (this.isHost && this.world) o.body = this._buildBody(o, [pos[0], y, pos[2]], quat);
    else if (spec.kind === "board") o.static = true;
    if (spec.locked) o.locked = true;
    this.objects.set(spec.id, o);
    return o;
  }

  _removeObject(id) {
    const o = this.objects.get(id);
    if (!o) return;
    if (this.hoverId === id) {
      this.hoverId = null;
      this._updatePreview();
    }
    if (this.myHold === id) this.myHold = null;
    if (this.sel.delete(id)) this.opts.onSelection?.([...this.sel]);
    this.scene.remove(o.mesh);
    this._disposeMesh(o.mesh);
    if (o.body && this.world) this.world.removeRigidBody(o.body);
    this.objects.delete(id);
  }

  _clearAll() {
    [...this.objects.keys()].forEach((id) => this._removeObject(id));
    this.holds.clear();
  }

  _autoPos(kind) {
    if (kind === "deck") {
      const k = this.autoCursor.deck++;
      return [-8 + (k % 5) * 5, 1, -3 + Math.floor(k / 5) * 5];
    }
    const k = this.autoCursor.piece++;
    return [-12 + (k % 10) * 2.7, 2, 8 + Math.floor(k / 10) * 2.7];
  }

  _instantiate(def) {
    const p = def.pos;
    if (def.kind === "die") {
      const id = this._newId("die");
      const o = this._addObject({ id, kind: "die" }, [rnd(-6, 6), 4 + rnd(0, 2), rnd(-4, 4)], null);
      if (o) {
        o.rolledBy = this.opts.myId;
        this._throw(o);
        o.rolling = false;
      }
    } else if (def.kind === "piece") {
      const pos = p ? [p[0], 2.2, p[1]] : this._autoPos("piece");
      const spec = { id: this._newId("piece"), kind: "piece", color: def.color, shape: def.shape || "cyl", ...(def.label ? { label: def.label, labelColor: def.labelColor } : {}) };
      this._addObject(spec, pos, null);
    } else if (def.kind === "deck") {
      const cards = def.shuffle ? shuffled(def.cards) : def.cards.slice();
      const t = thick(cards.length, def.dim);
      const base = p ? [p[0], 0, p[1]] : this._autoPos("deck");
      this._addObject({ id: this._newId("deck"), kind: "deck", dim: def.dim, cards, back: def.back, up: !!def.up }, [base[0], t / 2 + 0.6, base[2]], null);
    } else if (def.kind === "board") {
      const pos = p ? [p[0], 0, p[1]] : [0, 0, 0];
      this._addObject({ id: this._newId("board"), kind: "board", image: def.image, color: def.color, w: def.w, d: def.d, pos: [pos[0], pos[2]] }, pos, null);
    }
  }

  _setMeta(meta) {
    const m = {};
    const o = meta && typeof meta === "object" ? meta.okey : null;
    if (o && typeof o.text === "string" && typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color)) {
      m.okey = { text: o.text.slice(0, 3), color: o.color };
    }
    this.meta = m;
    this.opts.onMeta?.(m);
  }

  resetForMod(mod) {
    this._clearAll();
    this.hands.clear();
    this.handCounts = {};
    this.sel.clear();
    this.opts.onSelection?.([]);
    this.setMod(mod);
    this._setMeta({});
    this.opts.onHands?.(this.handCounts);
  }

  loadMod(mod) {
    if (!this.isHost) return;
    this._clearAll();
    this.hands.clear();
    this.handCounts = {};
    this.sel.clear();
    this.opts.onSelection?.([]);
    this.autoCursor = { deck: 0, piece: 0 };
    this.setMod(mod);
    this._setMeta({});
    mod.objects.forEach((def) => this._instantiate(def));
    this.opts.onHands?.(this.handCounts);
    this.opts.getPlayerIds?.().forEach((pid) => this.opts.onHand?.(pid, []));
  }

  reset() {
    if (this.isHost) this.loadMod(this.mod);
  }

  spawn(kind, color) {
    if (!this.isHost) return;
    if (kind === "die") {
      const id = this._newId("die");
      const o = this._addObject({ id, kind: "die" }, [rnd(-6, 6), 5, rnd(-4, 4)], null);
      if (o) {
        o.rolledBy = this.opts.myId;
        this._throw(o);
        this.changed.add(id);
      }
    } else {
      const col = typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#e74c3c";
      const id = this._newId("piece");
      this._addObject({ id, kind: "piece", color: col, shape: "cyl" }, [rnd(-8, 8), 3, rnd(-6, 6)], null);
      this.changed.add(id);
    }
  }

  _throw(o) {
    if (!o?.body || o.spec.locked) return;
    o.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    o.body.setTranslation({ x: rnd(-6, 6), y: 5 + rnd(0, 2), z: rnd(-4, 4) }, true);
    o.body.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28))), true);
    o.body.setLinvel({ x: rnd(-16, 16), y: rnd(4, 9), z: rnd(-10, 10) }, true);
    o.body.setAngvel({ x: rnd(-30, 30), y: rnd(-30, 30), z: rnd(-30, 30) }, true);
    o.rolling = true;
    o.restFrames = 0;
  }

  // ───────────────── Desteler ─────────────────
  _deck(id) {
    const o = this.objects.get(id);
    return o && o.spec.kind === "deck" ? o : null;
  }

  _touch(o) {
    this.changed.add(o.spec.id);
    this._rebuildVisual(o);
  }

  _newSingle(src, face, pos, offsetX) {
    const spec = { id: this._newId("deck"), kind: "deck", dim: src.spec.dim, cards: [face], back: src.spec.back, up: src.spec.up };
    const d = DIMS[spec.dim];
    const o = this._addObject(spec, [pos.x + (offsetX ?? d.w * 1.15), pos.y + 0.8, pos.z], null);
    if (o) this.changed.add(spec.id);
    return o;
  }

  _flipDeck(o) {
    o.spec.cards = o.spec.cards.slice().reverse();
    o.spec.up = !o.spec.up;
    o.flipT0 = performance.now();
    this.sfx.flip();
    this._touch(o);
  }

  _hand(pid) {
    if (!this.hands.has(pid)) this.hands.set(pid, []);
    return this.hands.get(pid);
  }

  _syncHand(pid) {
    const h = this._hand(pid);
    this.handCounts[pid] = h.length;
    this.opts.onHand?.(pid, h);
  }

  /** Destenin üstündeki kartı/taşı oyuncunun eline alır. Taşlar ıstakada ilk boş yuvaya girer. */
  _toHand(pid, o) {
    const hand = this._hand(pid);
    const isTile = o.spec.dim === "tile";
    if (hand.length >= (isTile ? TILE_SLOTS : MAX_HAND)) return false;
    const cards = o.spec.cards;
    const entry = { f: cards[cards.length - 1], d: o.spec.dim, b: o.spec.back };
    if (isTile) {
      const used = new Set(hand.map((c) => c.s));
      let s = 0;
      while (used.has(s)) s++;
      if (s >= TILE_SLOTS) return false;
      entry.s = s;
    }
    hand.push(entry);
    cards.pop();
    this.sfx.deal();
    if (!cards.length) {
      this.removed.add(o.spec.id);
      this.changed.delete(o.spec.id);
      this.releaseAllOf(o.spec.id);
      this._removeObject(o.spec.id);
    } else {
      this._touch(o);
    }
    this._syncHand(pid);
    return true;
  }

  _mergeInto(best, o) {
    const mine = o.spec.up === best.spec.up ? o.spec.cards : o.spec.cards.slice().reverse();
    best.spec.cards = best.spec.cards.concat(mine);
    this.removed.add(o.spec.id);
    this.changed.delete(o.spec.id);
    this.releaseAllOf(o.spec.id);
    this._removeObject(o.spec.id);
    this.sfx.deal();
    this._touch(best);
  }

  _tryMerge(o) {
    const spec = o.spec;
    if (!o.body) return;
    const p = o.body.translation();
    let best = null;
    let bestD = MERGE_DIST;
    this.objects.forEach((t) => {
      if (t === o || t.spec.kind !== "deck" || t.spec.dim !== spec.dim || !t.body) return;
      const q = t.body.translation();
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    });
    if (best) this._mergeInto(best, o);
  }

  _rotateY(o, angle) {
    if (!o?.body || o.spec.locked) return;
    const q = o.body.rotation();
    const nq = new THREE.Quaternion().setFromAxisAngle(this._yAxis, angle).multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    o.body.setRotation({ x: nq.x, y: nq.y, z: nq.z, w: nq.w }, true);
  }

  // ───────────────── 101 Okey ─────────────────
  /** Face tablosundan (sayı, renk) → yüz indeksi */
  _tileFace(text, color) {
    return (this.mod.faces || []).findIndex((f) => f.text === text && (f.textColor || "").toLowerCase() === color.toLowerCase());
  }

  /**
   * 101 Okey kurulumu: gösterge taşı açılır (okey = bir üstü, aynı renk, 13→1),
   * herkese 21 taş, başlayana (komutu veren) 22 taş. Kalan taşlar kapalı yığında kalır.
   */
  _deal101(playerId, deckObj) {
    let deck = deckObj;
    if (!deck || deck.spec.dim !== "tile" || deck.spec.cards.length < 60) return this.opts.onNotice?.("Önce tam taş yığınına (106 taş) uygula.");
    const players = (this.opts.getPlayerIds?.() || [playerId]).slice(0, 4);
    if ([...this.hands.values()].some((h) => h.length > 0)) return this.opts.onNotice?.("Eller dolu. Önce Sıfırla ile yeni el kur.");
    if (!players.includes(playerId)) players.unshift(playerId);

    // Gösterge: sahte okey (★) olmasın; gelirse yığının dibine koy
    let gi = -1;
    for (let tries = 0; tries < 20; tries++) {
      const face = deck.spec.cards[deck.spec.cards.length - 1];
      const f = this.mod.faces[face];
      if (f && /^\d+$/.test(f.text || "")) {
        gi = face;
        break;
      }
      deck.spec.cards.unshift(deck.spec.cards.pop());
    }
    if (gi < 0) return this.opts.onNotice?.("Gösterge belirlenemedi.");
    const gf = this.mod.faces[gi];
    const nextNum = (parseInt(gf.text, 10) % 13) + 1;
    deck.spec.cards.pop();
    this._touch(deck);
    const t = deck.body.translation();
    const g = this._addObject(
      { id: this._newId("deck"), kind: "deck", dim: "tile", cards: [gi], back: deck.spec.back, up: true },
      [t.x + 4.2, t.y + 0.8, t.z],
      null,
    );
    if (g) this.changed.add(g.spec.id);
    this.meta = { okey: { text: String(nextNum), color: gf.textColor || "#111111" } };
    this.opts.onMeta?.(this.meta);

    // Dağıtım: herkese 21, başlayana 22
    for (const pid of players) {
      const n = pid === playerId ? OKEY_DEAL + 1 : OKEY_DEAL;
      for (let i = 0; i < n && this.objects.has(deck.spec.id); i++) if (!this._toHand(pid, deck)) break;
    }
    // Yığın boşalmadıysa kapalı kalsın
    return true;
  }

  // ───────────────── Host: niyetleri uygula ─────────────────
  _isHeld(id) {
    for (const h of this.holds.values()) if (h.members.some((m) => m.id === id)) return true;
    return false;
  }

  _targets(intent) {
    const list = strList(intent.ids);
    if (!list.length && typeof intent.id === "string") list.push(intent.id);
    return list.filter((x) => this.objects.has(x));
  }

  applyIntent(playerId, intent) {
    if (!this.isHost || !intent || typeof intent !== "object") return;
    const id = typeof intent.id === "string" ? intent.id : null;
    switch (intent.k) {
      case "grab": {
        let o = id && this.objects.get(id);
        if (!o?.body || o.static || o.spec.locked || this._isHeld(id)) return;
        this.releaseHold(playerId);
        let ids = [id];
        if (Array.isArray(intent.group) && intent.group.length > 1) {
          // Çoklu seçim: seçili hepsi birlikte taşınır
          ids = [id, ...strList(intent.group).filter((x) => x !== id)].filter((x) => {
            const m = this.objects.get(x);
            return m?.body && !m.static && !m.spec.locked && !this._isHeld(x);
          }).slice(0, MAX_GROUP);
        } else if (intent.top && o.spec.kind === "deck" && o.spec.cards.length > 1) {
          // Shift: destenin üstündeki kartı çek ve onu tut
          const face = o.spec.cards.pop();
          const t0 = o.body.translation();
          const single = this._newSingle(o, face, t0, 0);
          this._touch(o);
          if (single) {
            o = single;
            ids = [single.spec.id];
          }
        }
        const t = o.body.translation();
        const members = ids.map((mid) => {
          const mo = this.objects.get(mid);
          const p = mo.body.translation();
          mo.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
          return { id: mid, dx: p.x - t.x, dz: p.z - t.z, dy: clamp(p.y - t.y, -0.6, 0.6) };
        });
        this.holds.set(playerId, {
          id: o.spec.id, members, start: { x: t.x, z: t.z }, t0: performance.now(), travel: 0,
          target: { x: t.x, z: t.z }, yaw: 0, yawDone: 0, prev: { x: t.x, y: t.y, z: t.z }, vel: { x: 0, y: 0, z: 0 }, hist: [],
        });
        break;
      }
      case "move": {
        const h = this.holds.get(playerId);
        if (!h) return;
        h.target = {
          x: clamp(num(intent.x), -TABLE.w / 2 + 1, TABLE.w / 2 - 1),
          z: clamp(num(intent.z), -TABLE.d / 2 + 1, TABLE.d / 2 - 1),
        };
        h.travel = Math.max(h.travel, Math.hypot(h.target.x - h.start.x, h.target.z - h.start.z));
        // Fırlatma hızı için imleç geçmişi (son ~200 ms)
        const now = performance.now();
        h.hist.push({ t: now, x: h.target.x, z: h.target.z });
        while (h.hist.length > 12 || (h.hist.length > 2 && now - h.hist[0].t > 250)) h.hist.shift();
        break;
      }
      case "rot": {
        const dir = intent.d > 0 ? 1 : -1;
        const h = this.holds.get(playerId);
        if (h) h.yaw += dir * ROT_STEP;
        else this._targets(intent).forEach((tid) => this._rotateY(this.objects.get(tid), dir * ROT_STEP));
        break;
      }
      case "release":
        this.releaseHold(playerId);
        break;
      case "toHand": {
        const h = this.holds.get(playerId);
        const o = h ? this._deck(h.id) : id ? this._deck(id) : null;
        this.releaseHold(playerId, o ? o.spec.id : null);
        if (o) {
          this._toHand(playerId, o);
          if (this.objects.has(o.spec.id) && o.body) o.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        }
        break;
      }
      case "roll":
        this._targets(intent).forEach((tid) => {
          const o = this.objects.get(tid);
          if (o?.spec.kind === "die") {
            o.rolledBy = playerId;
            this._throw(o);
          }
        });
        break;
      case "rollAll":
        this.objects.forEach((o) => {
          if (o.spec.kind === "die") {
            o.rolledBy = playerId;
            this._throw(o);
          }
        });
        break;
      case "rand":
        // R tuşu: seçililerde zarlar atılır, desteler karıştırılır
        this._targets(intent).forEach((tid) => {
          const o = this.objects.get(tid);
          if (o?.spec.kind === "die") {
            o.rolledBy = playerId;
            this._throw(o);
          } else if (o?.spec.kind === "deck" && o.spec.cards.length > 1) {
            o.spec.cards = shuffled(o.spec.cards);
            this.sfx.shuffle();
            this._touch(o);
            o.shuffleT0 = performance.now();
          }
        });
        break;
      case "spawn":
        if (intent.kind === "die" || intent.kind === "piece") this.spawn(intent.kind, intent.color);
        break;
      case "remove":
        this._targets(intent).forEach((tid) => {
          const o = this.objects.get(tid);
          if (o && !o.static) {
            this.releaseAllOf(tid);
            this._removeObject(tid);
            this.removed.add(tid);
            this.changed.delete(tid);
          }
        });
        break;
      case "lock": {
        const list = this._targets(intent).filter((tid) => {
          const o = this.objects.get(tid);
          return o?.body && !o.static;
        });
        if (!list.length) break;
        const to = !this.objects.get(list[0]).spec.locked; // ilkinin tersi hepsine uygulanır
        list.forEach((tid) => {
          const o = this.objects.get(tid);
          this.releaseAllOf(tid);
          o.spec.locked = to;
          o.locked = to;
          o.body.setBodyType(to ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic, true);
          this.changed.add(tid);
        });
        break;
      }
      case "reset":
        this.reset();
        this.opts.onFullReload?.();
        return;
      case "flip":
        this._targets(intent).forEach((tid) => {
          const o = this._deck(tid);
          if (o) this._flipDeck(o);
        });
        break;
      case "shuffle": {
        const o = id && this._deck(id);
        if (o && o.spec.cards.length > 1) {
          o.spec.cards = shuffled(o.spec.cards);
          this.sfx.shuffle();
          this._touch(o);
          o.shuffleT0 = performance.now();
        }
        break;
      }
      case "group": {
        // G: seçili desteleri (aynı tür) ilkinin üstünde birleştir
        const decks = this._targets(intent).map((tid) => this._deck(tid)).filter(Boolean);
        if (decks.length < 2) break;
        const base = decks.find((d) => d.spec.dim === decks[0].spec.dim);
        decks.slice(1).forEach((d) => {
          if (d !== base && d.spec.dim === base.spec.dim && this.objects.has(d.spec.id)) this._mergeInto(base, d);
        });
        break;
      }
      case "draw": {
        const o = id && this._deck(id);
        if (!o) break;
        if (intent.toHand) {
          this._toHand(playerId, o);
        } else if (o.spec.cards.length > 1) {
          const face = o.spec.cards.pop();
          const t = o.body.translation();
          this._newSingle(o, face, t);
          this.sfx.deal();
          this._touch(o);
        }
        break;
      }
      case "drawN": {
        const o = id && this._deck(id);
        if (!o) break;
        const n = clamp(Math.round(num(intent.n, 1)), 1, 15);
        for (let i = 0; i < n && this.objects.has(o.spec.id); i++) if (!this._toHand(playerId, o)) break;
        break;
      }
      case "deal": {
        const o = id && this._deck(id);
        if (!o) break;
        const n = clamp(Math.round(num(intent.n, 5)), 1, 15);
        const players = this.opts.getPlayerIds?.() || [playerId];
        for (let i = 0; i < n; i++) {
          for (const pid of players) {
            if (!this.objects.has(o.spec.id)) break;
            this._toHand(pid, o);
          }
        }
        break;
      }
      case "deal101": {
        const o = id && this._deck(id);
        if (o) this._deal101(playerId, o);
        break;
      }
      case "play": {
        const hand = this._hand(playerId);
        const i = Math.round(num(intent.index, -1));
        if (i < 0 || i >= hand.length) break;
        const [c] = hand.splice(i, 1);
        const spec = { id: this._newId("deck"), kind: "deck", dim: c.d, cards: [c.f], back: c.b, up: true };
        const hasPt = Number.isFinite(Number(intent.x)) && Number.isFinite(Number(intent.z));
        const x = hasPt ? clamp(num(intent.x), -TABLE.w / 2 + 1, TABLE.w / 2 - 1) : rnd(-7, 7);
        const z = hasPt ? clamp(num(intent.z), -TABLE.d / 2 + 1, TABLE.d / 2 - 1) : TABLE.d / 2 - 4.5;
        this._addObject(spec, [x, 1.6, z], null);
        this.sfx.deal();
        this.changed.add(spec.id);
        this._syncHand(playerId);
        break;
      }
      case "reorderHand": {
        const hand = this._hand(playerId);
        const from = Math.round(num(intent.from, -1));
        const to = clamp(Math.round(num(intent.to, -1)), 0, Math.max(0, hand.length - 1));
        if (from < 0 || from >= hand.length || to < 0 || from === to) break;
        const [c] = hand.splice(from, 1);
        hand.splice(to, 0, c);
        this._syncHand(playerId);
        break;
      }
      case "slot": {
        // Istaka: taşı başka yuvaya taşı (doluysa yer değiştirir)
        const hand = this._hand(playerId);
        const e = hand[Math.round(num(intent.from, -1))];
        const to = clamp(Math.round(num(intent.to, -1)), 0, TILE_SLOTS - 1);
        if (!e || e.d !== "tile" || e.s === to) break;
        const other = hand.find((c) => c !== e && c.s === to);
        if (other) other.s = e.s;
        e.s = to;
        this._syncHand(playerId);
        break;
      }
      default:
        return;
    }
    this._flush();
  }

  /** Fırlatma hızı: imleç geçmişinden (son ~150 ms). Duraklayıp bırakılırsa 0. */
  _throwVel(h) {
    const now = performance.now();
    const pts = h.hist.filter((p) => now - p.t <= 160);
    if (pts.length >= 2 && now - pts[pts.length - 1].t < 110) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.012) return { x: clamp(((b.x - a.x) / dt) * 0.95, -THROW_MAX, THROW_MAX), z: clamp(((b.z - a.z) / dt) * 0.95, -THROW_MAX, THROW_MAX) };
    }
    return { x: 0, z: 0 };
  }

  /**
   * Tutulanları bırakır. exceptId verilirse o nesne kinematik kalır (çağıran halleder, örn. ele alınan deste).
   */
  releaseHold(playerId, exceptId = null) {
    const h = this.holds.get(playerId);
    if (!h) return;
    this.holds.delete(playerId);
    const objs = h.members.map((m) => this.objects.get(m.id)).filter((o) => o?.body && o.spec.id !== exceptId);
    if (!objs.length) return;
    const click = performance.now() - h.t0 < 350 && h.travel < 0.8; // seçmek için kısa tıklama
    const v = click ? { x: 0, z: 0 } : this._throwVel(h);
    const speed = Math.hypot(v.x, v.z);
    objs.forEach((o) => {
      o.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      if (click) {
        o.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        return;
      }
      o.body.setLinvel({ x: v.x, y: 1.5 + speed * 0.05, z: v.z }, true);
      if (o.spec.kind === "deck") o.body.setAngvel({ x: 0, y: rnd(-1, 1) * speed * 0.18, z: 0 }, true); // kart fırlayınca dönerek kayar
      else o.body.setAngvel({ x: rnd(-4, 4) - v.z * 0.15, y: rnd(-4, 4), z: rnd(-4, 4) + v.x * 0.15 }, true);
      if (o.spec.kind === "die") {
        o.rolling = true;
        o.restFrames = 0;
        o.rolledBy = playerId;
      }
    });
    if (!click && objs.length === 1 && objs[0].spec.kind === "deck") {
      this._tryMerge(objs[0]);
      this._flush();
    }
  }

  /** Bir nesne silinirken tuttuğu elleri kopar; gruptaki diğer üyeler serbest kalır */
  releaseAllOf(id) {
    for (const [pid, h] of [...this.holds]) {
      if (!h.members.some((m) => m.id === id)) continue;
      this.holds.delete(pid);
      h.members.forEach((m) => {
        if (m.id === id) return;
        const o = this.objects.get(m.id);
        if (o?.body) o.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      });
    }
  }

  _flush() {
    if (!this.changed.size && !this.removed.size) return;
    const specs = [];
    const snap = [];
    this.changed.forEach((id) => {
      const o = this.objects.get(id);
      if (!o) return;
      specs.push(o.spec);
      if (o.body && !o.static) {
        const p = o.body.translation();
        const q = o.body.rotation();
        snap.push([id, r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w)]);
      }
    });
    const removed = [...this.removed];
    this.changed.clear();
    this.removed.clear();
    this.opts.onChange?.({ specs, removed, snap, hands: this.handCounts, meta: this.meta });
    this.opts.onHands?.(this.handCounts);
  }

  // ───────────────── Kare döngüsü ─────────────────
  _hostStep(dt) {
    for (const h of this.holds.values()) {
      const o = this.objects.get(h.id);
      if (!o?.body) continue;
      const t = o.body.translation();
      const k = 1 - Math.pow(0.0005, dt);
      const nx = t.x + (h.target.x - t.x) * k;
      const nz = t.z + (h.target.z - t.z) * k;
      const ny = t.y + (HOLD_Y - t.y) * k;
      // Q/E: grubu bir bütün olarak döndür (üyelerin ofsetleri de döner)
      const dyaw = (h.yaw - h.yawDone) * (1 - Math.pow(0.0001, dt));
      const rotating = Math.abs(dyaw) > 1e-4;
      if (rotating) h.yawDone += dyaw;
      const cy = Math.cos(dyaw);
      const sy = Math.sin(dyaw);
      for (const m of h.members) {
        const mo = this.objects.get(m.id);
        if (!mo?.body) continue;
        if (rotating) {
          if (m.id !== h.id) {
            const ox = m.dx * cy + m.dz * sy;
            const oz = -m.dx * sy + m.dz * cy;
            m.dx = ox;
            m.dz = oz;
          }
          const q = mo.body.rotation();
          const nq = new THREE.Quaternion().setFromAxisAngle(this._yAxis, dyaw).multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
          mo.body.setNextKinematicRotation({ x: nq.x, y: nq.y, z: nq.z, w: nq.w });
        }
        mo.body.setNextKinematicTranslation({ x: nx + m.dx, y: ny + m.dy, z: nz + m.dz });
      }
      const inv = dt > 0 ? 1 / dt : 0;
      h.vel = { x: (nx - h.prev.x) * inv * 0.6 + h.vel.x * 0.4, y: (ny - h.prev.y) * inv * 0.6 + h.vel.y * 0.4, z: (nz - h.prev.z) * inv * 0.6 + h.vel.z * 0.4 };
      h.prev = { x: nx, y: ny, z: nz };
    }

    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();

    this.objects.forEach((o) => {
      if (!o.body) return;
      if (!o.static) {
        const p = o.body.translation();
        const q = o.body.rotation();
        o.basePos.set(p.x, p.y, p.z);
        o.baseQuat.set(q.x, q.y, q.z, q.w);
        if (p.y < -15) {
          o.body.setTranslation({ x: 0, y: 6, z: 0 }, true);
          o.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        if (o.spec.kind === "die" && o.rolling) {
          const lv = o.body.linvel();
          const av = o.body.angvel();
          const slow = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z < 0.04 && av.x * av.x + av.y * av.y + av.z * av.z < 0.1;
          o.restFrames = slow && !this._isHeld(o.spec.id) ? o.restFrames + 1 : 0;
          if (o.restFrames > 20) {
            o.rolling = false;
            this.opts.onResult?.({ id: o.spec.id, value: this._topFace(o.baseQuat), by: o.rolledBy || this.opts.myId });
          }
        }
      }
      this._poseMesh(o, dt);
    });

    this.snapAcc += dt;
    if (this.snapAcc >= 1 / 15) {
      this.snapAcc = 0;
      const s = this.getSnapshot(true);
      if (s.length) this.opts.onSnapshot?.(s);
    }
  }

  _remoteStep(dt) {
    this.objects.forEach((o) => {
      if (o.target) {
        o.basePos.lerp(o.target.p, 0.35);
        o.baseQuat.slerp(o.target.q, 0.35);
      }
      this._poseMesh(o, dt);
    });
  }

  /** Fiziksel duruştan görünür duruşu üretir: çevirme/karıştırma animasyonu + çarpma sesi */
  _poseMesh(o, dt) {
    const now = performance.now();
    o.mesh.position.copy(o.basePos);
    o.mesh.quaternion.copy(o.baseQuat);
    if (o.flipT0) {
      const p = (now - o.flipT0) / FLIP_MS;
      if (p >= 1) o.flipT0 = 0;
      else {
        const ang = Math.PI * (1 - easeOut(p));
        o.mesh.quaternion.multiply(this._qa.setFromAxisAngle(this._zAxis, ang));
        o.mesh.position.y += Math.sin(Math.PI * p) * 1.6;
      }
    }
    if (o.shuffleT0) {
      const p = (now - o.shuffleT0) / 380;
      if (p >= 1) o.shuffleT0 = 0;
      else o.mesh.position.x += Math.sin(p * Math.PI * 6) * 0.35 * (1 - p);
    }
    if (!o.static && dt > 0) {
      const vy = (o.basePos.y - (o.prevY ?? o.basePos.y)) / dt;
      if ((o.prevVy ?? 0) < -6 && vy > (o.prevVy ?? 0) * 0.35) {
        const kind = o.spec.kind === "die" ? "die" : o.spec.kind === "deck" && o.spec.dim === "card" ? "card" : "piece";
        this.sfx.hit(Math.min(1, -o.prevVy / 40), kind);
      }
      o.prevY = o.basePos.y;
      o.prevVy = vy;
    }
  }

  _topFace(q) {
    const axes = [
      ["px", new THREE.Vector3(1, 0, 0)], ["nx", new THREE.Vector3(-1, 0, 0)],
      ["py", new THREE.Vector3(0, 1, 0)], ["ny", new THREE.Vector3(0, -1, 0)],
      ["pz", new THREE.Vector3(0, 0, 1)], ["nz", new THREE.Vector3(0, 0, -1)],
    ];
    let best = "py";
    let bestY = -2;
    axes.forEach(([k, v]) => {
      const y = v.clone().applyQuaternion(q).y;
      if (y > bestY) {
        bestY = y;
        best = k;
      }
    });
    return FACE_VALUES[best];
  }

  // ───────────────── Durum aktarımı ─────────────────
  getSnapshot(onlyMoving = false) {
    const out = [];
    const held = new Set();
    for (const h of this.holds.values()) h.members.forEach((m) => held.add(m.id));
    this.objects.forEach((o) => {
      if (!o.body || o.static) return;
      if (onlyMoving && o.body.isSleeping() && !held.has(o.spec.id)) return;
      const p = o.body.translation();
      const q = o.body.rotation();
      out.push([o.spec.id, r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w)]);
    });
    return out;
  }

  getFull() {
    return { specs: [...this.objects.values()].map((o) => o.spec), snap: this.getSnapshot(false), hands: this.handCounts, meta: this.meta };
  }

  _cleanSpec(s) {
    if (!s || typeof s.id !== "string" || s.id.length > 24) return null;
    const faces = this.mod.faces?.length || 0;
    const fi = (n) => clamp(Math.round(num(n)), 0, Math.max(0, faces - 1));
    const col = (c, d) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
    const locked = s.locked ? { locked: true } : {};
    if (s.kind === "die") return { id: s.id, kind: "die", ...locked };
    if (s.kind === "piece")
      return {
        id: s.id, kind: "piece", color: col(s.color, "#e74c3c"), shape: s.shape === "cube" ? "cube" : "cyl", ...locked,
        ...(typeof s.label === "string" && s.label ? { label: s.label.slice(0, 4), labelColor: col(s.labelColor, "#ffffff") } : {}),
      };
    if (s.kind === "deck") {
      if (!Array.isArray(s.cards) || !s.cards.length || (s.dim !== "card" && s.dim !== "tile")) return null;
      return { id: s.id, kind: "deck", dim: s.dim, cards: s.cards.slice(0, 130).map(fi), back: fi(s.back), up: !!s.up, ...locked };
    }
    if (s.kind === "board") {
      return {
        id: s.id, kind: "board", color: col(s.color, "#cbb58a"),
        ...(typeof s.image === "string" && this.mod.assets?.[s.image] ? { image: s.image } : {}),
        w: clamp(num(s.w, 20), 4, 38), d: clamp(num(s.d, 20), 4, 24),
        pos: Array.isArray(s.pos) ? [num(s.pos[0]), num(s.pos[1])] : [0, 0],
      };
    }
    return null;
  }

  applyFull(full) {
    if (this.isHost || !full || !Array.isArray(full.specs)) return;
    const specs = full.specs.slice(0, MAX_OBJECTS).map((s) => this._cleanSpec(s)).filter(Boolean);
    const keep = new Set(specs.map((s) => s.id));
    [...this.objects.keys()].forEach((id) => {
      if (!keep.has(id)) this._removeObject(id);
    });
    const byId = new Map((full.snap || []).map((r) => [r[0], r]));
    specs.forEach((spec) => this._upsert(spec, byId.get(spec.id), false));
    this.applySnapshot(full.snap);
    this._setHands(full.hands);
    if (full.meta) this._setMeta(full.meta);
  }

  applyUpdate(upd) {
    if (this.isHost || !upd) return;
    (upd.removed || []).forEach((id) => typeof id === "string" && this._removeObject(id));
    const byId = new Map((upd.snap || []).map((r) => [r[0], r]));
    (upd.specs || []).forEach((raw) => {
      const spec = this._cleanSpec(raw);
      if (spec) this._upsert(spec, byId.get(spec.id), true);
    });
    this.applySnapshot(upd.snap);
    this._setHands(upd.hands);
    if (upd.meta) this._setMeta(upd.meta);
  }

  _upsert(spec, row, animate) {
    const o = this.objects.get(spec.id);
    if (o) return this._applySpec(o, spec, animate);
    this._addObject(spec, spec.kind === "board" ? [spec.pos[0], 0, spec.pos[1]] : row ? [row[1], row[2], row[3]] : [0, 2, 0], row ? [row[4], row[5], row[6], row[7]] : null);
  }

  _applySpec(o, spec, animate) {
    const prev = o.spec;
    o.spec = spec;
    o.locked = !!spec.locked;
    if (prev.kind !== "deck" || spec.kind !== "deck") return;
    const sameCards = prev.cards.length === spec.cards.length && prev.cards.every((c, i) => c === spec.cards[i]);
    if (prev.up === spec.up && prev.back === spec.back && sameCards) return;
    if (animate && prev.up !== spec.up && prev.cards.length === spec.cards.length) {
      o.flipT0 = performance.now();
      this.sfx.flip();
    } else if (animate && !sameCards && prev.cards.length === spec.cards.length) {
      o.shuffleT0 = performance.now();
      this.sfx.shuffle();
    }
    this._rebuildVisual(o);
  }

  _setHands(counts) {
    if (counts && typeof counts === "object") {
      this.handCounts = counts;
      this.opts.onHands?.(counts);
    }
  }

  applySnapshot(list) {
    if (this.isHost || !Array.isArray(list)) return;
    for (const row of list) {
      const o = this.objects.get(row[0]);
      if (!o || o.static) continue;
      if (!o.target) o.target = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
      o.target.p.set(num(row[1]), num(row[2]), num(row[3]));
      o.target.q.set(num(row[4]), num(row[5]), num(row[6]), num(row[7], 1));
    }
  }

  // ───────────────── Seçim / vurgulama ─────────────────
  getInfo(id) {
    const o = this.objects.get(id);
    if (!o) return null;
    const s = o.spec;
    return { id, kind: s.kind, n: s.kind === "deck" ? s.cards.length : 1, up: !!s.up, dim: s.dim, static: !!o.static, locked: !!s.locked };
  }

  /** Ana taş/kart yığınının kimliği (en çok kartlı deste) — "101 Dağıt" düğmesi için */
  findMainDeck(dim = null) {
    let best = null;
    this.objects.forEach((o) => {
      if (o.spec.kind === "deck" && (!dim || o.spec.dim === dim) && (!best || o.spec.cards.length > best.spec.cards.length)) best = o;
    });
    return best?.spec.id || null;
  }

  select(ids, additive = false) {
    const prev = new Set(this.sel);
    if (!additive) this.sel.clear();
    ids.forEach((id) => this.objects.has(id) && this.sel.add(id));
    new Set([...prev, ...this.sel]).forEach((id) => {
      const o = this.objects.get(id);
      if (o) this._applyEmissive(o);
    });
    this.opts.onSelection?.([...this.sel]);
  }

  clearSelection() {
    if (this.sel.size) this.select([]);
  }

  _applyEmissive(o) {
    const id = o.spec.id;
    const lvl = this.sel.has(id) ? 0x5a4a14 : id === this.hoverId ? 0x2a2a30 : 0x000000;
    (Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material]).forEach((m) => m.emissive?.setHex(lvl));
  }

  _setHover(id) {
    if (id === this.hoverId) return;
    const prev = this.hoverId && this.objects.get(this.hoverId);
    this.hoverId = id;
    if (prev) this._applyEmissive(prev);
    if (id) this._applyEmissive(this.objects.get(id));
    this._updatePreview();
  }

  /** Kutu seçimi: ekran dikdörtgeninin içine düşen (kilitsiz, sabit olmayan) nesneleri seç */
  _boxSelect(x0, y0, x1, y1, additive) {
    const r = this.canvas.getBoundingClientRect();
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const ids = [];
    const v = new THREE.Vector3();
    this.objects.forEach((o) => {
      if (o.static || o.spec.locked) return;
      v.copy(o.mesh.position).project(this.camera);
      const sx = r.left + (v.x * 0.5 + 0.5) * r.width;
      const sy = r.top + (-v.y * 0.5 + 0.5) * r.height;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) ids.push(o.spec.id);
    });
    this.select(ids.slice(0, MAX_GROUP), additive);
  }

  /** Alt basılıyken üzerine gelinen kartı büyük göster */
  _updatePreview() {
    if (!this.opts.onPreview) return;
    const o = this.altDown && this.hoverId ? this.objects.get(this.hoverId) : null;
    if (o?.spec.kind === "deck") this.opts.onPreview({ face: this.getFaceView(this._deckTop(o.spec)), dim: o.spec.dim, count: o.spec.cards.length });
    else this.opts.onPreview(null);
  }

  // ───────────────── Kamera ─────────────────
  _moveCamera(dt) {
    if (!this.keys.size) return;
    let f = 0;
    let r = 0;
    if (this.keys.has("w")) f += 1;
    if (this.keys.has("s")) f -= 1;
    if (this.keys.has("d")) r += 1;
    if (this.keys.has("a")) r -= 1;
    if (!f && !r) return;
    const sp = this.cam.radius * 0.9 * dt;
    const { theta } = this.cam;
    this.camTarget.x += (-Math.sin(theta) * f + Math.cos(theta) * r) * sp;
    this.camTarget.z += (-Math.cos(theta) * f - Math.sin(theta) * r) * sp;
    this._clampTarget();
    this._updateCamera();
  }

  _clampTarget() {
    this.camTarget.x = clamp(this.camTarget.x, -TABLE.w / 2, TABLE.w / 2);
    this.camTarget.z = clamp(this.camTarget.z, -TABLE.d / 2 - 4, TABLE.d / 2 + 6);
  }

  resetCamera() {
    this.cam = { theta: 0, phi: 0.95, radius: 38 };
    this.camTarget.set(0, 0, 0);
    this._updateCamera();
  }

  _updateCamera() {
    const { theta, phi, radius } = this.cam;
    this.camera.position.set(
      this.camTarget.x + radius * Math.sin(phi) * Math.sin(theta),
      this.camTarget.y + radius * Math.cos(phi),
      this.camTarget.z + radius * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.lookAt(this.camTarget);
  }

  // ───────────────── Girdi ─────────────────
  _ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  _pick(e) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    const meshes = [];
    this.objects.forEach((o) => {
      if (!o.static) meshes.push(o.mesh);
    });
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit?.object?.userData?.id || null;
  }

  _planePoint(e, plane = this.holdPlane) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  tablePoint(clientX, clientY) {
    const p = this._planePoint({ clientX, clientY }, this.groundPlane);
    if (!p || Math.abs(p.x) > TABLE.w / 2 || Math.abs(p.z) > TABLE.d / 2) return null;
    return { x: r3(p.x), z: r3(p.z) };
  }

  /** Klavye eylemlerinin hedefi: seçili varsa hepsi, yoksa elde tutulan / üstüne gelinen */
  _keyTargets() {
    if (this.sel.size) return [...this.sel];
    const t = this.myHold || this.hoverId;
    return t && this.objects.has(t) ? [t] : [];
  }

  _bindInput() {
    const c = this.canvas;
    let drag = null; // { button, x, y, moved, id, box?, x0, y0, add }
    let lastMoveSent = 0;

    this._onDown = (e) => {
      c.focus?.({ preventScroll: true });
      this.sfx._ensure();
      if (e.button === 0) {
        const id = this._pick(e);
        if (!id) {
          // Boş yerde sol tık sürükle: kutu ile çoklu seçim
          c.setPointerCapture?.(e.pointerId);
          drag = { button: 0, box: true, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, add: e.shiftKey };
          return;
        }
        const o = this.objects.get(id);
        if (o?.spec.locked) return;
        c.setPointerCapture?.(e.pointerId);
        let group = null;
        if (this.sel.has(id) && this.sel.size > 1) group = [...this.sel]; // seçililerden birini tutunca hepsi birlikte
        else if (!e.shiftKey && !this.sel.has(id)) this.clearSelection();
        this.myHold = id;
        this.sfx.pick();
        this.opts.onIntent({ k: "grab", id, top: e.shiftKey && !group, ...(group ? { group } : {}) });
        const p = this._planePoint(e);
        if (p) this.opts.onIntent({ k: "move", x: r3(p.x), z: r3(p.z) });
        c.style.cursor = "grabbing";
        drag = { button: 0, x: e.clientX, y: e.clientY };
      } else if (e.button === 2 || e.button === 1) {
        c.setPointerCapture?.(e.pointerId);
        drag = { button: e.button, x: e.clientX, y: e.clientY, moved: 0, id: this._pick(e) };
        this.opts.onContext?.(null);
      }
    };

    this._onMove = (e) => {
      if (drag?.box) {
        drag.moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
        if (drag.moved > 4) this.opts.onBox?.({ x0: drag.x0, y0: drag.y0, x1: e.clientX, y1: e.clientY });
        return;
      }
      if (drag && drag.button === 2) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
        this.cam.theta -= dx * 0.006;
        this.cam.phi = clamp(this.cam.phi - dy * 0.006, 0.2, 1.4);
        this._updateCamera();
        return;
      }
      if (drag && drag.button === 1) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
        const s = this.cam.radius * 0.0018;
        const { theta } = this.cam;
        this.camTarget.x += (-Math.cos(theta) * dx - Math.sin(theta) * dy) * s;
        this.camTarget.z += (Math.sin(theta) * dx - Math.cos(theta) * dy) * s;
        this._clampTarget();
        this._updateCamera();
        return;
      }
      if (this.myHold) {
        const now = performance.now();
        if (now - lastMoveSent < 16) return; // ~60 Hz: fırlatma hızı doğru ölçülsün
        lastMoveSent = now;
        const p = this._planePoint(e);
        if (p) this.opts.onIntent({ k: "move", x: r3(p.x), z: r3(p.z) });
        return;
      }
      const id = this._pick(e);
      this._setHover(id);
      c.style.cursor = id ? "grab" : "default";
    };

    this._onUp = (e) => {
      if (drag?.box) {
        this.opts.onBox?.(null);
        if (drag.moved > 5) this._boxSelect(drag.x0, drag.y0, e.clientX, e.clientY, drag.add);
        else if (!drag.add) this.clearSelection();
      } else if (drag && drag.button === 2 && drag.moved < 6) {
        // Sağ tık (sürüklemeden): nesne bağlam menüsü
        const info = drag.id ? this.getInfo(drag.id) : null;
        if (info) {
          const multi = this.sel.has(drag.id) && this.sel.size > 1 ? [...this.sel] : null;
          this.opts.onContext?.({ ...info, x: e.clientX, y: e.clientY, multi });
        }
      } else if (drag && drag.button === 1 && drag.moved < 6) {
        const id = this.myHold || drag.id;
        if (id) this.opts.onIntent({ k: "flip", id });
      }
      if (this.myHold && (!drag || (drag.button === 0 && !drag.box))) {
        const id = this.myHold;
        this.myHold = null;
        const o = this.objects.get(id);
        if (this.opts.isOverHand?.(e.clientX, e.clientY) && o?.spec.kind === "deck") this.opts.onIntent({ k: "toHand", id });
        else this.opts.onIntent({ k: "release" });
        c.style.cursor = "default";
      }
      drag = null;
      c.releasePointerCapture?.(e.pointerId);
    };

    this._onWheel = (e) => {
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      const before = dir < 0 ? this._planePoint(e, this.groundPlane) : null;
      this.cam.radius = clamp(this.cam.radius * (1 + dir * 0.1), 10, 75);
      if (before) {
        this.camTarget.x += (before.x - this.camTarget.x) * 0.12;
        this.camTarget.z += (before.z - this.camTarget.z) * 0.12;
        this._clampTarget();
      }
      this._updateCamera();
    };

    this._onDbl = (e) => {
      const id = this._pick(e);
      const o = id && this.objects.get(id);
      if (!o) return;
      if (o.spec.kind === "die") this.opts.onIntent({ k: "roll", id });
      else if (o.spec.kind === "deck") this.opts.onIntent({ k: "flip", id });
    };

    this._onCtx = (e) => e.preventDefault();

    this._onKeyDown = (e) => {
      if (this.disposed || e.ctrlKey || e.metaKey) return;
      const tg = e.target;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
      if (this.opts.keysEnabled && !this.opts.keysEnabled()) return;
      const k = e.key.toLowerCase();
      if (k === "alt") {
        e.preventDefault();
        this.altDown = true;
        this._updatePreview();
        return;
      }
      const ids = this._keyTargets();
      if (k === "w" || k === "a" || k === "s" || k === "d") {
        this.keys.add(k);
      } else if (k === " ") {
        e.preventDefault();
        this.resetCamera();
      } else if (k === "escape") {
        this.clearSelection();
      } else if (k === "q" || k === "e") {
        if (this.myHold) this.opts.onIntent({ k: "rot", d: k === "e" ? 1 : -1 });
        else if (ids.length) this.opts.onIntent({ k: "rot", ids, d: k === "e" ? 1 : -1 });
      } else if (k === "f") {
        if (ids.length) this.opts.onIntent({ k: "flip", ids });
      } else if (k === "r") {
        if (ids.length) this.opts.onIntent({ k: "rand", ids });
      } else if (k === "g") {
        if (ids.length > 1) this.opts.onIntent({ k: "group", ids });
      } else if (k === "delete" || k === "backspace") {
        if (ids.length) {
          this.opts.onIntent({ k: "remove", ids });
          this.clearSelection();
        }
      } else if (/^[1-9]$/.test(k) && this.hoverId && this.objects.get(this.hoverId)?.spec.kind === "deck") {
        this.numBuf += k;
        clearTimeout(this.numTimer);
        const id = this.hoverId;
        this.numTimer = setTimeout(() => {
          const n = Math.min(15, parseInt(this.numBuf, 10) || 1);
          this.numBuf = "";
          this.opts.onIntent({ k: "drawN", id, n });
        }, 650);
      }
    };

    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === "alt") {
        this.altDown = false;
        this._updatePreview();
      }
    };

    this._onBlur = () => {
      this.keys.clear();
      this.altDown = false;
      this._updatePreview();
    };

    c.addEventListener("pointerdown", this._onDown);
    c.addEventListener("pointermove", this._onMove);
    c.addEventListener("pointerup", this._onUp);
    c.addEventListener("pointercancel", this._onUp);
    c.addEventListener("wheel", this._onWheel, { passive: false });
    c.addEventListener("dblclick", this._onDbl);
    c.addEventListener("contextmenu", this._onCtx);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
  }

  _resize() {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.numTimer);
    this._ro?.disconnect();
    const c = this.canvas;
    if (c) {
      c.removeEventListener("pointerdown", this._onDown);
      c.removeEventListener("pointermove", this._onMove);
      c.removeEventListener("pointerup", this._onUp);
      c.removeEventListener("pointercancel", this._onUp);
      c.removeEventListener("wheel", this._onWheel);
      c.removeEventListener("dblclick", this._onDbl);
      c.removeEventListener("contextmenu", this._onCtx);
    }
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    [...this.objects.keys()].forEach((id) => this._removeObject(id));
    this.scene?.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
        m.map?.dispose?.();
        m.dispose();
      });
    });
    this.pipTextures?.forEach((t) => t.dispose());
    this.pipTextures = null;
    this.faceTex.forEach((t) => t.dispose());
    this.faceTex.clear();
    this.assetTex.forEach((t) => t.dispose());
    this.assetTex.clear();
    this.imgCache.clear();
    this.sfx.close();
    try {
      this.world?.free();
    } catch (e) {}
    this.world = null;
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      c?.parentNode?.removeChild(c);
    }
    this.objects.clear();
    this.holds.clear();
    this.hands.clear();
    this.sel.clear();
  }
}
