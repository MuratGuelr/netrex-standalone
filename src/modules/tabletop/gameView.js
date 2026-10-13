/**
 * 🏒⚽🎱🎳 Masa oyunları — görünüm (three.js). Fizik/kurallar: gameLogic.js, poolGame.js, bowlingGame.js
 *
 * Her istemci kendi sahnesinde aynı sahayı çizer (sabit dekor, oyun türüne göre). Hareketli parçalar
 * (disk, raket, top, çubuklar, bilardo topları, istaka, lobutlar) normal masa nesneleridir ve konumları
 * anlık görüntü kanalıyla gelir. Malzemeler ortam haritasından (engine'de RoomEnvironment) yansıma alır.
 */
import { AH, FB, FB_RODS, rodPlayerZ, TEAM_COLORS } from "./gameLogic.js";
import { POOL, POCKETS } from "./poolGame.js";
import { BOWL, pinHome } from "./bowlingGame.js";

function canvasTexture(THREE, w, h, draw, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

function noise(g, w, h, n, alpha = 0.05, maxLen = 3) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${Math.random() * alpha})` : `rgba(0,0,0,${Math.random() * alpha * 1.4})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * maxLen, 1 + Math.random() * maxLen * 0.4);
  }
}

/** Köşe pahı dolgusu: üçgen prizma (xz düzleminde, yüksekliği h) */
function cornerPrism(THREE, sx, sz, HX, HZ, c, h) {
  const shape = new THREE.Shape();
  shape.moveTo(sx * HX, sz * HZ);
  shape.lineTo(sx * (HX - c), sz * HZ);
  shape.lineTo(sx * HX, sz * (HZ - c));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // şekil y'si → dünya z'si, kalınlık aşağı doğru
  geo.translate(0, h, 0);
  return geo;
}

/** Sahne dekoru: zemin, kenarlıklar, kale/cep, işaretler. dispose() hepsini serbest bırakır. */
export function buildGameDecor(THREE, RoundedBoxGeometry, type) {
  const group = new THREE.Group();
  const disposables = [];
  const mat = (opts) => {
    const m = new THREE.MeshStandardMaterial(opts);
    disposables.push(m);
    return m;
  };
  const geo = (g) => {
    disposables.push(g);
    return g;
  };
  const add = (g, material, x, y, z, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo(g), material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  };
  const box = (w, h, d, material, x, y, z, round = 0.2) =>
    add(round ? new RoundedBoxGeometry(w, h, d, 3, Math.min(round, h / 2.2, w / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const tex = (t) => {
    disposables.push(t);
    return t;
  };

  if (type === "airhockey" || type === "foosball") {
    const isAH = type === "airhockey";
    const D = isAH ? AH : FB;
    const totalW = 2 * (D.HX + D.POCKET);
    const totalD = 2 * D.HZ;
    const PX = 28;
    const corner = 3;

    // ── Zemin ──
    const floorTex = tex(
      canvasTexture(THREE, Math.round(totalW * PX), Math.round(totalD * PX), (g, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        const u = PX;
        if (isAH) {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "#e9f3fb");
          grad.addColorStop(0.5, "#f6fbff");
          grad.addColorStop(1, "#e3eef7");
          g.fillStyle = grad;
          g.fillRect(0, 0, w, h);
          // hava delikleri
          g.fillStyle = "rgba(90,120,150,0.22)";
          for (let x = 0.9; x < totalW; x += 0.9) for (let y = 0.9; y < totalD; y += 0.9) {
            g.beginPath();
            g.arc(x * u, y * u, 0.07 * u, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = "#c2d3e2";
          g.fillRect(0, 0, D.POCKET * u, h);
          g.fillRect(w - D.POCKET * u, 0, D.POCKET * u, h);
          g.lineWidth = 6;
          g.strokeStyle = "#e11d48";
          g.beginPath();
          g.moveTo(cx, 0);
          g.lineTo(cx, h);
          g.stroke();
          g.strokeStyle = "#2563eb";
          g.beginPath();
          g.arc(cx, cy, 4.2 * u, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = "#2563eb";
          g.beginPath();
          g.arc(cx, cy, 0.55 * u, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#e11d48";
          for (const [x0, a0, a1] of [[D.POCKET * u, -Math.PI / 2, Math.PI / 2], [w - D.POCKET * u, Math.PI / 2, Math.PI * 1.5]]) {
            g.beginPath();
            g.arc(x0, cy, 5.2 * u, a0, a1);
            g.stroke();
          }
          g.fillStyle = "#e11d48";
          for (const fx of [0.3, 0.7]) for (const fy of [0.25, 0.75]) {
            g.beginPath();
            g.arc(w * fx, h * fy, 0.4 * u, 0, Math.PI * 2);
            g.fill();
          }
        } else {
          g.fillStyle = "#1c6f38";
          g.fillRect(0, 0, w, h);
          noise(g, w, h, 5000, 0.07, 4);
          for (let i = 0; i < 14; i++) {
            g.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
            g.fillRect((i * w) / 14, 0, w / 14, h);
          }
          g.fillStyle = "#10401f";
          g.fillRect(0, 0, D.POCKET * u, h);
          g.fillRect(w - D.POCKET * u, 0, D.POCKET * u, h);
          g.strokeStyle = "rgba(255,255,255,0.9)";
          g.lineWidth = 5;
          g.strokeRect(D.POCKET * u, 3, w - 2 * D.POCKET * u, h - 6);
          g.beginPath();
          g.moveTo(cx, 0);
          g.lineTo(cx, h);
          g.stroke();
          g.beginPath();
          g.arc(cx, cy, 3.4 * u, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = "rgba(255,255,255,0.9)";
          g.beginPath();
          g.arc(cx, cy, 0.3 * u, 0, Math.PI * 2);
          g.fill();
          g.strokeRect(D.POCKET * u, cy - 5.2 * u, 4.4 * u, 10.4 * u);
          g.strokeRect(w - D.POCKET * u - 4.4 * u, cy - 5.2 * u, 4.4 * u, 10.4 * u);
          g.strokeRect(D.POCKET * u, cy - 2.6 * u, 1.8 * u, 5.2 * u);
          g.strokeRect(w - D.POCKET * u - 1.8 * u, cy - 2.6 * u, 1.8 * u, 5.2 * u);
        }
      }),
    );
    add(
      new THREE.PlaneGeometry(totalW, totalD),
      mat({ map: floorTex, roughness: isAH ? 0.18 : 0.92, metalness: isAH ? 0.05 : 0, envMapIntensity: isAH ? 0.9 : 0.35 }),
      0, 0.03, 0, { cast: false },
    ).rotation.x = -Math.PI / 2;

    // ── Kenarlıklar ──
    const railMat = isAH
      ? mat({ color: "#12206b", roughness: 0.28, metalness: 0.25 })
      : mat({ color: "#6a4222", roughness: 0.5, metalness: 0.05, map: tex(canvasTexture(THREE, 256, 64, (g, w, h) => {
          g.fillStyle = "#ffffff";
          g.fillRect(0, 0, w, h);
          for (let i = 0; i < 400; i++) {
            g.fillStyle = `rgba(60,30,10,${Math.random() * 0.22})`;
            g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 90, 1);
          }
        })) });
    const chrome = mat({ color: "#d7dde6", roughness: 0.22, metalness: 0.9 });
    const h = 1.8;
    const t = 1.1;
    const lenX = totalW + 2.2;
    const rails = [
      [lenX, h, t, 0, h / 2, -(D.HZ + t / 2)],
      [lenX, h, t, 0, h / 2, D.HZ + t / 2],
    ];
    const segHz = (D.HZ - D.GOAL_W / 2) / 2;
    for (const sx of [-1, 1]) {
      rails.push([t, h, segHz + 0.55, sx * (D.HX + t / 2), h / 2, D.GOAL_W / 2 + segHz]);
      rails.push([t, h, segHz + 0.55, sx * (D.HX + t / 2), h / 2, -(D.GOAL_W / 2 + segHz)]);
      rails.push([D.POCKET + 1, h, t, sx * (D.HX + D.POCKET / 2 + 0.5), h / 2, D.GOAL_W / 2 + t / 2]);
      rails.push([D.POCKET + 1, h, t, sx * (D.HX + D.POCKET / 2 + 0.5), h / 2, -(D.GOAL_W / 2 + t / 2)]);
      rails.push([t, h, D.GOAL_W + 2, sx * (D.HX + D.POCKET + t / 2), h / 2, 0]);
    }
    rails.forEach(([w, hh, d, x, y, z]) => box(w, hh, d, railMat, x, y, z, 0.28));
    // Üst krom/metal şerit (kenarlık boyunca)
    box(lenX, 0.14, 0.34, chrome, 0, h + 0.03, -(D.HZ + t / 2), 0.05);
    box(lenX, 0.14, 0.34, chrome, 0, h + 0.03, D.HZ + t / 2, 0.05);
    // Köşe pahları + dolgu
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const prism = add(cornerPrism(THREE, sx, sz, D.HX + 0.05, D.HZ + 0.05, corner + 0.05, h), railMat, 0, 0, 0);
      prism.material = railMat;
      const cx = sx * (D.HX - corner / 2 + 0.2);
      const cz = sz * (D.HZ - corner / 2 + 0.2);
      const edge = add(new THREE.BoxGeometry(corner * Math.SQRT2, 0.14, 0.3), chrome, cx, h + 0.03, cz);
      edge.rotation.y = (sx * sz > 0 ? 1 : -1) * (Math.PI / 4);
    }

    if (isAH) {
      // LED şeritler: sol yarı kırmızı, sağ yarı mavi (uzun kenarların iç yüzü)
      for (const sx of [-1, 1]) {
        const led = mat({ color: TEAM_COLORS[sx < 0 ? 0 : 1], emissive: TEAM_COLORS[sx < 0 ? 0 : 1], emissiveIntensity: 1.2, roughness: 0.4 });
        for (const sz of [-1, 1]) box((D.HX - corner) * 0.98, 0.16, 0.12, led, sx * ((D.HX - corner) / 2 + 0.2), 1.25, sz * (D.HZ - 0.02), 0.04);
        // kale ağzı çerçevesi
        const glow = mat({ color: TEAM_COLORS[sx < 0 ? 0 : 1], emissive: TEAM_COLORS[sx < 0 ? 0 : 1], emissiveIntensity: 0.9, roughness: 0.4 });
        box(0.3, 0.16, D.GOAL_W, glow, sx * (D.HX + 0.05), 0.1, 0, 0.04);
        // cep: koyu boşluk
        box(D.POCKET, 0.12, D.GOAL_W, mat({ color: "#0a0f1c", roughness: 0.9 }), sx * (D.HX + D.POCKET / 2), 0.1, 0, 0.02);
      }
    } else {
      // Kaleler: çerçeve + ağ
      const netTex = tex(canvasTexture(THREE, 128, 128, (g, w, hh) => {
        g.clearRect(0, 0, w, hh);
        g.strokeStyle = "rgba(255,255,255,0.75)";
        g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo((i * w) / 8, 0);
          g.lineTo((i * w) / 8, hh);
          g.moveTo(0, (i * hh) / 8);
          g.lineTo(w, (i * hh) / 8);
          g.stroke();
        }
      }, { repeat: [3, 1] }));
      for (const sx of [-1, 1]) {
        const col = TEAM_COLORS[sx < 0 ? 0 : 1];
        box(D.POCKET, 0.1, D.GOAL_W, mat({ color: "#0b0b0b", roughness: 0.95 }), sx * (D.HX + D.POCKET / 2), 0.08, 0);
        const post = mat({ color: "#f4f4f5", roughness: 0.35, metalness: 0.5 });
        for (const sz of [-1, 1]) {
          const p = add(new THREE.CylinderGeometry(0.16, 0.16, 2.0, 12), post, sx * (D.HX + 0.1), 1.0, sz * (D.GOAL_W / 2));
          p.castShadow = false;
        }
        const bar = add(new THREE.CylinderGeometry(0.14, 0.14, D.GOAL_W, 12), post, sx * (D.HX + 0.1), 2.0, 0);
        bar.rotation.x = Math.PI / 2;
        const net = add(
          new THREE.PlaneGeometry(D.GOAL_W, 2.0),
          new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
          sx * (D.HX + D.POCKET), 1.0, 0, { cast: false, receive: false },
        );
        disposables.push(net.material);
        net.rotation.y = Math.PI / 2;
        box(0.25, 0.14, D.GOAL_W, mat({ color: col, emissive: col, emissiveIntensity: 0.8, roughness: 0.4 }), sx * (D.HX + 0.05), 0.1, 0, 0.04);
      }
    }
  } else if (type === "pool") {
    const { HX, HZ } = POOL;
    const cush = 1.4;
    const rim = 0.55;
    // Çuha
    const clothTex = tex(
      canvasTexture(THREE, 512, 512, (g, w, h) => {
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, w, h);
        noise(g, w, h, 9000, 0.08, 2);
      }, { repeat: [10, 6] }),
    );
    add(new THREE.PlaneGeometry(2 * HX + 0.4, 2 * HZ + 0.4), mat({ color: "#0e6b46", map: clothTex, roughness: 0.95 }), 0, 0.03, 0, { cast: false }).rotation.x = -Math.PI / 2;
    // Çizgiler ve noktalar (baş çizgisi, ayak noktası)
    const marks = tex(
      canvasTexture(THREE, 1024, 512, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const sx = w / (2 * HX);
        const sz = h / (2 * HZ);
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo((HX + POOL.HEAD_X) * sx, 0);
        g.lineTo((HX + POOL.HEAD_X) * sx, h);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.55)";
        for (const x of [POOL.HEAD_X, POOL.FOOT_X, 0]) {
          g.beginPath();
          g.arc((HX + x) * sx, h / 2, 5, 0, Math.PI * 2);
          g.fill();
        }
      }),
    );
    add(new THREE.PlaneGeometry(2 * HX, 2 * HZ), new THREE.MeshBasicMaterial({ map: marks, transparent: true, depthWrite: false }), 0, 0.05, 0, { cast: false, receive: false }).rotation.x = -Math.PI / 2;
    disposables.push(group.children[group.children.length - 1].material);

    // Ahşap çerçeve (maun) + yastıklar (koyu yeşil kauçuk)
    const wood = mat({ color: "#5b2f17", roughness: 0.38, metalness: 0.08, map: tex(canvasTexture(THREE, 256, 64, (g, w, h) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(40,15,5,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 100, 1);
      }
    })) });
    const rubber = mat({ color: "#0a5a3a", roughness: 0.7 });
    const ow = 2 * HX + 2 * (cush + rim);
    const od = 2 * HZ + 2 * (cush + rim);
    for (const sz of [-1, 1]) {
      box(ow, 1.5, rim, wood, 0, 0.75, sz * (HZ + cush + rim / 2), 0.18);
      // yastıklar (cep ağızlarında kesik)
      for (const sx of [-1, 1]) {
        const x0 = POOL.SIDE_MOUTH;
        const x1 = HX - POOL.CORNER_MOUTH;
        box(x1 - x0, 1.2, cush, rubber, sx * ((x0 + x1) / 2), 0.6, sz * (HZ + cush / 2), 0.2);
      }
    }
    for (const sx of [-1, 1]) {
      box(rim, 1.5, od - 2 * rim, wood, sx * (HX + cush + rim / 2), 0.75, 0, 0.18);
      box(cush, 1.2, 2 * (HZ - POOL.CORNER_MOUTH), rubber, sx * (HX + cush / 2), 0.6, 0, 0.2);
    }
    // Elmas işaretleri
    const brass = mat({ color: "#f3e9c8", roughness: 0.3, metalness: 0.4 });
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 4), brass, i * (HX / 3.6), 1.52, sz * (HZ + cush + rim / 2), { cast: false });
    }
    // Ceplar: koyu delik + pirinç halka
    const hole = mat({ color: "#050505", roughness: 1 });
    const ring = mat({ color: "#b78a2f", roughness: 0.3, metalness: 0.85 });
    for (const k of POCKETS) {
      add(new THREE.CylinderGeometry(k.r * 0.95, k.r * 0.95, 0.12, 28), hole, k.x, 0.07, k.z, { cast: false });
      const torus = add(new THREE.TorusGeometry(k.r * 0.98, 0.1, 8, 28), ring, k.x, 1.0, k.z, { cast: false });
      torus.rotation.x = Math.PI / 2;
    }
    // Top tepsisi (cebe giren toplar burada sıralanır)
    box(23, 0.3, 2.4, wood, -3.9, -0.1, POOL.HZ + 2.6, 0.1);
    box(23.6, 0.3, 0.3, rubber, -3.9, 0.15, POOL.HZ + 3.7, 0.05);
  } else if (type === "bowling") {
    const { LANE_HALF, GUTTER_HALF, BACK_X, START_X, HEAD_X } = BOWL;
    const laneL = BACK_X + 19.6;
    // Kulvar: ahşap tahtalar
    const laneTex = tex(
      canvasTexture(THREE, 1024, 256, (g, w, h) => {
        const boards = 39;
        for (let i = 0; i < boards; i++) {
          const v = 190 + Math.floor(Math.random() * 30);
          g.fillStyle = `rgb(${v + 20},${v - 10},${v - 70})`;
          g.fillRect(0, (i * h) / boards, w, h / boards + 1);
          g.fillStyle = "rgba(90,50,20,0.12)";
          for (let k = 0; k < 14; k++) g.fillRect(Math.random() * w, (i * h) / boards + Math.random() * (h / boards), 40 + Math.random() * 160, 1);
        }
        g.strokeStyle = "rgba(60,30,10,0.35)";
        g.lineWidth = 1;
        for (let i = 0; i <= boards; i++) {
          g.beginPath();
          g.moveTo(0, (i * h) / boards);
          g.lineTo(w, (i * h) / boards);
          g.stroke();
        }
        // atış çizgisi, oklar, noktalar
        const px = (x) => ((x + 19.6) / laneL) * w;
        const pz = (z) => ((z + LANE_HALF) / (2 * LANE_HALF)) * h;
        g.fillStyle = "#1c1c1c";
        g.fillRect(px(START_X + 1.2), 0, 5, h);
        g.fillStyle = "rgba(30,20,10,0.8)";
        for (let i = -3; i <= 3; i++) {
          const x = START_X + 7 + Math.abs(i) * 1.4;
          g.beginPath();
          g.moveTo(px(x + 1.4), pz(i * 1.4));
          g.lineTo(px(x - 0.6), pz(i * 1.4 - 0.5));
          g.lineTo(px(x - 0.6), pz(i * 1.4 + 0.5));
          g.fill();
        }
        for (const z of [-3.5, -2.1, -0.7, 0.7, 2.1, 3.5]) {
          g.beginPath();
          g.arc(px(START_X + 3.5), pz(z), 3, 0, Math.PI * 2);
          g.fill();
        }
      }),
    );
    add(
      new THREE.PlaneGeometry(laneL, 2 * LANE_HALF),
      mat({ map: laneTex, roughness: 0.18, metalness: 0.05, envMapIntensity: 0.8 }),
      (BACK_X - 19.6) / 2, 0.03, 0, { cast: false },
    ).rotation.x = -Math.PI / 2;
    // Oluklar
    const gutterMat = mat({ color: "#16181d", roughness: 0.4, metalness: 0.5 });
    for (const sz of [-1, 1]) {
      add(new THREE.PlaneGeometry(laneL, GUTTER_HALF - LANE_HALF), gutterMat, (BACK_X - 19.6) / 2, 0.035, sz * ((LANE_HALF + GUTTER_HALF) / 2), { cast: false }).rotation.x = -Math.PI / 2;
      box(laneL, 0.6, 0.35, mat({ color: "#2b2f38", roughness: 0.4, metalness: 0.4 }), (BACK_X - 19.6) / 2, 0.3, sz * (LANE_HALF + 0.17), 0.1);
      // yan duvar (kickback)
      box(laneL, 2.4, 0.6, mat({ color: "#1c2433", roughness: 0.35, metalness: 0.2 }), (BACK_X - 19.6) / 2, 1.2, sz * (GUTTER_HALF + 0.9), 0.15);
    }
    // Arka perde ve lobut alanı
    box(0.8, 5, 2 * GUTTER_HALF + 2.4, mat({ color: "#0e1118", roughness: 0.9 }), BACK_X + 0.6, 2.5, 0, 0.1);
  }
  return {
    group,
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      group.removeFromParent();
    },
  };
}

// ───────────────── Hareketli parçalar ─────────────────
const POOL_COLORS = ["#f5f5f0", "#f2c500", "#1d4fb8", "#d62d20", "#5a2a8a", "#f0731c", "#1c8a3c", "#7b1f1f", "#101010"];
export const poolBallColor = (n) => POOL_COLORS[n === 0 ? 0 : n <= 8 ? n : n - 8];

function poolBallTexture(THREE, n) {
  return canvasTexture(THREE, 512, 256, (g, w, h) => {
    const col = poolBallColor(n);
    const stripe = n >= 9;
    g.fillStyle = stripe || n === 0 ? "#f7f7f2" : col;
    g.fillRect(0, 0, w, h);
    if (stripe) {
      g.fillStyle = col;
      g.fillRect(0, h * 0.27, w, h * 0.46);
    }
    if (n > 0) {
      for (const cx of [w * 0.25, w * 0.75]) {
        g.fillStyle = "#fafafa";
        g.beginPath();
        g.arc(cx, h / 2, h * 0.17, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#111";
        g.font = `bold ${Math.round(h * 0.2)}px sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(n), cx, h / 2 + 2);
      }
    } else {
      g.fillStyle = "rgba(200,40,40,0.8)";
      g.beginPath();
      g.arc(w * 0.25, h / 2, h * 0.05, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Oyun nesnesinin görseli. Orijin = fizik gövdesinin merkezi. */
export function buildGamePart(THREE, RoundedBoxGeometry, spec) {
  const g = new THREE.Group();
  const add = (geo, material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    g.add(m);
    return m;
  };
  const team = spec.team === 1 ? 1 : 0;
  const teamCol = TEAM_COLORS[team];
  const std = (o) => new THREE.MeshStandardMaterial(o);

  if (spec.part === "puck") {
    const y = -(AH.Y - AH.PUCK_H / 2); // fizikte küre, görüntüde düz disk: yere indir
    add(new THREE.CylinderGeometry(AH.PUCK_R, AH.PUCK_R * 1.02, AH.PUCK_H, 48), std({ color: "#15171d", roughness: 0.25, metalness: 0.5 }), 0, y, 0);
    add(new THREE.CylinderGeometry(AH.PUCK_R * 0.72, AH.PUCK_R * 0.72, AH.PUCK_H + 0.03, 40), std({ color: "#f59e0b", roughness: 0.35, emissive: "#f59e0b", emissiveIntensity: 0.3 }), 0, y, 0);
    add(new THREE.CylinderGeometry(AH.PUCK_R * 0.48, AH.PUCK_R * 0.48, AH.PUCK_H + 0.05, 32), std({ color: "#15171d", roughness: 0.3, metalness: 0.5 }), 0, y, 0);
    const rim = add(new THREE.TorusGeometry(AH.PUCK_R * 0.98, 0.05, 8, 40), std({ color: "#9aa4b2", roughness: 0.25, metalness: 0.9 }), 0, y + AH.PUCK_H / 2, 0, false);
    rim.rotation.x = Math.PI / 2;
  } else if (spec.part === "paddle") {
    const y = -(AH.Y - 0.25);
    const body = std({ color: teamCol, roughness: 0.22, metalness: 0.45 });
    const chrome = std({ color: "#e5e9f0", roughness: 0.18, metalness: 0.95 });
    add(new THREE.CylinderGeometry(AH.PAD_R, AH.PAD_R * 1.05, 0.5, 48), body, 0, y, 0);
    const felt = add(new THREE.TorusGeometry(AH.PAD_R * 0.98, 0.1, 10, 44), std({ color: "#0f172a", roughness: 0.8 }), 0, y - 0.2, 0, false);
    felt.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(AH.PAD_R * 0.7, AH.PAD_R * 0.7, 0.14, 40), std({ color: "#0f172a", roughness: 0.5, metalness: 0.2 }), 0, y + 0.3, 0);
    add(new THREE.CylinderGeometry(0.42, 0.62, 1.0, 24), chrome, 0, y + 0.85, 0);
    const grip = add(new THREE.SphereGeometry(0.9, 32, 20), body, 0, y + 1.5, 0);
    grip.scale.set(1, 0.72, 1);
    const sheen = add(new THREE.SphereGeometry(0.28, 12, 8), std({ color: "#ffffff", roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.25 }), -0.25, y + 1.75, -0.25, false);
    sheen.scale.set(1, 0.6, 1);
  } else if (spec.part === "ball") {
    const tex = canvasTexture(THREE, 256, 128, (c, w, h) => {
      c.fillStyle = "#fbfbf6";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#15171d";
      const pent = (cx, cy, r) => {
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        c.closePath();
        c.fill();
      };
      for (const [x, y] of [[0.12, 0.5], [0.37, 0.28], [0.37, 0.74], [0.62, 0.5], [0.87, 0.28], [0.87, 0.74], [0.5, 0.1], [0.5, 0.9]]) pent(w * x, h * y, h * 0.14);
    });
    const m = std({ map: tex, roughness: 0.3, metalness: 0.05 });
    m.userData.ownMap = true;
    add(new THREE.SphereGeometry(FB.BALL_R, 36, 24), m);
  } else if (spec.part === "rod") {
    const def = FB_RODS[spec.ri];
    if (def) {
      const chrome = std({ color: "#dde3ec", roughness: 0.18, metalness: 0.95 });
      const shirt = std({ color: teamCol, roughness: 0.55 });
      const trim = std({ color: "#f8fafc", roughness: 0.6 });
      const shorts = std({ color: team === 0 ? "#fafafa" : "#fafafa", roughness: 0.65 });
      const sock = std({ color: teamCol, roughness: 0.7 });
      const skin = std({ color: "#e8c39b", roughness: 0.6 });
      const hair = std({ color: team === 0 ? "#2b1a10" : "#c9a15a", roughness: 0.8 });
      const shoe = std({ color: "#0b0b0d", roughness: 0.45, metalness: 0.15 });
      const rubber = std({ color: "#141414", roughness: 0.9 });
      const len = 2 * FB.HZ + 2.6;
      const rod = add(new THREE.CylinderGeometry(0.2, 0.2, len, 14), chrome);
      rod.rotation.x = Math.PI / 2; // eksen z boyunca
      const dir = team === 0 ? 1 : -1;
      // tutamak: takıma göre karşı uçlarda, oluklu
      const hz = dir * (len / 2 + 1.6);
      const grip = add(new THREE.CylinderGeometry(0.58, 0.58, 3.4, 18), rubber, 0, 0, hz);
      grip.rotation.x = Math.PI / 2;
      for (let k = -1; k <= 1; k++) {
        const ringG = add(new THREE.TorusGeometry(0.58, 0.05, 6, 18), chrome, 0, 0, hz + k * 0.9, false);
        void ringG;
      }
      add(new THREE.SphereGeometry(0.68, 16, 12), std({ color: teamCol, roughness: 0.35, metalness: 0.3 }), 0, 0, hz + dir * 1.8);
      // iç/dış tamponlar (kauçuk)
      for (const s of [-1, 1]) {
        const b = add(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 14), rubber, 0, 0, s * (FB.HZ + 0.35), false);
        b.rotation.x = Math.PI / 2;
      }
      for (let j = 0; j < def.n; j++) {
        const z = rodPlayerZ(def, j);
        const collar = add(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 14), chrome, 0, 0, z, false);
        collar.rotation.x = Math.PI / 2;
        add(new RoundedBoxGeometry(0.34, 0.34, 0.9, 2, 0.1), chrome, 0, -0.18, z, false); // omuz bağlantısı
        add(new RoundedBoxGeometry(0.92, 1.45, 0.94, 3, 0.2), shirt, 0, -1.0, z); // gövde
        add(new RoundedBoxGeometry(0.95, 0.16, 0.97, 2, 0.05), trim, 0, -0.48, z, false); // yaka şeridi
        add(new RoundedBoxGeometry(0.9, 0.55, 0.92, 3, 0.15), shorts, 0, -1.95, z); // şort
        for (const s of [-1, 1]) {
          add(new THREE.CylinderGeometry(0.2, 0.18, 0.75, 10), skin, 0.02, -2.5, z + s * 0.22); // bacak
          add(new THREE.CylinderGeometry(0.21, 0.2, 0.28, 10), sock, 0.02, -2.78, z + s * 0.22, false); // çorap
          add(new RoundedBoxGeometry(0.84, 0.3, 0.4, 2, 0.1), shoe, dir * 0.07, -3.05, z + s * 0.22); // ayakkabı
          const arm = add(new THREE.CylinderGeometry(0.13, 0.12, 1.1, 8), shirt, 0, -1.05, z + s * 0.58);
          arm.rotation.x = s * 0.1;
          add(new THREE.SphereGeometry(0.13, 8, 6), skin, 0, -1.65, z + s * 0.6, false); // el
        }
        add(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 8), skin, 0, -0.1, z, false); // boyun
        add(new THREE.SphereGeometry(0.42, 18, 14), skin, 0, 0.22, z); // kafa
        const cap = add(new THREE.SphereGeometry(0.44, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.28, z, false);
        cap.rotation.x = -0.12;
      }
    }
  } else if (spec.part === "poolball") {
    const tex = poolBallTexture(THREE, spec.n);
    const m = std({ map: tex, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.3 });
    m.userData.ownMap = true;
    add(new THREE.SphereGeometry(POOL.BALL_R, 36, 24), m);
  } else if (spec.part === "cue") {
    // Orijin istakanın ortası; uç +x yönünde. Nişan çizgisi uçtan ileri uzanır.
    const L = POOL.CUE_LEN;
    const wood = std({ color: "#d9b27c", roughness: 0.35, metalness: 0.05 });
    const dark = std({ color: "#2a1608", roughness: 0.4, metalness: 0.1 });
    const shaft = add(new THREE.CylinderGeometry(0.1, 0.17, L * 0.62, 12), wood, L * 0.19, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    const butt = add(new THREE.CylinderGeometry(0.25, 0.17, L * 0.38, 12), dark, -L * 0.31, 0, 0);
    butt.rotation.z = Math.PI / 2;
    const tip = add(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), std({ color: "#3b82c4", roughness: 0.8 }), L / 2 + 0.05, 0, 0, false);
    tip.rotation.z = Math.PI / 2;
    const ferrule = add(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 10), std({ color: "#f5f5f5", roughness: 0.4 }), L / 2 - 0.2, 0, 0, false);
    ferrule.rotation.z = Math.PI / 2;
    // nişan çizgisi
    const lineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.38, depthWrite: false });
    add(new THREE.BoxGeometry(34, 0.05, 0.1), lineMat, L / 2 + 17.4, -0.4, 0, false);
  } else if (spec.part === "bowlball") {
    const tex = canvasTexture(THREE, 256, 128, (c, w, h) => {
      const grad = c.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#3b0f7a");
      grad.addColorStop(0.5, "#1f1b8a");
      grad.addColorStop(1, "#6b1fa8");
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) {
        c.strokeStyle = `rgba(${120 + Math.random() * 130},${60 + Math.random() * 90},255,${Math.random() * 0.25})`;
        c.lineWidth = 1 + Math.random() * 3;
        c.beginPath();
        c.moveTo(Math.random() * w, Math.random() * h);
        c.bezierCurveTo(Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h, Math.random() * w, Math.random() * h);
        c.stroke();
      }
    });
    const m = std({ map: tex, roughness: 0.1, metalness: 0.2, envMapIntensity: 1.2 });
    m.userData.ownMap = true;
    const ball = add(new THREE.SphereGeometry(BOWL.BALL_R, 40, 28), m);
    const hole = std({ color: "#050505", roughness: 0.9 });
    for (const [x, y, z] of [[0.18, 0.95, 0.12], [-0.1, 0.96, 0.2], [0.02, 0.9, -0.15]]) {
      const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(BOWL.BALL_R * 0.98);
      add(new THREE.SphereGeometry(0.16, 10, 8), hole, v.x, v.y, v.z, false);
    }
    void ball;
  } else if (spec.part === "pin") {
    const prof = [[0, 0], [0.42, 0], [0.45, 0.06], [0.52, 0.4], [0.6, 0.9], [0.58, 1.3], [0.46, 1.8], [0.34, 2.3], [0.27, 2.65], [0.3, 2.95], [0.4, 3.2], [0.42, 3.4], [0.34, 3.55], [0, 3.62]];
    const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const tex = canvasTexture(THREE, 8, 256, (c, w, h) => {
      c.fillStyle = "#f6f6f2";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#c81e1e";
      // Lathe v = noktaların sırası: boyun bölgesi indeks 8-9 (≈0.62-0.69)
      for (const [a, b] of [[0.6, 0.65], [0.7, 0.75]]) c.fillRect(0, h * (1 - b), w, h * (b - a));
    });
    const m = std({ map: tex, roughness: 0.2, metalness: 0.05, envMapIntensity: 0.9 });
    m.userData.ownMap = true;
    add(lathe, m);
  }
  g.userData.isGamePart = true;
  return g;
}
