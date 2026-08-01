import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from './supabase';
import { env } from '../config/env';

export interface AuthUser {
  id: string;
  email?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** The authenticated Supabase user. Set by the onRequest auth hook. */
    authUser?: AuthUser;
  }
}

/** Paths that must stay reachable without a token. */
const PUBLIC_PATHS = ['/health', '/docs', '/documentation'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Verified tokens are cached briefly so a page that fires six parallel queries
 * doesn't make six round trips to Supabase to validate the same token.
 */
const TOKEN_CACHE_TTL_MS = 60_000;
const tokenCache = new Map<string, { user: AuthUser; expiresAt: number }>();

function getCached(token: string): AuthUser | null {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    tokenCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCached(token: string, user: AuthUser): void {
  // Bound the cache so a stream of distinct tokens can't grow it without limit.
  if (tokenCache.size > 1000) tokenCache.clear();
  tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

/**
 * Resolves the Supabase user behind an access token.
 * Returns null for any token Supabase does not accept.
 */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  const cached = getCached(token);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const user: AuthUser = { id: data.user.id, email: data.user.email ?? undefined };
  setCached(token, user);
  return user;
}

/**
 * onRequest hook applied to the whole server.
 *
 * The API previously had no authentication at all: every endpoint was public and
 * writes were attributed to a literal 'system' user, so anyone who could reach
 * the port could read all leads, delete businesses, and spend OpenAI credits.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // CORS preflight carries no credentials by design.
  if (request.method === 'OPTIONS') return;
  if (isPublicPath(request.url.split('?')[0])) return;

  const token = extractBearerToken(request);

  if (token) {
    const user = await verifyAccessToken(token);
    if (user) {
      request.authUser = user;
      return;
    }
    return reply.code(401).send({ error: 'Invalid or expired access token' });
  }

  // Local-only escape hatch for curl and the Swagger UI. Deliberately ignored in
  // production so a stray env var can never open up a deployed instance.
  if (env.DEV_ALLOW_ANONYMOUS && env.NODE_ENV !== 'production') {
    request.authUser = { id: env.DEV_USER_ID };
    request.log.warn('Request accepted anonymously (DEV_ALLOW_ANONYMOUS=true)');
    return;
  }

  return reply.code(401).send({
    error: 'Missing Authorization header. Send the Supabase access token as "Bearer <token>".',
  });
}

/**
 * Reads the authenticated user id inside a route handler.
 * Throws rather than returning a fallback, so a missing hook can never
 * silently attribute writes to the wrong user.
 */
export function requireUserId(request: FastifyRequest): string {
  if (!request.authUser?.id) {
    throw new Error('Route reached without authentication');
  }
  return request.authUser.id;
}

/** Confirms a lead belongs to the caller before exposing or mutating it. */
export async function assertLeadOwned(leadId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('user_id')
    .eq('id', leadId)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify lead ownership: ${error.message}`);
  if (!data) throw new NotFoundError('Lead not found');
  if (data.user_id !== userId) throw new NotFoundError('Lead not found');
}

/** Signals "no such resource for this caller" — mapped to 404 by the error handler. */
export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
