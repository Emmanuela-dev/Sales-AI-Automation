import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';

import { env, configStatus, warnAboutPlaceholders } from './config/env';
import { authenticateRequest, NotFoundError } from './lib/auth';
import { AIError } from './lib/openai';

import { businessRoutes } from './routes/businesses';
import { leadRoutes } from './routes/leads';
import { analysisRoutes } from './routes/analysis';
import { outreachRoutes } from './routes/outreach';
import { proposalRoutes } from './routes/proposals';
import { crmRoutes } from './routes/crm';
import { analyticsRoutes } from './routes/analytics';
import { searchRoutes } from './routes/search';

const server = Fastify({
  logger: { level: env.LOG_LEVEL },
});

/**
 * Starts the BullMQ workers in this process for convenience during development.
 * Production runs them separately via `npm run start:workers`.
 *
 * These imports were previously fired without await or catch, so a Redis outage
 * surfaced as an unhandled rejection instead of a readable startup error.
 */
async function startInProcessWorkers(): Promise<void> {
  try {
    await import('./queues/analysisQueue');
    await import('./queues/aiQueue');
    const { startScheduler } = await import('./queues/schedulerQueue');
    startScheduler();
    server.log.info('Background workers started in-process (development mode)');
  } catch (err) {
    server.log.error(
      { err },
      'Failed to start background workers. Is Redis running? ' +
        '`docker-compose up -d redis`. The API will still serve requests, but ' +
        'website analysis and AI scoring jobs will not be processed.'
    );
  }
}

function registerErrorHandler(): void {
  server.setErrorHandler((error, request, reply) => {
    // Request body/param validation — a client mistake, not a server fault.
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: error.message });
    }

    // AI failures are upstream problems; the message is written to be shown.
    if (error instanceof AIError) {
      request.log.error({ err: error }, 'AI request failed');
      return reply.code(502).send({ error: error.message });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }

    // supabase-js wraps network failures as a bare "fetch failed", which tells
    // the user nothing. This is the symptom of a wrong SUPABASE_URL far more
    // often than of a real outage.
    if (/fetch failed/i.test(error.message)) {
      request.log.error({ err: error }, 'Supabase request failed');
      return reply.code(503).send({
        error:
          'Cannot reach Supabase. Check SUPABASE_URL in apps/backend/.env and your network connection, then run `npm run doctor`.',
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({
      error: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    });
  });

  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Route ${request.method} ${request.url} not found` });
  });
}

async function bootstrap() {
  warnAboutPlaceholders();

  // CORS
  await server.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  });

  // JWT — used by @fastify/jwt consumers; Supabase tokens are verified in the
  // auth hook via lib/auth.ts.
  await server.register(jwt, { secret: env.JWT_SECRET });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger docs
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'ProspectAI API',
        description:
          'AI Sales Intelligence Platform API. All /api/v1 routes require a Supabase ' +
          'access token: Authorization: Bearer <token>.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  });

  registerErrorHandler();

  // Authentication for every route except /health and /docs.
  server.addHook('onRequest', authenticateRequest);

  // Health check — reports which integrations are actually configured so a
  // misconfigured deployment is visible without reading the logs.
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    integrations: {
      supabase: configStatus.supabase ? 'configured' : 'missing',
      openai: configStatus.openai ? 'configured' : 'missing',
      google_places: configStatus.googlePlaces ? 'configured' : 'missing (database-only search)',
    },
  }));

  // Routes
  await server.register(searchRoutes, { prefix: '/api/v1/search' });
  await server.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await server.register(leadRoutes, { prefix: '/api/v1/leads' });
  await server.register(analysisRoutes, { prefix: '/api/v1/analysis' });
  await server.register(outreachRoutes, { prefix: '/api/v1/outreach' });
  await server.register(proposalRoutes, { prefix: '/api/v1/proposals' });
  await server.register(crmRoutes, { prefix: '/api/v1/crm' });
  await server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

  if (env.NODE_ENV !== 'production') {
    await startInProcessWorkers();
  }

  const port = Number(env.PORT) || 4000;
  await server.listen({ port, host: env.HOST });
  server.log.info(`ProspectAI backend running on http://${env.HOST}:${port}`);
  server.log.info(`API docs available at http://${env.HOST}:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
