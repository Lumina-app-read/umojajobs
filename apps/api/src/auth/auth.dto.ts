import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type AcceptedResponse,
  AFRICAN_COUNTRIES,
  type ChangePasswordRequest,
  type CsrfTokenResponse,
  type EmailRequest,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type MfaVerifyRequest,
  type RecoveryCodesResponse,
  type RegisterRequest,
  type ResetPasswordRequest,
  type TokenRequest,
  type TotpCodeRequest,
  type TotpSetupResponse,
  EMAIL_MAX_LENGTH,
  type MfaState,
  MFA_STATES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  SUPPORTED_LOCALES,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const toUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Lettres (toutes langues), espaces, apostrophes, traits d'union et points. Pas de caractères de contrôle. */
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

const AFRICAN_ISO2 = AFRICAN_COUNTRIES.map((country) => country.iso2);

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'Awa' })
  @Transform(trim)
  @IsString()
  @Length(1, PERSON_NAME_MAX_LENGTH)
  @Matches(PERSON_NAME)
  firstName!: string;

  @ApiProperty({ example: 'Diallo' })
  @Transform(trim)
  @IsString()
  @Length(1, PERSON_NAME_MAX_LENGTH)
  @Matches(PERSON_NAME)
  lastName!: string;

  @ApiProperty({ example: 'awa.diallo@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({ example: 'SN', description: "Pays de résidence (l'un des 54 pays africains)." })
  @Transform(toUpper)
  @IsIn(AFRICAN_ISO2)
  countryIso2!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty()
  @IsString()
  passwordConfirmation!: string;

  @ApiProperty({
    description: "Acceptation des conditions d'utilisation et de la politique de confidentialité.",
  })
  @Equals(true)
  acceptTerms!: boolean;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'fr' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: 'fr' | 'en';
}

export class EmailDto implements EmailRequest {
  @ApiProperty({ example: 'awa.diallo@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;
}

export class LoginDto extends EmailDto implements LoginRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class TokenDto implements TokenRequest {
  @ApiProperty({ description: 'Jeton reçu par email.' })
  @IsString()
  @Length(20, 200)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;
}

export class ResetPasswordDto extends TokenDto implements ResetPasswordRequest {
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty()
  @IsString()
  passwordConfirmation!: string;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;

  @ApiProperty()
  @IsString()
  newPasswordConfirmation!: string;
}

export class TotpCodeDto implements TotpCodeRequest {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class MfaVerifyDto implements MfaVerifyRequest {
  @ApiPropertyOptional({ example: '123456', description: 'Code TOTP à 6 chiffres.' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  code?: string;

  @ApiPropertyOptional({ description: 'Code de secours, si le téléphone est indisponible.' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/)
  recoveryCode?: string;
}

// --- Réponses -------------------------------------------------------------

export class AcceptedDto implements AcceptedResponse {
  @ApiProperty({ example: 'accepted', enum: ['accepted'] })
  status!: 'accepted';
}

export class CsrfTokenDto implements CsrfTokenResponse {
  @ApiProperty()
  csrfToken!: string;
}

export class MeDto implements MeResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ example: 'SN' }) countryIso2!: string;
  @ApiProperty({ enum: SUPPORTED_LOCALES }) locale!: 'fr' | 'en';
  @ApiProperty({ enum: ['light', 'dark', 'system'] }) theme!: 'light' | 'dark' | 'system';
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty({ enum: MFA_STATES }) mfaState!: MfaState;
  @ApiProperty() totpEnabled!: boolean;
}

export class LoginResponseDto implements LoginResponse {
  @ApiProperty({ type: MeDto }) user!: MeDto;
  @ApiProperty({ description: 'Nouveau jeton CSRF (renouvelé à la connexion).' })
  csrfToken!: string;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() lastSeenAt!: Date;
  @ApiProperty({ nullable: true, type: String }) ip!: string | null;
  @ApiProperty({ nullable: true, type: String }) userAgent!: string | null;
  @ApiProperty() current!: boolean;
}

export class TotpSetupDto implements TotpSetupResponse {
  @ApiProperty({ description: 'Secret Base32 à saisir manuellement si le QR code est illisible.' })
  secret!: string;
  @ApiProperty({ description: 'URI otpauth:// à afficher sous forme de QR code.' })
  otpauthUri!: string;
}

export class RecoveryCodesDto implements RecoveryCodesResponse {
  @ApiProperty({ type: [String], description: 'Affichés une seule fois. À conserver en lieu sûr.' })
  recoveryCodes!: string[];
}
