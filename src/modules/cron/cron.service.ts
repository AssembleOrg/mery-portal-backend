import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/services';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job que se ejecuta todos los días a las 3 AM (zona horaria del servidor)
   * Desactiva todas las compras que hayan expirado (expiresAt < now)
   */
  @Cron('0 3 * * *', {
    name: 'deactivate-expired-purchases',
    timeZone: 'America/Argentina/Buenos_Aires', // Ajusta según tu zona horaria
  })
  async deactivateExpiredPurchases() {
    try {
      this.logger.log('🕒 [CRON] Iniciando tarea de limpieza de compras expiradas...');

      const now = new Date();

      // Buscar todas las compras activas que ya expiraron
      const expiredPurchases = await this.prisma.categoryPurchase.findMany({
        where: {
          isActive: true,
          expiresAt: {
            not: null,
            lt: now, // expiresAt < now
          },
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      if (expiredPurchases.length === 0) {
        this.logger.log('✅ [CRON] No hay compras expiradas para procesar');
        return;
      }

      this.logger.log(`📋 [CRON] Encontradas ${expiredPurchases.length} compras expiradas`);

      // Desactivar todas las compras expiradas
      const result = await this.prisma.categoryPurchase.updateMany({
        where: {
          isActive: true,
          expiresAt: {
            not: null,
            lt: now,
          },
        },
        data: {
          isActive: false,
        },
      });

      this.logger.log(`✅ [CRON] ${result.count} compras desactivadas exitosamente`);

      // Log detallado de las compras desactivadas
      expiredPurchases.forEach((purchase) => {
        this.logger.log(
          `   - Usuario: ${purchase.user.email} | ` +
          `Categoría: ${purchase.category.name} | ` +
          `Expiró: ${purchase.expiresAt?.toISOString()}`
        );
      });

      // Opcional: Enviar notificaciones por email a los usuarios afectados
      // await this.sendExpirationNotifications(expiredPurchases);

    } catch (error) {
      this.logger.error('❌ [CRON] Error en tarea de limpieza de compras expiradas:', error);
      throw error;
    }
  }

  /**
   * Método auxiliar para obtener estadísticas de expiración
   * Puedes llamarlo manualmente si necesitas ver el estado
   */
  async getExpirationStats() {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [total, active, expired, expiringSoon] = await Promise.all([
      // Total de compras
      this.prisma.categoryPurchase.count(),

      // Compras activas
      this.prisma.categoryPurchase.count({
        where: {
          isActive: true,
        },
      }),

      // Compras expiradas pero aún activas (no procesadas)
      this.prisma.categoryPurchase.count({
        where: {
          isActive: true,
          expiresAt: {
            not: null,
            lt: now,
          },
        },
      }),

      // Compras que expiran en los próximos 30 días
      this.prisma.categoryPurchase.count({
        where: {
          isActive: true,
          expiresAt: {
            not: null,
            gte: now,
            lt: thirtyDaysFromNow,
          },
        },
      }),
    ]);

    return {
      total,
      active,
      expired,
      expiringSoon,
    };
  }

  /**
   * Método opcional para enviar notificaciones de expiración
   * Puedes implementarlo si quieres notificar a los usuarios
   */
  // private async sendExpirationNotifications(purchases: any[]) {
  //   // Implementar lógica de envío de emails
  //   // Ejemplo: usar EmailService para notificar a los usuarios
  // }
}

