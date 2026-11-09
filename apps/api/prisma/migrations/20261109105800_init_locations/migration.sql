-- Phase 1b : référentiel des pays et des villes.
-- Extension pour la recherche approximative des villes (index trigramme).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "city_source" AS ENUM ('geonames', 'admin');

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3) NOT NULL,
    "name_fr" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "official_name_fr" VARCHAR(150) NOT NULL,
    "official_name_en" VARCHAR(150) NOT NULL,
    "dial_code" VARCHAR(6) NOT NULL,
    "flag_emoji" VARCHAR(16) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "default_timezone" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "geonames_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "ascii_name" VARCHAR(200) NOT NULL,
    "search_name" VARCHAR(200) NOT NULL,
    "region_name" VARCHAR(200),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "population" INTEGER NOT NULL DEFAULT 0,
    "timezone" VARCHAR(64) NOT NULL,
    "feature_code" VARCHAR(10),
    "source" "city_source" NOT NULL DEFAULT 'geonames',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE UNIQUE INDEX "cities_geonames_id_key" ON "cities"("geonames_id");

-- CreateIndex
CREATE INDEX "cities_country_id_population_idx" ON "cities"("country_id", "population" DESC);

-- CreateIndex
CREATE INDEX "cities_search_name_trgm_idx" ON "cities" USING GIN ("search_name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes d'intégrité complémentaires (non modélisées par Prisma).
ALTER TABLE "countries"
  ADD CONSTRAINT "countries_iso2_format_chk" CHECK ("iso2" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "countries_iso3_format_chk" CHECK ("iso3" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "countries_dial_code_format_chk" CHECK ("dial_code" ~ '^\+[1-9][0-9]{0,3}$'),
  ADD CONSTRAINT "countries_currency_code_format_chk" CHECK ("currency_code" ~ '^[A-Z]{3}$');

ALTER TABLE "cities"
  ADD CONSTRAINT "cities_population_chk" CHECK ("population" >= 0),
  ADD CONSTRAINT "cities_latitude_chk" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "cities_longitude_chk" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "cities_source_geonames_id_chk" CHECK (("source" = 'geonames') = ("geonames_id" IS NOT NULL)),
  ADD CONSTRAINT "cities_search_name_not_blank_chk" CHECK (length(btrim("search_name")) > 0);
