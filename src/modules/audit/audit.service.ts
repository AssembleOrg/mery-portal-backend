import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { AuditData, AuditContext } from '../../shared/types';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(auditData: AuditData, context: AuditContext): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: context.userId,
          action: auditData.action,
          entity: auditData.entity,
          entityId: auditData.entityId,
          oldValues: auditData.oldValues,
          newValues: auditData.newValues,
          ipAddress: context.ipAddress,
          location: context.location,
          userAgent: context.userAgent,
        },
      });
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  }

  async getAuditLogs(
    entity?: string,
    entityId?: string,
    userId?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;
    
    const where = {
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
    };
  }
}
