export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { zone1, zone2, total, script } = req.body;
  const scriptName = script === 'hiragana' ? '히라가나' : '가타카나';

  const prompt = `당신은 한국 중고등학교 일본어 교육 전문가입니다.
수행평가 난이도 비율을 추천해주세요.

[평가 조건]
- 평가 문자: ${scriptName}
- 출제 범위 ①: ${zone1.join(', ')}
- 출제 범위 ②: ${zone2.join(', ')}
- 총 문항 수: ${total}개

[난이도 판단 기준]
- 하(쉬움): 아행, 카행, 나행, 마행 — 모음+기본 자음, 규칙적
- 중(보통): 사행(し불규칙), 하행(ふ불규칙), 야행+와행(문자 수 적음), 라행
- 상(어려움): 타행(ち・つ불규칙), 촉음/요음 포함 범위, 가타카나 전반

[응답 규칙]
- JSON만 출력, 다른 텍스트 없음, 코드블록 없음
- sang + jung + ha = 반드시 ${total}
- reason은 30자 이내 한국어

{"sang": 숫자, "jung": 숫자, "ha": 숫자, "reason": "추천 이유"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    const data = await response.json();
    const raw = data.candidates[0].content.parts[0].text
      .replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);

    // 합계 검증 — 어긋나면 ha로 보정
    const sum = (result.sang || 0) + (result.jung || 0) + (result.ha || 0);
    if (sum !== total) {
      result.ha = Math.max(0, total - (result.sang || 0) - (result.jung || 0));
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error('recommend API error:', e);
    // 폴백: 2:5:3 표준 분포
    const sang = Math.max(1, Math.round(total * 0.2));
    const ha   = Math.max(1, Math.round(total * 0.3));
    const jung = Math.max(0, total - sang - ha);
    return res.status(200).json({
      sang, jung, ha,
      reason: '기본 배율(상20%·중50%·하30%)로 추천했습니다.'
    });
  }
}
