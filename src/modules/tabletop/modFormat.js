/**
 * 🎲 Masa modu formatı (SADECE VERİ — hiçbir kod çalıştırılmaz)
 *
 * Bir mod: JSON dosyası. Görseller `data:image/...;base64` olarak İÇİNE gömülür (dış bağlantı yok → IP sızıntısı yok,
 * yükleme sırasında ağdan bir şey çekilmez). Her alan burada sıkı biçimde doğrulanır ve temizlenir.
 *
 * Ham biçim (kullanıcının yazdığı / paylaştığı):
 * {
 *   "format": "netrex-tabletop", "version": 1,
 *   "name": "...", "author": "...", "description": "...",
 *   "assets": { "arka": "data:image/png;base64,...", ... },       // anahtar: [a-z0-9_-]{1,32}
 *   "table": { "color": "#1f5c3a", "image": "assetAnahtari" },     // isteğe bağlı masa örtüsü
 *   "items": [
 *     { "type": "deck",  "name": "...", "back": Face, "cards": [ { "face": Face, "count": 2 }, ... ], "shuffle": true, "faceUp": false, "pos": [x, z] },
 *     { "type": "tile",  "back": Face, "tiles": [ { "face": Face, "count": 2 }, ... ], ... },            // okey taşı gibi kalın parçalar
 *     { "type": "die",   "count": 2 },
 *     { "type": "piece", "count": 4, "color": "#ff0000", "shape": "cyl"|"cube", "label": "K", "labelColor": "#fff", "pos": [x,z] },
 *     { "type": "board", "image": "assetAnahtari", "size": [w, d], "pos": [x, z] }
 *   ]
 * }
 * Face = { "image": assetKey, "color": "#rrggbb", "text": "kısa yazı", "textColor": "#rrggbb" }
 *
 * `validateMod` ham modu "derlenmiş" biçime çevirir: yüzler tek tabloda (faces), nesneler genişletilmiş (objects).
 */

export const MOD_FORMAT = "netrex-tabletop";

export const LIMITS = {
  name: 60,
  author: 40,
  description: 300,
  text: 24,
  maxObjects: 200,
  maxCardsPerDeck: 120,
  maxFaces: 400,
  maxAssets: 300,
  maxAssetChars: 560_000, // ~400 KB ikili veri (base64)
  maxTotalChars: 3_400_000, // ~2.5 MB ikili veri
  maxFileChars: 7_000_000, // dosya yüklerken ham sınır
  maxCountPerItem: 120,
};

export const TABLE_BOUNDS = { x: 18, z: 11 };

const GAMES = new Set(["okey101"]); // modun özel kurulum/kural desteği (veri etiketi; kod çalıştırmaz)
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const KEY_RE = /^[a-z0-9_-]{1,32}$/;
const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const cleanText = (v, max) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const int = (v, def, a, b) => clamp(Number.isFinite(Number(v)) ? Math.round(Number(v)) : def, a, b);
const color = (v, def) => (typeof v === "string" && COLOR_RE.test(v) ? v.toLowerCase() : def);

function cleanPos(p) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const x = Number(p[0]);
  const z = Number(p[1]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return [clamp(x, -TABLE_BOUNDS.x, TABLE_BOUNDS.x), clamp(z, -TABLE_BOUNDS.z, TABLE_BOUNDS.z)];
}

/** Ham modu doğrular ve derler. Geçersizse Error fırlatır (mesajı kullanıcıya gösterilebilir). */
export function validateMod(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Geçersiz mod dosyası.");
  if (raw.format !== MOD_FORMAT) throw new Error("Bu bir Netrex masa modu değil.");
  if (Number(raw.version) !== 1) throw new Error("Desteklenmeyen mod sürümü.");

  const name = cleanText(raw.name, LIMITS.name);
  if (!name) throw new Error("Modun bir adı olmalı.");

  // ── Görseller ──
  const assets = {};
  let total = 0;
  const rawAssets = raw.assets && typeof raw.assets === "object" ? raw.assets : {};
  const keys = Object.keys(rawAssets);
  if (keys.length > LIMITS.maxAssets) throw new Error("Çok fazla görsel.");
  for (const k of keys) {
    const v = rawAssets[k];
    if (!KEY_RE.test(k)) throw new Error(`Geçersiz görsel anahtarı: ${k.slice(0, 20)}`);
    if (typeof v !== "string" || v.length > LIMITS.maxAssetChars || !DATA_URL_RE.test(v)) {
      throw new Error(`Görsel geçersiz ya da çok büyük: ${k}`);
    }
    total += v.length;
    if (total > LIMITS.maxTotalChars) throw new Error("Modun toplam görsel boyutu sınırı aştı (~2.5 MB).");
    assets[k] = v;
  }

  // ── Yüz tablosu (tekilleştirilir) ──
  const faces = [];
  const faceIndex = new Map();
  const face = (f, fallbackColor = "#ffffff") => {
    const o = f && typeof f === "object" ? f : {};
    const image = typeof o.image === "string" && assets[o.image] ? o.image : undefined;
    const clean = {
      ...(image ? { image } : {}),
      color: color(o.color, fallbackColor),
      ...(cleanText(o.text, LIMITS.text) ? { text: cleanText(o.text, LIMITS.text) } : {}),
      ...(o.textColor ? { textColor: color(o.textColor, "#111111") } : {}),
    };
    const key = JSON.stringify(clean);
    if (faceIndex.has(key)) return faceIndex.get(key);
    if (faces.length >= LIMITS.maxFaces) throw new Error("Çok fazla farklı kart yüzü.");
    faces.push(clean);
    faceIndex.set(key, faces.length - 1);
    return faces.length - 1;
  };

  // ── Nesneler ──
  const objects = [];
  const push = (o) => {
    if (objects.length >= LIMITS.maxObjects) throw new Error(`Bir modda en fazla ${LIMITS.maxObjects} nesne olabilir.`);
    objects.push(o);
  };
  const items = Array.isArray(raw.items) ? raw.items : [];
  if (items.length > 400) throw new Error("Çok fazla öğe.");

  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const pos = cleanPos(it.pos);
    if (it.type === "die") {
      const n = int(it.count, 1, 1, 24);
      for (let i = 0; i < n; i++) push({ kind: "die" });
    } else if (it.type === "piece") {
      const n = int(it.count, 1, 1, LIMITS.maxCountPerItem);
      const base = {
        kind: "piece",
        color: color(it.color, "#e74c3c"),
        shape: it.shape === "cube" ? "cube" : "cyl",
        ...(cleanText(it.label, 4) ? { label: cleanText(it.label, 4), labelColor: color(it.labelColor, "#ffffff") } : {}),
        ...(pos ? { pos } : {}),
      };
      for (let i = 0; i < n; i++) push({ ...base });
    } else if (it.type === "deck" || it.type === "tile") {
      const dim = it.type === "tile" ? "tile" : "card";
      const list = Array.isArray(dim === "tile" ? it.tiles : it.cards) ? (dim === "tile" ? it.tiles : it.cards) : [];
      const cards = [];
      for (const c of list) {
        const f = face(c?.face ?? c, dim === "tile" ? "#f3ead2" : "#ffffff");
        const n = int(c?.count, 1, 1, LIMITS.maxCardsPerDeck);
        for (let i = 0; i < n; i++) cards.push(f);
        if (cards.length > LIMITS.maxCardsPerDeck) throw new Error(`Bir destede en fazla ${LIMITS.maxCardsPerDeck} kart olabilir.`);
      }
      if (!cards.length) continue;
      push({
        kind: "deck",
        dim,
        cards,
        back: face(it.back, dim === "tile" ? "#c9b98f" : "#1e3a8a"),
        up: it.faceUp === true,
        shuffle: it.shuffle !== false,
        ...(pos ? { pos } : {}),
      });
    } else if (it.type === "board") {
      const image = typeof it.image === "string" && assets[it.image] ? it.image : undefined;
      const sz = Array.isArray(it.size) ? it.size : [20, 20];
      push({
        kind: "board",
        ...(image ? { image } : {}),
        color: color(it.color, "#cbb58a"),
        w: clamp(Number(sz[0]) || 20, 4, 38),
        d: clamp(Number(sz[1]) || 20, 4, 24),
        ...(pos ? { pos } : {}),
      });
    }
  }

  const t = raw.table && typeof raw.table === "object" ? raw.table : {};
  return {
    format: MOD_FORMAT,
    version: 1,
    name,
    author: cleanText(raw.author, LIMITS.author),
    description: cleanText(raw.description, LIMITS.description),
    ...(GAMES.has(raw.game) ? { game: raw.game } : {}),
    assets,
    faces,
    table: {
      color: color(t.color, "#1f5c3a"),
      ...(typeof t.image === "string" && assets[t.image] ? { image: t.image } : {}),
    },
    objects,
  };
}

/** Dosya içeriğini (metin) güvenle ayrıştırıp doğrular. */
export function parseModText(text) {
  if (typeof text !== "string" || text.length > LIMITS.maxFileChars) throw new Error("Dosya çok büyük.");
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error("Dosya geçerli bir JSON değil.");
  }
  // Daha önce "dışa aktarılmış" (derlenmiş) mod da yüklenebilsin
  if (raw && raw.format === MOD_FORMAT && Array.isArray(raw.objects) && Array.isArray(raw.faces)) return validateCompiled(raw);
  return validateMod(raw);
}

/** Derlenmiş mod → paylaşılabilir ham mod (derlenmiş biçim de validateMod'dan geçemez; bu yüzden ayrı bir sıkıştırma biçimi kullanılır) */
export function modSizeChars(mod) {
  return Object.values(mod.assets || {}).reduce((n, s) => n + s.length, 0);
}

/** Derlenmiş bir nesne tanımını sınırlar (ağdan / dosyadan gelen veriye güvenilmez) */
function cleanObject(o, faceCount, assets) {
  if (!o || typeof o !== "object") return null;
  const pos = cleanPos(o.pos);
  const fi = (n) => clamp(Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0, 0, Math.max(0, faceCount - 1));
  if (o.kind === "die") return { kind: "die" };
  if (o.kind === "piece") {
    return {
      kind: "piece",
      color: color(o.color, "#e74c3c"),
      shape: o.shape === "cube" ? "cube" : "cyl",
      ...(cleanText(o.label, 4) ? { label: cleanText(o.label, 4), labelColor: color(o.labelColor, "#ffffff") } : {}),
      ...(pos ? { pos } : {}),
    };
  }
  if (o.kind === "deck") {
    if ((o.dim !== "card" && o.dim !== "tile") || !Array.isArray(o.cards) || !o.cards.length || !faceCount) return null;
    return {
      kind: "deck",
      dim: o.dim,
      cards: o.cards.slice(0, LIMITS.maxCardsPerDeck).map(fi),
      back: fi(o.back),
      up: o.up === true,
      shuffle: o.shuffle !== false,
      ...(pos ? { pos } : {}),
    };
  }
  if (o.kind === "board") {
    return {
      kind: "board",
      ...(typeof o.image === "string" && assets[o.image] ? { image: o.image } : {}),
      color: color(o.color, "#cbb58a"),
      w: clamp(Number(o.w) || 20, 4, 38),
      d: clamp(Number(o.d) || 20, 4, 24),
      ...(pos ? { pos } : {}),
    };
  }
  return null;
}

/** Alınan DERLENMİŞ modu (ağdan gelen) yeniden doğrular: yüz tablosu, görseller ve nesneler sınırlar içinde mi? */
export function validateCompiled(m) {
  if (!m || typeof m !== "object") throw new Error("Geçersiz mod.");
  const assets = {};
  let total = 0;
  for (const [k, v] of Object.entries(m.assets || {})) {
    if (!KEY_RE.test(k) || typeof v !== "string" || v.length > LIMITS.maxAssetChars || !DATA_URL_RE.test(v)) throw new Error("Geçersiz görsel.");
    total += v.length;
    if (total > LIMITS.maxTotalChars) throw new Error("Mod çok büyük.");
    assets[k] = v;
  }
  const faces = Array.isArray(m.faces) ? m.faces.slice(0, LIMITS.maxFaces) : [];
  const faceOk = faces.map((f) => {
    const o = f && typeof f === "object" ? f : {};
    return {
      ...(typeof o.image === "string" && assets[o.image] ? { image: o.image } : {}),
      color: color(o.color, "#ffffff"),
      ...(cleanText(o.text, LIMITS.text) ? { text: cleanText(o.text, LIMITS.text) } : {}),
      ...(o.textColor ? { textColor: color(o.textColor, "#111111") } : {}),
    };
  });
  const objects = (Array.isArray(m.objects) ? m.objects : [])
    .slice(0, LIMITS.maxObjects)
    .map((o) => cleanObject(o, faceOk.length, assets))
    .filter(Boolean);
  const t = m.table && typeof m.table === "object" ? m.table : {};
  return {
    format: MOD_FORMAT,
    version: 1,
    name: cleanText(m.name, LIMITS.name) || "Mod",
    author: cleanText(m.author, LIMITS.author),
    description: cleanText(m.description, LIMITS.description),
    ...(GAMES.has(m.game) ? { game: m.game } : {}),
    assets,
    faces: faceOk,
    table: { color: color(t.color, "#1f5c3a"), ...(typeof t.image === "string" && assets[t.image] ? { image: t.image } : {}) },
    objects,
  };
}

// ───────────────── Hazır modlar (görsel gerektirmeyenler) ─────────────────
export const BUILTIN_MODS = [
  { id: "classic", name: "Klasik Set", description: "2 zar ve 4 renkli parça" },
  { id: "cards", name: "İskambil Destesi", description: "54 kartlık deste (2 joker), karışık ve kapalı" },
  { id: "okey", name: "101 Okey", description: "106 taş, ıstaka, 21/22 taş dağıtımı, gösterge ve okey" },
  { id: "chess", name: "Satranç", description: "Tahta ve 32 taş" },
];

const SUITS = [
  ["♠", "#111111"],
  ["♥", "#c0392b"],
  ["♦", "#c0392b"],
  ["♣", "#111111"],
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/**
 * Hazır modu derlenmiş biçimde üretir.
 * `helpers.boardDataUrl` (tarayıcıda canvas ile satranç tahtası görseli) verilmezse tahta düz renkli olur.
 */
export function buildBuiltin(id, helpers = {}) {
  const raw = { format: MOD_FORMAT, version: 1, assets: {}, items: [] };
  if (id === "classic") {
    raw.name = "Klasik Set";
    raw.items = [
      { type: "die", count: 2 },
      { type: "piece", count: 1, color: "#e74c3c" },
      { type: "piece", count: 1, color: "#3498db" },
      { type: "piece", count: 1, color: "#f1c40f" },
      { type: "piece", count: 1, color: "#2ecc71" },
    ];
  } else if (id === "cards") {
    raw.name = "İskambil Destesi";
    const cards = [];
    for (const [s, c] of SUITS) for (const r of RANKS) cards.push({ face: { text: `${r}${s}`, textColor: c, color: "#ffffff" } });
    cards.push({ face: { text: "JOKER", textColor: "#c0392b", color: "#fff8dc" }, count: 2 });
    raw.items = [{ type: "deck", cards, back: { color: "#1e3a8a", text: "NETREX", textColor: "#93c5fd" }, shuffle: true, pos: [0, 0] }, { type: "die", count: 1 }];
  } else if (id === "okey") {
    raw.name = "101 Okey";
    raw.game = "okey101";
    raw.description = "4 kişilik 101 Okey: 106 taş (1-13 ×4 renk ×2 + 2 sahte okey). Taş yığınına sağ tık → 101 Okey Dağıt.";
    const colors = [["#111111", "#f3ead2"], ["#c0392b", "#f3ead2"], ["#1f6fb5", "#f3ead2"], ["#d4a017", "#f3ead2"]];
    const tiles = [];
    for (const [c, bg] of colors) for (let n = 1; n <= 13; n++) tiles.push({ face: { text: String(n), textColor: c, color: bg }, count: 2 });
    tiles.push({ face: { text: "★", textColor: "#16a34a", color: "#f3ead2" }, count: 2 }); // sahte okey
    raw.items = [{ type: "tile", tiles, back: { color: "#c9b98f" }, shuffle: true, pos: [0, 0] }];
  } else if (id === "chess") {
    raw.name = "Satranç";
    const hasBoard = !!helpers.boardDataUrl;
    if (hasBoard) raw.assets.board = helpers.boardDataUrl;
    raw.items = [{ type: "board", size: [19.2, 19.2], color: "#cbb58a", ...(hasBoard ? { image: "board" } : {}), pos: [0, 0] }];
    const sq = 2.4;
    const at = (file, rank) => [(file - 3.5) * sq, (3.5 - rank) * sq];
    const back = ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"];
    for (let f = 0; f < 8; f++) {
      raw.items.push({ type: "piece", color: "#f1ece0", label: back[f], labelColor: "#111111", pos: at(f, 7) });
      raw.items.push({ type: "piece", color: "#f1ece0", label: "♟", labelColor: "#111111", pos: at(f, 6) });
      raw.items.push({ type: "piece", color: "#2b2b30", label: back[f], labelColor: "#f1ece0", pos: at(f, 0) });
      raw.items.push({ type: "piece", color: "#2b2b30", label: "♟", labelColor: "#f1ece0", pos: at(f, 1) });
    }
  } else {
    throw new Error("Bilinmeyen hazır mod.");
  }
  return validateMod(raw);
}
