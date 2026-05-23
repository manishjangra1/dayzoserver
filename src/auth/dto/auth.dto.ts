import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'genz_streak_king', description: 'Unique username for Dayzo profile' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'password123', description: 'Minimum 6 character secure password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address or username' })
  @IsString()
  @IsNotEmpty()
  emailOrUsername!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
