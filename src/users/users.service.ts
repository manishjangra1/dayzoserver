import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 1. Get Detailed Profile
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        badges: {
          include: { badge: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User profile not found');

    const totalCompletions = await this.prisma.userChallenge.count({
      where: { userId, completed: true },
    });

    // Calculate 28-day consistency heatmap
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 27);
    startDate.setHours(0, 0, 0, 0);

    const completions = await this.prisma.userChallenge.findMany({
      where: {
        userId,
        completed: true,
        completedAt: { gte: startDate },
      },
      select: {
        completedAt: true,
      },
    });

    const heatmapData: { day: number; date: string; completed: boolean }[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];

      const hasCompletion = completions.some((c) => {
        const compDate = new Date(c.completedAt || new Date());
        compDate.setHours(0, 0, 0, 0);
        return compDate.toISOString().split('T')[0] === dateStr;
      });

      heatmapData.push({
        day: 28 - i,
        date: dateStr,
        completed: hasCompletion,
      });
    }

    return {
      ...user,
      title: this.getLevelTitle(user.xp),
      totalCompletions,
      badges: user.badges.map((ub) => ub.badge),
      heatmapData,
    };
  }

  // 2. Update Profile & Onboarding Settings
  async updateProfile(userId: string, data: { avatar?: string; username?: string; bio?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.getProfile(updated.id);
  }

  getLevelTitle(xp: number): string {
    if (xp < 100) return 'Rookie';
    if (xp < 300) return 'Locked In';
    if (xp < 600) return 'Warrior';
    if (xp < 1000) return 'Monk';
    if (xp < 2000) return 'Machine';
    return 'Legend';
  }
}
