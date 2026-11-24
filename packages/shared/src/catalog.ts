export const CATALOG_LIMITS = { nameMin: 2, nameMax: 120, categoriesMax: 100 } as const;

export interface AdminCategory {
  id: string;
  /** Identifiant d'adresse, fixé à la création : les liens publics ne changent jamais. */
  slug: string;
  nameFr: string;
  nameEn: string;
  isActive: boolean;
  /** Offres rattachées, tous états confondus. */
  offers: number;
}

export interface AdminCountry {
  iso2: string;
  nameFr: string;
  nameEn: string;
  flagEmoji: string;
  dialCode: string;
  currencyCode: string;
  isActive: boolean;
  users: number;
  offers: number;
}

export interface AdminCatalogResponse {
  categories: AdminCategory[];
  countries: AdminCountry[];
}

export interface CategoryInput {
  nameFr: string;
  nameEn: string;
}

export interface CategoryUpdateInput extends Partial<CategoryInput> {
  isActive?: boolean;
}

export interface CategoryOrderInput {
  /** Identifiants de toutes les catégories, dans le nouvel ordre. */
  ids: string[];
}

export interface CountryUpdateInput {
  isActive: boolean;
}
