/** Données publiques pour le plan du site et les pages par lieu ou par catégorie. */
export interface SitemapResponse {
  /** Offres actives, de la plus récente à la plus ancienne. */
  offers: { slug: string; updatedAt: string }[];
  /** Pays, catégories et villes ayant au moins une offre active. */
  countries: { iso2: string; count: number }[];
  categories: { slug: string; count: number }[];
  cities: { countryIso2: string; slug: string; name: string; count: number }[];
}

export interface PlaceCityResponse {
  id: string;
  name: string;
  slug: string;
  countryIso2: string;
}

/** Identifiant d'adresse d'une ville : son nom normalisé (minuscules, sans accents, tirets). */
export function citySlug(searchName: string): string {
  return searchName.trim().replace(/\s+/g, '-');
}

export const SITEMAP_MAX_OFFERS = 40_000;
