import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

// ============================================
// 🎙️ LiveKit Token API Route (Web Mode)
// ============================================
// Electron'da bu işlem ipcHandlers.js'te yapılıyor.
// Web modunda bu API route aynı işi yapar.

// Server pool'u bir kere yükle
let LIVEKIT_SERVERS = null;

function loadServers() {
  if (LIVEKIT_SERVERS !== null) return LIVEKIT_SERVERS;
  
  LIVEKIT_SERVERS = [];
  
  // Pool modunu dene
  for (let i = 0; i < 20; i++) {
    const url = process.env[`LIVEKIT_SERVERS_${i}_URL`];
    if (!url) break;
    
    LIVEKIT_SERVERS.push({
      url,
      key: process.env[`LIVEKIT_SERVERS_${i}_KEY`],
      secret: process.env[`LIVEKIT_SERVERS_${i}_SECRET`],
    });
  }
  
  // Fallback: Tek sunucu modu
  if (LIVEKIT_SERVERS.length === 0) {
    const fallbackKey = process.env.LIVEKIT_API_KEY;
    const fallbackSecret = process.env.LIVEKIT_API_SECRET;
    const fallbackUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    
    if (fallbackKey && fallbackSecret) {
      LIVEKIT_SERVERS.push({
        url: fallbackUrl || '',
        key: fallbackKey,
        secret: fallbackSecret,
      });
    }
  }
  
  return LIVEKIT_SERVERS;
}

export async function POST(request) {
  try {
    const { room, identity, displayName, serverIndex = 0 } = await request.json();
    
    if (!room || !identity) {
      return NextResponse.json(
        { error: 'room and identity are required' },
        { status: 400 }
      );
    }
    
    const servers = loadServers();
    
    if (servers.length === 0) {
      return NextResponse.json(
        { error: 'LiveKit servers not configured' },
        { status: 500 }
      );
    }
    
    const actualIndex = Math.min(Math.max(0, serverIndex), servers.length - 1);
    const server = servers[actualIndex];
    
    if (!server || !server.key || !server.secret) {
      return NextResponse.json(
        { error: `Server ${actualIndex} credentials missing` },
        { status: 500 }
      );
    }
    
    const name = displayName || identity;
    
    const at = new AccessToken(server.key, server.secret, {
      identity,
      name,
      ttl: '24h',
    });
    
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    });
    
    const token = await at.toJwt();
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error('LiveKit token error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
