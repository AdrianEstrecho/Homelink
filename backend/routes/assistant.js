import { Router } from 'express';
import { identify } from '../middleware/auth.js';
import { isGeminiConfigured, isRetryable } from '../utils/gemini.js';
import { answerChat } from '../utils/assistantChat.js';

const router = Router();

const MAX_HISTORY = 16;
const MAX_MESSAGE_CHARS = 2000;

// Every message costs a Gemini call on HomeLink's API key and the endpoint is open to guests, so
// each visitor (account if signed in, otherwise IP) gets a rolling allowance. In memory only —
// it resets on restart, which is fine for a cost guard on a single instance.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
const recentRequests = new Map();

function rateLimited(key) {
  const now = Date.now();
  const recent = (recentRequests.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= RATE_MAX;
  if (!limited) recent.push(now);
  recentRequests.set(key, recent);
  if (recentRequests.size > 5000) {
    for (const [k, times] of recentRequests) if (now - times[times.length - 1] >= RATE_WINDOW_MS) recentRequests.delete(k);
  }
  return limited;
}

function clientKey(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  const forwarded = req.headers['x-forwarded-for'];
  return `ip:${(typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || req.socket.remoteAddress}`;
}

router.get('/status', (req, res) => {
  res.json({ enabled: isGeminiConfigured() });
});

router.post('/chat', identify, async (req, res) => {
  if (!isGeminiConfigured()) return res.status(503).json({ error: 'The assistant is not available right now.' });

  const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = history
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY);
  // Gemini needs the conversation to open on a user turn; a trimmed history may not.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const latest = messages.at(-1);
  if (latest?.role !== 'user') return res.status(400).json({ error: 'Type a message for the assistant.' });
  if (latest.content.length > MAX_MESSAGE_CHARS) return res.status(400).json({ error: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.` });
  if (rateLimited(clientKey(req))) return res.status(429).json({ error: 'You\'re sending messages quickly. Please wait a few minutes and try again.' });

  const customerId = req.user?.role === 'customer' ? req.user.id : null;
  let answer;
  try {
    answer = await answerChat(messages, { customerId, maxMessageChars: MAX_MESSAGE_CHARS });
  } catch (failure) {
    console.error('Assistant request failed:', failure);
    const busy = isRetryable(failure);
    return res.status(busy ? 503 : 502).json({
      error: busy ? 'The assistant is busy right now. Please try again in a minute.' : 'The assistant ran into a problem. Please try again.',
    });
  }

  res.json({ reply: answer.reply, items: answer.items });
});

export default router;
