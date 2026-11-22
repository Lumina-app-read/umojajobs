import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesAdminController, UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

/** Administration des comptes utilisateurs et des rôles. */
@Module({
  imports: [AuthModule],
  controllers: [UsersAdminController, RolesAdminController],
  providers: [UsersAdminService],
})
export class UsersModule {}
