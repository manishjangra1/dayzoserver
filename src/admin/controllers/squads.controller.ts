import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body, Query, Req, Ip, Headers, NotFoundException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin Panel - Squad Management')
@Controller('admin/squads')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class SquadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('squads:read')
  @ApiOperation({ summary: 'Filter and search squad teams' })
  async getSquads(@Query('search') search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inviteCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.squad.findMany({
      where,
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { xp: 'desc' },
    });
  }

  @Get(':id')
  @RequirePermissions('squads:read')
  @ApiOperation({ summary: 'Get details and rosters' })
  async getSquadDetails(@Param('id') id: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            username: true,
            email: true,
            xp: true,
            level: true,
            streak: true,
          },
        },
      },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    return squad;
  }

  @Post()
  @RequirePermissions('squads:write')
  @ApiOperation({ summary: 'Create a new squad' })
  async createSquad(
    @Body() dto: { name: string; inviteCode: string; avatar?: string },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const squad = await this.prisma.squad.create({
      data: {
        name: dto.name,
        inviteCode: dto.inviteCode,
        avatar: dto.avatar || null,
        xp: 0,
        level: 1,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'SQUAD_CREATE',
      'Squad',
      squad.id,
      null,
      squad,
      ipAddress,
      userAgent,
    );

    return squad;
  }

  @Put(':id')
  @RequirePermissions('squads:write')
  @ApiOperation({ summary: 'Edit squad attributes or invite codes' })
  async updateSquad(
    @Param('id') id: string,
    @Body() dto: { name?: string; inviteCode?: string; avatar?: string; xp?: number; level?: number },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.squad.findUnique({ where: { id } });
    if (!original) throw new NotFoundException('Squad not found');

    const updated = await this.prisma.squad.update({
      where: { id },
      data: dto,
    });

    await this.auditService.logAction(
      req.user.id,
      'SQUAD_UPDATE',
      'Squad',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/members/:memberId/remove')
  @RequirePermissions('squads:write')
  @ApiOperation({ summary: 'Prune members from squad' })
  async removeMember(
    @Param('id') squadId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: memberId, squadId },
    });

    if (!user) {
      throw new NotFoundException('Member not found inside this squad');
    }

    const updated = await this.prisma.user.update({
      where: { id: memberId },
      data: { squadId: null },
    });

    await this.auditService.logAction(
      req.user.id,
      'SQUAD_MEMBER_PRUNE',
      'User',
      memberId,
      { id: memberId, squadId },
      updated,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  @Post(':id/members/:memberId/add')
  @RequirePermissions('squads:write')
  @ApiOperation({ summary: 'Manually add a user member' })
  async addMember(
    @Param('id') squadId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const squad = await this.prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    const user = await this.prisma.user.findUnique({ where: { id: memberId } });
    if (!user) throw new NotFoundException('User not found');

    const originalSquad = user.squadId;

    const updated = await this.prisma.user.update({
      where: { id: memberId },
      data: { squadId },
    });

    await this.auditService.logAction(
      req.user.id,
      'SQUAD_MEMBER_ADD',
      'User',
      memberId,
      { id: memberId, squadId: originalSquad },
      updated,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions('squads:write')
  @ApiOperation({ summary: 'Delete squad' })
  async deleteSquad(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.squad.findUnique({ where: { id } });
    if (!original) throw new NotFoundException('Squad not found');

    await this.prisma.squad.delete({ where: { id } });

    await this.auditService.logAction(
      req.user.id,
      'SQUAD_DELETE',
      'Squad',
      id,
      original,
      null,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }
}
