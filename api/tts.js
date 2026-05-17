export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['audio'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Aoede' }
              }
            }
          }
        })
      }
    );

    const data = await response.json();
    const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      console.error('TTS 응답 이상:', JSON.stringify(data));
      return res.status(500).json({ error: 'TTS 생성 실패' });
    }

    const buffer = Buffer.from(audioData, 'base64');
    res.setHeader('Content-Type', 'audio/wav');
    res.send(buffer);

  } catch (e) {
    console.error('TTS 오류:', e);
    res.status(500).json({ error: e.message });
  }
}
