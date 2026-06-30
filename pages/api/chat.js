import prisma from '../../lib/db';
import { chatWithGroq, groqAvailable } from '../../services/ai';

const SYSTEM_PROMPT =
  'You are a witty but genuinely helpful resume reviewer. ' +
  'You are continuation of the resume roast session. ' +
  'Answer the user\'s follow-up questions about their resume strictly. ' +
  'Do not answer general questions unrelated to their resume or career development. ' +
  'Be direct, constructive, and maintain the helpful tone. Keep answers under 200 words.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { conversationId, userMessage } = req.body;

  if (!conversationId || !userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'conversationId and userMessage are required.' });
  }

  if (!groqAvailable()) {
    return res.status(500).json({ error: 'AI generation service is currently misconfigured. Missing Groq API key.' });
  }

  try {
    // 1. Fetch the last 20 messages of the conversation to keep context history short and relevant
    // Fetch descending first to get the most recent messages, then reverse them.
    const pastMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Only take the last 20 messages
    });

    if (pastMessages.length === 0) {
      return res.status(404).json({ error: 'Conversation not found or has no messages.' });
    }

    // Reverse descending order to chronological order
    pastMessages.reverse();

    // Map past messages to the format expected by the API
    const formattedMessages = pastMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Add the new user message to the array
    formattedMessages.push({
      role: 'user',
      content: userMessage,
    });

    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...formattedMessages,
    ];
    const reply = await chatWithGroq(groqMessages);

    // 2. Persist the user's question and AI's reply to the database
    // The database automatically sets the `createdAt` timestamp (when the chat happened)
    await prisma.message.createMany({
      data: [
        { conversationId, role: 'user', content: userMessage },
        { conversationId, role: 'assistant', content: reply },
      ],
    });

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('[Chat] Error in chat api:', error);
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
