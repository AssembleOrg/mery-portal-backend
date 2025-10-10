import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import { setupSwagger } from './shared/config/swagger.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // API prefix
  app.setGlobalPrefix('api');

  // Raw body parser for webhooks (must be before other body parsers)
  // Mercado Pago webhooks need raw body for signature validation
  app.use('/api/webhooks/mercadopago', express.raw({ type: 'application/json' }));
  app.use('/api/webhook', express.raw({ type: 'application/json' })); // Alias para frontend

  // Cookie parser - Required for reading cookies
  app.use(cookieParser());

  // Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Disable in dev for Swagger
      crossOriginEmbedderPolicy: false, // Allow Vimeo embeds
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow Vimeo resources
    }),
  );

  // Compression
  app.use(compression());

  // CORS - Strict configuration
  const allowedOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',') 
    .map(origin => origin.trim());

  app.enableCors({
    origin: (origin: string, callback: any) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn(`Blocked CORS request from origin: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

  // Global validation pipe with sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction, // Hide detailed errors in production
      validationError: {
        target: false, // Don't expose class instance
        value: false, // Don't expose submitted value
      },
    }),
  );

  // Setup Swagger
  setupSwagger(app);

  // Trust proxy (important if behind nginx/load balancer)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const port = configService.get<number>('PORT', 3000);
  const server = await app.listen(port);
  
  // Increase timeout for large file uploads (1 hour)
  server.setTimeout(3600000);
  
  logger.log(`🚀 Aplicación ejecutándose en: http://localhost:${port}`);
  logger.log(`📚 Documentación API: http://localhost:${port}/api/docs`);
  logger.log(`🔒 Modo: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
  logger.log(`🛡️ Seguridad: Helmet, CORS, Rate Limiting ACTIVADOS`);
}

bootstrap().catch((error) => {
  console.error('❌ Error al iniciar la aplicación:', error);
  process.exit(1);
});
