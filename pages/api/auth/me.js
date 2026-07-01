import prisma from '../../../lib/db';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const cookies = req.headers.cookie || '';
  const sessionCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith('session='));

  if (!sessionCookie) {
    return res.status(200).json({ user: null, roasts: [] });
  }

  const token = sessionCookie.split('=')[1];
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';

  try {
    const decoded = jwt.verify(token, secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return res.status(200).json({ user: null, roasts: [] });
    }

    const roasts = await prisma.roast.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        resumeText: true,
        roastText: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ user, roasts });
  } catch (error) {
    res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    return res.status(200).json({ user: null, roasts: [] });
  }
}
