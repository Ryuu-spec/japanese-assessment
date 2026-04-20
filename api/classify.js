export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { word } = req.body || {};
  if (!word) return res.status(400).json({ error: 'word is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ word, difficulty: 'jung' });

  const prompt = `단어 "${word}"의 일본어 음운 난이도를 분류하세요.
ha: 2모라 이하 또는 특수음 없는 3모라
sang: 5모라 이상+특수음 또는 4모라+특수음 2개이상
jung: 나머지
{"difficulty":"ha"} 또는 {"difficulty":"jung"} 또는 {"difficulty":"sang"} 중 하나만 반환하세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 50 }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini raw:', JSON.stringify(data).slice(0, 200));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let difficulty = 'jung';
    try {
      const parsed = JSON.parse(clean);
      if (['ha', 'jung', 'sang'].includes(parsed.difficulty)) {
        difficulty = parsed.difficulty;
      }
    } catch {
      if (clean.includes('"ha"')) difficulty = 'ha';
      else if (clean.includes('"sang"')) difficulty = 'sang';
    }

    return res.status(200).json({ word, difficulty });
  } catch (error) {
    console.error('error:', error.message);
    return res.status(200).json({ word, difficulty: 'jung' });
  }
}
