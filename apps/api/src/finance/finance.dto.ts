import { ApiProperty } from '@nestjs/swagger';
import {
  CREDIT_SERVICES,
  type CreditGrantInput,
  type CreditService,
  FINANCE_LIMITS,
  FINANCIAL_SETTING_KEYS,
  type FinancialSettingInput,
  type FinancialSettingKey,
  type ServiceCostInput,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Valeur d'un paramètre : décimal en chaîne, la validation métier dépend de son unité. */
export class FinancialSettingInputDto implements FinancialSettingInput {
  @ApiProperty({ example: '0.10' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{1,14}(\.\d{1,6})?$/)
  value!: string;

  @ApiProperty({ minLength: FINANCE_LIMITS.reasonMin, maxLength: FINANCE_LIMITS.reasonMax })
  @Transform(trim)
  @IsString()
  @Length(FINANCE_LIMITS.reasonMin, FINANCE_LIMITS.reasonMax)
  reason!: string;
}

export class FinancialSettingKeyParamDto {
  @ApiProperty({ enum: FINANCIAL_SETTING_KEYS })
  @IsIn(FINANCIAL_SETTING_KEYS)
  key!: FinancialSettingKey;
}

export class ServiceCostInputDto implements ServiceCostInput {
  @ApiProperty({ minimum: 1, maximum: FINANCE_LIMITS.grantMaxCredits })
  @IsInt()
  @Min(1)
  @Max(FINANCE_LIMITS.grantMaxCredits)
  credits!: number;

  @ApiProperty({ minLength: FINANCE_LIMITS.reasonMin, maxLength: FINANCE_LIMITS.reasonMax })
  @Transform(trim)
  @IsString()
  @Length(FINANCE_LIMITS.reasonMin, FINANCE_LIMITS.reasonMax)
  reason!: string;
}

export class ServiceParamDto {
  @ApiProperty({ enum: CREDIT_SERVICES })
  @IsIn(CREDIT_SERVICES)
  service!: CreditService;
}

export class CreditGrantInputDto implements CreditGrantInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ minimum: 1, maximum: FINANCE_LIMITS.grantMaxCredits })
  @IsInt()
  @Min(1)
  @Max(FINANCE_LIMITS.grantMaxCredits)
  credits!: number;

  @ApiProperty({ minLength: FINANCE_LIMITS.reasonMin, maxLength: FINANCE_LIMITS.reasonMax })
  @Transform(trim)
  @IsString()
  @Length(FINANCE_LIMITS.reasonMin, FINANCE_LIMITS.reasonMax)
  reason!: string;
}
