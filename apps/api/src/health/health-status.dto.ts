import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';
}
