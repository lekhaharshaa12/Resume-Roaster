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

  const { email, code, password, confirmPassword } = req.body;

  if (!email || !code || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  try {
    // 1. Verify code
    const authRecord = await prisma.authCode.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
      },
    });

    if (!authRecord) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (new Date() > authRecord.expiresAt) {
      await prisma.authCode.delete({ where: { id: authRecord.id } });
      return res.status(400).json({ error: 'Verification code has expired. Please start over.' });
    }

    // 2. Double check user doesn't exist
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // 3. Create user
    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
      },
    });

    // 4. Clean up code
    await prisma.authCode.delete({ where: { id: authRecord.id } });

    // 5. Generate token
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: '12h' } // Token token itself is valid, but cookie will expire on close
    );

    // 6. Set browser session cookie (no Max-Age/Expires so it deletes on browser close)
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
      message: 'Signup successful.',
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Signup complete error:', error);
    return res.status(500).json({ error: 'Failed to complete signup.' });
  }
}
