import { Controller, Post, Body, Get, UseGuards, Req, Ip, Headers } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { AdminLoginDto, CreateAdminDto } from '../dto/admin.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';

@ApiTags('Admin Panel - Authentication')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Login admin dashboard user profile and issue JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid login credentials' })
  async login(
    @Body() dto: AdminLoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const response = await this.adminService.login(dto);
    
    // Log the successful administration login event
    await this.auditService.logAction(
      response.user.id,
      'ADMIN_LOGIN',
      'AdminUser',
      response.user.id,
      null,
      { email: response.user.email, ipAddress },
      ipAddress,
      userAgent,
    );

    return response;
  }

  @Get('auth/me')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current administrative profile details and permissions scopes' })
  async getMe(@Req() req: any) {
    return this.adminService.getAdminProfile(req.user.id);
  }

  @Post('auth/sub-admins')
  @UseGuards(AdminJwtAuthGuard, RbacGuard)
  @RequirePermissions('settings:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new administrative staff sub-account (SUPER_ADMIN / settings:write scope only)' })
  async createSubAdmin(
    @Body() dto: CreateAdminDto,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const newAdmin = await this.adminService.createAdmin(dto, req.user.id);
    
    await this.auditService.logAction(
      req.user.id,
      'SUB_ADMIN_CREATE',
      'AdminUser',
      newAdmin.id,
      null,
      { email: dto.email, username: dto.username, role: dto.role },
      ipAddress,
      userAgent,
    );

    return newAdmin;
  }
}
