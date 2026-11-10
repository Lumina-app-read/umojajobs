import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Stockage objet privé, disponible dans toute l'application. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
