import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';
}

export class ReadinessStatusDto extends HealthStatusDto {
  @ApiProperty({ example: 'up', enum: ['up'] })
  database!: 'up';
}
