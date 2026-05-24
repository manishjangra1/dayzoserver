import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dayzo_user:dayzo_password@127.0.0.1:5432/dayzo_db?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Badges
  const badges = [
    {
      title: 'First Step',
      description: 'Completed your first daily challenge on Dayzo!',
      icon: '🚀',
      requirementType: 'FIRST_CHALLENGE',
      requirementValue: 1,
    },
    {
      title: 'Locked In',
      description: 'Maintained a consistent 7-day streak.',
      icon: '🔥',
      requirementType: 'STREAK_DAYS',
      requirementValue: 7,
    },
    {
      title: 'Streak Legend',
      description: 'Maintained a continuous 30-day streak.',
      icon: '👑',
      requirementType: 'STREAK_DAYS',
      requirementValue: 30,
    },
    {
      title: 'Monk Status',
      description: 'Completed a grand total of 50 challenges.',
      icon: '🧘',
      requirementType: 'TOTAL_COMPLETIONS',
      requirementValue: 50,
    },
  ];

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { id: b.title },
      create: b,
      update: b,
    }).catch(async () => {
      const existing = await prisma.badge.findFirst({ where: { title: b.title } });
      if (!existing) {
        await prisma.badge.create({ data: b });
      }
    });
  }
  console.log('✅ Badges seeded.');

  // 2. Seed Challenges
  const challenges = [
    // Fitness
    {
      title: 'Do 20 Pushups',
      description: 'Kickstart your day with 20 continuous, clean pushups to elevate blood flow.',
      category: 'fitness',
      difficulty: 'medium',
      xpReward: 50,
      duration: 5,
    },
    {
      title: 'Run 2 Kilometers',
      description: 'Head outside or use a treadmill to log a solid 2km run at your own steady pace.',
      category: 'fitness',
      difficulty: 'hard',
      xpReward: 80,
      duration: 15,
    },
    {
      title: 'Hold 2-Min Plank',
      description: 'Strengthen your core by holding a straight abdominal plank position for 2 full minutes.',
      category: 'fitness',
      difficulty: 'medium',
      xpReward: 40,
      duration: 2,
    },
    // Productivity
    {
      title: 'Read 10 Book Pages',
      description: 'Ditch the screen. Open a physical or digital book and read at least 10 pages in quiet isolation.',
      category: 'productivity',
      difficulty: 'easy',
      xpReward: 30,
      duration: 10,
    },
    {
      title: 'Plan Your Week',
      description: 'Write down your top 3 objectives and organize your schedule calendar for the upcoming days.',
      category: 'productivity',
      difficulty: 'medium',
      xpReward: 50,
      duration: 15,
    },
    {
      title: 'Declutter Your Desk',
      description: 'Clear off all trash, loose sheets, and non-essential tools from your working desktop.',
      category: 'productivity',
      difficulty: 'easy',
      xpReward: 25,
      duration: 8,
    },
    // Learning
    {
      title: 'Write 1 Coding function',
      description: 'Open your editor and write a clean, well-commented function in TypeScript or your favored language.',
      category: 'learning',
      difficulty: 'medium',
      xpReward: 45,
      duration: 12,
    },
    {
      title: 'Learn 5 Foreign Words',
      description: 'Select a language and memorize 5 useful vocabulary words including their spelling and usage.',
      category: 'learning',
      difficulty: 'easy',
      xpReward: 30,
      duration: 10,
    },
    {
      title: 'Solve 1 Logic Riddle',
      description: 'Find and crack a challenging brain-teaser or algorithmic puzzle to test cognitive limits.',
      category: 'learning',
      difficulty: 'medium',
      xpReward: 40,
      duration: 15,
    },
    // Mindfulness
    {
      title: '10-Minute Meditation',
      description: 'Sit upright in a comfortable position, close your eyes, and focus purely on your natural breathing.',
      category: 'mindfulness',
      difficulty: 'easy',
      xpReward: 35,
      duration: 10,
    },
    {
      title: 'List 3 Gratitudes',
      description: 'Journal down exactly 3 simple or grand things in your life that you are deeply grateful for today.',
      category: 'mindfulness',
      difficulty: 'easy',
      xpReward: 20,
      duration: 5,
    },
    {
      title: 'No Socials for 2 Hours',
      description: 'Challenge your dopamine baseline by refraining from scrolling Instagram, TikTok, or X for 2 hours.',
      category: 'mindfulness',
      difficulty: 'hard',
      xpReward: 70,
      duration: 120,
    },
    // Social
    {
      title: 'Call a Family Member',
      description: 'Spend at least 5 minutes in a verbal call with a relative to connect and strengthen familial bonds.',
      category: 'social',
      difficulty: 'easy',
      xpReward: 30,
      duration: 10,
    },
    {
      title: 'Send Friend Compliment',
      description: 'Message or tell a friend a genuine, highly specific compliment about their personality or work.',
      category: 'social',
      difficulty: 'easy',
      xpReward: 25,
      duration: 3,
    },
  ];

  for (const c of challenges) {
    const existing = await prisma.challenge.findFirst({ where: { title: c.title } });
    if (!existing) {
      await prisma.challenge.create({ data: c });
    }
  }
  console.log('✅ Challenges seeded.');

  // Create an automatic challenge rotation entry for today so it's ready out of the box
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingToday = await prisma.dailyChallenge.findUnique({ where: { date: today } });
  if (!existingToday) {
    const randomChallenge = await prisma.challenge.findFirst();
    if (randomChallenge) {
      await prisma.dailyChallenge.create({
        data: {
          challengeId: randomChallenge.id,
          date: today,
        },
      });
      console.log('🔥 Default Daily Challenge rotated for today.');
    }
  }

  console.log('🌳 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
