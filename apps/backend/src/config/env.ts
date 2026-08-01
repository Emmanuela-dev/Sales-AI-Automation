import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  // Direct Postgres connection — used by `npm run migrate` only.
  // Supabase dashboard → Project Settings → Database → Connection string (URI).
  DATABASE_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),

  // OpenAI
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Google Places API
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Frontend
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Local development escape hatch: accept unauthenticated API requests and
  // attribute them to DEV_USER_ID. Ignored entirely when NODE_ENV=production.
  DEV_ALLOW_ANONYMOUS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DEV_USER_ID: z.string().default('00000000-0000-0000-0000-000000000000'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('\n❌ Invalid or missing environment variables:\n');
  for (const [key, messages] of Object.entries(fieldErrors)) {
    console.error(`   ${key}: ${messages?.join(', ')}`);
  }
  console.error(
    '\n   Copy apps/backend/.env.example to apps/backend/.env and fill in your values.\n'
  );
  process.exit(1);
}

export const env = parsed.data;

/**
 * Values that are syntactically valid (so zod accepts them) but are clearly
 * still the placeholders from .env.example. Calls using them will fail at the
 * provider, so warn loudly at boot rather than failing mysteriously later.
 */
const PLACEHOLDER_MARKERS = ['your-', 'change-me', 'sk-proj-your', 'your_'];

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker));
}

export const configStatus = {
  supabase: !looksLikePlaceholder(env.SUPABASE_URL) && !looksLikePlaceholder(env.SUPABASE_SERVICE_ROLE_KEY),
  openai: !looksLikePlaceholder(env.OPENAI_API_KEY) && env.OPENAI_API_KEY.startsWith('sk-'),
  googlePlaces: !looksLikePlaceholder(env.GOOGLE_PLACES_API_KEY),
  database: !looksLikePlaceholder(env.DATABASE_URL),
};

export function warnAboutPlaceholders(): void {
  const missing: string[] = [];
  if (!configStatus.supabase) missing.push('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — all database reads and writes will fail');
  if (!configStatus.openai) missing.push('OPENAI_API_KEY — lead scoring, research, outreach and proposals will fail');
  if (!configStatus.googlePlaces) missing.push('GOOGLE_PLACES_API_KEY — business discovery falls back to searching the existing database only');
  if (!configStatus.database) missing.push('DATABASE_URL — `npm run migrate` cannot run');

  if (missing.length === 0) return;

  console.warn('\n⚠️  Placeholder or missing configuration detected:\n');
  for (const item of missing) console.warn(`   • ${item}`);
  console.warn('\n   Fill these in apps/backend/.env to enable the affected features.\n');
}
