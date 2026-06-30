import prisma from '../../lib/db';
import { groqAvailable } from '../../services/ai';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT_INDIVIDUAL =
  'You are a witty but genuinely helpful resume reviewer. ' +
  'Be funny, be direct, and be harsh — but make every critique actionable. ' +
  'Point out what is vague, what is missing, what screams "I copied this from a template", ' +
  'and what would make a hiring manager cringe. ' +
  'Roast this specific resume individually. Do not mention or compare it with other resumes. ' +
  'End your roast with a clearly labelled section called "3 Concrete Fixes:" that gives ' +
  'three specific, actionable improvements the person can make TODAY. ' +
  'Keep the whole response under 400 words.';

const SYSTEM_PROMPT_COLLECTIVE =
  'You are a witty resume reviewer. ' +
  'Roast and compare all the resumes uploaded in this chat session together. ' +
  'Provide a constructive, harsh, and funny comparison of their progression/changes ' +
  'and roast the collection collectively. Tell the user if they are getting better or worse. ' +
  'End with "3 Overall Steps for Career Growth:" listing actionable advice. ' +
  'Keep the response under 400 words.';

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

  const { resumeText, conversationId: existingId } = req.body;

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

  let conversationId = existingId || null;

  // 1. Initialize a new Conversation session in database if not provided
  if (!conversationId) {
    try {
      const conversation = await prisma.conversation.create({ data: {} });
      conversationId = conversation.id;
    } catch (dbError) {
      console.error('[Roast Stream] Database session initialization failed:', dbError);
      return res.status(500).json({ error: 'Failed to initialize session in database.' });
    }
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders();

  // Send conversationId immediately so the frontend knows how to link subsequent roasts
  res.write(`data: ${JSON.stringify({ conversationId })}\n\n`);

  const userContent = `Please roast my new resume:\n\n${resumeText}`;
  const groqKey = process.env.GROQ_API_KEY;
  const groqClient = new Groq({ apiKey: groqKey, timeout: 30_000 });
  const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const maxTokens = parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10);

  let fullIndividualText = '';
  let fullCollectiveText = '';

  try {
    if (!existingId) {
      // ── FIRST TURN ──
      // Individual roast and collective roast are identical because there's only 1 resume.
      const stream = await groqClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_INDIVIDUAL },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.85,
        stream: true,
      });

      for await (const chunk of stream) {
        if (res.writableEnded || res.finished || res.destroyed) {
          break;
        }

        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullIndividualText += text;
          fullCollectiveText += text;
          // Send to both individual card (text) and chat box (collectiveText)
          res.write(`data: ${JSON.stringify({ text, collectiveText: text })}\n\n`);
        }
      }
    } else {
      // ── SUBSEQUENT TURNS ──
      // Generate individual roast and collective roast concurrently in parallel!
      
      // Fetch history for the collective roast
      const pastMessages = await prisma.message.findMany({
        where: { conversationId: existingId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      pastMessages.reverse();

      const apiHistory = pastMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // A. Setup Individual roast call (stateless)
      const individualPromise = groqClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_INDIVIDUAL },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.85,
        stream: true,
      });

      // B. Setup Collective roast call (with history)
      const collectivePromise = groqClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_COLLECTIVE },
          ...apiHistory,
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.85,
        stream: true,
      });

      const [individualStream, collectiveStream] = await Promise.all([
        individualPromise,
        collectivePromise,
      ]);

      const readIndividual = async () => {
        for await (const chunk of individualStream) {
          if (res.writableEnded || res.finished || res.destroyed) break;
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullIndividualText += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
      };

      const readCollective = async () => {
        for await (const chunk of collectiveStream) {
          if (res.writableEnded || res.finished || res.destroyed) break;
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullCollectiveText += text;
            res.write(`data: ${JSON.stringify({ collectiveText: text })}\n\n`);
          }
        }
      };

      await Promise.all([readIndividual(), readCollective()]);
    }
  } catch (error) {
    console.error('[Roast Stream] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream processing failed' })}\n\n`);
  } finally {
    // Write [DONE] signal to frontend
    res.write('data: [DONE]\n\n');
    res.end();

    // 3. Save transcript to DB
    if (conversationId && fullIndividualText.trim().length > 0) {
      try {
        // Save collective roast to Message logs (since chat logs compare them)
        await prisma.message.createMany({
          data: [
            { conversationId, role: 'user',      content: userContent },
            { conversationId, role: 'assistant', content: fullCollectiveText },
          ],
        });
        // Save individual roast in Roast log
        await prisma.roast.create({
          data: { conversationId, resumeText, roastText: fullIndividualText },
        });
      } catch (dbError) {
        console.error('[Roast Stream] Failed to persist messages to DB:', dbError);
      }
    }
  }
}
