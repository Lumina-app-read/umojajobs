import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { AiModule } from '../ai/ai.module';
import { StudioAiService } from './studio-ai.service';
import { StudioService } from './studio.service';

/** Career Studio (phase 4) : documents professionnels de l'utilisateur. */
@Module({
  imports: [AiModule],
  controllers: [StudioController],
  providers: [StudioService, StudioAiService],
  exports: [StudioService],
})
export class StudioModule {}
