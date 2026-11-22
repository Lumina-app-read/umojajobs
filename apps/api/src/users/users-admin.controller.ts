import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminRolesResponse,
  type AdminUserDetail,
  PERMISSIONS,
  REGISTRY_MAX_PAGE,
  STAFF_ROLES,
  type StaffRole,
  USER_ADMIN_LIMITS,
  USER_FILTERS,
  type UserFilter,
  type UserRegistryResponse,
  type UserRoleInput,
  type UserStatusInput,
} from '@opportinities/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, RequirePermissions } from '../security/decorators';
import { UsersAdminService } from './users-admin.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const ACTION_LIMIT = { default: { limit: 20, ttl: 60_000 } };

class UserListQueryDto {
  @ApiPropertyOptional({ description: 'Nom ou adresse email.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: USER_FILTERS })
  @IsOptional()
  @IsIn(USER_FILTERS)
  status?: UserFilter;

  @ApiPropertyOptional({ minimum: 1, maximum: REGISTRY_MAX_PAGE, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REGISTRY_MAX_PAGE)
  page = 1;
}

class UserIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

class UserStatusDto implements UserStatusInput {
  @ApiProperty({ minLength: USER_ADMIN_LIMITS.reasonMin, maxLength: USER_ADMIN_LIMITS.reasonMax })
  @Transform(trim)
  @IsString()
  @Length(USER_ADMIN_LIMITS.reasonMin, USER_ADMIN_LIMITS.reasonMax)
  reason!: string;
}

class UserRoleDto extends UserStatusDto implements UserRoleInput {
  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES)
  role!: StaffRole;

  @ApiProperty({ description: 'Vrai pour attribuer, faux pour retirer.' })
  @IsBoolean()
  granted!: boolean;
}

/** Comptes utilisateurs : consultation, suspension, réactivation et rôles. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_READ)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  @ApiOkResponse({ description: 'Comptes, du plus récent au plus ancien, et totaux.' })
  list(@Query() query: UserListQueryDto): Promise<UserRegistryResponse> {
    return this.users.list(query, query.status);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Fiche d’un compte, historique et actions permises.' })
  get(@CurrentAuth() auth: AuthContext, @Param() params: UserIdDto): Promise<AdminUserDetail> {
    return this.users.get(auth, params.id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Throttle(ACTION_LIMIT)
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_MANAGE)
  @ApiOkResponse({ description: 'Compte suspendu, sessions fermées.' })
  suspend(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdDto,
    @Body() body: UserStatusDto,
    @Req() req: AppRequest,
  ): Promise<AdminUserDetail> {
    return this.users.setStatus(auth, params.id, 'suspended', body.reason, getClientInfo(req));
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Throttle(ACTION_LIMIT)
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_MANAGE)
  @ApiOkResponse({ description: 'Compte réactivé.' })
  reactivate(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdDto,
    @Body() body: UserStatusDto,
    @Req() req: AppRequest,
  ): Promise<AdminUserDetail> {
    return this.users.setStatus(auth, params.id, 'active', body.reason, getClientInfo(req));
  }

  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  @Throttle(ACTION_LIMIT)
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ROLES_MANAGE)
  @ApiOkResponse({ description: 'Rôle attribué ou retiré, sessions du compte fermées.' })
  setRole(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UserIdDto,
    @Body() body: UserRoleDto,
    @Req() req: AppRequest,
  ): Promise<AdminUserDetail> {
    return this.users.setRole(auth, params.id, body, getClientInfo(req));
  }
}

/** Rôles et permissions en vigueur. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ROLES_MANAGE)
@Controller('admin/roles')
export class RolesAdminController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  @ApiOkResponse({ description: 'Permissions de chaque rôle et membres de l’équipe.' })
  roles(): Promise<AdminRolesResponse> {
    return this.users.roles();
  }
}
