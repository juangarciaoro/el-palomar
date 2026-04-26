#!/usr/bin/env node
// Simple script to download woff2 files referenced by a Google Fonts CSS URL
// Usage: node scripts/fetch-fonts.js [google-fonts-css-url]

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap';
const outDir = path.resolve(__dirname, '..', 'www', 'assets', 'fonts');

// Modern browser UA is required for Google Fonts to return woff2 (not ttf)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => reject(err));
    }).on('error', reject);
  });
}

/** Parse all @font-face blocks from a CSS string and return an array of metadata objects */
function parseFontFaceBlocks(css) {
  const blocks = [];
  const blockRe = /@font-face\s*\{([^}]+)\}/g;
  let bm;
  while ((bm = blockRe.exec(css)) !== null) {
    const block = bm[1];
    const get = (prop) => {
      const r = new RegExp(prop + '\\s*:\\s*([^;]+)', 'i');
      const m = r.exec(block);
      return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
    };
    const urlM = /url\((https:\/\/[^)]+?\.woff2)\)/.exec(block);
    if (!urlM) continue;
    const unicodeRange = get('unicode-range');
    blocks.push({
      family: get('font-family'),
      weight: get('font-weight') || '400',
      style:  get('font-style')  || 'normal',
      url:    urlM[1],
      isLatin: !unicodeRange,   // blocks with no unicode-range are the latin base block
      unicodeRange,
    });
  }
  return blocks;
}

/** Sanitize a font-family name into a safe filename segment */
function safeName(s) {
  return s.replace(/['"\s]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

async function main() {
  const cssUrl = process.argv[2] || DEFAULT_URL;
  console.log('Fetching CSS from', cssUrl);
  try {
    const cssBuf = await fetchUrl(cssUrl);
    const css = cssBuf.toString('utf8');
    const all = parseFontFaceBlocks(css);

    if (all.length === 0) {
      console.log('No woff2 @font-face blocks found. CSS output:\n', css);
      return;
    }

    // Keep only the latin base block per family+weight+style (no unicode-range)
    // Fall back to first block if none is latin-only
    const seen = new Map();
    for (const f of all) {
      const key = `${f.family}__${f.weight}__${f.style}`;
      if (!seen.has(key) || f.isLatin) seen.set(key, f);
    }
    const toDownload = Array.from(seen.values());

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    console.log(`Downloading ${toDownload.length} font files (latin subset only)...`);
    const downloaded = [];
    for (const f of toDownload) {
      const styleSuffix = f.style === 'italic' ? '-Italic' : '';
      const filename = `${safeName(f.family)}-${f.weight}${styleSuffix}.woff2`;
      const dest = path.join(outDir, filename);
      console.log(` - ${filename}  (${f.family} ${f.weight} ${f.style})`);
      await downloadFile(f.url, dest);
      downloaded.push({ ...f, filename });
    }

    // Generate @font-face declarations to replace the placeholders in design-tokens.css
    const tokensPath = path.resolve(__dirname, '..', 'www', 'css', 'design-tokens.css');
    let tokensCSS = fs.readFileSync(tokensPath, 'utf8');

    // Build replacement @font-face block
    const faces = downloaded.map(f =>
      `@font-face {\n  font-family: "${f.family} Local";\n  src: url("../assets/fonts/${f.filename}") format("woff2");\n  font-weight: ${f.weight};\n  font-style: ${f.style};\n  font-display: swap;\n}`
    ).join('\n');

    // Replace the placeholder @font-face section (between the two sentinel comments)
    const startMark = '/* Self-hosted font faces (place .woff2 files into /www/assets/fonts/) */';
    const endMark   = '\n/* Map semantic brand tokens';
    const startIdx  = tokensCSS.indexOf(startMark);
    const endIdx    = tokensCSS.indexOf(endMark);
    if (startIdx !== -1 && endIdx !== -1) {
      tokensCSS = tokensCSS.slice(0, startIdx) +
        '/* Self-hosted font faces — generated by scripts/fetch-fonts.js */\n' +
        faces + '\n' +
        tokensCSS.slice(endIdx);
      fs.writeFileSync(tokensPath, tokensCSS, 'utf8');
      console.log('\nUpdated www/css/design-tokens.css with correct @font-face declarations.');
    } else {
      console.log('\nNote: could not locate @font-face placeholder section in design-tokens.css. Add these manually:');
      console.log(faces);
    }

    console.log('\nDone! Fonts are in', outDir);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
