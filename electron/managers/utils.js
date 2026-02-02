const path = require('path');
const { app } = require('electron');

// Common CSS for consistent premium look
const COMMON_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    background: #050508; 
    color: #e2e8f0; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    height: 100vh; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    overflow: hidden;
  }
  .bg-glow { position: absolute; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%); filter: blur(80px); animation: pulse 8s ease-in-out infinite; z-index: 0; }
  .bg-glow-static { position: absolute; width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%); filter: blur(100px); z-index: -1; top: -10%; right: -10%; }
  
  .card { 
    position: relative; 
    z-index: 10;
    background: rgba(15, 15, 20, 0.6); 
    backdrop-filter: blur(25px); 
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 255, 255, 0.05); 
    padding: 56px; 
    border-radius: 40px; 
    text-align: center; 
    box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03); 
    width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .logo-container { width: 90px; height: 90px; margin-bottom: 8px; position: relative; }
  .logo-svg { width: 100%; height: 100%; filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.4)); }
  
  h1 { font-size: 32px; font-weight: 950; background: linear-gradient(135deg, #fff 30%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.2em; margin-right: -0.2em; text-align: center; }
  p { font-size: 15px; color: #94a3b8; line-height: 1.6; font-weight: 500; text-align: center; margin-top: -8px; }
  
  .btn { 
    width: 100%; 
    padding: 16px 24px; 
    background: linear-gradient(135deg, #6366f1, #a855f7); 
    color: white; 
    border-radius: 18px; 
    text-decoration: none; 
    cursor: pointer; 
    border: 1px solid rgba(255, 255, 255, 0.1); 
    font-weight: 700; 
    font-size: 15px; 
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
    margin-top: 8px;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.5); filter: brightness(110%); border-color: rgba(255, 255, 255, 0.2); }
  
  .status { font-size: 12px; margin-top: 8px; font-weight: 600; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; text-align: center; }
  
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0.7; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  
  .particle { position: absolute; background: white; border-radius: 50%; pointer-events: none; opacity: 0; animation: float 10s infinite; }
  @keyframes float { 
    0% { transform: translateY(0) scale(0); opacity: 0; }
    20% { opacity: 0.2; }
    80% { opacity: 0.2; }
    100% { transform: translateY(-100vh) scale(1); opacity: 0; }
  }
`;

const LOGO_SVG = `
  <svg class="logo-svg" viewBox="0 0 2560 2560" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(0, 2560) scale(1, -1)">
       <path d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z" fill="#a855f7"/>
    </g>
  </svg>
`;

const getHtmlTemplate = (title, bodyContent, scriptContent = "") => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="bg-glow-static"></div>
  <div id="particles"></div>
  <div class="card">
    <div class="logo-container">${LOGO_SVG}</div>
    ${bodyContent}
  </div>
  <script>
    const container = document.getElementById('particles');
    for(let i=0; i<15; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.bottom = '-10px';
        p.style.width = p.style.height = (Math.random() * 3 + 1) + 'px';
        p.style.animationDelay = Math.random() * 10 + 's';
        p.style.animationDuration = (Math.random() * 5 + 5) + 's';
        container.appendChild(p);
    }
  </script>
  ${scriptContent}
</body>
</html>
`;

const getIconPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, "logo.ico")
    : path.join(__dirname, "../../public/logo.ico");
};

const getLoginHtml = (apiKey, authDomain) => getHtmlTemplate("Netrex Giriş", `
  <h1>NETREX</h1>
  <p>Güvenli ve şık sesli sohbet deneyimi için Google ile giriş yapın.</p>
  <button id="loginBtn" class="btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.8-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/></svg>
    Google ile Devam Et
  </button>
  <div id="status" class="status">Kısa süre içinde yönlendirileceksiniz...</div>
`, `
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
    const firebaseConfig = { apiKey: "${apiKey}", authDomain: "${authDomain}" };
    try {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        const btn = document.getElementById("loginBtn");
        const status = document.getElementById("status");
        btn.addEventListener("click", () => {
            status.innerText = "Google penceresi açılıyor...";
            signInWithPopup(auth, provider).then((result) => {
                const credential = GoogleAuthProvider.credentialFromResult(result);
                window.location.href = "/oauth/callback?token=" + credential.idToken;
            });
        });
    } catch (e) {}
  </script>
`);

const getSuccessHtml = () => getHtmlTemplate("Giriş Başarılı", `
  <h1>HOŞ GELDİN</h1>
  <p>Netrex dünyasına hoş geldin. Hesabın doğrulandı, şimdi tadını çıkar.</p>
`, `
  <script>setTimeout(() => window.close(), 2500);</script>
`);

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

// --- SPLASH SCREEN HTML ---
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
  <div class="bg-glow"></div>
  <div class="bg-glow-secondary"></div>
  <div class="grid-pattern"></div>
  
  <div class="main-container">
    <div class="logo-container">
      <div class="glow-ring"></div>
      <div class="glow-ring-inner"></div>
      <svg class="logo-svg" viewBox="0 0 256 256">
        <g transform="translate(0,256) scale(0.1,-0.1)">
          <path class="logo-path" d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z"/>
        </g>
      </svg>
    </div>
    <div class="text-container">
      <div class="brand-name">Netrex</div>
      <div class="loading-text">
        <span id="loadingText">Başlatılıyor</span>
        <div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
      </div>
      <div class="progress-container"><div class="progress-bar"></div></div>
    </div>
  </div>
  <script>
    const msgs = ['Başlatılıyor', 'Güncellemeler kontrol ediliyor', 'Hazırlanıyor'];
    let midx = 0;
    const lt = document.getElementById('loadingText');
    setInterval(() => { midx = (midx + 1) % msgs.length; lt.textContent = msgs[midx]; }, 1500);
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
      filter: blur(40px);
    }
    
    .card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 40px;
      border-radius: 32px;
      text-align: center;
      width: 380px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    .icon-box {
      width: 64px;
      height: 64px;
      background: rgba(251, 191, 36, 0.1);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      color: #fbbf24;
    }
    
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 14px; color: rgba(255, 255, 255, 0.5); line-height: 1.6; }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="card">
    <div class="icon-box">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
    </div>
    <h1>Uygulama Zaten Açık</h1>
    <p>Netrex zaten çalışıyor. Mevcut pencereye odaklanılıyor...</p>
  </div>
</body>
</html>
`;

module.exports = { 
  getHtmlTemplate, 
  getIconPath, 
  getLoginHtml, 
  getSuccessHtml, 
  getAlreadyRunningHtml, 
  getExitSplashHtml, 
  getSplashHtml 
};
