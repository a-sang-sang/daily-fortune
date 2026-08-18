// 2) 템플릿 + fortune-data.json → 캐러셀용 여러 장의 PNG 렌더링
// 슬라이드 구성: 1장(오늘의 주인공, 크게) + 나머지 11개 띠를 2개씩 묶은 장들
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

function chunkPairs(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function renderImage() {
  const dataPath = path.join(__dirname, '..', 'data', 'fortune-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const hero = ZODIAC.find((z) => z.key === data.heroKey);
  const rest = ZODIAC.filter((z) => z.key !== data.heroKey);
  const pairs = chunkPairs(rest, 2); // 11개 -> 6묶음(5개는 2개씩, 마지막 1개)

  const totalPages = 1 + pairs.length; // 항상 10 이하 (보통 7장)

  const outDir = path.join(__dirname, '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });

  // 이전 실행에서 남은 png 정리 (개수가 날마다 같아서 보통 필요 없지만 안전하게)
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.png')) fs.unlinkSync(path.join(outDir, f));
  }

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

  // --- 1번 슬라이드: 히어로 ---
  const heroTemplatePath = path.join(__dirname, '..', 'templates', 'fortune-card.template.html');
  let heroHtml = fs.readFileSync(heroTemplatePath, 'utf-8');
  heroHtml = heroHtml
    .replace('{{PAGE_NUM}}', '1')
    .replace('{{TOTAL_PAGES}}', String(totalPages))
    .replace('{{MONTH}}', data.date.month)
    .replace('{{DAY}}', data.date.day)
    .replace('{{HERO_ICON}}', hero.icon)
    .replace('{{HERO_NAME}}', hero.name)
    .replace('{{HERO_FORTUNE}}', data.heroFortune);

  await renderOne(page, heroHtml, path.join(outDir, 'fortune-01.png'));

  // --- 2번 슬라이드부터: 2개씩 묶은 페이지들 ---
  const pairTemplatePath = path.join(__dirname, '..', 'templates', 'fortune-card-pair.template.html');
  const pairTemplateRaw = fs.readFileSync(pairTemplatePath, 'utf-8');

  for (let i = 0; i < pairs.length; i++) {
    const group = pairs[i];
    const rowsHtml = group
      .map(
        (z) => `
      <div class="row-card">
        <div class="row-icon">${z.icon}</div>
        <div class="row-text">
          <div class="name">${z.name}</div>
          <div class="fortune">${data.fortunes[z.key]}</div>
        </div>
      </div>`
      )
      .join('\n');

    let pairHtml = pairTemplateRaw
      .replace('{{PAGE_NUM}}', String(i + 2))
      .replace('{{TOTAL_PAGES}}', String(totalPages))
      .replace('{{MONTH}}', data.date.month)
      .replace('{{DAY}}', data.date.day)
      .replace('{{ROWS_HTML}}', rowsHtml);

    const fileNum = String(i + 2).padStart(2, '0');
    await renderOne(page, pairHtml, path.join(outDir, `fortune-${fileNum}.png`));
  }

  await browser.close();
  console.log(`총 ${totalPages}장의 슬라이드 생성 완료 (output/ 폴더 확인)`);
}

async function renderOne(page, html, outPath) {
  const tmpPath = outPath.replace('.png', '.html');
  fs.writeFileSync(tmpPath, html);
  await page.goto(`file://${tmpPath}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath });
  fs.unlinkSync(tmpPath);
  console.log('생성:', outPath);
}

renderImage().catch((err) => {
  console.error(err);
  process.exit(1);
});
