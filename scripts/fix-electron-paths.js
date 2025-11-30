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

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main execution
console.log('Fixing paths for Electron file:// protocol...');
const htmlFiles = walkDir(outDir);
let fixedCount = 0;

htmlFiles.forEach(file => {
  if (fixPathsInFile(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} out of ${htmlFiles.length} HTML file(s).`);

