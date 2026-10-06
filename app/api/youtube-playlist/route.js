import { NextResponse } from 'next/server';
import * as playlistModule from '../../../electron/managers/youtubePlaylist';

// ============================================
// 📃 YouTube Çalma Listesi API Route (Web Modu)
// ============================================
// Electron'da bu işlem ipcHandlers.js'te yapılır (CORS yok). Web'de tarayıcı YouTube sayfalarını
// doğrudan okuyamaz (CORS), bu yüzden aynı okuyucu sunucuda çalışır.
//
// Kötüye kullanım koruması: yalnızca doğrulanmış liste kimlikleri, IP başına dakikada 10 istek,
// aynı liste 2 dakika önbelleğe alınır.

// 'force-dynamic' statik export (Electron) derlemesini bozar; diğer route'lardaki gibi prerender = false kullanılır.
export const prerender = false;

const fetchYouTubePlaylist =
  playlistModule.fetchYouTubePlaylist || playlistModule.default?.fetchYouTubePlaylist;

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const CACHE_MS = 120_000;
const hits = new Map(); // ip -> [zaman damgaları]
const cache = new Map(); // listId -> { at, data }

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // sınırsız büyümesin
  return recent.length > RATE_LIMIT;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = (searchParams.get('list') || '').trim();
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(listId)) {
      return NextResponse.json({ ok: false, error: 'Geçersiz çalma listesi bağlantısı.' }, { status: 400 });
    }

    const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'Çok fazla istek. Biraz bekleyip tekrar deneyin.' }, { status: 429 });
    }

    const cached = cache.get(listId);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return NextResponse.json({ ok: true, ...cached.data });
    }

    const data = await fetchYouTubePlaylist(listId);
    cache.set(listId, { at: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value);

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Liste alınamadı.' }, { status: 502 });
  }
}
