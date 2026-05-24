import { IsEmail, IsString, MinLength, IsIn, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@dayzo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'superpassword' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class CreateAdminDto {
  @ApiProperty({ example: 'moderator@dayzo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'mod_user' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'modpass123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'MODERATOR' })
  @IsString()
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT_AGENT', 'CONTENT_MANAGER'])
  role!: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false, example: 'new_username' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false, example: 'New Bio details' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ required: false, example: 100 })
  @IsNumber()
  @IsOptional()
  xp?: number;

  @ApiProperty({ required: false, example: 5 })
  @IsNumber()
  @IsOptional()
  level?: number;

  @ApiProperty({ required: false, example: 10 })
  @IsNumber()
  @IsOptional()
  streak?: number;

  @ApiProperty({ required: false, example: 2 })
  @IsNumber()
  @IsOptional()
  streakFreezes?: number;
}
