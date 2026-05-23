import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

class FriendRequestDto {
  @ApiProperty({ example: 'streak_master', description: 'Username of the user you want to add' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

class AcceptRequestDto {
  @ApiProperty({ example: 'user-uuid-xyz', description: 'ID of the sender of the request' })
  @IsString()
  @IsNotEmpty()
  senderId!: string;
}

class ReactDto {
  @ApiProperty({ example: 'user-uuid-abc', description: 'User ID of the completion card creator' })
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;

  @ApiProperty({ example: '🔥', description: 'Emoji to send as quick reaction' })
  @IsString()
  @IsNotEmpty()
  emoji!: string;
}

@ApiTags('Social Networking')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request to a user by username' })
  @ApiResponse({ status: 201, description: 'Request successfully sent/accepted.' })
  async requestFriend(@CurrentUser() user: User, @Body() dto: FriendRequestDto) {
    return this.socialService.sendFriendRequest(user.id, dto.username);
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept a pending friend request from a sender ID' })
  @ApiResponse({ status: 200, description: 'Successfully accepted request.' })
  async acceptFriend(@CurrentUser() user: User, @Body() dto: AcceptRequestDto) {
    return this.socialService.acceptFriendRequest(user.id, dto.senderId);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get list of current accepted friends' })
  @ApiResponse({ status: 200, description: 'Returned list of friends profiles.' })
  async getFriends(@CurrentUser() user: User) {
    return this.socialService.getFriends(user.id);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get activity feed showing friends completed challenges' })
  @ApiResponse({ status: 200, description: 'Returned chronological feed list.' })
  async getFeed(@CurrentUser() user: User) {
    return this.socialService.getSocialFeed(user.id);
  }

  @Post('react')
  @ApiOperation({ summary: 'React with an emoji to a target user\'s completion card' })
  @ApiResponse({ status: 201, description: 'Reaction successfully logged.' })
  async react(@CurrentUser() user: User, @Body() dto: ReactDto) {
    return this.socialService.reactToFriend(user.id, dto.targetUserId, dto.emoji);
  }

  @Post('comment')
  @ApiOperation({ summary: 'Add a text comment on a user completion card' })
  @ApiResponse({ status: 201, description: 'Comment successfully added.' })
  async addComment(
    @CurrentUser() user: User,
    @Body() dto: { userChallengeId: string; content: string }
  ) {
    return this.socialService.addComment(user.id, dto.userChallengeId, dto.content);
  }

  @Get('search')
  @ApiOperation({ summary: 'Global discovery search across users and squads' })
  @ApiResponse({ status: 200, description: 'Returned matching users and squads.' })
  async search(@Query('q') query: string) {
    return this.socialService.searchGlobal(query);
  }
}
