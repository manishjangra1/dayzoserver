import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Daily Challenges')
@Controller('challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('today')
  @ApiOperation({ summary: 'Get the active daily challenge for today' })
  @ApiResponse({ status: 200, description: 'Successfully returned today\'s challenge details.' })
  async getToday() {
    return this.challengesService.getTodayChallenge();
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark today\'s rotating daily challenge as successfully completed' })
  @ApiResponse({ status: 200, description: 'Successfully completed. Returns rewards state, levels, haptics info, and badge unlocks.' })
  @ApiResponse({ status: 400, description: 'Already completed today\'s challenge.' })
  async complete(@CurrentUser() user: User) {
    return this.challengesService.completeChallenge(user.id);
  }

  @Post('skip')
  @ApiOperation({ summary: 'Skip today\'s rotating challenge (uses a streak freeze if available)' })
  @ApiResponse({ status: 200, description: 'Successfully skipped. Returns adjusted streak and remaining freezes count.' })
  @ApiResponse({ status: 400, description: 'Already skipped or completed today.' })
  async skip(@CurrentUser() user: User) {
    return this.challengesService.skipChallenge(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get a list of the user\'s past challenge actions' })
  @ApiResponse({ status: 200, description: 'Successfully returned activity history list.' })
  async getHistory(@CurrentUser() user: User) {
    return this.challengesService.getChallengeHistory(user.id);
  }
}
