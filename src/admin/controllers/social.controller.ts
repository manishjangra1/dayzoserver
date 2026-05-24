import { Controller, Get, Post, Delete, UseGuards, Param, Body, Query, Req, Ip, Headers, NotFoundException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin Panel - Social & Content Moderation')
@Controller('admin/social')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get('reports')
  @RequirePermissions('social:read')
  @ApiOperation({ summary: 'Get list of community flags and reports' })
  async getReports(@Query('status') status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.moderationReport.findMany({
      where,
      include: {
        reporter: {
          select: { id: true, username: true, email: true },
        },
        resolvedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('reports/:id/resolve')
  @RequirePermissions('social:write')
  @ApiOperation({ summary: 'Resolve a pending flag with a specific remediation action' })
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: { action: string; remarks?: string },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const report = await this.prisma.moderationReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report flag not found');

    const updated = await this.prisma.moderationReport.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedById: req.user.id,
        resolutionAction: dto.action,
      },
    });

    // Execute the action in database
    if (dto.action === 'DELETE' && report.targetType === 'COMMENT') {
      await this.prisma.comment.delete({ where: { id: report.targetId } }).catch(() => {});
    }

    await this.auditService.logAction(
      req.user.id,
      'REPORT_RESOLVE',
      'ModerationReport',
      id,
      report,
      { ...updated, remarks: dto.remarks },
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Delete('comments/:id')
  @RequirePermissions('social:write')
  @ApiOperation({ summary: 'Force-delete a comment directly' })
  async deleteComment(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.prisma.comment.delete({ where: { id } });

    await this.auditService.logAction(
      req.user.id,
      'COMMENT_DELETE',
      'Comment',
      id,
      comment,
      null,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  @Post('users/:id/shadow-ban')
  @RequirePermissions('social:write')
  @ApiOperation({ summary: 'Shadow ban user content silently' })
  async shadowBan(
    @Param('id') userId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User profile not found');

    // Add [SHADOW_BANNED] to user bio or status marker
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bio: user.bio ? `[SHADOW_BANNED] ${user.bio}` : '[SHADOW_BANNED]',
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'USER_SHADOW_BAN',
      'User',
      userId,
      user,
      updated,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }
}
