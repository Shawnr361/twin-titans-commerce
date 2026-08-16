import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

const COOKIE = 'tt_admin';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 48'
    );
  }
  return new TextEncoder().encode(raw);
}

export interface AdminSession {
  userId: string;
  email: string;
  name?: string;
  role: string;
}

/*
 * bcryptjs SYNC, deliberately.
 *
 * The async API (`bcrypt.hash` / `bcrypt.compare`) does not use threads — it
 * splits the work into small chunks and yields to the event loop between each
 * one. On a busy or CPU-throttled server that turns a ~0.5s computation into
 * an unbounded wait, because the continuation keeps losing to other work. Live
 * symptom: the login request hung past 90 seconds while a malformed request to
 * the same route returned in 1.3s.
 *
 * The sync API blocks for a predictable ~0.5s instead. On a login route that
 * is the right trade: bounded and reliable beats non-blocking and starved.
 *
 * Cost stays 12. bcrypt encodes the cost inside the hash, so existing hashes
 * keep verifying regardless of what we choose for new ones.
 */
export function hashPassword(plain: string): Promise<string> {
  return Promise.resolve(bcrypt.hashSync(plain, 12));
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return Promise.resolve(bcrypt.compareSync(plain, hash));
}

export async function createSession(session: AdminSession): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: payload.name ? String(payload.name) : undefined,
      role: String(payload.role ?? 'owner'),
    };
  } catch {
    return null;
  }
}

/** Throws if not signed in — use at the top of every admin route handler. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in.');
    this.name = 'UnauthorizedError';
  }
}

export async function authenticate(email: string, password: string): Promise<AdminSession | null> {
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    // Constant-ish work whether or not the account exists, so a timing
    // difference does not reveal which emails are registered.
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { userId: user.id, email: user.email, name: user.name ?? undefined, role: user.role };
}
