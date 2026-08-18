// 2) 템플릿 + fortune-data.json → 1080x1080 PNG 렌더링
// 실행: node scripts/2-render-image.js

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ZODIAC = [
  { key: 'rat',     icon: '🐭', name: '쥐띠' },
  { key: 'ox',      icon: '🐮', name: '소띠' },
  { key: 'tiger',   icon: '🐯', name: '호랑이띠' },
  { key: 'rabbit',  icon: '🐰', name: '토끼띠' },
  { key: 'dragon',  icon: '🐲', name: '용띠' },
  { key: 'snake',   icon: '🐍', name: '뱀띠' },
  { key: 'horse',   icon: '🐴', name: '말띠' },
  { key: 'goat',    icon: '🐑', name: '양띠' },
  { key: 'monkey',  icon: '🐵', name: '원숭이띠' },
  { key: 'rooster', icon: '🐔', name: '닭띠' },
  { key: 'dog',     icon: '🐶', name: '개띠' },
  { key: 'pig',     icon: '🐷', name: '돼지띠' },
];

async function renderImage() {
  const dataPath = path.join(__dirname, '..', 'data', 'fortune-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const templatePath = path.join(__dirname, '..', 'templates', 'fortune-card.template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const hero = ZODIAC.find((z) => z.key === data.heroKey);

  const gridItemsHtml = ZODIAC.map((z) => {
    const isActive = z.key === data.heroKey;
    const text = isActive ? '오늘의 주인공 ✨' : data.fortunes[z.key];
    return `
      <div class="item${isActive ? ' active' : ''}">
        <div class="icon">${z.icon}</div>
        <div class="info">
          <div class="name">${z.name}</div>
          <div class="text">${text}</div>
        </div>
      </div>`;
  }).join('\n');

  html = html
    .replace('{{MONTH}}', data.date.month)
    .replace('{{DAY}}', data.date.day)
    .replace('{{HERO_ICON}}', hero.icon)
    .replace('{{HERO_NAME}}', hero.name)
    .replace('{{HERO_FORTUNE}}', data.heroFortune)
    .replace('{{GRID_ITEMS}}', gridItemsHtml);

  const outDir = path.join(__dirname, '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const renderedHtmlPath = path.join(outDir, 'rendered.html');
  fs.writeFileSync(renderedHtmlPath, html);

  const dateStr = `${data.date.month}-${data.date.day}`;
  const imagePath = path.join(outDir, `fortune-${dateStr}.png`);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`file://${renderedHtmlPath}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: imagePath });
  await browser.close();

  console.log('이미지 생성 완료:', imagePath);
  return imagePath;
}

renderImage().catch((err) => {
  console.error(err);
  process.exit(1);
});
