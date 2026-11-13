import { Module } from '@nestjs/common';
import { AI_PROVIDER } from './ai-provider';
import { OpenAiProvider } from './openai.provider';

/** Accès à l'IA derrière une interface unique (fournisseur actuel : OpenAI). */
@Module({
  providers: [{ provide: AI_PROVIDER, useClass: OpenAiProvider }],
  exports: [AI_PROVIDER],
})
export class AiModule {}
