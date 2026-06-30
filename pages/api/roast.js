/**
 * pages/api/roast.js
 *
 * Generates an AI roast for a submitted resume.
 * Creates a Conversation + persists both turns (user + assistant) as Messages.
 * Returns { roast, conversationId } so the frontend can wire up follow-up chat.
 */

import prisma from '../../lib/db';
import { chatWithGroq, groqAvailable } from '../../services/ai';

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are a witty but genuinely helpful resume reviewer. ' +
  'Be funny, be direct, and be harsh — but make every critique actionable. ' +
  'Point out what is vague, what is missing, what screams "I copied this from a template", ' +
  'and what would make a hiring manager cringe. ' +
  'End your roast with a clearly labelled section called "3 Concrete Fixes:" that gives ' +
  'three specific, actionable improvements the person can make TODAY. ' +
  'Keep the whole response under 400 words. ' +
  'You are strictly a resume advisor — only answer questions about this resume and career topics.';

// ── Route handler ─────────────────────────────────────────────────────────────

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

  // The user turn — the model sees this as the opening message of the conversation
  const userContent = `Please roast my resume:\n\n${resumeText}`;
  const messages = [{ role: 'user', content: userContent }];

  try {
    // Groq puts the system prompt as the first message with role "system"
    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];
    const roast = await chatWithGroq(groqMessages, { model: 'llama-3.3-70b-versatile' });

    // ── Persist to DB ─────────────────────────────────────────────────────────
    // Non-fatal: a DB failure must never prevent the user from seeing their roast.
    let conversationId = null;
    try {
      // 1. Create the parent Conversation row
      const conversation = await prisma.conversation.create({ data: {} });
      conversationId = conversation.id;

      // 2. Save both turns as Messages (preserves the full history for follow-ups)
      await prisma.message.createMany({
        data: [
          { conversationId, role: 'user',      content: userContent },
          { conversationId, role: 'assistant', content: roast },
        ],
      });

      // 3. Save the Roast record linked to the conversation
      await prisma.roast.create({
        data: { conversationId, resumeText, roastText: roast },
      });
    } catch (dbError) {
      console.error('[Roast] Failed to persist to database:', dbError);
    }

    return res.status(200).json({ roast, conversationId });
  } catch (error) {
    console.error('[Roast] AI service error:', error);

    if (error.category === 'permanent') {
      return res.status(500).json({ error: error.message });
    }
    if (error.category === 'transient') {
      return res.status(503).json({
        error: 'The AI is temporarily unavailable. Please try again in a moment.',
      });
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
