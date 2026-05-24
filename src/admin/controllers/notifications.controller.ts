import { Controller, Get, Post, UseGuards, Body, Req, Ip, Headers } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

class CampaignDto {
  title!: string;
  body!: string;
  targetSegment!: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SQUAD_MEMBERS';
}

@ApiTags('Admin Panel - Notification Campaigns')
@Controller('admin/notifications')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get('campaigns')
  @RequirePermissions('notifications:write')
  @ApiOperation({ summary: 'Get list of notifications broadcast campaigns' })
  async getCampaigns() {
    return this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('campaigns')
  @RequirePermissions('notifications:write')
  @ApiOperation({ summary: 'Create and dispatch push notification alerts' })
  async createCampaign(
    @Body() dto: CampaignDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title: dto.title,
        body: dto.body,
        targetSegment: dto.targetSegment,
        status: 'PENDING',
      },
    });

    // 1. Resolve Target Users
    const targetWhere: any = {};
    if (dto.targetSegment === 'ACTIVE') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      targetWhere.lastActiveAt = { gte: sevenDaysAgo };
    } else if (dto.targetSegment === 'INACTIVE') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      targetWhere.lastActiveAt = { lt: sevenDaysAgo };
    } else if (dto.targetSegment === 'SQUAD_MEMBERS') {
      targetWhere.squadId = { not: null };
    }

    const users = await this.prisma.user.findMany({
      where: targetWhere,
      select: { id: true, email: true }, // In real app, select user.expoPushToken
    });

    // For demonstration and future production integration:
    // Filter valid Expo Push Tokens (e.g. ExponentPushToken[xxx])
    // const pushTokens = users.map(u => u.expoPushToken).filter(token => token && token.startsWith('ExponentPushToken'));
    // Since we don't have token in schema yet, we record the target users count and insert system notifications
    
    await Promise.all(
      users.map((user) =>
        this.prisma.notification.create({
          data: {
            userId: user.id,
            title: dto.title,
            body: dto.body,
            read: false,
          },
        }),
      ),
    );

    // Call Expo API in background if dynamic credentials are configured
    let deliveryCount = users.length;
    let status = 'SENT';

    const expoToken = process.env.EXPO_ACCESS_TOKEN;
    if (expoToken && users.length > 0) {
      try {
        // Prepare dynamic push message list
        // const messages = pushTokens.map(token => ({ to: token, title: dto.title, body: dto.body }));
        // await axios.post('https://exp.host/--/api/v2/push/send', messages, {
        //   headers: { Authorization: `Bearer ${expoToken}` }
        // });
      } catch (err) {
        console.error('Expo Notification campaign deliver failure:', err);
        status = 'FAILED';
      }
    }

    const updated = await this.prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        status,
        sentAt: new Date(),
        deliveryCount,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'NOTIFICATION_CAMPAIGN_SEND',
      'NotificationCampaign',
      campaign.id,
      null,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }
}
