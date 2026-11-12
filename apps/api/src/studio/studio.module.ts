import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';

/** Career Studio (phase 4) : documents professionnels de l'utilisateur. */
@Module({
  controllers: [StudioController],
  providers: [StudioService],
  exports: [StudioService],
})
export class StudioModule {}
