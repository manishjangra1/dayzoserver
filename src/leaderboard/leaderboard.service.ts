import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  // 1. Get Global Leaderboard ordered by XP
  async getGlobalLeaderboard() {
    const users = await this.prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: 50,
      select: {
        id: true,
        username: true,
        avatar: true,
        xp: true,
        level: true,
        streak: true,
      },
    });

    return users.map((user, index) => ({
      ...user,
      rank: index + 1,
      isPodium: index < 3,
      title: this.getLevelTitle(user.xp),
    }));
  }

  // 2. Get Friends Leaderboard ordered by XP
  async getFriendsLeaderboard(userId: string) {
    // Get all accepted friendships where user is sender or receiver
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
    });

    const friendIds = friendships.map((f) =>
      f.senderId === userId ? f.receiverId : f.senderId,
    );

    // Always include user themselves
    friendIds.push(userId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: friendIds } },
      orderBy: { xp: 'desc' },
      select: {
        id: true,
        username: true,
        avatar: true,
        xp: true,
        level: true,
        streak: true,
      },
    });

    return users.map((user, index) => ({
      ...user,
      rank: index + 1,
      isPodium: index < 3,
      title: this.getLevelTitle(user.xp),
    }));
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
