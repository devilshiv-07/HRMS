import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
import ms from 'ms';

const accessExpires = process.env.ACCESS_TOKEN_EXPIRES_IN || '60m';
const refreshExpires = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: accessExpires });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: refreshExpires });
}

export async function saveRefreshToken(token, userId) {
  const decoded = jwt.decode(token);
  const exp = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + ms(refreshExpires));
  return prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: exp,
    },
  });
}

export async function revokeRefreshToken(token) {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true },
  });
}
