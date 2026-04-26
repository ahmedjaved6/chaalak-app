import sharp from 'sharp'
import path from 'path'

const svgContent = `
<svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="18.5" cy="17.5" r="3.5" />
  <circle cx="5.5" cy="17.5" r="3.5" />
  <path d="M15 17.5h-6" />
  <path d="M5.5 14V7a2 2 0 0 1 2-2H12" />
  <path d="M18.5 14v-4a2 2 0 0 0-2-2h-3" />
  <path d="M12 5v12.5" />
</svg>
`

async function generateIcons() {
  const sizes = [
    { name: 'icon-192.png', size: 192, radius: 40, svgSize: 96 },
    { name: 'icon-512.png', size: 512, radius: 106, svgSize: 256 },
  ];

  for (const { name, size, radius, svgSize } of sizes) {
    const resizedSvg = svgContent.replace('width="100" height="100"', `width="${svgSize}" height="${svgSize}"`);
    
    // Create base rounded rect SVG to act as mask/background
    const bgSvg = `
      <svg width="${size}" height="${size}">
        <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#F59E0B" />
      </svg>
    `;

    const outPath = path.join(process.cwd(), 'public', name);

    await sharp(Buffer.from(bgSvg))
      .composite([{ input: Buffer.from(resizedSvg), gravity: 'center' }])
      .png({ quality: 80, progressive: false, compressionLevel: 9 })
      .toFile(outPath);

    console.log(`Generated ${name}`);
  }
}

generateIcons().catch(console.error);
