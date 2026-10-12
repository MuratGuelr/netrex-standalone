/**
 * 🎲 Büyük verileri (mod, tam masa durumu) LiveKit veri kanalından göndermek için parçalama + sıkıştırma.
 * Tek paket ~15 KB'ı geçmemeli; daha büyük veri 12 KB'lık parçalara bölünür, alıcıda birleştirilir.
 */

const CHUNK_CHARS = 12_000;
const MAX_TOTAL_CHARS = 5_000_000; // alıcı tarafı üst sınırı (≈ sıkıştırılmış mod boyutundan fazlası)
const MAX_PENDING = 6; // aynı anda birleştirilen en fazla ileti sayısı (bellek koruması)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── base64 <-> bytes (büyük dizilerde 'apply' sınırını aşmamak için parça parça) ──
function bytesToB64(bytes) {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function streamBytes(stream, input) {
  const writer = stream.writable.getWriter();
  writer.write(input);
  writer.close();
  const buf = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/** JSON nesnesi → gzip → base64 metni (CompressionStream yoksa sıkıştırmasız) */
export async function packJson(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === "undefined") return { z: 0, d: json }; // sıkıştırma yoksa ham JSON
  const gz = await streamBytes(new CompressionStream("gzip"), bytes);
  return { z: 1, d: bytesToB64(gz) };
}

/** packJson çıktısı → nesne */
export async function unpackJson({ z, d }, maxChars = MAX_TOTAL_CHARS * 4) {
  if (typeof d !== "string" || d.length > MAX_TOTAL_CHARS) throw new Error("Veri çok büyük.");
  if (!z) {
    if (d.length > maxChars) throw new Error("Veri çok büyük.");
    return JSON.parse(d); // z=0: d ham JSON metnidir
  }
  if (typeof DecompressionStream === "undefined") throw new Error("Bu cihaz sıkıştırılmış modu açamıyor.");
  const bytes = await streamBytes(new DecompressionStream("gzip"), b64ToBytes(d));
  if (bytes.length > maxChars) throw new Error("Veri çok büyük.");
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Metni parçalara böler */
export function chunkString(str, size = CHUNK_CHARS) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out.length ? out : [""];
}

/**
 * Nesneyi (gerekirse sıkıştırarak) parçalı gönderir.
 * @param publish (topic, obj, dest) => void  — güvenilir (reliable) gönderim yapmalı
 */
export async function sendChunked(publish, topic, obj, dest, { compress = false, onProgress } = {}) {
  const packed = compress ? await packJson(obj) : { z: 0, d: JSON.stringify(obj) };
  const parts = chunkString(packed.d);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  for (let i = 0; i < parts.length; i++) {
    publish(topic, { c: 1, id, i, n: parts.length, z: packed.z, d: parts[i] }, dest);
    onProgress?.(i + 1, parts.length);
    if ((i + 1) % 8 === 0) await sleep(25); // gönderim tamponunu taşırma
  }
  return parts.length;
}

/** Alıcı tarafı: parçaları birleştirir */
export class Reassembler {
  constructor() {
    this.pending = new Map(); // key -> { parts:[], got, n, z, at }
  }

  /** Parça geçerliyse ve iletinin tamamı geldiyse { z, d } döner, değilse null */
  push(from, msg) {
    if (!msg || msg.c !== 1 || typeof msg.id !== "string" || typeof msg.d !== "string") return null;
    const n = Number(msg.n);
    const i = Number(msg.i);
    if (!Number.isInteger(n) || !Number.isInteger(i) || n < 1 || n > 600 || i < 0 || i >= n) return null;
    if (msg.d.length > CHUNK_CHARS * 2) return null;

    const key = `${from}:${msg.id}`;
    let p = this.pending.get(key);
    if (!p) {
      if (this.pending.size >= MAX_PENDING) {
        // En eskiyi at
        const oldest = [...this.pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) this.pending.delete(oldest[0]);
      }
      p = { parts: new Array(n), got: 0, n, z: msg.z ? 1 : 0, at: Date.now(), chars: 0 };
      this.pending.set(key, p);
    }
    if (p.n !== n || p.parts[i] !== undefined) return null;
    p.parts[i] = msg.d;
    p.got++;
    p.chars += msg.d.length;
    if (p.chars > MAX_TOTAL_CHARS) {
      this.pending.delete(key);
      return null;
    }
    if (p.got < p.n) return null;
    this.pending.delete(key);
    return { z: p.z, d: p.parts.join("") };
  }

  clear() {
    this.pending.clear();
  }
}

/** Birleştirilmiş veriyi nesneye çevirir (sıkıştırma bayrağına göre) */
export async function openChunked({ z, d }) {
  return unpackJson({ z, d });
}
