import { Controller, Get, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Leaderboard')
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('global')
  @ApiOperation({ summary: 'Get global top users ranking based on XP' })
  @ApiResponse({ status: 200, description: 'Successfully returned global rank list.' })
  async getGlobal() {
    return this.leaderboardService.getGlobalLeaderboard();
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get leaderboard rank list consisting of user and their friends' })
  @ApiResponse({ status: 200, description: 'Successfully returned friends rank list.' })
  async getFriends(@CurrentUser() user: User) {
    return this.leaderboardService.getFriendsLeaderboard(user.id);
  }
}
