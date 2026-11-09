import { Global, Module } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService, EmailTemplatesService],
  exports: [MailService, EmailTemplatesService],
})
export class MailModule {}
