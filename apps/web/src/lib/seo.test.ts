import { describe, expect, it } from 'vitest';
import { jsonLd, localizedAlternates } from './seo';

describe('référencement', () => {
  it('donne l’adresse canonique de la langue et toutes les versions linguistiques', () => {
    expect(localizedAlternates('en', '/jobs/category/health')).toEqual({
      canonical: '/en/jobs/category/health',
      languages: {
        fr: '/fr/jobs/category/health',
        en: '/en/jobs/category/health',
        'x-default': '/fr/jobs/category/health',
      },
    });
    expect(localizedAlternates('fr', '/').canonical).toBe('/fr');
  });

  it('les données structurées ne peuvent pas refermer la balise script', () => {
    const output = jsonLd({ title: '</script><script>alert(1)</script>' });
    expect(output).not.toContain('</script>');
    expect(JSON.parse(output)).toEqual({ title: '</script><script>alert(1)</script>' });
  });
});
