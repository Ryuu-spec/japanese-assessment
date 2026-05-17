export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `日本語のネイティブスピーカーとして、自然な日本語の発音で読んでください: ${text}` }] }],
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
      const part = data?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;

      if (!audioData) {
        console.warn(`TTS 시도 ${attempt}/${MAX_RETRIES} 실패: 오디오 없음`);
        if (attempt === MAX_RETRIES) return res.status(500).json({ error: 'TTS 생성 실패' });
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }

      // PCM → WAV (24000Hz, mono, 16bit)
      const pcm = Buffer.from(audioData, 'base64');
      const header = Buffer.alloc(44);
      const sampleRate = 24000, numChannels = 1, bitsPerSample = 16;
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + pcm.length, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(numChannels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
      header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(pcm.length, 40);

      res.setHeader('Content-Type', 'audio/wav');
      return res.send(Buffer.concat([header, pcm]));

    } catch (e) {
      console.error(`TTS 시도 ${attempt}/${MAX_RETRIES} 오류:`, e.message);
      if (attempt === MAX_RETRIES) return res.status(500).json({ error: e.message });
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
}
