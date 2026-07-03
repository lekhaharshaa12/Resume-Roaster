import prisma from '../../../lib/db';
import { sendOtpEmail } from '../../../lib/mailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered. Please sign in instead.' });
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Remove any previous registration codes for this email
    await prisma.authCode.deleteMany({
      where: { email: cleanEmail },
    });

    // Save code
    await prisma.authCode.create({
      data: {
        email: cleanEmail,
        code,
        expiresAt,
      },
    });

    // Send the email via SMTP in the background so the HTTP response returns immediately
    sendOtpEmail(cleanEmail, code).catch((mailErr) => {
      console.error('[Background Mail Error] Failed to send OTP:', mailErr);
    });

    return res.status(200).json({
      message: 'Verification code sent.',
    });
  } catch (error) {
    console.error('Signup send code error:', error);
    return res.status(500).json({ error: 'Failed to send verification code.' });
  }
}
