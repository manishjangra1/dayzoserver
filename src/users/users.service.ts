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

    return {
      ...user,
      title: this.getLevelTitle(user.xp),
      totalCompletions,
      badges: user.badges.map((ub) => ub.badge),
    };
  }

  // 2. Update Profile & Onboarding Settings
  async updateProfile(userId: string, data: { avatar?: string; username?: string }) {
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
