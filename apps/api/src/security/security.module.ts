import { Global, Module } from '@nestjs/common';
import { CookiesService } from './cookies.service';
import { CsrfGuard } from './csrf.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({
  providers: [CookiesService, CsrfGuard, RedisThrottlerStorage],
  exports: [CookiesService, CsrfGuard, RedisThrottlerStorage],
})
export class SecurityModule {}
