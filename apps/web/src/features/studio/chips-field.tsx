'use client';

import { type LucideIcon, Plus, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';

/**
 * Liste de libellés courts (compétences, centres d'intérêt) : Entrée ou virgule pour ajouter,
 * retour arrière pour retirer le dernier, doublons ignorés sans tenir compte de la casse.
 */
export function ChipsField({
  label,
  name,
  icon,
  placeholder,
  hint,
  values,
  onChange,
  max,
  itemMax,
  addLabel,
  removeLabel,
}: {
  label: string;
  name: string;
  icon: LucideIcon;
  placeholder: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  itemMax: number;
  addLabel: string;
  removeLabel: (value: string) => string;
}) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const additions = raw
      .split(',')
      .map((value) => value.trim().slice(0, itemMax))
      .filter(Boolean);
    if (additions.length === 0) return;
    const next = [...values];
    for (const value of additions) {
      const exists = next.some((entry) => entry.toLowerCase() === value.toLowerCase());
      if (!exists && next.length < max) next.push(value);
    }
    onChange(next);
    setDraft('');
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="grid gap-3">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-3 text-[13px] text-fg"
            >
              {value}
              <button
                type="button"
                className="grid size-5 place-items-center rounded-full text-fg-subtle hover:bg-line hover:text-fg"
                aria-label={removeLabel(value)}
                onClick={() => onChange(values.filter((entry) => entry !== value))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormField
        label={label}
        name={name}
        icon={icon}
        placeholder={placeholder}
        hint={hint}
        maxLength={itemMax * 4}
        value={draft}
        disabled={values.length >= max}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        trailing={
          <IconButton
            icon={Plus}
            size="sm"
            label={addLabel}
            disabled={!draft.trim()}
            onClick={() => add(draft)}
          />
        }
      />
    </div>
  );
}
