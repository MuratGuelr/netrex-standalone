/**
 * 🎲 Masa Atölyesi — Firestore servisi
 *
 * Koleksiyon: tabletop_mods/{modId}
 *   alanlar: name, author, authorId, description, tags[], thumb (küçük data URL), parts (sayı), size (karakter),
 *            objects (sayı), status ('pending' | 'active'), downloads, ratingSum, ratingCount, reports, createdAt
 *   alt koleksiyon  parts/{n}   : { i, d }  → sıkıştırılmış mod verisinin parçaları (her biri < 1 MB)
 *   alt koleksiyon  ratings/{uid}: { value: 1..5 }
 *   alt koleksiyon  reports/{uid}: { at }
 *
 * Mod verisi başka bir hizmete (Cloudinary vb.) gitmez: gzip + base64 ile doğrudan Firestore'da tutulur.
 * Modlar yalnızca VERİdir (bkz. modFormat.js): indirildiğinde kod çalışmaz, her alan yeniden doğrulanır.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, limit,
  serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { packJson, unpackJson } from "./modPack";
import { validateCompiled, LIMITS } from "./modFormat";

const COL = "tabletop_mods";
const PART_CHARS = 700_000; // Firestore belge sınırı (1 MiB) altında kalsın
const MAX_PARTS = 6;
const REPORT_HIDE_AT = 5;

const SORTS = {
  new: ["createdAt", "desc"],
  popular: ["downloads", "desc"],
  top: ["ratingSum", "desc"],
};

/** Atölyedeki modları listeler (gizlenenler/bekleyenler elenir) */
export async function listMods(sort = "new", max = 40) {
  const [field, dir] = SORTS[sort] || SORTS.new;
  const snap = await getDocs(query(collection(db, COL), orderBy(field, dir), limit(max)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.status === "active" && (m.reports || 0) < REPORT_HIDE_AT);
}

/** Bir modu indirir, açar ve yeniden doğrular. İndirme sayacını artırır. */
export async function downloadMod(modId) {
  const meta = await getDoc(doc(db, COL, modId));
  if (!meta.exists()) throw new Error("Mod bulunamadı.");
  const m = meta.data();
  const n = Number(m.parts);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARTS) throw new Error("Mod bozuk.");
  const parts = await getDocs(query(collection(db, COL, modId, "parts"), orderBy("i", "asc")));
  const list = parts.docs.map((d) => d.data());
  if (list.length !== n) throw new Error("Mod eksik indirildi, tekrar deneyin.");
  const obj = await unpackJson({ z: 1, d: list.map((p) => p.d).join("") });
  const mod = validateCompiled(obj);
  updateDoc(doc(db, COL, modId), { downloads: increment(1) }).catch(() => {});
  return mod;
}

/** Derlenmiş bir modu Atölye'ye yayınlar */
export async function publishMod(mod, { uid, authorName, description, tags = [], thumb }) {
  if (!uid) throw new Error("Yayınlamak için giriş yapın.");
  const packed = await packJson(mod);
  if (!packed.z) throw new Error("Bu cihaz sıkıştırmayı desteklemiyor, yayınlanamadı.");
  const chars = packed.d.length;
  if (chars > PART_CHARS * MAX_PARTS) throw new Error("Mod Atölye için çok büyük (en fazla ~3 MB sıkıştırılmış).");
  const chunks = [];
  for (let i = 0; i < chars; i += PART_CHARS) chunks.push(packed.d.slice(i, i + PART_CHARS));

  const ref = doc(collection(db, COL));
  const clean = (s, n) => String(s || "").slice(0, n);
  await setDoc(ref, {
    name: clean(mod.name, LIMITS.name),
    author: clean(authorName, LIMITS.author),
    authorId: uid,
    description: clean(description ?? mod.description, LIMITS.description),
    tags: tags.slice(0, 5).map((t) => clean(t, 20)),
    thumb: thumb && thumb.length < 40_000 ? thumb : "",
    parts: chunks.length,
    size: chars,
    objects: mod.objects.length,
    status: "pending",
    downloads: 0,
    ratingSum: 0,
    ratingCount: 0,
    reports: 0,
    createdAt: serverTimestamp(),
  });
  try {
    for (let i = 0; i < chunks.length; i++) {
      await setDoc(doc(db, COL, ref.id, "parts", String(i)), { i, d: chunks[i] });
    }
    await updateDoc(ref, { status: "active" });
  } catch (e) {
    // Yarım kalan yüklemeyi temizle
    await deleteMod(ref.id).catch(() => {});
    throw e;
  }
  return ref.id;
}

export async function deleteMod(modId) {
  const parts = await getDocs(collection(db, COL, modId, "parts"));
  await Promise.all(parts.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, COL, modId));
}

/** 1-5 puan ver (daha önce verdiyse günceller) */
export async function rateMod(modId, uid, value) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  const rref = doc(db, COL, modId, "ratings", uid);
  const prev = await getDoc(rref);
  const old = prev.exists() ? Number(prev.data().value) || 0 : 0;
  await setDoc(rref, { value: v });
  await updateDoc(doc(db, COL, modId), {
    ratingSum: increment(v - old),
    ratingCount: increment(old ? 0 : 1),
  });
  return v;
}

export async function getMyRating(modId, uid) {
  const s = await getDoc(doc(db, COL, modId, "ratings", uid));
  return s.exists() ? Number(s.data().value) || 0 : 0;
}

/** Uygunsuz/telifli içeriği bildir (kişi başı bir kez). Belli sayıya ulaşınca liste dışı kalır. */
export async function reportMod(modId, uid) {
  const rref = doc(db, COL, modId, "reports", uid);
  if ((await getDoc(rref)).exists()) return false;
  await setDoc(rref, { at: serverTimestamp() });
  await updateDoc(doc(db, COL, modId), { reports: increment(1) });
  return true;
}
