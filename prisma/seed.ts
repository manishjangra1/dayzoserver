import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
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

  // Create challenge rotation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingToday = await prisma.dailyChallenge.findFirst({ where: { date: today } });
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

  // 3. Seed Permissions
  const permissionsList = [
    { name: 'users:read', action: 'READ', subject: 'USERS', description: 'Can read user profiles and list users' },
    { name: 'users:write', action: 'UPDATE', subject: 'USERS', description: 'Can modify XP, streaks, levels, status, etc.' },
    { name: 'challenges:read', action: 'READ', subject: 'CHALLENGES', description: 'Can view challenges lists' },
    { name: 'challenges:write', action: 'ALL', subject: 'CHALLENGES', description: 'Can create, edit, delete, and duplicate challenges' },
    { name: 'squads:read', action: 'READ', subject: 'SQUADS', description: 'Can view squad metrics and rosters' },
    { name: 'squads:write', action: 'ALL', subject: 'SQUADS', description: 'Can create, delete, and prune squads' },
    { name: 'social:read', action: 'READ', subject: 'SOCIAL', description: 'Can view moderation queue' },
    { name: 'social:write', action: 'UPDATE', subject: 'SOCIAL', description: 'Can approve/reject comments and shadow ban users' },
    { name: 'notifications:write', action: 'ALL', subject: 'NOTIFICATIONS', description: 'Can send push campaigns and broadcast announcements' },
    { name: 'cms:write', action: 'ALL', subject: 'CMS', description: 'Can edit quotes, slides, feature flags, and constants' },
    { name: 'settings:write', action: 'ALL', subject: 'SYSTEM', description: 'Can edit app configs, formulas, and rate limits' },
    { name: 'audit:read', action: 'READ', subject: 'SYSTEM', description: 'Can view administrative audit logs' },
  ];

  const dbPermissions = [];
  for (const perm of permissionsList) {
    const existing = await prisma.permission.findUnique({ where: { name: perm.name } });
    if (!existing) {
      const created = await prisma.permission.create({ data: perm });
      dbPermissions.push(created);
    } else {
      dbPermissions.push(existing);
    }
  }
  console.log(`✅ ${dbPermissions.length} Permissions initialized.`);

  // 4. Seed Admin Roles
  const rolesList = [
    {
      name: 'SUPER_ADMIN',
      description: 'Full systemic control with access to all modules, audits, and configuration parameters.',
      permNames: permissionsList.map((p) => p.name),
    },
    {
      name: 'ADMIN',
      description: 'Comprehensive dashboard manager, excluding platform system configuration overrides.',
      permNames: ['users:read', 'users:write', 'challenges:read', 'challenges:write', 'squads:read', 'squads:write', 'social:read', 'social:write', 'notifications:write', 'cms:write', 'audit:read'],
    },
    {
      name: 'MODERATOR',
      description: 'Monitors community posts, comments, reviews reports, and issues shadow bans or warnings.',
      permNames: ['users:read', 'challenges:read', 'squads:read', 'social:read', 'social:write'],
    },
    {
      name: 'SUPPORT_AGENT',
      description: 'Reviews user queries, restores streaks, and handles user account updates.',
      permNames: ['users:read', 'users:write', 'challenges:read', 'squads:read', 'social:read'],
    },
    {
      name: 'CONTENT_MANAGER',
      description: 'Responsible for creating challenges, setting category content, sliding banners, and push alerts.',
      permNames: ['challenges:read', 'challenges:write', 'notifications:write', 'cms:write'],
    },
  ];

  for (const r of rolesList) {
    const existing = await prisma.adminRole.findUnique({ where: { name: r.name } });
    const perms = await prisma.permission.findMany({
      where: {
        name: { in: r.permNames },
      },
    });

    if (!existing) {
      await prisma.adminRole.create({
        data: {
          name: r.name,
          description: r.description,
          permissions: {
            connect: perms.map((p) => ({ id: p.id })),
          },
        },
      });
    } else {
      await prisma.adminRole.update({
        where: { id: existing.id },
        data: {
          permissions: {
            set: perms.map((p) => ({ id: p.id })),
          },
        },
      });
    }
  }
  console.log('✅ Admin Roles initialized and permissions linked.');

  // 5. Seed Default Super Admin
  const superAdminRole = await prisma.adminRole.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    const defaultSAEmail = 'admin@dayzo.com';
    const saUsername = 'superadmin';
    const saPasswordHash = bcrypt.hashSync('superpassword', 10);

    const existingSA = await prisma.adminUser.findUnique({ where: { email: defaultSAEmail } });
    if (!existingSA) {
      await prisma.adminUser.create({
        data: {
          email: defaultSAEmail,
          username: saUsername,
          passwordHash: saPasswordHash,
          roleId: superAdminRole.id,
          isActive: true,
        },
      });
      console.log(`👑 Created SuperAdmin account! email: ${defaultSAEmail} | password: superpassword`);
    }
  }

  // 6. Seed System Configurations
  const defaultConfigs = [
    { key: 'XP_FORMULA_MULTIPLIER', value: 1.5, description: 'Base multiplier applied on challenge difficulties.' },
    { key: 'STREAK_FREEZE_MAX_COUNT', value: 3, description: 'Maximum streak freezes a user profile can purchase or hold.' },
    { key: 'MAINTENANCE_MODE_ACTIVE', value: false, description: 'Block app traffic and show maintenance screen.' },
    { key: 'DAILY_CHALLENGE_COUNT', value: 3, description: 'Number of rotating active challenges shown each day.' },
  ];

  for (const conf of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: conf.key },
      create: { key: conf.key, value: conf.value, description: conf.description },
      update: { description: conf.description },
    });
  }
  console.log('✅ Default System Configurations seeded.');

  // 7. Seed Feature Flags
  const defaultFlags = [
    { key: 'enable_squad_chat', description: 'Enable direct message bubble in active squads', isActive: true },
    { key: 'enable_streak_wagers', description: 'Enable wagering daily streak XP against friends', isActive: false },
    { key: 'enable_video_proofs', description: 'Allow video uploads for challenge evidence verification', isActive: false },
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { description: flag.description },
    });
  }
  console.log('✅ Feature Flags initialized.');

  // 8. Seed CMS Content Blocks
  const cmsBlocks = [
    {
      type: 'ONBOARDING_SLIDE',
      key: 'slide_welcome',
      content: {
        title: 'Welcome to Dayzo!',
        text: 'The ultimate gen-z hub to Gamify your focus, lock-in with friends, and break bad habits.',
        imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600',
      },
      isActive: true,
    },
    {
      type: 'MOTIVATIONAL_QUOTE',
      key: 'quote_day_1',
      content: {
        quote: 'Do not seek to follow in the footsteps of the wise. Seek what they sought.',
        author: 'Matsuo Basho',
      },
      isActive: true,
    },
    {
      type: 'APP_BANNER',
      key: 'banner_summer_lockin',
      content: {
        title: 'SUMMER SHRED CHALLENGE',
        subtitle: 'Complete 10 fitness milestones this week for exclusive badges and double XP!',
        actionUrl: 'dayzo://challenges/summer-shred',
        accentColor: '#FF5E62',
      },
      isActive: true,
    },
  ];

  for (const block of cmsBlocks) {
    await prisma.contentBlock.upsert({
      where: { key: block.key },
      create: block,
      update: { content: block.content, type: block.type, isActive: block.isActive },
    });
  }
  console.log('✅ CMS Content Blocks initialized.');

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

