import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminLoginDto, CreateAdminDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('This administrator account has been deactivated');
    }

    const passwordMatch = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: admin.id, email: admin.email, type: 'admin' };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: admin.role.name,
        permissions: admin.role.permissions.map((p) => p.name),
      },
    };
  }

  async createAdmin(dto: CreateAdminDto, requestingAdminId: string) {
    const existingEmail = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException('Email address already in use');
    }

    const existingUser = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    if (existingUser) {
      throw new ConflictException('Username already taken');
    }

    const role = await this.prisma.adminRole.findUnique({ where: { name: dto.role } });
    if (!role) {
      throw new ConflictException(`Role '${dto.role}' does not exist`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.adminUser.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        roleId: role.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: {
          select: {
            name: true,
          },
        },
        isActive: true,
        createdAt: true,
      },
    });
  }

  async getAdminProfile(id: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Session user not found');
    }

    return {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      role: admin.role.name,
      permissions: admin.role.permissions.map((p) => p.name),
      isActive: admin.isActive,
    };
  }
}
