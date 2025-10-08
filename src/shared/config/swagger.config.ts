import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const isSwaggerEnabled = configService.get<string>('SWAGGER_ENABLED') === 'true';
  const swaggerPassword = configService.get<string>('SWAGGER_PASSWORD');

  if (!isSwaggerEnabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Mery Portal API')
    .setDescription('API para el portal de videos Mery')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Autenticación', 'Endpoints para autenticación y autorización')
    .addTag('Usuarios', 'Gestión de usuarios del sistema')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Protect Swagger in production
  if (configService.get<string>('NODE_ENV') === 'production') {
    const express = require('express');
    const basicAuth = require('express-basic-auth');
    
    app.use(
      '/api/docs',
      basicAuth({
        users: { admin: swaggerPassword },
        challenge: true,
      }),
      express.static('swagger-static'),
    );
    
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Mery Portal API - Documentación',
      customfavIcon: '/favicon.ico',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js',
      ],
      customCssUrl: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
      ],
    });
  } else {
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Mery Portal API - Documentación',
    });
  }
}
