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

const getAlreadyRunningHtml = () => getHtmlTemplate("Netrex Zaten Çalışıyor", `
  <h1>NETREX</h1>
  <p>Uygulama zaten arka planda çalışıyor. Mevcut pencereye odaklanıyoruz...</p>
`);

const getExitSplashHtml = () => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    body { background: #050508; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: -apple-system, sans-serif; overflow: hidden; }
    .bg-glow { position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%); filter: blur(50px); animation: pulse 4s infinite; }
    .loader { width: 32px; height: 32px; border: 2px solid rgba(255,255,255,0.05); border-top-color: #ef4444; border-radius: 50%; animation: rotation 0.8s linear infinite; margin-bottom: 24px; }
    @keyframes rotation { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0.8; } }
    .content { text-align: center; position: relative; z-index: 2; display: flex; flex-direction: column; items: center; }
    h2 { margin: 0; font-weight: 800; letter-spacing: 0.2em; margin-right: -0.2em; font-size: 18px; text-transform: uppercase; }
    p { opacity: 0.3; font-size: 11px; margin-top: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="content">
    <div class="loader"></div>
    <h2>NETREX</h2>
    <p>Bağlantılar Kesiliyor</p>
  </div>
</body>
</html>
`;

const getSplashHtml = (logoPath) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #050508; color: #ffffff; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
    .aurora { position: absolute; filter: blur(100px); opacity: 0.15; z-index: 1; }
    .a1 { width: 400px; height: 400px; background: #6366f1; top: -100px; left: -100px; animation: m1 15s infinite alternate; }
    .a2 { width: 400px; height: 400px; background: #a855f7; bottom: -100px; right: -100px; animation: m2 12s infinite alternate; }
    @keyframes m1 { to { transform: translate(100px, 50px); } }
    @keyframes m2 { to { transform: translate(-80px, -40px); } }
    .logo-box { position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 40px; }
    .ring { position: absolute; width: 150px; height: 150px; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 40px; animation: ring-spin 10s linear infinite; top: -25px; }
    @keyframes ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .logo-svg { width: 100px; height: 100px; filter: drop-shadow(0 0 25px rgba(168, 85, 247, 0.4)); position: relative; z-index: 11; }
    .path-draw { fill: transparent; stroke: #a855f7; stroke-width: 50; stroke-dasharray: 15000; stroke-dashoffset: 15000; animation: draw 2s ease-out forwards, fill 0.6s ease-out 1.8s forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fill { to { fill: #a855f7; stroke-width: 0; } }
    .brand { font-size: 28px; font-weight: 900; letter-spacing: 0.4em; margin-right: -0.4em; text-align: center; background: linear-gradient(to bottom, #fff, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .bottom { position: absolute; bottom: 60px; z-index: 10; display: flex; flex-direction: column; items: center; gap: 20px; }
    .progress-track { width: 180px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7); animation: fill-bar 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fill-bar { to { width: 100%; } }
    .loader-text { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.4em; margin-right: -0.4em; text-align: center; }
  </style>
</head>
<body>
  <div class="aurora a1"></div><div class="aurora a2"></div>
  <div class="logo-box">
    <div class="ring"></div>
    <svg class="logo-svg" viewBox="0 0 256 256"><g transform="translate(0,256) scale(0.1,-0.1)"><path class="path-draw" d="M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z"/></g></svg>
    <div class="brand">NETREX</div>
  </div>
  <div class="bottom">
    <div class="loader-text" id="lt">Hazırlanıyor</div>
    <div class="progress-track"><div class="progress-fill"></div></div>
  </div>
  <script>
    const txts = ['Hazırlanıyor', 'Kontrol Ediliyor', 'Başlatılıyor']; 
    let idx = 0;
    const interval = setInterval(() => {
        if (idx < txts.length - 1) {
            document.getElementById('lt').innerText = txts[++idx];
        } else {
            clearInterval(interval);
        }
    }, 1200);
  </script>
</body>
</html>
`;

module.exports = { getHtmlTemplate, getIconPath, getLoginHtml, getSuccessHtml, getAlreadyRunningHtml, getExitSplashHtml, getSplashHtml };
