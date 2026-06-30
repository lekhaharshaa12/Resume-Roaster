/**
 * services/ai.js
 *
 * Reusable AI service module. Import chatWithGroq from any route in this backend.
 * Centralises model selection, retries, timeouts, and error categorisation
 * so every caller stays clean. Exclusively powered by Groq.
 */

import Groq from 'groq-sdk';

// ── Error categories ──────────────────────────────────────────────────────────

/**
 * Classifies an API error so callers know whether to retry or give up.
 *
 * @param {Error} error
 * @returns {{ category: 'transient' | 'permanent' | 'unknown', message: string }}
 */
function categoriseError(error) {
  const status = error?.status ?? error?.statusCode;

  // Permanent errors — no point retrying
  if (status === 401) {
    return { category: 'permanent', message: 'Invalid API key. Check your credentials.' };
  }
  if (status === 400) {
    return { category: 'permanent', message: 'Malformed request sent to the AI API.' };
  }

  // Transient errors — worth retrying
  if (status === 429) {
    return { category: 'transient', message: 'Rate limit hit. Retrying…' };
  }
  if (status === 529 || status === 503 || status === 502) {
    return { category: 'transient', message: 'AI provider is overloaded. Retrying…' };
  }
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.name === 'AbortError') {
    return { category: 'transient', message: 'Network error. Retrying…' };
  }

  return { category: 'unknown', message: error?.message || 'Unexpected AI API error.' };
}

/**
 * Waits for `ms` milliseconds. Used between retries.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Groq service ──────────────────────────────────────────────────────────────

/**
 * Send a conversation to a Groq-hosted model and return the generated text.
 *
 * @param {Array<{ role: 'user'|'assistant'|'system', content: string }>} messages
 * @param {object} [options]
 * @param {string} [options.model]       Override the default Groq model.
 * @param {number} [options.maxTokens]   Override the default token limit.
 * @param {number} [options.temperature] Sampling temperature (0–1).
 * @param {number} [options.maxRetries]  Max retry attempts for transient errors (default: 2).
 * @returns {Promise<string>} The assistant's response text.
 */
export async function chatWithGroq(messages, options = {}) {
  const {
    model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    maxTokens = parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10),
    temperature = 0.85,
    maxRetries = 2,
  } = options;

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    const err = new Error('GROQ_API_KEY is not configured.');
    err.category = 'permanent';
    throw err;
  }

  const groqClient = new Groq({ apiKey: groqKey, timeout: 30_000 });

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const completion = await groqClient.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      const { category, message } = categoriseError(error);

      if (category === 'permanent' || attempt === maxRetries) {
        const err = new Error(message);
        err.category = category;
        err.originalError = error;
        throw err;
      }

      console.warn(`[Groq Service] Attempt ${attempt + 1} failed (${category}): ${message}`);
      await sleep(1000 * (attempt + 1));
      attempt++;
    }
  }
}

// ── Provider auto-selector ────────────────────────────────────────────────────


/**
 * Returns true when a valid Groq API key is present in the environment.
 */
export function groqAvailable() {
  const key = process.env.GROQ_API_KEY || '';
  return key.length > 0 && !key.includes('your-key') && key.startsWith('gsk_');
}
