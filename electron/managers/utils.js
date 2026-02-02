const path = require('path');
const { app } = require('electron');

/**
 * 🎨 Netrex v6.0 Premium Design System (Native Core)
 * Optimized: Edge-to-edge progress bar and perfect centering.
 */

const TOKENS = {
    bg: '#050508',
    purple: '#a855f7',
    indigo: '#6366f1',
    rose: '#ef4444',
    text: '#e2e8f0',
    font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif"
};

const COMMON_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        background: ${TOKENS.bg}; 
        color: ${TOKENS.text}; 
        font-family: ${TOKENS.font}; 
        height: 100vh; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        overflow: hidden; 
        user-select: none;
    }
    .aurora { position: absolute; filter: blur(120px); opacity: 0.15; z-index: 1; pointer-events: none; border-radius: 50%; }
    .noise { position: absolute; inset: 0; background: url('https://grainy-gradients.vercel.app/noise.svg'); opacity: 0.05; pointer-events: none; z-index: 2; contrast: 150%; brightness: 150%; }
    .particles { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
    .p { position: absolute; background: white; border-radius: 50%; opacity: 0; }
    
    .container { position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 32px; width: 100%; }
    .logo-box { position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; }
    .ring { position: absolute; inset: -20px; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 40px; }
    .ring-active { position: absolute; inset: -20px; border: 1px solid transparent; border-radius: 40px; animation: rotate 12s linear infinite; }
    
    @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fill-inner { to { fill-opacity: 1; stroke-width: 0; } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .brand { 
        font-size: 32px; font-weight: 950; letter-spacing: 0.3em; 
        text-align: center; opacity: 0; animation: fade-in 0.8s ease-out 0.5s forwards;
        display: flex; justify-content: center; width: 100%;
        text-indent: 0.3em; 
    }
    .status-text { 
        font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.25); 
        text-transform: uppercase; letter-spacing: 0.4em; 
        text-align: center; width: 100%;
        text-indent: 0.4em;
        opacity: 0; animation: fade-in 0.8s ease-out 0.8s forwards;
    }

    /* Edge-to-edge Progress Bar at the absolute bottom */
    .progress-track { 
        position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; 
        background: rgba(255,255,255,0.02); z-index: 20; overflow: hidden;
    }
    .progress-fill { height: 100%; width: 0%; transition: width 0.1s linear; box-shadow: 0 0 15px currentColor; }
`;

const LOGO_PATH = "M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z";

const getIconPath = () => {
    return app.isPackaged
        ? path.join(process.resourcesPath, "logo.ico")
        : path.join(__dirname, "../../public/logo.ico");
};

// --- SPLASH SCREEN (ENTRY) ---
const getSplashHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <style>
        ${COMMON_CSS}
        .a1 { width: 500px; height: 500px; background: ${TOKENS.indigo}; top: -150px; left: -150px; animation: drift1 20s infinite alternate; }
        .a2 { width: 400px; height: 400px; background: ${TOKENS.purple}; bottom: -100px; right: -100px; animation: drift2 15s infinite alternate; }
        @keyframes drift1 { from { transform: translate(0,0) scale(1); } to { transform: translate(100px, 50px) scale(1.1); } }
        @keyframes drift2 { from { transform: translate(0,0) scale(1.1); } to { transform: translate(-80px, -40px) scale(1); } }
        
        .ring-active { background: linear-gradient(45deg, ${TOKENS.purple}20, transparent, ${TOKENS.indigo}20); }
        .path { 
            fill: ${TOKENS.purple}; fill-opacity: 0; stroke: ${TOKENS.purple}; stroke-width: 50; 
            stroke-dasharray: 15000; stroke-dashoffset: 15000; 
            animation: draw 1.8s ease-out forwards, fill-inner 0.8s ease-out 1.5s forwards; 
        }
        .brand { background: linear-gradient(to bottom, #fff, ${TOKENS.purple}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .progress-fill { 
            color: ${TOKENS.purple};
            background: linear-gradient(90deg, ${TOKENS.indigo}, ${TOKENS.purple}, ${TOKENS.indigo}); background-size: 200% 100%; animation: shimmer 3s linear infinite; 
        }
        @keyframes shimmer { from { background-position: 0% 0%; } to { background-position: 200% 0%; } }
    </style>
</head>
<body>
    <div class="aurora a1"></div><div class="aurora a2"></div>
    <div class="noise"></div>
    <div class="particles" id="ps"></div>
    <div class="container">
        <div class="logo-box">
            <div class="ring"></div>
            <div class="ring-active"></div>
            <svg width="100" height="100" viewBox="0 0 256 256">
                <g transform="translate(0,256) scale(0.1,-0.1)">
                    <path class="path" d="${LOGO_PATH}"/>
                </g>
            </svg>
        </div>
        <div class="brand">NETREX</div>
        <div class="status-text" id="st">Hazırlanıyor</div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="pb"></div></div>
    <script>
        const ps = document.getElementById('ps');
        for(let i=0; i<30; i++) {
            const p = document.createElement('div');
            p.className = 'p';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.width = p.style.height = (Math.random() * 2 + 1) + 'px';
            p.style.animation = \`float \${5 + Math.random() * 10}s infinite\`;
            p.style.animationDelay = \`-\${Math.random() * 10}s\`;
            ps.appendChild(p);
        }
        const style = document.createElement('style');
        style.innerHTML = '@keyframes float { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 0.4; } 100% { transform: translateY(-80px); opacity: 0; } }';
        document.head.appendChild(style);

        const txts = ['Hazırlanıyor', 'Kontrol Ediliyor', 'Başlatılıyor'];
        let idx = 0;
        let prog = 0;
        const pb = document.getElementById('pb');
        const st = document.getElementById('st');
        
        const tick = setInterval(() => {
            prog += (100 - prog) * 0.05;
            pb.style.width = prog + '%';
            if(prog > 99.5) {
                pb.style.width = '100%';
                clearInterval(tick);
            }
        }, 100);

        setInterval(() => {
            if(idx < txts.length - 1) st.innerText = txts[++idx];
        }, 1500);
    </script>
</body>
</html>
`;

// --- EXIT SPLASH SCREEN ---
const getExitSplashHtml = () => `
<!DOCTYPE html>
<html>
<head>
    <style>
        ${COMMON_CSS}
        .a1 { width: 500px; height: 500px; background: ${TOKENS.rose}; top: -150px; right: -150px; animation: drift1 18s infinite alternate; opacity: 0.1; }
        .a2 { width: 400px; height: 400px; background: #991b1b; bottom: -100px; left: -100px; animation: drift2 14s infinite alternate; opacity: 0.1; }
        @keyframes drift1 { from { transform: translate(0,0); } to { transform: translate(-80px, 40px); } }
        @keyframes drift2 { from { transform: translate(0,0); } to { transform: translate(60px, -30px); } }

        .ring-active { background: linear-gradient(45deg, ${TOKENS.rose}15, transparent, #991b1b15); border-color: ${TOKENS.rose}20; }
        .path { 
            fill: ${TOKENS.rose}; fill-opacity: 0; stroke: ${TOKENS.rose}; stroke-width: 50; 
            stroke-dasharray: 15000; stroke-dashoffset: 15000; 
            animation: draw 1.5s ease-out forwards, fill-inner 0.6s ease-out 1.2s forwards; 
        }
        .brand { background: linear-gradient(to bottom, #fff, ${TOKENS.rose}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .progress-fill { 
            color: ${TOKENS.rose};
            background: linear-gradient(90deg, #991b1b, ${TOKENS.rose}, #991b1b); background-size: 200% 100%; animation: shimmer 2.5s linear infinite; 
        }
        @keyframes shimmer { from { background-position: 0% 0%; } to { background-position: 200% 0%; } }
    </style>
</head>
<body>
    <div class="aurora a1"></div><div class="aurora a2"></div>
    <div class="noise"></div>
    <div class="particles" id="ps"></div>
    <div class="container">
        <div class="logo-box">
            <div class="ring"></div>
            <div class="ring-active"></div>
            <svg width="100" height="100" viewBox="0 0 256 256">
                <g transform="translate(0,256) scale(0.1,-0.1)">
                    <path class="path" d="${LOGO_PATH}"/>
                </g>
            </svg>
        </div>
        <div class="brand">NETREX</div>
        <div class="status-text" id="st">Bağlantılar Kesiliyor</div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="pb"></div></div>
    <script>
        const ps = document.getElementById('ps');
        for(let i=0; i<30; i++) {
            const p = document.createElement('div');
            p.className = 'p';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.width = p.style.height = (Math.random() * 2 + 1) + 'px';
            p.style.background = '${TOKENS.rose}';
            p.style.animation = \`fall \${4 + Math.random() * 6}s infinite\`;
            ps.appendChild(p);
        }
        const style = document.createElement('style');
        style.innerHTML = '@keyframes fall { 0% { transform: translateY(-50px); opacity: 0; } 50% { opacity: 0.3; } 100% { transform: translateY(50px); opacity: 0; } }';
        document.head.appendChild(style);

        const txts = ['Bağlantılar Kesiliyor', 'Veriler Temizleniyor', 'Görüşmek Üzere'];
        let idx = 0;
        let prog = 0;
        const pb = document.getElementById('pb');
        const st = document.getElementById('st');
        
        setInterval(() => {
            prog += (100 - prog) * 0.04;
            pb.style.width = prog + '%';
        }, 100);

        setInterval(() => {
            if(idx < txts.length - 1) st.innerText = txts[++idx];
        }, 1200);
    </script>
</body>
</html>
`;

// --- OTHER UTILITIES (RESTORED) ---
const getHtmlTemplate = (title, bodyContent, scriptContent = "") => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        ${COMMON_CSS}
        .card { 
            position: relative; z-index: 10; background: rgba(15, 15, 20, 0.6); 
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.05); padding: 56px; border-radius: 40px; 
            text-align: center; width: 420px; animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .btn { 
            width: 100%; padding: 16px 24px; background: linear-gradient(135deg, ${TOKENS.indigo}, ${TOKENS.purple}); 
            color: white; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.1); 
            font-weight: 700; cursor: pointer; transition: all 0.3s; margin-top: 20px;
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(110%); }
        h1 { font-size: 28px; font-weight: 900; letter-spacing: 0.2em; text-indent: 0.2em; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="aurora" style="width:600px;height:600px;background:${TOKENS.purple}20;top:-10%;left:-10%"></div>
    <div class="card">
        <svg width="80" height="80" viewBox="0 0 256 256" style="margin-bottom:20px">
            <g transform="translate(0,256) scale(0.1,-0.1)"><path d="${LOGO_PATH}" fill="${TOKENS.purple}"/></g>
        </svg>
        ${bodyContent}
    </div>
    ${scriptContent}
</body>
</html>
`;

const getLoginHtml = (apiKey, authDomain) => getHtmlTemplate("Netrex Giriş", `
    <h1>NETREX</h1>
    <p style="color:rgba(255,255,255,0.5);margin:10px 0 20px">Devam etmek için giriş yapın.</p>
    <button id="loginBtn" class="btn">Google ile Devam Et</button>
`, `
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        const fbReq = { apiKey: "${apiKey}", authDomain: "${authDomain}" };
        try {
            const app = initializeApp(fbReq);
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();
            document.getElementById("loginBtn").addEventListener("click", () => {
                signInWithPopup(auth, provider).then((res) => {
                    const cred = GoogleAuthProvider.credentialFromResult(res);
                    window.location.href = "/oauth/callback?token=" + cred.idToken;
                });
            });
        } catch (e) {}
    </script>
`);

const getSuccessHtml = () => getHtmlTemplate("Giriş Başarılı", `<h1>HOŞ GELDİN</h1><p>Giriş başarıyla tamamlandı.</p><script>setTimeout(()=>window.close(),2000)</script>`);

const getAlreadyRunningHtml = () => getHtmlTemplate("Netrex Zaten Çalışıyor", `<h1>NETREX</h1><p>Uygulama zaten arka planda çalışıyor.</p>`);

module.exports = {
    getIconPath,
    getSplashHtml,
    getExitSplashHtml,
    getLoginHtml,
    getSuccessHtml,
    getAlreadyRunningHtml,
    getHtmlTemplate
};
