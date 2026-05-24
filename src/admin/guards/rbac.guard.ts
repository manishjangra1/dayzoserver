import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.role || !user.role.permissions) {
      throw new ForbiddenException('Access denied: Insufficient administrative privileges');
    }

    // Super Admin has bypass access to all features
    if (user.role.name === 'SUPER_ADMIN') {
      return true;
    }

    const userPermissions = user.role.permissions.map((p: any) => p.name);
    const hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      throw new ForbiddenException(`Access denied: You do not possess the required permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
