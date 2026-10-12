/**
 * 🎲 Tarayıcıda mod oluşturma yardımcıları (canvas gerektirir).
 * Kullanıcının seçtiği görseller küçültülüp JPEG'e çevrilir: hem paylaşım boyutu küçük kalır hem de
 * SVG gibi riskli biçimler hiç içeri girmez (her şey canvas'tan geçip yeniden kodlanır).
 */
import { MOD_FORMAT, validateMod, LIMITS, buildBuiltin } from "./modFormat";

/** Dosya → küçültülmüş JPEG data URL */
export async function imageFileToDataUrl(file, maxSide = 420, quality = 0.82) {
  if (!file || !/^image\//.test(file.type) || /svg/i.test(file.type)) throw new Error("Sadece PNG / JPEG / WebP görseller.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Görsel çok büyük (en fazla 12 MB).");
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; // saydam alanlar beyaz olsun
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const url = c.toDataURL("image/jpeg", quality);
  if (url.length > LIMITS.maxAssetChars) throw new Error("Görsel küçültüldükten sonra bile çok büyük.");
  return url;
}

/** Satranç tahtası görseli (hazır mod için, canvas ile üretilir) */
export function chessBoardDataUrl() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const q = 64;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#e8d3a8" : "#9c6b3d";
      g.fillRect(x * q, y * q, q, q);
    }
  }
  return c.toDataURL("image/jpeg", 0.85);
}

/** Hazır modu üretir (satranç tahtası görseli tarayıcıda çizilir) */
export function buildBuiltinInBrowser(id) {
  return buildBuiltin(id, id === "chess" ? { boardDataUrl: chessBoardDataUrl() } : {});
}

/**
 * Görsellerden deste modu: her ön yüz görseli bir kart olur.
 * @param {{name, author, description, back: File, fronts: File[], cardBackColor?: string}} p
 */
export async function buildDeckMod(p) {
  if (!p.fronts?.length) throw new Error("En az bir kart görseli seçin.");
  if (p.fronts.length > LIMITS.maxCardsPerDeck) throw new Error(`En fazla ${LIMITS.maxCardsPerDeck} kart.`);
  const assets = {};
  const cards = [];
  for (let i = 0; i < p.fronts.length; i++) {
    const key = `k${i}`;
    assets[key] = await imageFileToDataUrl(p.fronts[i], 420);
    cards.push({ face: { image: key } });
  }
  let back = { color: p.cardBackColor || "#1e3a8a" };
  if (p.back) {
    assets.arka = await imageFileToDataUrl(p.back, 420);
    back = { image: "arka" };
  }
  return validateMod({
    format: MOD_FORMAT,
    version: 1,
    name: p.name,
    author: p.author,
    description: p.description,
    assets,
    items: [
      { type: "deck", cards, back, shuffle: true, pos: [0, 0] },
      { type: "die", count: 2 },
    ],
  });
}

/** Tek görselden tahta modu (+ isteğe bağlı parçalar) */
export async function buildBoardMod(p) {
  if (!p.board) throw new Error("Bir tahta görseli seçin.");
  const assets = { tahta: await imageFileToDataUrl(p.board, 900, 0.85) };
  const items = [{ type: "board", image: "tahta", size: [p.width || 24, p.depth || 24], pos: [0, 0] }];
  const colors = ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#9b59b6", "#e67e22"];
  const pieces = Math.max(0, Math.min(6, p.pieces ?? 4));
  for (let i = 0; i < pieces; i++) items.push({ type: "piece", color: colors[i], count: 1, pos: [-16 + i * 2.8, 10] });
  items.push({ type: "die", count: Math.max(0, Math.min(4, p.dice ?? 2)) || 1 });
  return validateMod({ format: MOD_FORMAT, version: 1, name: p.name, author: p.author, description: p.description, assets, items });
}

/** Atölye kartı için küçük önizleme (ilk görsel ya da mod renginden) */
export async function makeThumb(mod) {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = mod.table?.color || "#1f5c3a";
  g.fillRect(0, 0, 96, 96);
  const first = Object.values(mod.assets || {})[0];
  if (first) {
    try {
      const img = new Image();
      img.src = first;
      await img.decode();
      const s = Math.max(96 / img.width, 96 / img.height);
      g.drawImage(img, (96 - img.width * s) / 2, (96 - img.height * s) / 2, img.width * s, img.height * s);
    } catch (e) {}
  } else {
    g.fillStyle = "#ffffff";
    g.font = "bold 44px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText((mod.name || "?").slice(0, 1).toUpperCase(), 48, 52);
  }
  return c.toDataURL("image/jpeg", 0.7);
}

/** Modu .json olarak indir */
export function downloadModFile(mod) {
  const blob = new Blob([JSON.stringify(mod)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(mod.name || "mod").replace(/[^\w.-]+/g, "_").slice(0, 40)}.netrexmod.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
