import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  // 1. Send Friend Request
  async sendFriendRequest(senderId: string, receiverUsername: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { username: receiverUsername },
    });

    if (!receiver) {
      throw new NotFoundException('User with that username not found');
    }

    if (senderId === receiver.id) {
      throw new BadRequestException('You cannot send a friend request to yourself');
    }

    // Check if friendship already exists
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException('You are already friends');
      }
      if (existing.senderId === senderId) {
        throw new BadRequestException('Friend request already sent');
      } else {
        // Automatically accept since the other party had already requested
        const updated = await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        return { message: 'Friend request accepted automatically', friendship: updated };
      }
    }

    const friendship = await this.prisma.friendship.create({
      data: {
        senderId,
        receiverId: receiver.id,
        status: 'PENDING',
      },
    });

    return { message: 'Friend request sent', friendship };
  }

  // 2. Accept Friend Request
  async acceptFriendRequest(receiverId: string, senderId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
    });

    if (!friendship) {
      throw new NotFoundException('Pending friend request not found');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
    });

    return { message: 'Friend request accepted', friendship: updated };
  }

  // 3. Get Friends List
  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
            xp: true,
            level: true,
            streak: true,
          },
        },
        receiver: {
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

    return friendships.map((f) => (f.senderId === userId ? f.receiver : f.sender));
  }

  // 4. Get Social Feed (Completed Challenges of Friends)
  async getSocialFeed(userId: string) {
    const friends = await this.getFriends(userId);
    const friendIds = friends.map((f) => f.id);

    // Include the user's own activities as well
    friendIds.push(userId);

    const feedItems = await this.prisma.userChallenge.findMany({
      where: {
        userId: { in: friendIds },
        completed: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true,
            streak: true,
          },
        },
        challenge: true,
        comments: {
          include: {
            user: {
              select: {
                username: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    // For each feed item, fetch the reactions
    const itemsWithReactions = await Promise.all(
      feedItems.map(async (item) => {
        const reactions = await this.prisma.reaction.findMany({
          where: { targetUserId: item.userId, createdAt: { gte: item.completedAt || undefined } },
          include: {
            user: { select: { username: true } },
          },
          take: 5,
        });

        return {
          ...item,
          reactions: reactions.map((r) => ({
            username: r.user.username,
            emoji: r.emoji,
          })),
        };
      }),
    );

    return itemsWithReactions;
  }

  // 5. React to Friend completion
  async reactToFriend(userId: string, targetUserId: string, emoji: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const reaction = await this.prisma.reaction.create({
      data: {
        userId,
        targetUserId,
        emoji,
      },
    });

    return { success: true, reaction };
  }

  // 6. Create a Comment on completion card
  async addComment(userId: string, userChallengeId: string, content: string) {
    const completion = await this.prisma.userChallenge.findUnique({
      where: { id: userChallengeId },
    });

    if (!completion) {
      throw new NotFoundException('Completion card not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        userChallengeId,
        content,
      },
      include: {
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
      },
    });

    return comment;
  }

  // 7. Global Search for discovery (Users and Squads)
  async searchGlobal(query: string) {
    if (!query || query.trim().length === 0) {
      return { users: [], squads: [] };
    }

    const cleanedQuery = query.trim();

    const users = await this.prisma.user.findMany({
      where: {
        username: {
          contains: cleanedQuery,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        xp: true,
        level: true,
      },
      take: 10,
    });

    const squads = await this.prisma.squad.findMany({
      where: {
        name: {
          contains: cleanedQuery,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        xp: true,
        level: true,
      },
      take: 10,
    });

    return { users, squads };
  }
}
