'use client';

import { Search } from 'lucide-react';
import { FormField } from '@/components/ui/form-field';

/** Champ de recherche d'un registre (composant client : l'icône ne traverse pas le serveur). */
export function RegistrySearchField({
  label,
  placeholder,
  defaultValue,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <FormField
      // Une nouvelle adresse (filtre, effacement) réinitialise le champ.
      key={defaultValue}
      label={label}
      name="q"
      type="search"
      icon={Search}
      placeholder={placeholder}
      defaultValue={defaultValue}
      maxLength={120}
      className="sm:w-96"
    />
  );
}
