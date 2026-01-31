const path = require('path');
const { app } = require('electron');

const getHtmlTemplate = (title, bodyContent, scriptContent = "") => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background-color: #111214; color: #dbdee1; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .card { background-color: #313338; padding: 40px; border-radius: 8px; text-align: center; }
    .btn { display: inline-block; padding: 10px 20px; background: #5865F2; color: white; border-radius: 4px; text-decoration: none; cursor: pointer; border: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">${bodyContent}</div>
  ${scriptContent}
</body>
  </html>
`;

const getIconPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, "logo.ico")
    : path.join(__dirname, "../../public/logo.ico");
};

// --- SPLASH SCREEN HTML ---
// (Copying the large animated splash SVG HTML here to keep main.js clean)
const getSplashHtml = (logoPath) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      position: relative;
    }
    
    /* Animated Background */
    .bg-glow {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
      animation: glow-pulse 3s ease-in-out infinite;
    }
    
    .bg-glow-secondary {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%);
      animation: glow-rotate 20s linear infinite;
    }
    
    .grid-pattern {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
    }
    
    @keyframes glow-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Main Container */
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    
    /* Logo Container */
    .logo-container {
      position: relative;
      width: 140px;
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Glow Ring that rotates */
    .glow-ring {
      position: absolute;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.15);
      border-right-color: rgba(99, 102, 241, 0.3);
      animation: spin 4s linear infinite;
    }
    
    .glow-ring-inner {
      position: absolute;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.3);
      border-right-color: rgba(99, 102, 241, 0.5);
      animation: spin 3s linear infinite reverse;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* SVG Logo with Draw Animation */
    .logo-svg {
      width: 120px;
      height: 120px;
      filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.25));
    }
    
    .logo-path {
      fill: transparent;
      stroke: #a855f7;
      stroke-width: 30;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 15000;
      stroke-dashoffset: 15000;
      animation: draw-path 2s ease-out forwards, fill-path 0.6s ease-out 2s forwards;
    }
    
    @keyframes draw-path {
      0% {
        stroke-dashoffset: 15000;
        filter: none;
      }
      100% { 
        stroke-dashoffset: 0;
        filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.4));
      }
    }
    
    @keyframes fill-path {
      0% {
        fill: transparent;
        stroke: #a855f7;
        stroke-width: 30;
      }
      100% { 
        fill: #a855f7;
        stroke: #a855f7;
        stroke-width: 0;
        filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.35));
      }
    }
    
    /* Text Container */
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      opacity: 0;
      animation: fade-in 0.5s ease-out 0.5s forwards;
    }
    
    @keyframes fade-in {
      to { opacity: 1; }
    }
    
    /* Brand Name */
    .brand-name {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #b5bac1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }
    
    /* Loading Text */
    .loading-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    
    .loading-dots {
      display: flex;
      gap: 4px;
    }
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      animation: dot-pulse 1.2s ease-in-out infinite;
    }
    
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
    
    /* Progress Bar */
    .progress-container {
      width: 180px;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 3px;
      animation: progress-fill 3s ease-in-out forwards;
    }
    
    @keyframes progress-fill {
      0% { width: 0%; }
      30% { width: 30%; }
      60% { width: 60%; }
      100% { width: 100%; }
    }
    
    /* Version Badge */
    .version {
      position: absolute;
      bottom: 24px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.25);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <!-- Background Effects -->
  <div class="bg-glow"></div>
  <div class="bg-glow-secondary"></div>
  <div class="grid-pattern"></div>
  
  <!-- Main Content -->
  <div class="main-container">
    <!-- Logo with Draw Animation -->
    <div class="logo-container">
      <div class="glow-ring"></div>
      <div class="glow-ring-inner"></div>
      
      <!-- Netrex Logo SVG -->
      <svg class="logo-svg" viewBox="0 0 256 256">
        <g transform="translate(0,256) scale(0.1,-0.1)">
          <path 
            class="logo-path" 
            d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z"
          />
        </g>
      </svg>
    </div>
    
    <!-- Text -->
    <div class="text-container">
      <div class="brand-name">Netrex</div>
      <div class="loading-text">
        <span id="loadingText">Başlatılıyor</span>
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  
  <!-- Version -->  
  <script>
    // Dynamic loading text
    const messages = [
      'Başlatılıyor',
      'Güncellemeler kontrol ediliyor',
      'Hazırlanıyor'
    ];
    let messageIndex = 0;
    const loadingText = document.getElementById('loadingText');
    
    setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      loadingText.textContent = messages[messageIndex];
    }, 1500);
  </script>
</body>
</html>
`;

// --- EXIT SPLASH HTML ---
const getExitSplashHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex - Çıkış</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      position: relative;
    }
    
    /* Animated Background - Purple theme */
    .bg-glow {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%);
      animation: glow-pulse 3s ease-in-out infinite;
    }
    
    .bg-glow-secondary {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%);
      animation: glow-rotate 20s linear infinite;
    }
    
    .grid-pattern {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
    }
    
    @keyframes glow-rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Main Container */
    .main-container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    
    /* Logo Container */
    .logo-container {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Glow Ring that rotates - Purple theme */
    .glow-ring {
      position: absolute;
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.15);
      border-right-color: rgba(99, 102, 241, 0.3);
      animation: spin 3s linear infinite;
    }
    
    .glow-ring-inner {
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: rgba(168, 85, 247, 0.3);
      border-right-color: rgba(99, 102, 241, 0.5);
      animation: spin 2s linear infinite reverse;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* SVG Logo with pulse animation */
    .logo-svg {
      width: 100px;
      height: 100px;
      filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.4));
      animation: logo-pulse 2s ease-in-out infinite;
    }
    
    .logo-path {
      fill: #a855f7;
      filter: drop-shadow(0 0 30px rgba(168, 85, 247, 0.6));
    }
    
    @keyframes logo-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(0.98); }
    }
    
    /* Text Container */
    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      opacity: 0;
      animation: fade-in 0.5s ease-out 0.3s forwards;
    }
    
    @keyframes fade-in {
      to { opacity: 1; }
    }
    
    /* Brand Name */
    .brand-name {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #b5bac1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }
    
    /* Loading Text */
    .loading-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 500;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    
    .loading-dots {
      display: flex;
      gap: 4px;
    }
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      animation: dot-pulse 1.2s ease-in-out infinite;
    }
    
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.2); }
    }
    
    /* Progress Bar */
    .progress-container {
      width: 160px;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 3px;
      animation: progress-fill 4s ease-in-out forwards;
    }
    
    @keyframes progress-fill {
      0% { width: 0%; }
      20% { width: 20%; }
      50% { width: 50%; }
      80% { width: 80%; }
      100% { width: 100%; }
    }
    
    /* Goodbye text */
    .goodbye-text {
      position: absolute;
      bottom: 32px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.3);
      font-weight: 500;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <!-- Background Effects -->
  <div class="bg-glow"></div>
  <div class="bg-glow-secondary"></div>
  <div class="grid-pattern"></div>
  
  <!-- Main Content -->
  <div class="main-container">
    <!-- Logo with Animation -->
    <div class="logo-container">
      <div class="glow-ring"></div>
      <div class="glow-ring-inner"></div>
      
      <!-- Netrex Logo SVG -->
      <svg class="logo-svg" viewBox="0 0 256 256">
        <g transform="translate(0,256) scale(0.1,-0.1)">
          <path 
            class="logo-path" 
            d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z"
          />
        </g>
      </svg>
    </div>
    
    <!-- Text -->
    <div class="text-container">
      <div class="brand-name">Netrex</div>
      <div class="loading-text">
        <span id="loadingText">Oturum kapatılıyor</span>
        <div class="loading-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  
  <!-- Goodbye -->
  <div class="goodbye-text">Görüşmek üzere!</div>
  
  <script>
    // Dynamic loading text
    const messages = [
      'Oturum kapatılıyor',
      'Bağlantılar temizleniyor',
      'Hoşça kal'
    ];
    let messageIndex = 0;
    const loadingText = document.getElementById('loadingText');
    
    setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      loadingText.textContent = messages[messageIndex];
    }, 1200);
  </script>
</body>
</html>
`;

// --- ALREADY RUNNING HTML ---
const getAlreadyRunningHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Netrex Zaten Çalışıyor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #111118 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    
    .bg-glow {
      position: absolute;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%);
    }
    
    .container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 40px;
    }
    
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    
    .text-container {
      text-align: center;
    }
    
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    
    .subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
    }
    
    .timer {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="container">
    <div class="icon">⚠️</div>
    <div class="text-container">
      <div class="title">Netrex Zaten Çalışıyor</div>
      <div class="subtitle">Uygulamayı yalnızca bir kez açabilirsiniz.<br>Bu pencere otomatik olarak kapanacak.</div>
    </div>
    <div class="timer">3 saniye içinde kapatılıyor...</div>
  </div>
</body>
</html>
`;

module.exports = {
    getHtmlTemplate,
    getIconPath,
    getSplashHtml,
    getExitSplashHtml,
    getAlreadyRunningHtml
};
