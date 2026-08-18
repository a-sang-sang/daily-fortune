// 1) Claude API로 오늘의 12간지 운세를 JSON으로 생성
// 실행: node scripts/1-generate-fortune.js
// 필요 환경변수: ANTHROPIC_API_KEY

const fs = require('fs');
const path = require('path');

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

// 참고: 정통 사주 명리학의 일진(60갑자)은 음력·절기 기반 계산이 필요해서 간단히 구현하기 어려워요.
// 여기서는 콘텐츠에 변화를 주기 위해 날짜 기반으로 "오늘의 주인공"을 순환시키는 방식을 씁니다.
// 실제 명리학적 정확도가 필요하면 별도 만세력 라이브러리 연동을 검토하세요.

// GitHub Actions 서버는 UTC로 동작해서 new Date()를 그냥 쓰면 한국시간과 날짜가
// 하루 어긋날 수 있어요 (UTC 22시 = 한국시간 다음날 07시). 그래서 한국시간(KST) 기준으로
// 연/월/일을 직접 계산해요.
function getKstDateParts() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC + 9시간
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayOfYear = Math.floor(
    (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / (1000 * 60 * 60 * 24)
  );
  return { year, month, day, dayOfYear };
}

function pickHeroKey(dayOfYear) {
  return ZODIAC[dayOfYear % 12].key;
}

async function generateFortunes() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 없습니다.');

  const { year, month, day, dayOfYear } = getKstDateParts();
  const heroKey = pickHeroKey(dayOfYear);

  const prompt = `오늘(${year}년 ${month}월 ${day}일) 12간지 각각에 대한 운세를 만들어줘.

조건:
- 12간지 각각 한 줄 운세 (최대 22자, 이모지 1개 포함 가능)
- 톤: 다정하고 귀엽고 긍정적, 미신적이거나 불안을 조장하는 표현 금지
- "${heroKey}" 띠는 오늘의 주인공이니 조금 더 상세한 2줄 운세도 별도로 작성 (최대 45자)
- 순서는 반드시 rat, ox, tiger, rabbit, dragon, snake, horse, goat, monkey, rooster, dog, pig

아래 JSON 형식으로만 응답해. 다른 텍스트, 설명, 마크다운 코드블록 없이 JSON만 출력해:
{
  "hero_fortune": "토끼띠를 위한 2줄 상세 운세",
  "fortunes": {
    "rat": "한 줄 운세",
    "ox": "한 줄 운세",
    "tiger": "한 줄 운세",
    "rabbit": "한 줄 운세",
    "dragon": "한 줄 운세",
    "snake": "한 줄 운세",
    "horse": "한 줄 운세",
    "goat": "한 줄 운세",
    "monkey": "한 줄 운세",
    "rooster": "한 줄 운세",
    "dog": "한 줄 운세",
    "pig": "한 줄 운세"
  }
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API 오류: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const rawText = data.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const output = {
    date: { month, day },
    heroKey,
    heroFortune: parsed.hero_fortune,
    fortunes: parsed.fortunes,
  };

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fortune-data.json'), JSON.stringify(output, null, 2));
  console.log('fortune-data.json 생성 완료:', output);
}

generateFortunes().catch((err) => {
  console.error(err);
  process.exit(1);
});
