import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SquadsService } from './squads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

class CreateSquadDto {
  @ApiProperty({ example: 'Streak Titans', description: 'Name of the squad' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'https://avatar-url', description: 'Optional squad avatar', required: false })
  @IsString()
  @IsOptional()
  avatar?: string;
}

class JoinSquadDto {
  @ApiProperty({ example: 'AX79Q1', description: '6-character invite code of the squad' })
  @IsString()
  @IsNotEmpty()
  inviteCode!: string;
}

@ApiTags('Squads')
@Controller('squads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SquadsController {
  constructor(private readonly squadsService: SquadsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new squad' })
  @ApiResponse({ status: 201, description: 'Squad successfully created.' })
  async create(@CurrentUser() user: User, @Body() dto: CreateSquadDto) {
    return this.squadsService.createSquad(user.id, dto.name, dto.avatar);
  }

  @Post('join')
  @ApiOperation({ summary: 'Join an existing squad using an invite code' })
  @ApiResponse({ status: 200, description: 'Successfully joined squad.' })
  async join(@CurrentUser() user: User, @Body() dto: JoinSquadDto) {
    return this.squadsService.joinSquad(user.id, dto.inviteCode);
  }

  @Get('my-squad')
  @ApiOperation({ summary: "Get details of the current user's squad" })
  @ApiResponse({ status: 200, description: 'Returned squad details or null.' })
  async getMySquad(@CurrentUser() user: User) {
    return this.squadsService.getUserSquad(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard ranking of squads' })
  @ApiResponse({ status: 200, description: 'Returned list of squads.' })
  async getLeaderboard() {
    return this.squadsService.getSquadsLeaderboard();
  }

  @Post('leave')
  @ApiOperation({ summary: 'Leave the current squad' })
  @ApiResponse({ status: 200, description: 'Successfully left squad.' })
  async leave(@CurrentUser() user: User) {
    return this.squadsService.leaveSquad(user.id);
  }
}
