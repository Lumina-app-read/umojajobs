import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/** Administration des catégories d'offres et des pays. */
@Module({ controllers: [CatalogController], providers: [CatalogService] })
export class CatalogModule {}
