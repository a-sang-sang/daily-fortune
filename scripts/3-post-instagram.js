// 3) output/ 폴더의 여러 이미지를 인스타그램 캐러셀(여러 장 넘기기)로 게시
// 실행: node scripts/3-post-instagram.js
// 필요 환경변수:
//   IG_ACCESS_TOKEN, IG_ACCOUNT_ID
//   GITHUB_REPOSITORY, GITHUB_SHA (GitHub Actions에서 자동 제공)

const fs = require('fs');
const path = require('path');

const API_VERSION = 'v21.0';
const API_BASE = 'https://graph.instagram.com';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postToInstagram() {
  const { IG_ACCESS_TOKEN, IG_ACCOUNT_ID, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;

  if (!IG_ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error('IG_ACCESS_TOKEN / IG_ACCOUNT_ID 환경변수가 필요합니다.');
  }
  if (!GITHUB_REPOSITORY || !GITHUB_SHA) {
    throw new Error('GITHUB_REPOSITORY / GITHUB_SHA 환경변수가 필요합니다.');
  }

  const outDir = path.join(__dirname, '..', 'output');
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.png'))
    .sort(); // fortune-01.png, fortune-02.png ... 순서대로 정렬됨

  if (files.length < 2) {
    throw new Error(`슬라이드가 2장 미만입니다 (${files.length}장). 캐러셀은 최소 2장 필요해요.`);
  }
  if (files.length > 10) {
    throw new Error(`슬라이드가 ${files.length}장입니다. 인스타그램 API 캐러셀은 최대 10장까지만 가능해요.`);
  }

  console.log(`총 ${files.length}장의 슬라이드를 업로드합니다.`);

  // 1) 각 이미지를 캐러셀 아이템(child) 컨테이너로 생성
  const childIds = [];
  for (const file of files) {
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_SHA}/output/${file}`;
    console.log('아이템 컨테이너 생성 중:', imageUrl);

    const res = await fetch(`${API_BASE}/${API_VERSION}/${IG_ACCOUNT_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: IG_ACCESS_TOKEN,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`아이템 컨테이너 생성 실패 (${file}): ${JSON.stringify(data)}`);
    }
    childIds.push(data.id);
  }

  console.log('아이템 컨테이너', childIds.length, '개 생성 완료');

  // 2) 캐러셀(부모) 컨테이너 생성
  const caption = buildCaption();
  const carouselRes = await fetch(`${API_BASE}/${API_VERSION}/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: IG_ACCESS_TOKEN,
    }),
  });
  const carouselData = await carouselRes.json();
  if (!carouselRes.ok) {
    throw new Error(`캐러셀 컨테이너 생성 실패: ${JSON.stringify(carouselData)}`);
  }
  const carouselId = carouselData.id;
  console.log('캐러셀 컨테이너 생성 완료:', carouselId);

  // 3) 처리 완료 대기
  await waitUntilReady(carouselId, IG_ACCESS_TOKEN);

  // 4) 게시
  const publishRes = await fetch(`${API_BASE}/${API_VERSION}/${IG_ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: carouselId,
      access_token: IG_ACCESS_TOKEN,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`게시 실패: ${JSON.stringify(publishData)}`);
  }
  console.log('게시 완료! media id:', publishData.id);
}

async function waitUntilReady(containerId, token, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    const res = await fetch(
      `${API_BASE}/${API_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const data = await res.json();
    console.log(`상태 확인 (${i + 1}/${maxTries}):`, data.status_code);
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error('캐러셀 컨테이너 처리 중 오류가 발생했습니다.');
    }
    await sleep(3000);
  }
  throw new Error('캐러셀 컨테이너가 시간 내에 준비되지 않았습니다.');
}

function buildCaption() {
  const today = new Date();
  return [
    `${today.getMonth() + 1}월 ${today.getDate()}일, 오늘의 12간지 운세 🔮`,
    '',
    '옆으로 넘겨서 내 띠 운세 확인해보세요 👉',
    '나의 띠 운세는 어땠나요? 댓글로 알려주세요 💬',
    '',
    '#오늘의운세 #띠별운세 #12간지 #운세 #데일리운세',
  ].join('\n');
}

postToInstagram().catch((err) => {
  console.error(err);
  process.exit(1);
});
