import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type JobSearchResponse,
  type PlaceCityResponse,
  type SitemapResponse,
  type PublicJobOfferDetail,
  type SavedJobResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth, Public } from '../security/decorators';
import {
  JobOfferRefParamDto,
  JobOfferSlugParamDto,
  JobSearchQueryDto,
  PageQueryDto,
  PlaceCityParamDto,
} from './job-offers.dto';
import { JobSearchService } from './job-search.service';

/** Consultation publique des offres : recherche, archives et fiche détaillée. */
@ApiTags('job-offers')
@Public()
@Controller('job-offers')
export class PublicJobOffersController {
  constructor(private readonly search: JobSearchService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ description: 'Offres actives (validées, non expirées), filtrées et paginées.' })
  list(@Query() query: JobSearchQueryDto): Promise<JobSearchResponse> {
    return this.search.search(query);
  }

  @Get('archives')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'Offres expirées, conservées en archives.' })
  archives(@Query() query: PageQueryDto): Promise<JobSearchResponse> {
    return this.search.archives(query.page);
  }

  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=600')
  @ApiOkResponse({
    description: 'Offres actives et lieux ou catégories qui en ont (plan du site).',
  })
  sitemap(): Promise<SitemapResponse> {
    return this.search.sitemap();
  }

  @Get('places/:iso2/cities/:city')
  @Header('Cache-Control', 'public, max-age=600')
  @ApiOkResponse({ description: 'Ville désignée par son adresse publique.' })
  placeCity(@Param() params: PlaceCityParamDto): Promise<PlaceCityResponse> {
    return this.search.placeCity(params.iso2, params.city);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ description: 'Fiche publique (sans coordonnées de candidature ni document).' })
  detail(@Param() params: JobOfferSlugParamDto): Promise<PublicJobOfferDetail> {
    return this.search.detail(params.slug);
  }
}

/** Offres enregistrées par l'utilisateur connecté. */
@ApiTags('job-offers')
@Controller('me/saved-jobs')
export class SavedJobsController {
  constructor(private readonly search: JobSearchService) {}

  @Get()
  @ApiOkResponse({ description: 'Offres enregistrées, les plus récentes d’abord.' })
  list(@CurrentAuth() auth: AuthContext): Promise<SavedJobResponse[]> {
    return this.search.listSaved(auth);
  }

  @Put(':jobOfferId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Offre enregistrée (sans effet si elle l’est déjà).' })
  async save(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferRefParamDto,
  ): Promise<void> {
    await this.search.save(auth, params.jobOfferId);
  }

  @Delete(':jobOfferId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Offre retirée des enregistrements.' })
  async unsave(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferRefParamDto,
  ): Promise<void> {
    await this.search.unsave(auth, params.jobOfferId);
  }
}
