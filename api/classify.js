export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'word is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `
당신은 한국 중고등학생을 위한 일본어 음운 난이도 분류 전문가입니다.
다음 일본어 단어의 난이도를 분류해주세요.
단어: ${word}

난이도 기준:
- ha(하): 2모라 이하 / 청음·탁음·반탁음으로만 구성된 3모라 (ン 없이)
- sang(상): 5모라 이상 + 특수음 포함 / 4모라 + 특수음(요음·촉음·장음·소모음) 2개 이상
- jung(중): 나머지

특수음: 요음(ゃゅょ), 촉음(っ/ッ), 장음(ー), 소모음(ァィゥェォ)

반드시 아래 JSON 형식으로만 답하세요. 다른 설명 없이:
{"difficulty": "ha"} 또는 {"difficulty": "jung"} 또는 {"difficulty": "sang"}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
        })
      }
    );
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return res.status(500).json({ error: 'No response from Gemini' });

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // 유효한 값인지 확인
    const valid = ['ha', 'jung', 'sang'];
    const difficulty = valid.includes(result.difficulty) ? result.difficulty : 'jung';

    return res.status(200).json({ word, difficulty });
  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ error: 'Classification failed', detail: error.message });
  }
}
