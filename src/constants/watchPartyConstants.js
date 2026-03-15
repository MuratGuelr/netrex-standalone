// src/constants/watchPartyConstants.js

// ─── DataChannel Mesaj Tipleri ───
export const WP_ACTIONS = {
  PLAY:       'WP_PLAY',
  PAUSE:      'WP_PAUSE',
  SEEK:       'WP_SEEK',
  SKIP:       'WP_SKIP',
  SYNC_REQ:   'WP_SYNC_REQUEST',
  SYNC_RESP:  'WP_SYNC_RESPONSE',
};

// ─── Yetki Seviyeleri ───
export const WP_ROLES = {
  HOST:      'HOST',
  CO_HOST:   'CO_HOST',
  ADMIN:     'ADMIN',       // Sunucu admini
  MODERATOR: 'MODERATOR',   // Sunucu moderatörü
  MEMBER:    'MEMBER',       // Normal üye
};

// ─── Drift Ayarları ───
// Drift threshold'u 1 saniyeye düşürerek senkronizasyonu daha sıkı hale getiriyoruz.
// Böylece "ben 2 saniye ilerideyim/gerideyim" hissi kaybolur.
export const DRIFT_THRESHOLD_SECONDS = 1.0;
export const DRIFT_CHECK_INTERVAL_MS = 2000;

// ─── Oy ───
export const VOTE_UP   =  1;
export const VOTE_DOWN = -1;
export const VOTE_NONE =  0;
