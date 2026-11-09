import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const CITY_SEARCH_DEFAULT_LIMIT = 20;
export const CITY_SEARCH_MAX_LIMIT = 50;

export class CountryIso2ParamDto {
  @ApiProperty({ example: 'CD', description: 'Code ISO 3166-1 alpha-2 (insensible à la casse).' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/)
  iso2!: string;
}

export class CitySearchQueryDto {
  @ApiPropertyOptional({
    example: 'lubum',
    description: 'Texte recherché (accents et casse ignorés). Vide : villes les plus peuplées.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    default: CITY_SEARCH_DEFAULT_LIMIT,
    minimum: 1,
    maximum: CITY_SEARCH_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CITY_SEARCH_MAX_LIMIT)
  limit?: number;
}

export class CountryDto {
  @ApiProperty({ example: 'CD' }) iso2!: string;
  @ApiProperty({ example: 'COD' }) iso3!: string;
  @ApiProperty({ example: 'République démocratique du Congo' }) nameFr!: string;
  @ApiProperty({ example: 'Democratic Republic of the Congo' }) nameEn!: string;
  @ApiProperty() officialNameFr!: string;
  @ApiProperty() officialNameEn!: string;
  @ApiProperty({ example: '+243' }) dialCode!: string;
  @ApiProperty({ example: '🇨🇩' }) flagEmoji!: string;
  @ApiProperty({ example: 'CDF' }) currencyCode!: string;
  @ApiProperty({ example: 'Africa/Kinshasa' }) defaultTimezone!: string;
}

export class CityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Lubumbashi' }) name!: string;
  @ApiProperty({ example: 'Haut-Katanga', nullable: true, type: String })
  regionName!: string | null;
  @ApiProperty({ example: 2221925 }) population!: number;
  @ApiProperty({ example: 'Africa/Lubumbashi' }) timezone!: string;
}
