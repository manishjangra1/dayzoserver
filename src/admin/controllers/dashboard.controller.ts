import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin Panel - Dashboard Overview')
@Controller('admin/dashboard')
@UseGuards(AdminJwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get total dashboard summary KPI metrics' })
  async getMetrics() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      dau,
      wau,
      mau,
      totalCompletions,
      totalSkips,
      xpSum,
      totalSquads,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
      this.prisma.userChallenge.count({ where: { completed: true } }),
      this.prisma.userChallenge.count({ where: { skipped: true } }),
      this.prisma.user.aggregate({ _sum: { xp: true } }),
      this.prisma.squad.count(),
    ]);

    const activeRate = totalUsers > 0 ? (dau / totalUsers) * 100 : 0;

    return {
      kpis: {
        totalUsers,
        activeUsers: { dau, wau, mau, activeRate: Math.round(activeRate * 10) / 10 },
        totalChallengesCompleted: totalCompletions,
        totalChallengesSkipped: totalSkips,
        totalXpGenerated: xpSum._sum?.xp || 0,
        totalSquads,
      },
    };
  }

  @Get('charts')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get chronological datasets for growth and activity charts' })
  async getChartData(@Query('days') daysQuery?: string) {
    const days = daysQuery ? parseInt(daysQuery, 10) : 7;
    const chartData = [];

    for (let i = days - 1; i >= 0; i--) {
      const dateStart = new Date();
      dateStart.setDate(dateStart.getDate() - i);
      dateStart.setHours(0, 0, 0, 0);

      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);

      const [usersJoined, challengesDone] = await Promise.all([
        this.prisma.user.count({
          where: { createdAt: { gte: dateStart, lt: dateEnd } },
        }),
        this.prisma.userChallenge.count({
          where: { completedAt: { gte: dateStart, lt: dateEnd }, completed: true },
        }),
      ]);

      chartData.push({
        date: dateStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newUsers: usersJoined,
        completions: challengesDone,
      });
    }

    return chartData;
  }

  @Get('leaderboards')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get leaderboard metrics for high-performing players and squads' })
  async getLeaderboards() {
    const [topUsers, topSquads] = await Promise.all([
      this.prisma.user.findMany({
        take: 5,
        orderBy: { xp: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          xp: true,
          level: true,
          streak: true,
          avatar: true,
        },
      }),
      this.prisma.squad.findMany({
        take: 5,
        orderBy: { xp: 'desc' },
        select: {
          id: true,
          name: true,
          xp: true,
          level: true,
          inviteCode: true,
          avatar: true,
          _count: {
            select: { members: true },
          },
        },
      }),
    ]);

    return {
      topUsers,
      topSquads,
    };
  }

  @Get('challenge-performance')
  @RequirePermissions('challenges:read')
  @ApiOperation({ summary: 'Get performance breakdowns by challenge difficulty and categories' })
  async getChallengePerformance() {
    // 1. Completion rate grouped by Category
    const completions = await this.prisma.userChallenge.findMany({
      where: { completed: true },
      include: { challenge: true },
    });

    const categoryStats: Record<string, { completed: number; skipped: number; total: number }> = {};
    
    // Seed initial categories
    const categories = ['fitness', 'productivity', 'learning', 'mindfulness', 'social'];
    categories.forEach((cat) => {
      categoryStats[cat] = { completed: 0, skipped: 0, total: 0 };
    });

    const allHistory = await this.prisma.userChallenge.findMany({
      include: { challenge: true },
    });

    allHistory.forEach((uc) => {
      const cat = uc.challenge?.category || 'other';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { completed: 0, skipped: 0, total: 0 };
      }
      categoryStats[cat].total += 1;
      if (uc.completed) {
        categoryStats[cat].completed += 1;
      }
      if (uc.skipped) {
        categoryStats[cat].skipped += 1;
      }
    });

    const categoryData = Object.keys(categoryStats).map((cat) => ({
      category: cat.toUpperCase(),
      completed: categoryStats[cat].completed,
      skipped: categoryStats[cat].skipped,
      total: categoryStats[cat].total,
    }));

    // 2. High performing / popular challenges
    const topCompleted = await this.prisma.challenge.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        difficulty: true,
        _count: {
          select: {
            userChallenges: {
              where: { completed: true },
            },
          },
        },
      },
      orderBy: {
        userChallenges: {
          _count: 'desc',
        },
      },
    });

    return {
      categoryData,
      popularChallenges: topCompleted.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        difficulty: c.difficulty,
        completionsCount: c._count.userChallenges,
      })),
    };
  }

  @Get('heatmap')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Get challenge completions coordinates for building activity heatmaps' })
  async getHeatmap() {
    // Generate dates for the last 30 days
    const heatmap = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dEnd = new Date(d);
      dEnd.setDate(dEnd.getDate() + 1);

      const count = await this.prisma.userChallenge.count({
        where: {
          completedAt: { gte: d, lt: dEnd },
          completed: true,
        },
      });

      heatmap.push({
        date: d.toISOString().split('T')[0],
        count,
      });
    }

    return heatmap;
  }
}
