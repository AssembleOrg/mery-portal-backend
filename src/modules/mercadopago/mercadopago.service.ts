import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/services';
import { WebhookNotificationDto, MercadoPagoPaymentDto } from './dto';
import { CartService } from '../cart/cart.service';
import { ChatService } from '../chat/chat.service';
import { RewardsService } from '../rewards/rewards.service';
import { PresencialDepositsService } from '../presencial-classes/presencial-deposits.service';
import { CouponsService } from '../coupons/coupons.service';

/** Precio centinela de los cursos que solo se venden en USD (no pasan por MP). */
const USD_ONLY_SENTINEL = 99999999;

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = 'https://api.mercadopago.com';
  
  // Store processed notification IDs to ensure idempotency
  private processedNotifications = new Set<string>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cartService: CartService,
    private chatService: ChatService,
    private rewardsService: RewardsService,
    private presencialDeposits: PresencialDepositsService,
    private couponsService: CouponsService,
  ) {
    this.accessToken = this.configService.get<string>('MP_ACCESS_TOKEN') || '';
    this.webhookSecret = this.configService.get<string>('MP_WEBHOOK_SECRET') || '';
    
    if (!this.accessToken) {
      this.logger.warn('⚠️ MP_ACCESS_TOKEN no configurado');
    }
    if (!this.webhookSecret) {
      this.logger.warn('⚠️ MP_WEBHOOK_SECRET no configurado - validación de firma deshabilitada');
    }
  }

  /**
   * Validate webhook signature using HMAC-SHA256
   */
  validateSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('⚠️ Webhook secret no configurado - saltando validación');
      return true; // En desarrollo, puedes permitir sin validación
    }

    // Skip validation if rawBody is empty (data comes in query params)
    if (!rawBody || rawBody.length === 0) {
      this.logger.warn('⚠️ rawBody vacío (datos en query params) - saltando validación de firma');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      this.logger.error('Error validando firma de webhook:', error);
      this.logger.warn('⚠️ Error en validación de firma - permitiendo webhook para debugging');
      // En lugar de bloquear, permitir el webhook y loguear el error
      // Esto es útil durante debugging, pero en producción deberías retornar false
      return true;
    }
  }

  /**
   * Check if notification was already processed (idempotency)
   */
  isNotificationProcessed(notificationId: string): boolean {
    return this.processedNotifications.has(notificationId);
  }

  /**
   * Mark notification as processed
   */
  markNotificationAsProcessed(notificationId: string): void {
    this.processedNotifications.add(notificationId);
    
    // Clean up old entries (keep only last 1000)
    if (this.processedNotifications.size > 1000) {
      const iterator = this.processedNotifications.values();
      for (let i = 0; i < 100; i++) {
        const value = iterator.next().value;
        if (value) {
          this.processedNotifications.delete(value);
        }
      }
    }
  }

  /**
   * Get payment details from Mercado Pago API
   */
  async getPaymentDetails(paymentId: string): Promise<MercadoPagoPaymentDto> {
    try {
      this.logger.log(`📥 Consultando pago ${paymentId} en Mercado Pago`);
      
      const response = await axios.get<MercadoPagoPaymentDto>(
        `${this.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      this.logger.log(`✅ Pago ${paymentId} obtenido: ${response.data.status}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo pago ${paymentId}:`, error.response?.data || error.message);
      throw new InternalServerErrorException('Error consultando pago en Mercado Pago');
    }
  }

  /**
   * Process payment notification
   */
  async processPaymentNotification(notification: WebhookNotificationDto): Promise<void> {
    const notificationId = `${notification.type}-${notification.data.id}`;

    // Check idempotency
    if (this.isNotificationProcessed(notificationId)) {
      this.logger.log(`⏭️ Notificación ${notificationId} ya procesada, ignorando`);
      return;
    }

    try {
      // Get payment details from Mercado Pago
      const payment = await this.getPaymentDetails(notification.data.id);

      this.logger.log(`💳 Procesando pago:`, {
        id: payment.id,
        status: payment.status,
        amount: payment.transaction_amount,
        currency: payment.currency_id,
        email: payment.payer.email,
        metadata: payment.metadata,
      });

      // Only process approved payments
      if (payment.status === 'approved') {
        await this.handleApprovedPayment(payment);
      } else {
        this.logger.log(`ℹ️ Pago ${payment.id} en estado ${payment.status}, no se procesa`);
      }

      // Mark as processed
      this.markNotificationAsProcessed(notificationId);
    } catch (error) {
      this.logger.error(`❌ Error procesando notificación de pago:`, error);
      throw error;
    }
  }

  /**
   * Handle approved payment - grant access to categories
   */
  private async handleApprovedPayment(payment: MercadoPagoPaymentDto): Promise<void> {
    const transactionId = payment.id.toString();

    // Las señas de clases presenciales no otorgan acceso a cursos: se marcan
    // aparte y salen por acá antes de buscar category_ids.
    if (payment.metadata?.type === 'presencial_deposit') {
      const signupId =
        payment.metadata?.signup_id ||
        payment.external_reference?.replace(/^presencial_/, '');
      if (!signupId) {
        this.logger.error(`❌ Seña ${payment.id} sin signup_id`);
        return;
      }
      await this.presencialDeposits.markPaid(signupId, transactionId);
      return;
    }

    try {
      // Extract metadata with better fallback handling
      const userId = payment.metadata?.user_id || payment.external_reference?.split('_')[0];
      const categoryIdsStr = payment.metadata?.category_ids;
      const userEmail = payment.metadata?.user_email || payment.payer?.email;

      if (!userId) {
        this.logger.error(`❌ Pago ${payment.id} sin user_id en metadata o external_reference`);
        return;
      }

      if (!categoryIdsStr) {
        this.logger.error(`❌ Pago ${payment.id} sin category_ids en metadata`);
        return;
      }

      // Parse category IDs from metadata
      let categoryIds: string[];
      try {
        categoryIds = JSON.parse(categoryIdsStr);
      } catch {
        this.logger.error(`❌ Error parseando category_ids: ${categoryIdsStr}`);
        return;
      }

      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        this.logger.error(`❌ category_ids inválido o vacío: ${categoryIdsStr}`);
        return;
      }

      this.logger.log(`🎯 Procesando pago para usuario ${userId} (${userEmail})`);
      this.logger.log(`💳 Monto: ${payment.transaction_amount} ${payment.currency_id}`);
      this.logger.log(`📦 Categorías: ${categoryIds.join(', ')}`);

      // Check for existing purchases with this transaction ID (database-level idempotency)
      const existingPurchases = await this.prisma.categoryPurchase.findMany({
        where: { transactionId },
      });

      if (existingPurchases.length > 0) {
        this.logger.warn(`⏭️ Pago ${payment.id} ya procesado anteriormente (${existingPurchases.length} registros)`);
        return;
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.error(`❌ Usuario ${userId} no encontrado`);
        return;
      }

      // Solo se otorga lo que efectivamente se cobró. Los ítems del pago los
      // arma el servidor desde el quote (precios de la DB), así que son la
      // fuente confiable; la metadata sola no alcanza. Además se descartan
      // cursos inactivos o solo-USD, que nunca se cobran por Mercado Pago.
      const chargedIds = new Set<string>(
        (Array.isArray(payment.additional_info?.items) ? payment.additional_info.items : [])
          .map((it: { id?: unknown }) => (it?.id != null ? String(it.id) : ''))
          .filter(Boolean),
      );
      const grantableIds =
        chargedIds.size > 0
          ? categoryIds.filter((id) => chargedIds.has(String(id)))
          : categoryIds;
      if (chargedIds.size === 0) {
        this.logger.warn(`⚠️ Pago ${payment.id} sin additional_info.items: se valida solo por estado y precio`);
      }
      const notCharged = categoryIds.filter((id) => !grantableIds.includes(id));
      if (notCharged.length > 0) {
        this.logger.warn(`🚫 Pago ${payment.id}: categorías en metadata que no se cobraron, se ignoran: ${notCharged.join(', ')}`);
      }

      const categories = (
        await this.prisma.videoCategory.findMany({
          where: {
            id: { in: grantableIds },
            deletedAt: null,
            isActive: true,
          },
        })
      ).filter((c) => Number(c.priceARS) !== USD_ONLY_SENTINEL);

      if (categories.length !== grantableIds.length) {
        const foundIds = categories.map(c => c.id);
        const missingIds = grantableIds.filter(id => !foundIds.includes(id));
        this.logger.warn(`⚠️ Categorías no otorgables (inexistentes, inactivas o solo USD): ${missingIds.join(', ')}`);
      }

      if (categories.length === 0) {
        this.logger.error(`❌ Ninguna categoría válida encontrada`);
        return;
      }

      // Nombres de las formaciones recién otorgadas en ESTA corrida. Sirve para
      // el email de agradecimiento y como guardia de idempotencia: si el webhook
      // se reprocesa, no habrá creaciones nuevas y no se re-emite la recompensa.
      const createdCategoryNames: string[] = [];

      // Use transaction for atomicity
      const purchasesCreated = await this.prisma.$transaction(async (tx) => {
        const purchases: any[] = [];

        for (const category of categories) {
          try {
            // Check if user already has access (within transaction)
            const existingAccess = await tx.categoryPurchase.findUnique({
              where: {
                userId_categoryId: {
                  userId,
                  categoryId: category.id,
                },
              },
            });

            if (existingAccess) {
              this.logger.log(`ℹ️ Usuario ${userId} ya tiene acceso a "${category.name}"`);
              purchases.push(existingAccess);
              continue;
            }

            // Calculate individual price (split total amount proportionally)
            const individualAmount = payment.transaction_amount / categories.length;

            // Los cursos se venden con acceso de 1 año
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            // Create purchase record
            const purchase = await tx.categoryPurchase.create({
              data: {
                userId,
                categoryId: category.id,
                amount: individualAmount,
                currency: payment.currency_id,
                paymentMethod: payment.payment_method_id,
                transactionId,
                paymentStatus: 'completed',
                isActive: true,
                expiresAt, // Expira en 1 año
              },
            });

            this.logger.log(`✅ Acceso otorgado: "${category.name}"`);
            purchases.push(purchase);
            createdCategoryNames.push(category.name);
          } catch (error) {
            this.logger.error(`❌ Error otorgando acceso a "${category.name}":`, error);
            throw error; // Rollback entire transaction on any error
          }
        }

        return purchases;
      });

      this.logger.log(`🎉 ${purchasesCreated.length} compra(s) procesada(s) exitosamente`);

      // Clear user's cart after successful purchase
      try {
        await this.cartService.clearCart(userId);
        this.logger.log(`🛒 Carrito del usuario ${userId} vaciado`);
      } catch (cartError) {
        // Don't fail the entire process if cart clearing fails
        this.logger.warn(`⚠️ Error vaciando carrito: ${cartError.message}`);
      }

      // Comprar otra formación reabre/extiende la vida de los chats del alumno.
      try {
        const { reopened } = await this.chatService.reopenRoomsForUser(userId);
        if (reopened > 0) {
          this.logger.log(`💬 ${reopened} chat(s) reabiertos para ${userId}`);
        }
      } catch (chatError) {
        this.logger.warn(`⚠️ Error reabriendo chats: ${chatError.message}`);
      }

      // El uso del cupón se confirma acá, con el pago ya aprobado. Antes lo
      // hacía un endpoint público que cualquiera podía llamar.
      const paidCouponId = payment.metadata?.coupon_id;
      if (paidCouponId && createdCategoryNames.length > 0) {
        try {
          await this.couponsService.confirmPaidUsage(String(paidCouponId), userId);
        } catch (couponError) {
          this.logger.warn(`⚠️ Error confirmando uso de cupón: ${couponError.message}`);
        }
      }

      // Recompensa por compra: cupón-regalo personal 20% + email de gracias.
      // Solo si hubo al menos una compra NUEVA (idempotente ante reintentos MP).
      if (createdCategoryNames.length > 0) {
        try {
          await this.rewardsService.issuePurchaseReward(userId, createdCategoryNames);
        } catch (rewardError) {
          this.logger.warn(`⚠️ Error emitiendo cupón-regalo: ${rewardError.message}`);
        }
      }

    } catch (error) {
      this.logger.error(`❌ Error en handleApprovedPayment para pago ${payment.id}:`, error);
      
      // Log detailed error for debugging
      if (error.code) {
        this.logger.error(`Error code: ${error.code}`);
      }
      if (error.meta) {
        this.logger.error(`Error meta:`, error.meta);
      }
      
      throw error;
    }
  }

  /**
   * Process merchant order notification (if needed)
   */
  async processMerchantOrderNotification(notification: WebhookNotificationDto): Promise<void> {
    this.logger.log(`📦 Notificación de merchant_order recibida: ${notification.data.id}`);
    // Implement if you use Checkout Pro with merchant orders
    // For now, we'll just log it
  }

  /**
   * Process chargeback notification
   */
  async processChargebackNotification(notification: WebhookNotificationDto): Promise<void> {
    this.logger.warn(`⚠️ Contracargo recibido: ${notification.data.id}`);
    // TODO: Handle chargebacks - revoke access, notify admin, etc.
  }

  /**
   * Process refund notification
   */
  async processRefundNotification(notification: WebhookNotificationDto): Promise<void> {
    this.logger.warn(`💸 Reembolso recibido: ${notification.data.id}`);
    // TODO: Handle refunds - revoke access, update purchase status, etc.
  }
}

