import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    adminUserId: string,
    action: string,
    targetEntity: string,
    targetId?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          adminUserId,
          action,
          targetEntity,
          targetId,
          oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
          newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error('❌ Failed to write administrative audit log:', error);
      // Fail silently or handle accordingly to prevent locking the main request lifecycle
    }
  }

  async getLogs(page = 1, limit = 50, filters: { action?: string; adminUserId?: string; targetEntity?: string } = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.adminUserId) {
      where.adminUserId = filters.adminUserId;
    }
    if (filters.targetEntity) {
      where.targetEntity = filters.targetEntity;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          adminUser: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
