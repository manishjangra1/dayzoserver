import React from 'react';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SquadsService {
  constructor(private prisma: PrismaService) {}

  // 1. Create a Squad
  async createSquad(userId: string, name: string, avatar?: string) {
    // Check if user is already in a squad
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.squadId) {
      throw new BadRequestException('You are already in a squad. Leave your current squad first.');
    }

    // Check if squad name is taken
    const existingName = await this.prisma.squad.findUnique({
      where: { name },
    });

    if (existingName) {
      throw new BadRequestException('Squad name is already taken.');
    }

    // Generate unique 6-character invite code
    let inviteCode = '';
    let isUnique = false;
    while (!isUnique) {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingCode = await this.prisma.squad.findUnique({
        where: { inviteCode },
      });
      if (!existingCode) {
        isUnique = true;
      }
    }

    // Create squad and add creator as a member
    const squad = await this.prisma.squad.create({
      data: {
        name,
        inviteCode,
        avatar: avatar || `https://api.dicebear.com/7.x/identicon/png?seed=${name}`,
        members: {
          connect: { id: userId },
        },
      },
      include: {
        members: {
          select: {
            id: true,
            username: true,
            avatar: true,
            xp: true,
            level: true,
            streak: true,
          },
        },
      },
    });

    return squad;
  }

  // 2. Join a Squad using Invite Code
  async joinSquad(userId: string, inviteCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.squadId) {
      throw new BadRequestException('You are already in a squad. Leave your current squad first.');
    }

    const squad = await this.prisma.squad.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!squad) {
      throw new NotFoundException('Squad with that invite code not found.');
    }

    // Connect user to squad
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        squadId: squad.id,
      },
    });

    // Re-fetch squad with all members to calculate total squad XP
    const fullSquad = await this.prisma.squad.findUnique({
      where: { id: squad.id },
      include: {
        members: {
          select: {
            id: true,
            username: true,
            avatar: true,
            xp: true,
            level: true,
            streak: true,
          },
        },
      },
    });

    // Recalculate squad total XP (sum of members' XP)
    if (fullSquad) {
      const totalXp = fullSquad.members.reduce((sum, member) => sum + member.xp, 0);
      await this.prisma.squad.update({
        where: { id: squad.id },
        data: { xp: totalXp },
      });
    }

    return fullSquad;
  }

  // 3. Get Logged-In User's Squad
  async getUserSquad(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.squadId) {
      return null;
    }

    const squad = await this.prisma.squad.findUnique({
      where: { id: user.squadId },
      include: {
        members: {
          select: {
            id: true,
            username: true,
            avatar: true,
            xp: true,
            level: true,
            streak: true,
          },
        },
      },
    });

    // Update squad total XP on fetch to keep synced
    if (squad) {
      const totalXp = squad.members.reduce((sum, member) => sum + member.xp, 0);
      const updatedSquad = await this.prisma.squad.update({
        where: { id: squad.id },
        data: { xp: totalXp },
        include: {
          members: {
            select: {
              id: true,
              username: true,
              avatar: true,
              xp: true,
              level: true,
              streak: true,
            },
          },
        },
      });
      return updatedSquad;
    }

    return squad;
  }

  // 4. Get Leaderboard of Squads
  async getSquadsLeaderboard() {
    return this.prisma.squad.findMany({
      orderBy: {
        xp: 'desc',
      },
      take: 10,
    });
  }

  // 5. Leave Squad
  async leaveSquad(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.squadId) {
      throw new BadRequestException('You are not currently in a squad.');
    }

    const squadId = user.squadId;

    // Disconnect user from squad
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        squadId: null,
      },
    });

    // Check if squad is now empty
    const remainingMembers = await this.prisma.user.findMany({
      where: { squadId },
    });

    if (remainingMembers.length === 0) {
      // Delete squad if empty
      await this.prisma.squad.delete({
        where: { id: squadId },
      });
      return { message: 'Left squad. Squad has been disbanded.' };
    }

    // Recalculate XP for remaining members
    const newXp = remainingMembers.reduce((sum, m) => sum + m.xp, 0);
    await this.prisma.squad.update({
      where: { id: squadId },
      data: { xp: newXp },
    });

    return { message: 'Successfully left squad.' };
  }
}
