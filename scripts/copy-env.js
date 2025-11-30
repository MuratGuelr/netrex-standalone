const fs = require('fs');
const path = require('path');

// Copy .env.local to electron/ directory for build
const sourceEnv = path.join(__dirname, '../.env.local');
const destEnv = path.join(__dirname, '../electron/.env.local');

if (fs.existsSync(sourceEnv)) {
  try {
    fs.copyFileSync(sourceEnv, destEnv);
    console.log('✓ Copied .env.local to electron/ directory');
  } catch (error) {
    console.error('Error copying .env.local:', error);
    process.exit(1);
  }
} else {
  console.warn('⚠ Warning: .env.local not found in project root');
  console.warn('  Expected location:', sourceEnv);
}

