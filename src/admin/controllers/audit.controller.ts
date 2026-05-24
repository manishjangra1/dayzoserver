import { Controller, Get, UseGuards, Query, Param, NotFoundException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { AuditService } from '../services/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Admin Panel - Security Audit Logs')
@Controller('admin/audit')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Filter and browse administration action trails' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'adminUserId', required: false, type: String })
  @ApiQuery({ name: 'targetEntity', required: false, type: String })
  async getLogs(
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('action') action?: string,
    @Query('adminUserId') adminUserId?: string,
    @Query('targetEntity') targetEntity?: string,
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;

    return this.auditService.getLogs(page, limit, { action, adminUserId, targetEntity });
  }

  @Get('logs/:id')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get old vs new detail differences for rollback analysis' })
  async getLogDetail(@Param('id') id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        adminUser: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Audit log event not found');
    }

    return log;
  }
}
