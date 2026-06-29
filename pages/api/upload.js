const pdfParse = require('pdf-parse');
import anthropic from '../../lib/claude';
import Groq from 'groq-sdk';

export const config = {
  api: {
    bodyParser: false, // Disables default parser to read raw binary stream
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const contentType = req.headers['content-type'] || '';

  try {
    const buffer = await getRawBody(req);

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'No file data received.' });
    }

    let extractedText = '';

    // ── Handle Images (Vision OCR) ──────────────────────────
    if (contentType.startsWith('image/')) {
      const base64Data = buffer.toString('base64');
      const groqKey = process.env.GROQ_API_KEY;

      if (groqKey && !groqKey.includes('your-key') && groqKey.startsWith('gsk_')) {
        // Use Groq Llama 3.2 Vision (11B)
        const groq = new Groq({ apiKey: groqKey });
        const response = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all the plain text from this resume image. Maintain the layout, headings, and structure as closely as possible. Do not add any conversational introduction, notes, or commentary. Output only the extracted resume text.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${contentType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        });
        extractedText = response.choices[0]?.message?.content || '';
      } else {
        // Fallback: Use Claude 3.5 Sonnet Vision
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all the plain text from this resume image. Maintain the layout, headings, and structure as closely as possible. Do not add any conversational introduction, notes, or commentary. Output only the extracted resume text.',
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: contentType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        });
        extractedText = message.content[0].text || '';
      }
    } 
    // ── Handle PDFs ────────────────────────────────────────────────
    else if (contentType === 'application/pdf') {
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } 
    else {
      return res.status(400).json({ error: 'Unsupported file type. Upload a PDF or an Image.' });
    }

    // Clean up text format
    extractedText = extractedText.replace(/\r\n/g, '\n').replace(/ +/g, ' ').trim();

    if (!extractedText) {
      return res.status(400).json({ error: 'Could not extract text. Make sure the document is legible.' });
    }

    return res.status(200).json({ text: extractedText });
  } catch (error) {
    console.error('File parsing error:', error);
    return res.status(500).json({ error: `Failed to extract text: ${error.message || 'Unknown error'}` });
  }
}
