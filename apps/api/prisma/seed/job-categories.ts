import { type PrismaClient } from '../../src/generated/prisma/client';

/**
 * Catégories professionnelles initiales. Administrables ensuite : le seed met à jour les noms
 * et l'ordre, mais ne réactive jamais une catégorie désactivée par l'administration.
 */
export const JOB_CATEGORIES: { slug: string; nameFr: string; nameEn: string }[] = [
  {
    slug: 'administration',
    nameFr: 'Administration et secrétariat',
    nameEn: 'Administration and office support',
  },
  {
    slug: 'accounting-finance',
    nameFr: 'Comptabilité, audit et finance',
    nameEn: 'Accounting, audit and finance',
  },
  { slug: 'banking-insurance', nameFr: 'Banque et assurance', nameEn: 'Banking and insurance' },
  { slug: 'sales', nameFr: 'Commerce et vente', nameEn: 'Sales and business development' },
  {
    slug: 'marketing-communication',
    nameFr: 'Marketing et communication',
    nameEn: 'Marketing and communication',
  },
  { slug: 'it-telecom', nameFr: 'Informatique et télécoms', nameEn: 'IT and telecommunications' },
  {
    slug: 'engineering-construction',
    nameFr: 'Ingénierie, BTP et architecture',
    nameEn: 'Engineering, construction and architecture',
  },
  {
    slug: 'industry-production',
    nameFr: 'Industrie, production et maintenance',
    nameEn: 'Industry, production and maintenance',
  },
  { slug: 'energy-mining', nameFr: 'Énergie, mines et pétrole', nameEn: 'Energy, mining and oil' },
  {
    slug: 'logistics-transport',
    nameFr: 'Logistique et transport',
    nameEn: 'Logistics and transport',
  },
  {
    slug: 'agriculture-environment',
    nameFr: 'Agriculture et environnement',
    nameEn: 'Agriculture and environment',
  },
  { slug: 'health', nameFr: 'Santé et médical', nameEn: 'Health and medical' },
  {
    slug: 'education-training',
    nameFr: 'Éducation et formation',
    nameEn: 'Education and training',
  },
  { slug: 'human-resources', nameFr: 'Ressources humaines', nameEn: 'Human resources' },
  { slug: 'legal', nameFr: 'Juridique', nameEn: 'Legal' },
  {
    slug: 'ngo-development',
    nameFr: 'ONG, humanitaire et développement',
    nameEn: 'NGOs, humanitarian and development',
  },
  { slug: 'public-sector', nameFr: 'Administration publique', nameEn: 'Public sector' },
  {
    slug: 'hospitality-tourism',
    nameFr: 'Hôtellerie, restauration et tourisme',
    nameEn: 'Hospitality and tourism',
  },
  { slug: 'media-arts', nameFr: 'Médias, arts et culture', nameEn: 'Media, arts and culture' },
  { slug: 'security', nameFr: 'Sécurité et gardiennage', nameEn: 'Security services' },
  { slug: 'other', nameFr: 'Autre', nameEn: 'Other' },
];

export async function seedJobCategories(prisma: PrismaClient): Promise<number> {
  for (const [index, category] of JOB_CATEGORIES.entries()) {
    const data = { nameFr: category.nameFr, nameEn: category.nameEn, sortOrder: index * 10 };
    await prisma.jobCategory.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, ...data },
      update: data,
    });
  }
  return JOB_CATEGORIES.length;
}
