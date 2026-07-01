import prisma from '../../../lib/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Verify hash
    const inputHash = hashPassword(password);
    if (inputHash !== user.passwordHash) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Create session token
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: '12h' }
    );

    // Set browser session cookie (no Max-Age/Expires so it deletes on browser close)
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `session=${token}`,
      'Path=/',
      'HttpOnly',
      isProd ? 'Secure' : '',
      'SameSite=Lax',
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookieOptions);

    return res.status(200).json({
      message: 'Sign in successful.',
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return res.status(500).json({ error: 'Failed to sign in.' });
  }
}
