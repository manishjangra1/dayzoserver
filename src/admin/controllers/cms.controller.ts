import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body, Req, Ip, Headers, NotFoundException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin Panel - CMS & System Configurations')
@Controller('admin/cms')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class CmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // 1. Content Blocks (Slides, Quotes, Banners)
  // ==========================================

  @Get('content')
  @RequirePermissions('cms:write')
  @ApiOperation({ summary: 'List all dynamic content blocks and quotes' })
  async getContentBlocks() {
    return this.prisma.contentBlock.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('content')
  @RequirePermissions('cms:write')
  @ApiOperation({ summary: 'Create or update a CMS block' })
  async upsertContentBlock(
    @Body() dto: { type: string; key: string; content: any; isActive?: boolean },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const existing = await this.prisma.contentBlock.findUnique({ where: { key: dto.key } });

    const block = await this.prisma.contentBlock.upsert({
      where: { key: dto.key },
      create: {
        type: dto.type,
        key: dto.key,
        content: dto.content,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      update: {
        type: dto.type,
        content: dto.content,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      existing ? 'CMS_BLOCK_UPDATE' : 'CMS_BLOCK_CREATE',
      'ContentBlock',
      block.id,
      existing,
      block,
      ipAddress,
      userAgent,
    );

    return block;
  }

  @Delete('content/:id')
  @RequirePermissions('cms:write')
  @ApiOperation({ summary: 'Delete a CMS block' })
  async deleteContentBlock(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.contentBlock.findUnique({ where: { id } });
    if (!original) throw new NotFoundException('Block not found');

    await this.prisma.contentBlock.delete({ where: { id } });

    await this.auditService.logAction(
      req.user.id,
      'CMS_BLOCK_DELETE',
      'ContentBlock',
      id,
      original,
      null,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  // ==========================================
  // 2. Feature Flags Toggles
  // ==========================================

  @Get('features')
  @RequirePermissions('cms:write')
  @ApiOperation({ summary: 'List all dynamic feature toggles' })
  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany();
  }

  @Post('features/:id/toggle')
  @RequirePermissions('cms:write')
  @ApiOperation({ summary: 'Toggle the status of a feature flag' })
  async toggleFeature(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: { isActive: !flag.isActive },
    });

    await this.auditService.logAction(
      req.user.id,
      'FEATURE_FLAG_TOGGLE',
      'FeatureFlag',
      id,
      flag,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  // ==========================================
  // 3. System Configurations & Constants
  // ==========================================

  @Get('configs')
  @RequirePermissions('settings:write')
  @ApiOperation({ summary: 'List all game config constants and XP rules' })
  async getConfigs() {
    return this.prisma.systemConfig.findMany();
  }

  @Post('configs')
  @RequirePermissions('settings:write')
  @ApiOperation({ summary: 'Upsert system configuration parameters' })
  async upsertConfig(
    @Body() dto: { key: string; value: any; description?: string },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const existing = await this.prisma.systemConfig.findUnique({ where: { key: dto.key } });

    const config = await this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value: dto.value,
        description: dto.description,
      },
      update: {
        value: dto.value,
        description: dto.description || undefined,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      existing ? 'SYSTEM_CONFIG_UPDATE' : 'SYSTEM_CONFIG_CREATE',
      'SystemConfig',
      config.id,
      existing,
      config,
      ipAddress,
      userAgent,
    );

    return config;
  }
}
