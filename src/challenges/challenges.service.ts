import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

  // 1. Get or Rotate today's 5 challenges
  async getTodayChallenges(userId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there are already 5 challenges assigned for today
    let dailyChallenges = await this.prisma.dailyChallenge.findMany({
      where: { date: today },
      include: { challenge: true },
    });

    if (dailyChallenges.length < 5) {
      // If not, pick 5 unique challenges from the challenge database
      const allChallenges = await this.prisma.challenge.findMany();
      
      if (allChallenges.length === 0) {
        // Fallback placeholder if seed is missing
        const fallback = await this.prisma.challenge.create({
          data: {
            title: 'Do 20 Pushups',
            description: 'Get down and do 20 clean, continuous pushups to kickstart your day.',
            category: 'fitness',
            difficulty: 'medium',
            xpReward: 50,
            duration: 5,
          },
        });
        allChallenges.push(fallback);
      }

      // We need to pick 5 unique challenges randomly or as many as we have available
      const shuffled = [...allChallenges].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(5, shuffled.length));

      for (const chall of selected) {
        const existing = dailyChallenges.find((dc) => dc.challengeId === chall.id);
        if (!existing) {
          try {
            await this.prisma.dailyChallenge.create({
              data: {
                challengeId: chall.id,
                date: today,
              },
            });
          } catch (e) {
            // Safe concurrent catch
          }
        }
      }

      // Re-fetch to guarantee sync
      dailyChallenges = await this.prisma.dailyChallenge.findMany({
        where: { date: today },
        include: { challenge: true },
      });
    }

    // Extract challenge records
    const challenges = dailyChallenges.map((dc) => dc.challenge);

    // If userId is provided, inject completion status for today
    if (userId) {
      const userCompletions = await this.prisma.userChallenge.findMany({
        where: {
          userId,
          challengeId: { in: challenges.map((c) => c.id) },
          completedAt: { gte: today },
        },
      });

      return challenges.map((challenge) => {
        const comp = userCompletions.find((uc) => uc.challengeId === challenge.id);
        return {
          ...challenge,
          completed: comp ? comp.completed : false,
          skipped: comp ? comp.skipped : false,
          userChallengeId: comp ? comp.id : null,
          proofText: comp ? comp.proofText : null,
        };
      });
    }

    return challenges.map((challenge) => ({
      ...challenge,
      completed: false,
      skipped: false,
      userChallengeId: null,
      proofText: null,
    }));
  }

  // Backwards compatible getter
  async getTodayChallenge() {
    const list = await this.getTodayChallenges();
    return list[0];
  }

  // 2. Complete a daily challenge
  async completeChallenge(userId: string, challengeId?: string, proofText?: string, proofUrl?: string) {
    const todayChallenges = await this.getTodayChallenges(userId);
    
    // Find target challenge
    let targetChallenge = todayChallenges.find((c) => c.id === challengeId);
    if (!targetChallenge) {
      if (challengeId) {
        throw new NotFoundException('Challenge not found in today\'s active list!');
      } else {
        // Fallback to first incomplete challenge
        targetChallenge = todayChallenges.find((c) => !c.completed) || todayChallenges[0];
      }
    }

    if (targetChallenge.completed) {
      throw new BadRequestException('You have already completed this challenge today!');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Record Completion
    const userChallenge = await this.prisma.userChallenge.create({
      data: {
        userId,
        challengeId: targetChallenge.id,
        completed: true,
        completedAt: new Date(),
        proofText,
        proofUrl,
      },
    });

    // Fetch user to apply rewards
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const xpGained = targetChallenge.xpReward;
    const nextXp = user.xp + xpGained;
    const nextLevel = Math.floor(nextXp / 100) + 1;
    const isLevelUp = nextLevel > user.level;

    // Calculate new streak (Only increments on first completion of a given day)
    let newStreak = user.streak;
    const lastActive = user.lastActiveAt;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (!lastActive) {
      // First challenge completed ever
      newStreak = 1;
    } else {
      const lastActiveDay = new Date(lastActive);
      lastActiveDay.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(now.getTime() - lastActiveDay.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Continuous day completion
        newStreak += 1;
      } else if (diffDays > 1) {
        // Streak was broken, restart it
        newStreak = 1;
      }
      // If diffDays === 0, user already completed a challenge today, streak stays the same
    }

    const nextLongestStreak = Math.max(user.longestStreak, newStreak);

    // Update User in Database
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: nextXp,
        level: nextLevel,
        streak: newStreak,
        longestStreak: nextLongestStreak,
        lastActiveAt: new Date(),
      },
    });

    // Check & Unlock Badges
    const unlockedBadges = await this.checkAndAwardBadges(userId, updatedUser, newStreak);

    return {
      completed: true,
      challenge: targetChallenge,
      xpGained,
      streakUpdated: newStreak,
      levelUp: isLevelUp,
      newLevel: nextLevel,
      unlockedBadges,
      user: {
        ...updatedUser,
        title: this.getLevelTitle(updatedUser.xp),
      },
    };
  }

  // 3. Skip/Freeze a challenge
  async skipChallenge(userId: string, challengeId?: string) {
    const todayChallenges = await this.getTodayChallenges(userId);
    
    // Find target challenge
    let targetChallenge = todayChallenges.find((c) => c.id === challengeId);
    if (!targetChallenge) {
      if (challengeId) {
        throw new NotFoundException('Challenge not found in today\'s active list!');
      } else {
        // Fallback to first incomplete challenge
        targetChallenge = todayChallenges.find((c) => !c.completed) || todayChallenges[0];
      }
    }

    if (targetChallenge.completed || targetChallenge.skipped) {
      throw new BadRequestException('You have already completed or skipped this challenge today!');
    }

    // Record Skip
    await this.prisma.userChallenge.create({
      data: {
        userId,
        challengeId: targetChallenge.id,
        completed: false,
        skipped: true,
        completedAt: new Date(),
      },
    });

    // Fetch user to adjust streak freeze
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let updatedStreak = user.streak;
    let newFreezes = user.streakFreezes;

    if (user.streakFreezes > 0) {
      // Use streak freeze
      newFreezes -= 1;
    } else {
      // Reset streak
      updatedStreak = 0;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        streak: updatedStreak,
        streakFreezes: newFreezes,
      },
    });

    return {
      skipped: true,
      streak: updatedStreak,
      streakFreezes: newFreezes,
      user: {
        ...updatedUser,
        title: this.getLevelTitle(updatedUser.xp),
      },
    };
  }

  // 4. Get history
  async getChallengeHistory(userId: string) {
    return this.prisma.userChallenge.findMany({
      where: { userId },
      include: { challenge: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // Badge Engine
  private async checkAndAwardBadges(userId: string, user: any, currentStreak: number) {
    const unlocked: any[] = [];
    const allBadges = await this.prisma.badge.findMany();

    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeId: true },
    });
    const ownedIds = new Set(userBadges.map((b) => b.badgeId));

    // Get total completions count
    const completionsCount = await this.prisma.userChallenge.count({
      where: { userId, completed: true },
    });

    for (const badge of allBadges) {
      if (ownedIds.has(badge.id)) continue;

      let meetsRequirement = false;

      if (badge.requirementType === 'FIRST_CHALLENGE' && completionsCount >= 1) {
        meetsRequirement = true;
      } else if (badge.requirementType === 'STREAK_DAYS' && currentStreak >= badge.requirementValue) {
        meetsRequirement = true;
      } else if (badge.requirementType === 'TOTAL_COMPLETIONS' && completionsCount >= badge.requirementValue) {
        meetsRequirement = true;
      }

      if (meetsRequirement) {
        const userBadge = await this.prisma.userBadge.create({
          data: {
            userId,
            badgeId: badge.id,
          },
          include: { badge: true },
        }).catch(() => null);

        if (userBadge) {
          unlocked.push(userBadge.badge);
        }
      }
    }

    return unlocked;
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
