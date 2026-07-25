import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { businessRoutes } from './routes/businesses';
import { leadRoutes } from './routes/leads';
import { analysisRoutes } from './routes/analysis';
import { outreachRoutes } from './routes/outreach';
import { proposalRoutes } from './routes/proposals';
import { crmRoutes } from './routes/crm';
import { analyticsRoutes } from './routes/analytics';
import { searchRoutes } from './routes/search';

// Start background workers in-process during development
if (process.env.NODE_ENV !== 'production') {
  import('./queues/analysisQueue');
  import('./queues/aiQueue');
  import('./queues/schedulerQueue').then(({ startScheduler }) => startScheduler());
}

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function bootstrap() {
  // CORS
  await server.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // JWT
  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  });

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
        description: 'AI Sales Intelligence Platform API',
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
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await server.register(searchRoutes, { prefix: '/api/v1/search' });
  await server.register(businessRoutes, { prefix: '/api/v1/businesses' });
  await server.register(leadRoutes, { prefix: '/api/v1/leads' });
  await server.register(analysisRoutes, { prefix: '/api/v1/analysis' });
  await server.register(outreachRoutes, { prefix: '/api/v1/outreach' });
  await server.register(proposalRoutes, { prefix: '/api/v1/proposals' });
  await server.register(crmRoutes, { prefix: '/api/v1/crm' });
  await server.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  await server.listen({ port, host });
  server.log.info(`ProspectAI backend running on http://${host}:${port}`);
  server.log.info(`API docs available at http://${host}:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
