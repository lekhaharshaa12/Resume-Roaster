const pdfParse = require('pdf-parse');
import prisma from '../../lib/db';
import { streamChatWithGroq, chatWithGroq, groqAvailable } from '../../services/ai';
import jwt from 'jsonwebtoken';

const ROAST_PROMPT = (resumeText) => `You are a witty, brutally honest resume reviewer with a sharp sense of humor. 
Your job is to roast the resume below — be funny, be direct, be harsh — but make it genuinely useful. 
Point out what's vague, what's missing, what screams "I copied this from a template", and what would make a hiring manager cringe.
End your roast with a clearly labeled section called "3 Concrete Fixes:" that gives three specific, actionable improvements the person can make TODAY.
Keep the whole response under 400 words.

Resume:
${resumeText}`;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Authentication Check
  const cookies = req.headers.cookie || '';
  const sessionCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith('session='));

  if (!sessionCookie) {
    return res.status(401).json({ error: 'Unauthorized. Please sign up or sign in first.' });
  }

  const token = sessionCookie.split('=')[1];
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
  let userId;

  try {
    const decoded = jwt.verify(token, secret);
    userId = decoded.userId;
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const { fileData, fileType, resumeText: pastedText } = req.body;

  let textToRoast = '';

  try {
    // 2. Process attachments if present
    if (fileData && fileType) {
      const buffer = Buffer.from(fileData, 'base64');

      if (fileType === 'application/pdf') {
        const data = await pdfParse(buffer);
        textToRoast = data.text || '';
      } else if (fileType.startsWith('image/')) {
        if (!groqAvailable()) {
          return res.status(500).json({ error: 'Vision OCR not configured.' });
        }

        const OCR_INSTRUCTION =
          'Extract all the plain text from this resume image. ' +
          'Maintain the layout, headings, and structure as closely as possible. ' +
          'Do not add any conversational introduction, notes, or commentary. ' +
          'Output only the extracted resume text.';

        textToRoast = await chatWithGroq([
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_INSTRUCTION },
              {
                type: 'image_url',
                image_url: { url: `data:${fileType};base64,${fileData}` },
              },
            ],
          },
        ], { model: 'meta-llama/llama-4-scout-17b-16e-instruct' });
      } else {
        return res.status(400).json({ error: 'Unsupported file type attached.' });
      }
    } else {
      textToRoast = pastedText || '';
    }

    // Clean up text
    textToRoast = textToRoast.replace(/\r\n/g, '\n').replace(/ +/g, ' ').trim();

    if (!textToRoast) {
      return res.status(400).json({ error: 'Could not extract resume content.' });
    }

    const wordCount = textToRoast.trim() === '' ? 0 : textToRoast.trim().split(/\s+/).length;
    if (wordCount < 200) {
      return res.status(400).json({
        error: `The parsed resume has only ${wordCount} words. Paste/upload a full resume of at least 200 words.`,
      });
    }

    if (!groqAvailable()) {
      return res.status(500).json({ error: 'AI generation service missing API keys.' });
    }

    // 3. Set SSE (Server Sent Events) Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none',
    });
    res.flushHeaders();

    // 4. Stream response from Groq
    let fullRoastText = '';
    let isClientClosed = false;

    req.on('close', () => {
      isClientClosed = true;
    });

    const completionStream = streamChatWithGroq([
      { role: 'user', content: ROAST_PROMPT(textToRoast) },
    ], { model: 'llama-3.3-70b-versatile' });

    for await (const chunk of completionStream) {
      if (isClientClosed) {
        break;
      }
      fullRoastText += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // 5. Complete registration of roast in database on successful finish
    if (!isClientClosed && fullRoastText.trim().length > 0) {
      try {
        await prisma.roast.create({
          data: {
            resumeText: textToRoast,
            roastText: fullRoastText,
            userId,
          },
        });
      } catch (dbErr) {
        console.error('[Roast Stream] DB Save Error:', dbErr);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[Roast Stream] Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to process stream.' })}\n\n`);
    res.end();
  }
}
