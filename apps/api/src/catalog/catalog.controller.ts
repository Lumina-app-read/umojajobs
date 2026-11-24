import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  type AdminCatalogResponse,
  CATALOG_LIMITS,
  type CategoryInput,
  type CategoryOrderInput,
  type CategoryUpdateInput,
  type CountryUpdateInput,
  PERMISSIONS,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, RequirePermissions } from '../security/decorators';
import { CatalogService } from './catalog.service';

const clean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

class CategoryDto implements CategoryInput {
  @ApiProperty({ example: 'Comptabilité et finance' })
  @Transform(clean)
  @IsString()
  @Length(CATALOG_LIMITS.nameMin, CATALOG_LIMITS.nameMax)
  nameFr!: string;

  @ApiProperty({ example: 'Accounting and finance' })
  @Transform(clean)
  @IsString()
  @Length(CATALOG_LIMITS.nameMin, CATALOG_LIMITS.nameMax)
  nameEn!: string;
}

class CategoryUpdateDto implements CategoryUpdateInput {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(clean)
  @IsString()
  @Length(CATALOG_LIMITS.nameMin, CATALOG_LIMITS.nameMax)
  nameFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(clean)
  @IsString()
  @Length(CATALOG_LIMITS.nameMin, CATALOG_LIMITS.nameMax)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CategoryOrderDto implements CategoryOrderInput {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(CATALOG_LIMITS.categoriesMax)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

class CountryUpdateDto implements CountryUpdateInput {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

class CategoryIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

class CountryIso2Dto {
  @ApiProperty({ example: 'SN' })
  @Matches(/^[A-Z]{2}$/)
  iso2!: string;
}

/** Catégories d'offres et pays proposés par la plateforme. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SETTINGS_MANAGE)
@Controller('admin/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ description: 'Catégories et pays, actifs ou non, avec leur utilisation.' })
  get(): Promise<AdminCatalogResponse> {
    return this.catalog.get();
  }

  @Post('categories')
  @HttpCode(HttpStatus.OK)
  createCategory(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CategoryDto,
    @Req() req: AppRequest,
  ): Promise<AdminCatalogResponse> {
    return this.catalog.createCategory(
      auth,
      { nameFr: body.nameFr, nameEn: body.nameEn },
      getClientInfo(req),
    );
  }

  @Put('categories/order')
  orderCategories(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CategoryOrderDto,
    @Req() req: AppRequest,
  ): Promise<AdminCatalogResponse> {
    return this.catalog.orderCategories(auth, body.ids, getClientInfo(req));
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentAuth() auth: AuthContext,
    @Param() params: CategoryIdDto,
    @Body() body: CategoryUpdateDto,
    @Req() req: AppRequest,
  ): Promise<AdminCatalogResponse> {
    return this.catalog.updateCategory(auth, params.id, body, getClientInfo(req));
  }

  @Patch('countries/:iso2')
  updateCountry(
    @CurrentAuth() auth: AuthContext,
    @Param() params: CountryIso2Dto,
    @Body() body: CountryUpdateDto,
    @Req() req: AppRequest,
  ): Promise<AdminCatalogResponse> {
    return this.catalog.setCountryActive(auth, params.iso2, body.isActive, getClientInfo(req));
  }
}
