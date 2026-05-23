import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';

class UpdateProfileDto {
  @ApiProperty({ example: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=monk', required: false })
  avatar?: string;

  @ApiProperty({ example: 'new_username', required: false })
  username?: string;
}

@ApiTags('Users Profiles')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get details of the currently logged-in user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully.' })
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update avatar image or username settings' })
  @ApiResponse({ status: 200, description: 'Successfully updated user profile settings.' })
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
}
