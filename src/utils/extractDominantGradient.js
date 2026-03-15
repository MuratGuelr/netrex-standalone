/**
 * extractDominantGradient
 * ─────────────────────────────────────────────────────────────────
 * Bir File / Blob / URL'den iki belirgin renk çıkarır ve
 * güzel bir CSS linear-gradient string döndürür.
 *
 * Algoritma:
 *   1. Resmi küçük bir canvas'a çizer (64×64 px yeterli)
 *   2. Pikselleri örnekler; çok koyu / çok açık / renksiz pikselleri eler
 *   3. Kalan pikselleri RGB kümelere ayırır (k-means benzeri, 2 merkez)
 *   4. Her kümenin "parlak" bir temsilcisini seçer
 *   5. Gradient string üretir: 135deg, start → end
 *
 * @param {File | Blob | string} source  – File nesnesi veya image URL
 * @param {object}  [opts]
 * @param {number}  [opts.angle=135]     – gradient açısı
 * @param {number}  [opts.satBoost=1.15] – doygunluk güçlendirme katsayısı
 * @param {number}  [opts.lightTarget=0.52] – hedef parlaklık (0-1)
 * @returns {Promise<string>}  "linear-gradient(135deg, #rrggbb 0%, #rrggbb 100%)"
 */
export async function extractDominantGradient(source, opts = {}) {
  const { angle = 135, satBoost = 1.15, lightTarget = 0.52 } = opts;

  // ── 1. Resmi yükle ──────────────────────────────────────────────────────────
  const src = typeof source === "string" ? source : URL.createObjectURL(source);

  let revokeOnDone = typeof source !== "string";

  try {
    const pixels = await loadPixels(src, 64);

    // ── 2. Ön eleme: çok koyu / çok açık / renksiz pikselleri at ───────────────
    const candidates = pixels.filter(([r, g, b]) => {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 510; // 0-1
      const sat = max === 0 ? 0 : (max - min) / max; // 0-1
      return lum > 0.08 && lum < 0.92 && sat > 0.12;
    });

    // Renk bulunamazsa basit fallback gradient
    if (candidates.length < 10) {
      return `linear-gradient(${angle}deg, #6366f1 0%, #a855f7 100%)`;
    }

    // ── 3. 2-means kümeleme (10 iterasyon) ────────────────────────────────────
    const [c1, c2] = kMeans2(candidates, 10);

    // ── 4. Her kümenin parlak temsilcisini hesapla ─────────────────────────────
    const start = enhance(c1, satBoost, lightTarget);
    const end = enhance(c2, satBoost, lightTarget);

    // ── 5. Aralarındaki mesafeyi kontrol et; çok yakınsa birini kaydır ────────
    const dist = colorDistance(start, end);
    let finalEnd = end;
    if (dist < 60) {
      // Çok benzer renkler → birini daha koyu / daha tonlu yap
      finalEnd = shift(end, -0.18);
    }

    return `linear-gradient(${angle}deg, ${toHex(start)} 0%, ${toHex(finalEnd)} 100%)`;
  } finally {
    if (revokeOnDone) URL.revokeObjectURL(src);
  }
}

// ── Yardımcılar ─────────────────────────────────────────────────────────────

/** Canvas'a çiz, piksel dizisi döndür [[r,g,b], …] */
function loadPixels(url, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const pixels = [];
        // Her 4. pikseli örnekle (hız için)
        for (let i = 0; i < data.length; i += 16) {
          const alpha = data[i + 3];
          if (alpha < 128) continue; // şeffaf pikseli atla
          pixels.push([data[i], data[i + 1], data[i + 2]]);
        }
        resolve(pixels);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Resim yüklenemedi"));
    img.src = url;
  });
}

/** Basit 2-means kümeleme */
function kMeans2(pixels, iterations) {
  if (pixels.length === 0)
    return [
      [99, 102, 241],
      [168, 85, 247],
    ];

  // Başlangıç merkezleri: en uzak iki renk
  let c1 = [...pixels[0]];
  let c2 = [...pixels[Math.floor(pixels.length / 2)]];

  for (let iter = 0; iter < iterations; iter++) {
    const g1 = [],
      g2 = [];

    for (const p of pixels) {
      colorDistance(p, c1) <= colorDistance(p, c2) ? g1.push(p) : g2.push(p);
    }

    const newC1 = mean(g1.length ? g1 : [c1]);
    const newC2 = mean(g2.length ? g2 : [c2]);

    // Yakınsadıysa erken çık
    if (colorDistance(newC1, c1) < 1 && colorDistance(newC2, c2) < 1) break;

    c1 = newC1;
    c2 = newC2;
  }

  return [c1, c2];
}

/** Piksel dizisinin ortalaması */
function mean(pixels) {
  const sum = [0, 0, 0];
  for (const [r, g, b] of pixels) {
    sum[0] += r;
    sum[1] += g;
    sum[2] += b;
  }
  return sum.map((v) => Math.round(v / pixels.length));
}

/** İki renk arasındaki Öklid mesafesi */
function colorDistance([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Rengi daha canlı/parlak yap:
 * RGB → HSL → doygunluğu artır, parlaklığı hedefe getir → RGB
 */
function enhance([r, g, b], satBoost, lightTarget) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.min(1, s * satBoost);
  l = l * 0.6 + lightTarget * 0.4; // hafifçe hedef parlaklığa yönlendir
  l = Math.max(0.25, Math.min(0.75, l));
  return hslToRgb(h, s, l);
}

/** Rengi parlaklık/karanlık ekseninde kaydır (factor: -1..1) */
function shift([r, g, b], factor) {
  let [h, s, l] = rgbToHsl(r, g, b);
  l = Math.max(0.15, Math.min(0.85, l + factor));
  return hslToRgb(h, s, l);
}

/** [r,g,b] → "#rrggbb" */
function toHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

// ── Renk uzayı dönüşümleri ────────────────────────────────────────────────────

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}
