import anthropic from '../../lib/claude';

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

  if (resumeText.trim().length < 200) {
    return res
      .status(400)
      .json({ error: 'Resume must be at least 200 characters. Paste the full text.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a witty, brutally honest resume reviewer with a sharp sense of humor. 
Your job is to roast the resume below — be funny, be direct, be harsh — but make it genuinely useful. 
Point out what's vague, what's missing, what screams "I copied this from a template", and what would make a hiring manager cringe.
End your roast with a clearly labeled section called "3 Concrete Fixes:" that gives three specific, actionable improvements the person can make TODAY.
Keep the whole response under 400 words.

Resume:
${resumeText}`,
        },
      ],
    });

    const roast = message.content[0].text;
    return res.status(200).json({ roast });
  } catch (error) {
    console.error('Anthropic API error:', error);

    if (error.status === 401) {
      return res.status(500).json({ error: 'Invalid API key. Check your ANTHROPIC_API_KEY.' });
    }

    return res.status(500).json({
      error: 'The AI is taking a coffee break. Please try again in a moment.',
    });
  }
}
