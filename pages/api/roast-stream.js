import prisma from '../../lib/db';
import { groqAvailable, categoriseError } from '../../services/ai';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT =
  'You are a witty but genuinely helpful resume reviewer. ' +
  'Be funny, be direct, and be harsh — but make every critique actionable. ' +
  'Point out what is vague, what is missing, what screams "I copied this from a template", ' +
  'and what would make a hiring manager cringe. ' +
  'End your roast with a clearly labelled section called "3 Concrete Fixes:" that gives ' +
  'three specific, actionable improvements the person can make TODAY. ' +
  'Keep the whole response under 400 words. ' +
  'You are strictly a resume advisor — only answer questions about this resume and career topics.';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { resumeText } = req.body;

  if (!resumeText || typeof resumeText !== 'string') {
    return res.status(400).json({ error: 'resumeText is required.' });
  }

  const wordCount = resumeText.trim() === '' ? 0 : resumeText.trim().split(/\s+/).length;
  if (wordCount < 200) {
    return res.status(400).json({
      error: 'Resume must be at least 200 words. Paste the full text.',
    });
  }

  if (!groqAvailable()) {
    return res.status(500).json({ error: 'AI generation service is currently misconfigured. Missing Groq API key.' });
  }

  // 1. Initialize a new Conversation session in database
  let conversationId = null;
  try {
    const conversation = await prisma.conversation.create({ data: {} });
    conversationId = conversation.id;
  } catch (dbError) {
    console.error('[Roast Stream] Database session initialization failed:', dbError);
    return res.status(500).json({ error: 'Failed to initialize session in database.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders();

  // Send conversationId immediately so the frontend knows how to link follow-ups
  res.write(`data: ${JSON.stringify({ conversationId })}\n\n`);

  const userContent = `Please roast my resume:\n\n${resumeText}`;
  const groqKey = process.env.GROQ_API_KEY;
  const groqClient = new Groq({ apiKey: groqKey, timeout: 30_000 });

  let fullRoastText = '';

  try {
    const stream = await groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
      temperature: 0.85,
      stream: true,
    });

    for await (const chunk of stream) {
      if (res.writableEnded || res.finished || res.destroyed) {
        break;
      }

      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullRoastText += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
  } catch (error) {
    console.error('[Roast Stream] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream processing failed' })}\n\n`);
  } finally {
    // Write [DONE] signal to frontend
    res.write('data: [DONE]\n\n');
    res.end();

    // 2. Persist full messages and roast in database (after sending response)
    if (conversationId && fullRoastText.trim().length > 0) {
      try {
        await prisma.message.createMany({
          data: [
            { conversationId, role: 'user',      content: userContent },
            { conversationId, role: 'assistant', content: fullRoastText },
          ],
        });
        await prisma.roast.create({
          data: { conversationId, resumeText, roastText: fullRoastText },
        });
      } catch (dbError) {
        console.error('[Roast Stream] Failed to persist messages to DB:', dbError);
      }
    }
  }
}
