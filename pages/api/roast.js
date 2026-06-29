import anthropic from '../../lib/claude';
import prisma from '../../lib/db';
import Groq from 'groq-sdk';

const ROAST_PROMPT = (resumeText) => `You are a witty, brutally honest resume reviewer with a sharp sense of humor. 
Your job is to roast the resume below — be funny, be direct, be harsh — but make it genuinely useful. 
Point out what's vague, what's missing, what screams "I copied this from a template", and what would make a hiring manager cringe.
End your roast with a clearly labeled section called "3 Concrete Fixes:" that gives three specific, actionable improvements the person can make TODAY.
Keep the whole response under 400 words.

Resume:
${resumeText}`;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { resumeText } = req.body;

  // Validate input
  if (!resumeText || typeof resumeText !== 'string') {
    return res.status(400).json({ error: 'resumeText is required.' });
  }

  const wordCount = resumeText.trim() === '' ? 0 : resumeText.trim().split(/\s+/).length;

  if (wordCount < 200) {
    return res.status(400).json({
      error: 'Resume must be at least 200 words. Paste the full text.',
    });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const useGroq = groqKey && !groqKey.includes('your-key') && groqKey.startsWith('gsk_');

  try {
    let roast = '';

    if (useGroq) {
      // Use Groq Llama 3.3 70B
      const groq = new Groq({ apiKey: groqKey });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: ROAST_PROMPT(resumeText),
          },
        ],
        max_tokens: 1024,
        temperature: 0.85,
      });
      roast = completion.choices[0]?.message?.content || '';
    } else {
      // Use Claude 3.5 Sonnet
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: ROAST_PROMPT(resumeText),
          },
        ],
      });
      roast = message.content[0].text;
    }

    // Save to database (Supabase/MySQL) via Prisma
    try {
      await prisma.roast.create({
        data: {
          resumeText,
          roastText: roast,
        },
      });
    } catch (dbError) {
      console.error('Failed to log roast to database:', dbError);
    }

    return res.status(200).json({ roast });
  } catch (error) {
    console.error('AI API error:', error);

    const providerName = useGroq ? 'Groq' : 'Anthropic';
    if (error.status === 401) {
      return res.status(500).json({ error: `Invalid ${providerName} API key. Please check your credentials.` });
    }

    if (error.status === 429) {
      return res.status(500).json({ error: 'Rate limit hit. Wait a moment and try again.' });
    }

    return res.status(500).json({
      error: 'The AI is taking a coffee break. Please try again in a moment.',
    });
  }
}
