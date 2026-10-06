// ============================================
// 📃 YouTube çalma listesi (playlist) okuyucu
// ============================================
// YouTube Data API anahtarı gerektirmeden, herkese açık bir listenin parçalarını okur.
// Tarayıcıdan YouTube sayfalarına doğrudan istek CORS'a takılır; bu yüzden:
//   • Electron: ipcHandlers.js bu modülü ana süreçte çalıştırır (CORS yok)
//   • Web:      app/api/youtube-playlist/route.js aynı modülü sunucuda çalıştırır
//
// Saf Node modülüdür (yalnızca global fetch kullanır), "electron" içe aktarmaz.
// NOT: YouTube'un sayfa yapısı değişebilir; okuma başarısız olursa anlaşılır bir hata döner,
// tek video ekleme etkilenmez.

const MAX_TRACKS = 200; // Firestore belge boyutunu (1MB) ve ekranı şişirmemek için üst sınır
const MAX_CONTINUATION_PAGES = 5; // ilk sayfa ~100 parça; devamı sayfa sayfa
const REQUEST_TIMEOUT_MS = 15000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  // Avrupa'da çıkan "çerezleri kabul et" ara sayfasını atlar
  Cookie: "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+987",
};

async function timedFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** `marker` adlı değişkenin atandığı JSON nesnesini (süslü parantez eşleştirerek) çıkarır */
function extractBalancedJson(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  const start = text.indexOf("{", at);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Nesne ağacında `key` anahtarının ilk değerini bulur (yapı değişse de dayanıklı olsun diye) */
function findFirstByKey(root, key) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
    } else {
      for (const k of Object.keys(node)) stack.push(node[k]);
    }
  }
  return undefined;
}

const textOf = (t) => (t?.runs ? t.runs.map((r) => r.text).join("") : t?.simpleText) || "";

// "3:53" / "1:02:03" → saniye
function parseClock(text) {
  if (typeof text !== "string" || !/^\d{1,2}(:\d{2}){1,2}$/.test(text.trim())) return 0;
  return text
    .trim()
    .split(":")
    .reduce((acc, part) => acc * 60 + Number(part), 0);
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const makeTrack = (videoId, title, duration) => ({
  videoId,
  title: title || videoId,
  thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  duration: duration || 0,
});

/** Yeni YouTube düzeni: lockupViewModel (parça kartı) */
function parseLockup(lockup) {
  const videoId = lockup?.contentId;
  if (!VIDEO_ID.test(videoId || "")) return null;
  if (lockup.contentType && lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return null;
  const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;
  // Süre, küçük resmin alt köşesindeki rozet metninde ("3:53")
  let duration = 0;
  const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || [];
  for (const o of overlays) {
    for (const badge of o?.thumbnailBottomOverlayViewModel?.badges || []) {
      duration = duration || parseClock(badge?.thumbnailBadgeViewModel?.text);
    }
  }
  return makeTrack(videoId, title, duration);
}

/** Bir sayfadaki öğeleri parçalara çevirir; varsa devam belirtecini (continuation token) de döndürür */
function parseItems(items) {
  const tracks = [];
  let token = null;
  for (const item of items || []) {
    if (item?.playlistVideoRenderer) {
      // Eski düzen
      const v = item.playlistVideoRenderer;
      if (!v.videoId || v.isPlayable === false) continue; // silinmiş / özel / bölge kısıtlı
      tracks.push(makeTrack(v.videoId, textOf(v.title), Number(v.lengthSeconds) || 0));
    } else if (item?.lockupViewModel) {
      const t = parseLockup(item.lockupViewModel);
      if (t) tracks.push(t);
    } else if (item?.continuationItemRenderer) {
      token = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || token;
    } else if (item?.continuationItemViewModel) {
      token =
        item.continuationItemViewModel.continuationCommand?.innertubeCommand?.continuationCommand?.token ||
        item.continuationItemViewModel.continuationCommand?.token ||
        token;
    }
  }
  return { tracks, token };
}

/** Parça kartlarını içeren diziyi bulur (iki düzeni de tanır) */
function findItemsArray(root) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      if (node.some((x) => x && (x.lockupViewModel || x.playlistVideoRenderer))) return node;
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
    } else {
      for (const k of Object.keys(node)) stack.push(node[k]);
    }
  }
  return null;
}

/** Sayfanın ilk yüklemesindeki devam belirteci (yeni düzende parça dizisinin DIŞINDA durur) */
function findInitialToken(root) {
  const vm = findFirstByKey(root, "continuationItemViewModel");
  if (vm) return parseItems([{ continuationItemViewModel: vm }]).token;
  const r = findFirstByKey(root, "continuationItemRenderer");
  if (r) return parseItems([{ continuationItemRenderer: r }]).token;
  return null;
}

/**
 * @param {string} listId YouTube çalma listesi kimliği (örn. PLxxxxxxxx)
 * @returns {Promise<{ title: string, tracks: {videoId,title,thumbnail,duration}[], truncated: boolean }>}
 */
async function fetchYouTubePlaylist(listId) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(String(listId || ""))) {
    throw new Error("Geçersiz çalma listesi bağlantısı.");
  }
  // "RD…" karışımlar (mix/radio) sonsuzdur, kişiselleştirilmiştir ve oynatılamaz
  if (/^(RD|UL|LL|WL)/.test(listId)) {
    throw new Error("Bu bir YouTube karışımı/kişisel liste; eklenemez. Herkese açık bir çalma listesi bağlantısı kullanın.");
  }

  const res = await timedFetch(`https://www.youtube.com/playlist?list=${listId}&hl=en`, {
    headers: HEADERS,
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`YouTube listeyi vermedi (HTTP ${res.status}).`);
  const html = await res.text();

  const data = extractBalancedJson(html, "ytInitialData");
  if (!data) throw new Error("YouTube sayfası okunamadı (beklenmeyen biçim).");

  const firstItems = findItemsArray(data);
  if (!firstItems) {
    throw new Error("Liste bulunamadı. Gizli, silinmiş veya boş olabilir; \"Herkese açık\" ya da \"Liste dışı\" olmalı.");
  }

  const title =
    data?.metadata?.playlistMetadataRenderer?.title ||
    textOf(findFirstByKey(data, "playlistHeaderRenderer")?.title) ||
    "YouTube Çalma Listesi";

  const firstPage = parseItems(firstItems);
  let tracks = firstPage.tracks;
  let token = firstPage.token || findInitialToken(data);

  // Devam sayfaları (ilk sayfada ~100 parça var)
  const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const clientVersion = (html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || [])[1];
  let pages = 0;
  while (token && apiKey && tracks.length < MAX_TRACKS && pages < MAX_CONTINUATION_PAGES) {
    pages++;
    let json;
    try {
      const r = await timedFetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: clientVersion || "2.20240101.00.00", hl: "en", gl: "US" } },
          continuation: token,
        }),
      });
      if (!r.ok) break;
      json = await r.json();
    } catch {
      break; // devam sayfası alınamazsa elimizdekilerle devam et
    }
    const items =
      json?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems ||
      findFirstByKey(json, "continuationItems") ||
      findItemsArray(json) ||
      [];
    const parsed = parseItems(items);
    if (parsed.tracks.length === 0 && !parsed.token) {
      token = null; // boş devam sayfası = liste bitti ("kısaltıldı" sayılmasın)
      break;
    }
    tracks = tracks.concat(parsed.tracks);
    token = parsed.token;
  }

  // Aynı video listede birden çok kez varsa tekilleştir
  const seen = new Set();
  tracks = tracks.filter((t) => (seen.has(t.videoId) ? false : (seen.add(t.videoId), true)));

  const truncated = tracks.length > MAX_TRACKS || !!token;
  return { title, tracks: tracks.slice(0, MAX_TRACKS), truncated };
}

module.exports = { fetchYouTubePlaylist, MAX_TRACKS };
