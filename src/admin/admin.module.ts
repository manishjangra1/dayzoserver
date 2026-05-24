import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';

// Controllers
import { AdminController } from './controllers/admin.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { UsersController } from './controllers/users.controller';
import { ChallengesController } from './controllers/challenges.controller';
import { SquadsController } from './controllers/squads.controller';
import { SocialController } from './controllers/social.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { CmsController } from './controllers/cms.controller';
import { AuditController } from './controllers/audit.controller';

// Services
import { AdminService } from './admin.service';
import { AuditService } from './services/audit.service';

// Strategies & Guards
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dayzo_super_secure_secret_2026_genz_key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    AdminController,
    DashboardController,
    UsersController,
    ChallengesController,
    SquadsController,
    SocialController,
    NotificationsController,
    CmsController,
    AuditController,
  ],
  providers: [
    AdminService,
    AuditService,
    AdminJwtStrategy,
    RbacGuard,
  ],
  exports: [
    AdminService,
    AuditService,
  ],
})
export class AdminModule {}
