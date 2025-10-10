import { Controller, Post, Req, Res, HttpCode, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import * as express from 'express';
import { MercadoPagoService } from './mercadopago.service';
import { WebhookNotificationDto } from './dto';
import { Public } from '../../shared/decorators';

@ApiTags('Webhooks')
@Controller('webhooks/mercadopago')
export class MercadoPagoController {
  private readonly logger = new Logger(MercadoPagoController.name);

  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint() // Hide from Swagger docs for security
  @ApiOperation({ 
    summary: 'Webhook de notificaciones de Mercado Pago',
    description: 'Endpoint para recibir notificaciones de pagos, contracargos, reembolsos, etc. de Mercado Pago'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Notificación recibida y procesada exitosamente' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Firma inválida - webhook no autorizado' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Payload inválido' 
  })
  async handleWebhook(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    return this.processWebhook(req, res);
  }

  /**
   * Process webhook - centralized logic
   */
  private async processWebhook(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      this.logger.log('🔔 Webhook de Mercado Pago recibido');

      // Get raw body for signature validation
      const rawBody = req.body as Buffer;
      
      // Get signature from headers (Mercado Pago sends different header names depending on version)
      const signature = 
        (req.headers['x-signature'] as string) ||
        (req.headers['x-hook-signature'] as string) ||
        '';

      this.logger.debug(`Headers recibidos:`, {
        'x-signature': req.headers['x-signature'],
        'x-hook-signature': req.headers['x-hook-signature'],
        'x-request-id': req.headers['x-request-id'],
      });

      // Validate signature if webhook secret is configured
      if (signature && !this.mercadoPagoService.validateSignature(rawBody, signature)) {
        this.logger.error('❌ Firma de webhook inválida');
        res.status(401).send('Invalid signature');
        return;
      }

      // Parse payload
      let payload: WebhookNotificationDto;
      try {
        payload = JSON.parse(rawBody.toString('utf-8'));
      } catch (error) {
        this.logger.error('❌ Error parseando payload:', error);
        res.status(400).send('Invalid JSON');
        return;
      }

      this.logger.log(`📨 Notificación recibida:`, {
        id: payload.id,
        type: payload.type,
        action: payload.action,
        resourceId: payload.data?.id,
      });

      // Respond immediately to prevent timeout (Mercado Pago expects quick response)
      res.status(200).send('OK');

      // Process notification asynchronously (don't await - let it run in background)
      this.processNotificationAsync(payload).catch(error => {
        this.logger.error('❌ Error procesando notificación en background:', error);
      });

    } catch (error) {
      this.logger.error('❌ Error en webhook handler:', error);
      // If we haven't sent response yet, send 500
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }

  /**
   * Process notification asynchronously in background
   */
  private async processNotificationAsync(payload: WebhookNotificationDto): Promise<void> {
    try {
      const topic = payload.type || payload.action?.split('.')[0];

      switch (topic) {
        case 'payment':
          await this.mercadoPagoService.processPaymentNotification(payload);
          break;

        case 'merchant_order':
          await this.mercadoPagoService.processMerchantOrderNotification(payload);
          break;

        case 'chargebacks':
        case 'chargeback':
          await this.mercadoPagoService.processChargebackNotification(payload);
          break;

        case 'refunds':
        case 'refund':
          await this.mercadoPagoService.processRefundNotification(payload);
          break;

        default:
          this.logger.log(`ℹ️ Tipo de notificación no manejado: ${topic}`);
      }
    } catch (error) {
      this.logger.error('❌ Error en processNotificationAsync:', error);
      // Don't throw - we already responded to Mercado Pago
    }
  }

  /**
   * Health check endpoint for webhook
   */
  @Post('health')
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Alternative webhook controller for frontend compatibility
 * Handles POST /api/webhook (without 's' and '/mercadopago')
 */
@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookAliasController {
  private readonly logger = new Logger(WebhookAliasController.name);

  constructor(private readonly mercadoPagoService: MercadoPagoService) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    this.logger.log('🔀 Webhook recibido en ruta alternativa /api/webhook');
    this.logger.log('📋 Reenviando a procesamiento de MercadoPago...');
    
    // Reuse the same logic
    return this.processWebhook(req, res);
  }

  private async processWebhook(
    req: express.Request,
    res: express.Response,
  ): Promise<void> {
    try {
      this.logger.log('🔔 Webhook de Mercado Pago recibido (alias)');

      // Get raw body for signature validation
      const rawBody = req.body as Buffer;
      
      // Get signature from headers
      const signature = 
        (req.headers['x-signature'] as string) ||
        (req.headers['x-hook-signature'] as string) ||
        '';

      this.logger.debug(`Headers recibidos:`, {
        'x-signature': req.headers['x-signature'],
        'x-hook-signature': req.headers['x-hook-signature'],
        'x-request-id': req.headers['x-request-id'],
      });

      // Validate signature if webhook secret is configured
      if (signature && !this.mercadoPagoService.validateSignature(rawBody, signature)) {
        this.logger.error('❌ Firma de webhook inválida');
        res.status(401).send('Invalid signature');
        return;
      }

      // Parse payload - MercadoPago can send data in query params or body
      let payload: WebhookNotificationDto;
      
      // Check if data comes in query params (MercadoPago format)
      const queryParams = req.query as any;
      if (queryParams.id || queryParams['data.id'] || queryParams.topic || queryParams.type) {
        this.logger.debug('📋 Datos recibidos en query params:', queryParams);
        
        // Construct payload from query params
        payload = {
          id: queryParams.id ? parseInt(queryParams.id) : undefined,
          type: queryParams.type || queryParams.topic,
          action: queryParams.action,
          data: {
            id: queryParams['data.id'] || queryParams.id,
          },
          live_mode: false,
          date_created: new Date().toISOString(),
          application_id: '',
          user_id: 0,
          version: 1,
          api_version: 'v1',
        } as WebhookNotificationDto;
      } else {
        // Try to parse from body
        try {
          payload = JSON.parse(rawBody.toString('utf-8'));
        } catch (error) {
          this.logger.error('❌ Error parseando payload:', error);
          res.status(400).send('Invalid JSON');
          return;
        }
      }

      this.logger.log(`📨 Notificación recibida:`, {
        id: payload.id,
        type: payload.type,
        action: payload.action,
        resourceId: payload.data?.id,
      });

      // Respond immediately
      res.status(200).send('OK');

      // Process notification asynchronously
      this.processNotificationAsync(payload).catch(error => {
        this.logger.error('❌ Error procesando notificación en background:', error);
      });

    } catch (error) {
      this.logger.error('❌ Error en webhook handler:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }

  private async processNotificationAsync(payload: WebhookNotificationDto): Promise<void> {
    try {
      const topic = payload.type || payload.action?.split('.')[0];

      switch (topic) {
        case 'payment':
          await this.mercadoPagoService.processPaymentNotification(payload);
          break;

        case 'merchant_order':
          await this.mercadoPagoService.processMerchantOrderNotification(payload);
          break;

        case 'chargebacks':
        case 'chargeback':
          await this.mercadoPagoService.processChargebackNotification(payload);
          break;

        case 'refunds':
        case 'refund':
          await this.mercadoPagoService.processRefundNotification(payload);
          break;

        default:
          this.logger.log(`ℹ️ Tipo de notificación no manejado: ${topic}`);
      }
    } catch (error) {
      this.logger.error('❌ Error en processNotificationAsync:', error);
    }
  }
}

