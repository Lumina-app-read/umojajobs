import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type PermissionCode } from '@opportinities/shared';
import { type AppRequest } from '../../common/http/app-request';
import { REQUIRED_PERMISSIONS_KEY } from '../../security/decorators';

/** Vérifie les permissions exigées par @RequirePermissions (toutes requises). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const auth = context.switchToHttp().getRequest<AppRequest>().auth;
    if (!auth || !required.every((permission) => auth.permissions.has(permission))) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN });
    }
    return true;
  }
}
