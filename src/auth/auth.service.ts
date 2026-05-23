import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { username: dto.username },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Email or username is already taken');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${dto.username}`,
        xp: 0,
        level: 1,
        streak: 0,
        longestStreak: 0,
        streakFreezes: 1,
      },
    });

    const tokens = this.generateTokens(user.id, user.email);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.emailOrUsername },
          { username: dto.emailOrUsername },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user.id, user.email);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return {
      ...sanitized,
      title: this.getLevelTitle(user.xp),
    };
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
