import { NextResponse } from 'next/server';

// ============================================
// 📡 LiveKit Server Info API Route (Web Mode)
// ============================================
// Electron'da bu işlem ipcHandlers.js'te yapılıyor.
// Web modunda bu API route aynı işi yapar.
// NOT: Key ve secret döndürmez, sadece URL ve pool bilgisi.

let LIVEKIT_SERVERS = null;

function loadServers() {
  if (LIVEKIT_SERVERS !== null) return LIVEKIT_SERVERS;
  
  LIVEKIT_SERVERS = [];
  
  for (let i = 0; i < 20; i++) {
    const url = process.env[`LIVEKIT_SERVERS_${i}_URL`];
    if (!url) break;
    
    LIVEKIT_SERVERS.push({ url });
  }
  
  // Fallback
  if (LIVEKIT_SERVERS.length === 0) {
    const fallbackUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (fallbackUrl) {
      LIVEKIT_SERVERS.push({ url: fallbackUrl });
    }
  }
  
  return LIVEKIT_SERVERS;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serverIndex = parseInt(searchParams.get('serverIndex') || '0', 10);
    
    const servers = loadServers();
    
    if (servers.length === 0) {
      return NextResponse.json({
        url: '',
        serverCount: 0,
        serverIndex: 0,
        poolMode: false,
        error: 'No LiveKit servers configured',
      });
    }
    
    const actualIndex = Math.min(Math.max(0, serverIndex), servers.length - 1);
    
    return NextResponse.json({
      url: servers[actualIndex].url,
      serverCount: servers.length,
      serverIndex: actualIndex,
      poolMode: servers.length > 1,
    });
  } catch (error) {
    console.error('LiveKit server info error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
