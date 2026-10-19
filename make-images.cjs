// one-off: og image + PNG icons with sharp. Run from the portfolio root: node make-images.cjs <path-to-sharp-dir>
const sharp = require(require('path').join(process.argv[2], 'node_modules', 'sharp'));
(async () => {
  const W = 1200, H = 630;
  const face = await sharp('dist/assets/hassan-bust.webp').resize({ height: 630, width: 640, fit: 'cover', position: 'top' }).toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="78%" cy="40%" r="60%"><stop offset="0" stop-color="#ff5b26" stop-opacity=".35"/><stop offset="1" stop-color="#0b0c0e" stop-opacity="0"/></radialGradient>
  <linearGradient id="f" x1="0" x2="1"><stop offset=".45" stop-color="#0b0c0e"/><stop offset=".62" stop-color="#0b0c0e" stop-opacity="0"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="#0b0c0e"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="url(#f)"/>
  <defs><linearGradient id="f" x1="0" x2="1"><stop offset=".42" stop-color="#0b0c0e"/><stop offset=".6" stop-color="#0b0c0e" stop-opacity="0"/></linearGradient></defs>
  <text x="72" y="120" font-family="DejaVu Sans Mono, Consolas, monospace" font-size="20" letter-spacing="4" fill="#ff7a45">OSLO · NORWAY · GULF · EGYPT</text>
  <text x="68" y="270" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="104" fill="#edeae3">Hassan</text>
  <text x="68" y="380" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="104" fill="#edeae3">Nasr</text>
  <text x="72" y="450" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#ff7a45">CTO · Medioteq AS</text>
  <text x="72" y="520" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#b9c0cf">AI architecture · Health · Enterprise software</text>
  <circle cx="1130" cy="70" r="10" fill="#ff5b26"/></svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: face, left: 560, top: 0 }, { input: Buffer.from(over), left: 0, top: 0 }]).jpeg({ quality: 82, mozjpeg: true }).toFile('dist/assets/og-image.jpg');
  for (const s of [192, 512]) await sharp('dist/favicon.svg', { density: 600 }).resize(s, s).png().toFile(`dist/assets/icon-${s}.png`);
  console.log('images ok');
})().catch(e => { console.error(e); process.exit(1); });
