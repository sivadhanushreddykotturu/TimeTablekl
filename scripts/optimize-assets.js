import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple asset optimization script
function optimizeAssets() {
  console.log('Optimizing assets for PWA...');
  
  // Check if public directory exists
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    console.log('Public directory not found');
    return;
  }

  // List of files to check and optimize
  const filesToCheck = [
    'maskable_icon_x192.png',
    'maskable_icon_x512.png',
    'icon.svg',
    'manifest.json'
  ];

  filesToCheck.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`${file}: Not found`);
    }
  });

  console.log('Asset optimization check complete');
}

// Run optimization
optimizeAssets(); 