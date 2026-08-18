// 3) 생성된 이미지를 인스타그램에 게시
// 인스타그램 Graph API는 "공개 URL"이 있는 이미지만 업로드할 수 있어서,
// 이 스크립트는 GitHub Actions가 이미지를 리포지토리에 커밋/푸시한 뒤
// raw.githubusercontent.com 링크를 그 URL로 사용하는 방식을 가정합니다.
//
// 실행: node scripts/3-post-instagram.js
// 필요 환경변수:
//   IG_ACCESS_TOKEN, IG_ACCOUNT_ID
//   GITHUB_REPOSITORY (예: username/repo, GitHub Actions에서 자동 제공)
//   GITHUB_SHA (커밋 SHA, GitHub Actions에서 자동 제공)
//   IMAGE_REL_PATH (예: output/fortune-8-18.png)

const API_VERSION = 'v21.0';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postToInstagram() {
  const {
    IG_ACCESS_TOKEN,
    IG_ACCOUNT_ID,
    GITHUB_REPOSITORY,
    GITHUB_SHA,
    IMAGE_REL_PATH,
  } = process.env;

  if (!IG_ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error('IG_ACCESS_TOKEN / IG_ACCOUNT_ID 환경변수가 필요합니다.');
  }
  if (!GITHUB_REPOSITORY || !GITHUB_SHA || !IMAGE_REL_PATH) {
    throw new Error('GITHUB_REPOSITORY / GITHUB_SHA / IMAGE_REL_PATH 환경변수가 필요합니다.');
  }

  const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_SHA}/${IMAGE_REL_PATH}`;
  console.log('업로드할 이미지 URL:', imageUrl);

  const caption = buildCaption();

  // 1) 미디어 컨테이너 생성
  const createRes = await fetch(
    `https://graph.instagram.com/${API_VERSION}/${IG_ACCOUNT_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: IG_ACCESS_TOKEN,
      }),
    }
  );
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`컨테이너 생성 실패: ${JSON.stringify(createData)}`);
  }
  const creationId = createData.id;
  console.log('컨테이너 생성 완료:', creationId);

  // 2) 컨테이너 상태가 FINISHED 될 때까지 대기 (이미지 다운로드/처리 시간 필요)
  await waitUntilReady(creationId, IG_ACCESS_TOKEN);

  // 3) 게시
  const publishRes = await fetch(
    `https://graph.instagram.com/${API_VERSION}/${IG_ACCOUNT_ID}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: IG_ACCESS_TOKEN,
      }),
    }
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`게시 실패: ${JSON.stringify(publishData)}`);
  }
  console.log('게시 완료! media id:', publishData.id);
}

async function waitUntilReady(creationId, token, maxTries = 10) {
  for (let i = 0; i < maxTries; i++) {
    const res = await fetch(
      `https://graph.instagram.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${token}`
    );
    const data = await res.json();
    console.log(`상태 확인 (${i + 1}/${maxTries}):`, data.status_code);
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error('미디어 컨테이너 처리 중 오류가 발생했습니다.');
    }
    await sleep(3000);
  }
  throw new Error('미디어 컨테이너가 시간 내에 준비되지 않았습니다.');
}

function buildCaption() {
  const today = new Date();
  return [
    `${today.getMonth() + 1}월 ${today.getDate()}일, 오늘의 12간지 운세 🔮`,
    '',
    '나의 띠 운세는 어땠나요? 댓글로 알려주세요 💬',
    '',
    '#오늘의운세 #띠별운세 #12간지 #운세 #데일리운세',
  ].join('\n');
}

postToInstagram().catch((err) => {
  console.error(err);
  process.exit(1);
});
