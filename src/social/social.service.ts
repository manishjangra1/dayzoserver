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

    if (feedItems.length === 0) {
      return [];
    }

    // Find the earliest completion date in this page to limit bulk reactions search scope
    const earliestCompletedAt = new Date(
      Math.min(
        ...feedItems.map((item) => new Date(item.completedAt || item.createdAt).getTime())
      )
    );

    // Query reactions in bulk for all target users of this feed page
    const userIdsInFeed = feedItems.map((item) => item.userId);
    const allReactions = await this.prisma.reaction.findMany({
      where: {
        targetUserId: { in: userIdsInFeed },
        createdAt: { gte: earliestCompletedAt },
      },
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map bulk reactions back to feed items locally in memory
    const itemsWithReactions = feedItems.map((item) => {
      const itemCompletedTime = new Date(item.completedAt || item.createdAt).getTime();
      const reactionsForItem = allReactions
        .filter(
          (r) =>
            r.targetUserId === item.userId &&
            new Date(r.createdAt).getTime() >= itemCompletedTime
        )
        .slice(0, 5);

      return {
        ...item,
        reactions: reactionsForItem.map((r) => ({
          username: r.user.username,
          emoji: r.emoji,
        })),
      };
    });

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

  // 8. Decline Friend Request
  async declineFriendRequest(receiverId: string, senderId: string) {
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

    await this.prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return { message: 'Friend request declined successfully' };
  }

  // 9. Remove Friend (Unfriend)
  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.friendship.delete({
      where: { id: friendship.id },
    });

    return { message: 'Friend removed successfully' };
  }

  // 10. Get Pending Incoming Requests
  async getIncomingRequests(userId: string) {
    const requests = await this.prisma.friendship.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
            level: true,
          },
        },
      },
    });
    return requests.map((r) => r.sender);
  }
}

