/**
 * 🀄 101 Okey — ıstaka analizi (saf mantık, three.js/rapier yok)
 *
 * Istaka 2 sıra × 12 yuvadır. Yan yana dizilmiş, boşlukla ayrılmış taş grupları "per" sayılır:
 *   Seri : aynı renk, ardışık sayı (en az 3). 12-13-1 geçerli, 13-1-2 geçersiz. 1 taşı 1 puandır.
 *   Grup : aynı sayı, farklı renkler (3 ya da 4 taş). Puan = sayı × taş sayısı.
 *   Okey (gösterge+1) joker: istenen taşın yerine geçer. Sahte okey (★) okeyin gerçek değerini taşır.
 * 101 ile açmak için geçerli perlerin toplamı en az 101 olmalı.
 */

export const SLOT_ROW = 12;
export const SLOTS = 24;
export const OPEN_POINTS = 101;

const low = (s) => String(s || "").toLowerCase();

/**
 * Yüz bilgisinden (metin + renk) taş çözümlemesi.
 * @param face {text, textColor}
 * @param okey {text, color} | null — gösterge sonrası belli olan okey taşı
 */
export function parseTile(face, okey) {
  const text = face?.text || "";
  const col = low(face?.textColor);
  if (text === "★") {
    // sahte okey: okeyin değerinde sıradan taş gibi davranır
    if (!okey) return { n: 0, c: "", wild: false, fake: true };
    return { n: parseInt(okey.text, 10) || 0, c: low(okey.color), wild: false, fake: true };
  }
  const n = parseInt(text, 10);
  if (!Number.isFinite(n)) return { n: 0, c: col, wild: false };
  const wild = !!okey && text === okey.text && col === low(okey.color);
  return { n, c: col, wild };
}

function trySet(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return null;
  const real = tiles.filter((t) => !t.wild);
  if (!real.length) return null;
  const n = real[0].n;
  if (!n || real.some((t) => t.n !== n)) return null;
  if (new Set(real.map((t) => t.c)).size !== real.length) return null; // aynı renk iki kez olamaz
  return { kind: "set", points: n * tiles.length };
}

function tryRun(tiles) {
  const len = tiles.length;
  if (len < 3 || len > 13) return null;
  const real = tiles.map((t, i) => ({ t, i })).filter((x) => !x.t.wild);
  if (!real.length) return null;
  const c = real[0].t.c;
  if (!c || real.some((x) => x.t.c !== c || !x.t.n)) return null;

  let best = null;
  for (const hi of [false, true]) {
    // hi: 1 taşları 14 (13'ten sonra gelen 1) olarak değerlendirilir
    const vals = real.map((x) => (hi && x.t.n === 1 ? 14 : x.t.n));
    const s = vals[0] - real[0].i;
    if (vals.some((v, k) => v !== s + real[k].i)) continue;
    if (s < 1 || s + len - 1 > 14) continue;
    let points = 0;
    for (let p = 0; p < len; p++) points += s + p === 14 ? 1 : s + p;
    if (!best || points > best.points) best = { kind: "run", points };
  }
  return best;
}

/** Tek bir taş grubunu değerlendirir */
export function evaluateGroup(tiles) {
  if (tiles.length < 3) return { valid: false, points: 0, kind: null, reason: "short" };
  const r = trySet(tiles) || tryRun(tiles);
  if (!r) return { valid: false, points: 0, kind: null, reason: "invalid" };
  return { valid: true, points: r.points, kind: r.kind };
}

/**
 * Istakayı değerlendirir.
 * @param slots (24) uzunlukta dizi: her eleman {face:{text,textColor}} ya da null
 * @returns { groups:[{from,to,tiles,valid,points,kind}], total, loose, canOpen }
 */
export function analyzeRack(slots, okey) {
  const groups = [];
  let total = 0;
  let loose = 0;
  for (let row = 0; row < 2; row++) {
    let start = -1;
    const flush = (end) => {
      if (start < 0) return;
      const tiles = [];
      for (let i = start; i <= end; i++) tiles.push(parseTile(slots[i].face, okey));
      const ev = evaluateGroup(tiles);
      groups.push({ from: start, to: end, ...ev });
      if (ev.valid) total += ev.points;
      else loose += tiles.length;
      start = -1;
    };
    for (let i = row * SLOT_ROW; i < (row + 1) * SLOT_ROW; i++) {
      if (slots[i]) {
        if (start < 0) start = i;
      } else flush(i - 1);
    }
    flush((row + 1) * SLOT_ROW - 1);
  }
  return { groups, total, loose, canOpen: total >= OPEN_POINTS };
}

/** Elden (hand girdileri: {f, d, s}) 24 yuvalık diziye */
export function rackSlots(hand, faceOf) {
  const slots = new Array(SLOTS).fill(null);
  hand.forEach((c, index) => {
    if (c.d !== "tile" || !Number.isInteger(c.s) || c.s < 0 || c.s >= SLOTS) return;
    slots[c.s] = { index, face: faceOf(c.f) };
  });
  return slots;
}

/**
 * Taşları diz: renge göre (renk, sayı) ya da sayıya göre (sayı, renk). Gruplar arasında bir boşluk bırakılır
 * ve bir grup satır sonunda yarım kalmaz. Sığmazsa boşluksuz sıkıştırılır.
 * @param items [{ key, n, col }] — n: sayı (0 = sahte okey / bilinmeyen), col: renk dizgisi
 * @returns { key → slot } haritası
 */
export function layoutSort(items, mode, colorOrder = []) {
  const ci = (col) => {
    const i = colorOrder.indexOf(low(col));
    return i < 0 ? 99 : i;
  };
  const sorted = items.slice().sort((a, b) => {
    const fa = a.n === 0 ? 1 : 0;
    const fb = b.n === 0 ? 1 : 0;
    if (fa !== fb) return fa - fb; // sahte okey en sonda
    if (mode === "num") return a.n - b.n || ci(a.col) - ci(b.col) || String(a.col).localeCompare(String(b.col));
    return ci(a.col) - ci(b.col) || String(a.col).localeCompare(String(b.col)) || a.n - b.n;
  });
  const groupKey = (it) => (it.n === 0 ? "fake" : mode === "num" ? String(it.n) : low(it.col));
  const groups = [];
  for (const it of sorted) {
    const k = groupKey(it);
    const last = groups[groups.length - 1];
    if (last && last.k === k) last.items.push(it);
    else groups.push({ k, items: [it] });
  }

  const place = (gaps) => {
    const out = new Map();
    let pos = 0;
    for (const g of groups) {
      const len = g.items.length;
      if (gaps && len <= SLOT_ROW && (pos % SLOT_ROW) + len > SLOT_ROW) pos = (Math.floor(pos / SLOT_ROW) + 1) * SLOT_ROW;
      for (const it of g.items) {
        if (pos >= SLOTS) return null;
        out.set(it.key, pos++);
      }
      if (gaps) pos++; // grup arası boşluk
    }
    return out;
  };
  return place(true) || place(false);
}
