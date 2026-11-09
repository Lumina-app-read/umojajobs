import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CityDto, CitySearchQueryDto, CountryDto, CountryIso2ParamDto } from './locations.dto';
import { Public } from '../security/decorators';
import { LocationsService } from './locations.service';

/** Référentiel public des pays et des villes (sélecteurs recherchables de l'interface). */
@ApiTags('locations')
@Public()
@Controller('countries')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOkResponse({ type: CountryDto, isArray: true })
  listCountries(): Promise<CountryDto[]> {
    return this.locations.listCountries();
  }

  @Get(':iso2/cities')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ type: CityDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Pays inconnu ou inactif (code COUNTRY_NOT_FOUND).' })
  searchCities(
    @Param() params: CountryIso2ParamDto,
    @Query() query: CitySearchQueryDto,
  ): Promise<CityDto[]> {
    return this.locations.searchCities(params.iso2, query.q, query.limit);
  }
}
