import { Controller, Get, Post, Patch, Delete, UseGuards, Query, Param, Body, Req, Ip, Headers, NotFoundException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { UpdateUserDto } from '../dto/admin.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Admin Panel - User Management')
@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Filter and search users with debounced support' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'ACTIVE', 'INACTIVE', 'BANNED'] })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'xp', 'streak'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  async getUsers(
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order = 'desc',
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'BANNED') {
      where.bio = { contains: '[BANNED]' }; // Soft ban tracking in bio or similar marker
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          xp: true,
          level: true,
          streak: true,
          longestStreak: true,
          streakFreezes: true,
          lastActiveAt: true,
          createdAt: true,
          bio: true,
          squad: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get extensive profile details' })
  async getUserProfile(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        squad: true,
        badges: {
          include: {
            badge: true,
          },
        },
        _count: {
          select: {
            challenges: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Edit user bio, stats, and XP directly' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.user.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('User profile not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    await this.auditService.logAction(
      req.user.id,
      'USER_UPDATE',
      'User',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/streak/reset')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Force reset a user streak value back to 0' })
  async resetStreak(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.user.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('User profile not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { streak: 0 },
    });

    await this.auditService.logAction(
      req.user.id,
      'USER_STREAK_RESET',
      'User',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/suspend')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Bans or suspends a customer account' })
  async suspendUser(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.user.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('User profile not found');
    }

    // Toggle ban state marker inside bio or streak
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        bio: original.bio ? `[BANNED] ${original.bio}` : '[BANNED]',
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'USER_SUSPEND',
      'User',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/unsuspend')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Restores a suspended user account' })
  async restoreUser(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.user.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('User profile not found');
    }

    const cleanBio = original.bio ? original.bio.replace('[BANNED]', '').trim() : '';

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        bio: cleanBio,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'USER_RESTORE',
      'User',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/badges/:badgeId')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Manually allocate a dynamic gamification badge' })
  async allocateBadge(
    @Param('id') userId: string,
    @Param('badgeId') badgeId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User profile not found');

    const badge = await this.prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge element not found');

    const assignment = await this.prisma.userBadge.upsert({
      where: {
        userId_badgeId: { userId, badgeId },
      },
      create: { userId, badgeId },
      update: {},
    });

    await this.auditService.logAction(
      req.user.id,
      'BADGE_ASSIGN',
      'UserBadge',
      assignment.id,
      null,
      { userId, badgeId, badgeTitle: badge.title },
      ipAddress,
      userAgent,
    );

    return assignment;
  }

  @Delete(':id/badges/:badgeId')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Manually remove a badge' })
  async removeBadge(
    @Param('id') userId: string,
    @Param('badgeId') badgeId: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User profile not found');

    const targetBadge = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId },
      },
    });

    if (!targetBadge) {
      throw new NotFoundException('User does not possess this badge');
    }

    await this.prisma.userBadge.delete({
      where: {
        userId_badgeId: { userId, badgeId },
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'BADGE_REMOVE',
      'UserBadge',
      targetBadge.id,
      targetBadge,
      null,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }
}
