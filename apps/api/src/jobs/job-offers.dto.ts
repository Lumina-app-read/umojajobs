import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AFRICAN_COUNTRIES,
  CONTRACT_TYPES,
  type ContractType,
  EDUCATION_LEVELS,
  type EducationLevel,
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
  JOB_LIMITS,
  JOB_OFFER_STATUSES,
  JOB_SOURCE_TYPES,
  type JobOfferInput,
  type JobOfferStatus,
  type JobOfferSubmitRequest,
  type JobOfferUpdateRequest,
  type JobSourceType,
  type ModerationDecisionRequest,
  SALARY_PERIODS,
  type SalaryPeriod,
  SUPPORTED_LOCALES,
  WORK_MODES,
  type WorkMode,
} from '@opportinities/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Texte saisi : espaces de début et de fin retirés ; une chaîne vide équivaut à « non renseigné ». */
const clean = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() || null : value;

/** Compétences : nettoyées, sans doublon (casse ignorée), vides retirées. */
const cleanSkills = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  return (value as unknown[])
    .map((skill) => (typeof skill === 'string' ? skill.trim() : skill))
    .filter((skill) => {
      if (typeof skill !== 'string') return true;
      const key = skill.toLowerCase();
      if (skill === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/** Le champ peut être absent (inchangé) ou null (effacé) ; sinon il est validé. */
const present = (_: object, value: unknown): boolean => value !== null && value !== undefined;

const AFRICAN_ISO2 = AFRICAN_COUNTRIES.map((country) => country.iso2);
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class JobOfferInputDto implements JobOfferInput {
  @ApiPropertyOptional({ maxLength: JOB_LIMITS.titleMax, example: 'Comptable confirmé' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @Length(2, JOB_LIMITS.titleMax)
  title?: string | null;

  @ApiPropertyOptional({ maxLength: JOB_LIMITS.companyMax })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @Length(2, JOB_LIMITS.companyMax)
  companyName?: string | null;

  @ApiPropertyOptional({ example: 'SN' })
  @IsOptional()
  @Transform(upper)
  @ValidateIf(present)
  @IsIn(AFRICAN_ISO2)
  countryIso2?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @ValidateIf(present)
  @IsUUID()
  cityId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @ValidateIf(present)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ enum: CONTRACT_TYPES })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(CONTRACT_TYPES)
  contractType?: ContractType | null;

  @ApiPropertyOptional({ enum: WORK_MODES })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(WORK_MODES)
  workMode?: WorkMode | null;

  @ApiPropertyOptional({ enum: EDUCATION_LEVELS })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(EDUCATION_LEVELS)
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({ enum: EXPERIENCE_LEVELS })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(EXPERIENCE_LEVELS)
  experienceLevel?: ExperienceLevel | null;

  @ApiPropertyOptional({ minimum: 0, example: 350000 })
  @IsOptional()
  @ValidateIf(present)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999_999_999_999)
  salaryMin?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @ValidateIf(present)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(999_999_999_999)
  salaryMax?: number | null;

  @ApiPropertyOptional({ example: 'XOF', description: 'Code ISO 4217.' })
  @IsOptional()
  @Transform(upper)
  @ValidateIf(present)
  @Matches(/^[A-Z]{3}$/)
  salaryCurrency?: string | null;

  @ApiPropertyOptional({ enum: SALARY_PERIODS })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(SALARY_PERIODS)
  salaryPeriod?: SalaryPeriod | null;

  @ApiPropertyOptional({ maxLength: JOB_LIMITS.descriptionMax })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @MaxLength(JOB_LIMITS.descriptionMax)
  description?: string | null;

  @ApiPropertyOptional({ maxLength: JOB_LIMITS.requirementsMax })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @MaxLength(JOB_LIMITS.requirementsMax)
  requirements?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: JOB_LIMITS.skillsMax })
  @IsOptional()
  @Transform(cleanSkills)
  @IsArray()
  @ArrayMaxSize(JOB_LIMITS.skillsMax)
  @IsString({ each: true })
  @MaxLength(JOB_LIMITS.skillMax, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(SUPPORTED_LOCALES)
  contentLanguage?: 'fr' | 'en' | null;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @ValidateIf(present)
  @Matches(DATE_ONLY)
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-12-15' })
  @IsOptional()
  @ValidateIf(present)
  @Matches(DATE_ONLY)
  endDate?: string | null;

  @ApiPropertyOptional({ enum: JOB_SOURCE_TYPES })
  @IsOptional()
  @ValidateIf(present)
  @IsIn(JOB_SOURCE_TYPES)
  sourceType?: JobSourceType | null;

  @ApiPropertyOptional({ example: 'https://entreprise.example/carrieres/123' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsUrl(URL_OPTIONS)
  @MaxLength(JOB_LIMITS.urlMax)
  sourceUrl?: string | null;

  @ApiPropertyOptional({ description: 'Précision sur la source (nom du journal, du groupe…).' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @MaxLength(JOB_LIMITS.sourceDetailsMax)
  sourceDetails?: string | null;

  @ApiPropertyOptional({ description: 'Privé : révélé après déverrouillage.' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @MaxLength(JOB_LIMITS.instructionsMax)
  applicationInstructions?: string | null;

  @ApiPropertyOptional({ description: 'Privé : révélé après déverrouillage.' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsEmail()
  @MaxLength(254)
  applicationEmail?: string | null;

  @ApiPropertyOptional({ description: 'Privé : révélé après déverrouillage.' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsUrl(URL_OPTIONS)
  @MaxLength(JOB_LIMITS.urlMax)
  applicationUrl?: string | null;

  @ApiPropertyOptional({ description: 'Privé : révélé après déverrouillage.' })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @MaxLength(JOB_LIMITS.addressMax)
  applicationAddress?: string | null;
}

export class JobOfferUpdateDto extends JobOfferInputDto implements JobOfferUpdateRequest {
  @ApiProperty({
    minimum: 1,
    description: 'Version lue (détection des modifications concurrentes).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class JobOfferSubmitDto implements JobOfferSubmitRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty({ description: 'Exactitude des informations et droit de les partager.' })
  @Equals(true)
  declarationAccepted!: boolean;
}

export class ModerationDecisionDto implements ModerationDecisionRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ minLength: JOB_LIMITS.reasonMin, maxLength: JOB_LIMITS.reasonMax })
  @IsOptional()
  @Transform(clean)
  @ValidateIf(present)
  @IsString()
  @Length(JOB_LIMITS.reasonMin, JOB_LIMITS.reasonMax)
  reason?: string;
}

export class JobOfferIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ enum: JOB_OFFER_STATUSES, default: 'pending_review' })
  @IsOptional()
  @IsIn(JOB_OFFER_STATUSES)
  status?: JobOfferStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Pagination : dernier élément reçu.' })
  @IsOptional()
  @IsUUID()
  after?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
