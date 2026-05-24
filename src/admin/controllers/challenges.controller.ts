import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body, Query, Req, Ip, Headers, NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../services/audit.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

class AdminCreateChallengeDto {
  title!: string;
  description!: string;
  category!: string;
  difficulty!: string;
  xpReward!: number;
  duration!: number;
}

class AdminUpdateUserChallengeProgressDto {
  userId!: string;
  challengeId!: string;
  completed!: boolean;
  skipped!: boolean;
  proofText?: string;
  proofUrl?: string;
}

@ApiTags('Admin Panel - Challenge Management')
@Controller('admin/challenges')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class ChallengesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('challenges:read')
  @ApiOperation({ summary: 'Filter and search catalog challenges' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'difficulty', required: false })
  async getChallenges(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    return this.prisma.challenge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: 'Create a new challenge card' })
  async createChallenge(
    @Body() dto: AdminCreateChallengeDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const created = await this.prisma.challenge.create({
      data: dto,
    });

    await this.auditService.logAction(
      req.user.id,
      'CHALLENGE_CREATE',
      'Challenge',
      created.id,
      null,
      created,
      ipAddress,
      userAgent,
    );

    return created;
  }

  @Put(':id')
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: 'Edit challenge values, category, and rewards' })
  async updateChallenge(
    @Param('id') id: string,
    @Body() dto: AdminCreateChallengeDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.challenge.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('Challenge not found');
    }

    const updated = await this.prisma.challenge.update({
      where: { id },
      data: dto,
    });

    await this.auditService.logAction(
      req.user.id,
      'CHALLENGE_UPDATE',
      'Challenge',
      id,
      original,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Post(':id/duplicate')
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: 'Duplicate an existing challenge template' })
  async duplicateChallenge(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.challenge.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('Challenge target not found');
    }

    const duplicated = await this.prisma.challenge.create({
      data: {
        title: `${original.title} (Copy)`,
        description: original.description,
        category: original.category,
        difficulty: original.difficulty,
        xpReward: original.xpReward,
        duration: original.duration,
      },
    });

    await this.auditService.logAction(
      req.user.id,
      'CHALLENGE_DUPLICATE',
      'Challenge',
      duplicated.id,
      null,
      duplicated,
      ipAddress,
      userAgent,
    );

    return duplicated;
  }

  @Delete(':id')
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: 'Delete challenge from index database' })
  async deleteChallenge(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const original = await this.prisma.challenge.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException('Challenge not found');
    }

    await this.prisma.challenge.delete({ where: { id } });

    await this.auditService.logAction(
      req.user.id,
      'CHALLENGE_DELETE',
      'Challenge',
      id,
      original,
      null,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }

  @Post('progress')
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: "Modify completion status, proofs, or skipped states for ANY specific user's challenge" })
  async updateProgress(
    @Body() dto: AdminUpdateUserChallengeProgressDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const { userId, challengeId, completed, skipped, proofText, proofUrl } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User profile not found');

    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException('Challenge template not found');

    // Find if there is an existing UserChallenge tracking entry
    const existing = await this.prisma.userChallenge.findFirst({
      where: { userId, challengeId },
      orderBy: { createdAt: 'desc' },
    });

    let updatedOrCreated;
    const completedAt = completed ? new Date() : null;

    if (existing) {
      updatedOrCreated = await this.prisma.userChallenge.update({
        where: { id: existing.id },
        data: {
          completed,
          skipped,
          proofText,
          proofUrl,
          completedAt,
        },
      });
    } else {
      updatedOrCreated = await this.prisma.userChallenge.create({
        data: {
          userId,
          challengeId,
          completed,
          skipped,
          proofText,
          proofUrl,
          completedAt,
        },
      });
    }

    // Award XP to user if they were marked as completed and were not previously
    if (completed && (!existing || !existing.completed)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          xp: { increment: challenge.xpReward },
          // Check level update logic
          level: Math.floor((user.xp + challenge.xpReward) / 1000) + 1,
        },
      });
    }

    await this.auditService.logAction(
      req.user.id,
      'USER_CHALLENGE_PROGRESS_OVERRIDE',
      'UserChallenge',
      updatedOrCreated.id,
      existing,
      updatedOrCreated,
      ipAddress,
      userAgent,
    );

    return updatedOrCreated;
  }

  @Post('schedule-daily')
  @RequirePermissions('challenges:write')
  @ApiOperation({ summary: 'Rotate and schedule a specific challenge for a date' })
  async scheduleDaily(
    @Body() dto: { challengeId: string; date: string },
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const targetDate = new Date(dto.date);
    targetDate.setHours(0, 0, 0, 0);

    const challenge = await this.prisma.challenge.findUnique({ where: { id: dto.challengeId } });
    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    const scheduled = await this.prisma.dailyChallenge.upsert({
      where: {
        date_challengeId: {
          date: targetDate,
          challengeId: dto.challengeId,
        },
      },
      create: {
        date: targetDate,
        challengeId: dto.challengeId,
      },
      update: {},
    });

    await this.auditService.logAction(
      req.user.id,
      'DAILY_CHALLENGE_SCHEDULE',
      'DailyChallenge',
      scheduled.id,
      null,
      { challengeId: dto.challengeId, date: targetDate },
      ipAddress,
      userAgent,
    );

    return scheduled;
  }
}
