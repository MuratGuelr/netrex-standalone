const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

function fixPathsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace all absolute paths with relative paths
    const originalContent = content;
    
    // First, fix any incorrect ../_next/ paths that might have been created
    content = content.replace(/href="\.\.\/_next\//g, 'href="./_next/');
    content = content.replace(/src="\.\.\/_next\//g, 'src="./_next/');
    content = content.replace(/href='\.\.\/_next\//g, "href='./_next/");
    content = content.replace(/src='\.\.\/_next\//g, "src='./_next/");
    
    // Fix href and src attributes (absolute paths)
    content = content.replace(/href="\/_next\//g, 'href="./_next/');
    content = content.replace(/src="\/_next\//g, 'src="./_next/');
    content = content.replace(/href='\/_next\//g, "href='./_next/");
    content = content.replace(/src='\/_next\//g, "src='./_next/");
    
    // Fix paths in JavaScript strings (both single and double quotes)
    // But be careful not to break existing relative paths
    content = content.replace(/("|\')\/_next\//g, '$1./_next/');
    content = content.replace(/("|\')\.\.\/_next\//g, '$1./_next/');
    
    // Fix paths in JavaScript code (like in __next_f.push arrays)
    // Match patterns like: "static/chunks/..." or "/_next/static/..."
    content = content.replace(/\/_next\/static/g, './_next/static');
    content = content.replace(/\.\.\/_next\/static/g, './_next/static');
    
    // 🖼️ FIX: Common public assets should be relative
    // This fixes broken images like /logo.png in Electron build
    content = content.replace(/src="\/logo\.png"/g, 'src="./logo.png"');
    content = content.replace(/src="\/logo\.svg"/g, 'src="./logo.svg"');
    content = content.replace(/src="\/logo\.ico"/g, 'src="./logo.ico"');
    content = content.replace(/src="\/favicon\.ico"/g, 'src="./favicon.ico"');
    // Generic fix for any src starting with / that isn't _next or absolute URL
    content = content.replace(/src="\/([^h_/][^"]*)"/g, 'src="./$1"');
    
    // Fix paths in __next_f.push arrays that reference chunks
    // Pattern: "static/chunks/..." should become "./_next/static/chunks/..."
    content = content.replace(/"static\/chunks\//g, '"./_next/static/chunks/');
    content = content.replace(/'static\/chunks\//g, "'./_next/static/chunks/");
    
    // Add base tag if not present (handle both <head> and <head>)
    if (!content.includes('<base')) {
      content = content.replace(
        /<head[^>]*>/i,
        (match) => `${match}<base href="./">`
      );
    }
    
    // Inject path fix script for Electron file:// protocol (right after <head>)
    // This fixes dynamic path resolution in JavaScript and webpack chunk loading
    if (!content.includes('__electron_path_fix')) {
      const pathFixScript = `<script>
// Electron path fix - ensures all paths are resolved correctly with file:// protocol
// MUST RUN BEFORE ALL OTHER SCRIPTS
(function() {
  'use strict';
  if (window.location.protocol === 'file:') {
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const webpackPublicPath = baseUrl + '_next/';
    
    // Set webpack public path IMMEDIATELY (before webpack loads)
    if (typeof window !== 'undefined') {
      window.__webpack_public_path__ = webpackPublicPath;
    }
    
    // Helper function to fix URLs
    function fixUrl(url) {
      if (typeof url !== 'string') return url;
      
      // Fix absolute paths starting with /_next/
      if (url.startsWith('/_next/')) {
        return webpackPublicPath + url.substring(7);
      }
      
      // Fix incorrect Windows absolute paths (C:/_next/...)
      if (url.match(/^[A-Z]:\\/_next\\//)) {
        return webpackPublicPath + url.substring(url.indexOf('/_next/') + 7);
      }
      
      // Fix file:// URLs that are incorrect (file:///C:/_next/...)
      if (url.startsWith('file:///') && url.includes('/_next/') && !url.includes(baseUrl)) {
        const nextIndex = url.indexOf('/_next/');
        return webpackPublicPath + url.substring(nextIndex + 7);
      }
      
      // Fix paths with double _next
      if (url.includes('/_next/_next/')) {
        url = url.replace(/\\/_next\\/_next\\//g, '/_next/');
        if (url.startsWith('/_next/')) {
          return webpackPublicPath + url.substring(7);
        }
      }
      
      return url;
    }
    
    // Override webpack's public path getter/setter if webpack is already loaded
    function fixWebpackPublicPath() {
      try {
        // Try to find webpack chunk loader and fix its public path
        if (typeof self !== 'undefined' && self.webpackChunk_N_E) {
          // Webpack might be loading, wait a bit and try again
          setTimeout(fixWebpackPublicPath, 10);
        }
        
        // Fix __webpack_require__.p if it exists
        if (typeof __webpack_require__ !== 'undefined' && __webpack_require__.p) {
          if (__webpack_require__.p === '/_next/' || __webpack_require__.p.startsWith('/_next/')) {
            __webpack_require__.p = webpackPublicPath;
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Try to fix webpack public path immediately and periodically
    fixWebpackPublicPath();
    setInterval(fixWebpackPublicPath, 100);
    
    // Fix fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(url, ...args) {
      return originalFetch.call(this, fixUrl(url), ...args);
    };
    
    // Intercept script src attribute setting (for webpack chunk loading)
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (name === 'src' && this.tagName === 'SCRIPT' && typeof value === 'string') {
        value = fixUrl(value);
      }
      return originalSetAttribute.call(this, name, value);
    };
    
    // Intercept script src property setter
    const scriptProto = HTMLScriptElement.prototype;
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(scriptProto, 'src');
    if (originalSrcDescriptor && originalSrcDescriptor.set) {
      Object.defineProperty(scriptProto, 'src', {
        set: function(value) {
          originalSrcDescriptor.set.call(this, fixUrl(value));
        },
        get: originalSrcDescriptor.get,
        configurable: true,
        enumerable: true
      });
    }
  }
})();
</script>`;
      // Insert right after <head> tag (before base tag if present)
      content = content.replace(/<head[^>]*>/i, (match) => `${match}${pathFixScript}`);
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed paths in: ${path.relative(outDir, filePath)}`);
      modified = true;
    }

    return modified;
  } catch (error) {
    console.error(`Error fixing paths in ${filePath}:`, error);
    return false;
  }
}

function fixWebpackBundle(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;
    
    // Fix webpack's hardcoded public path: s.p="/_next/" -> s.p=window.__webpack_public_path__||"./_next/"
    // This ensures webpack uses the correct path in Electron
    // Match patterns like: s.p="/_next/" or s.p=/_next/ (minified, no spaces)
    if (content.includes('/_next/"') || content.includes("/_next/'")) {
      // Replace hardcoded public path with dynamic one (handle both spaced and minified)
      content = content.replace(/s\.p\s*=\s*"\/_next\/"/g, 's.p=window.__webpack_public_path__||"./_next/"');
      content = content.replace(/s\.p\s*=\s*'\/_next\/'/g, "s.p=window.__webpack_public_path__||'./_next/'");
      // Also handle minified version without spaces
      content = content.replace(/s\.p="\/_next\/"/g, 's.p=window.__webpack_public_path__||"./_next/"');
      content = content.replace(/s\.p='\/_next\/'/g, "s.p=window.__webpack_public_path__||'./_next/'");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed webpack public path in: ${path.relative(outDir, filePath)}`);
    }
    
    return modified;
  } catch (error) {
    console.error(`Error fixing webpack bundle ${filePath}:`, error);
    return false;
  }
}

function walkDir(dir, fileList = [], fileType = 'html') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, fileList, fileType);
    } else if (fileType === 'html' && file.endsWith('.html')) {
      fileList.push(filePath);
    } else if (fileType === 'js' && file.endsWith('.js') && file.includes('webpack')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
console.log('Fixing paths for Electron file:// protocol...');

// Fix HTML files
const htmlFiles = walkDir(outDir);
let fixedCount = 0;

htmlFiles.forEach(file => {
  if (fixPathsInFile(file)) {
    fixedCount++;
  }
});

console.log(`Fixed ${fixedCount} out of ${htmlFiles.length} HTML file(s).`);

// Fix webpack bundle files
const webpackFiles = walkDir(outDir, [], 'js');
let webpackFixedCount = 0;

webpackFiles.forEach(file => {
  if (fixWebpackBundle(file)) {
    webpackFixedCount++;
  }
});

if (webpackFixedCount > 0) {
  console.log(`Fixed ${webpackFixedCount} webpack bundle file(s).`);
}

// Check if WASM files exist in out directory
const wasmFile = path.join(outDir, 'rnnoise.wasm');
const workletFile = path.join(outDir, 'rnnoise.worklet.js');

if (fs.existsSync(wasmFile)) {
  console.log('✓ rnnoise.wasm found in out/ directory');
} else {
  console.warn('⚠ WARNING: rnnoise.wasm NOT found in out/ directory');
  console.warn('  Expected location:', wasmFile);
}

if (fs.existsSync(workletFile)) {
  console.log('✓ rnnoise.worklet.js found in out/ directory');
} else {
  console.warn('⚠ WARNING: rnnoise.worklet.js NOT found in out/ directory');
  console.warn('  Expected location:', workletFile);
}

