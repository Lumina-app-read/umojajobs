'use client';

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eraser,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addDays,
  addMonths,
  type CalendarDate,
  compareDates,
  type DatePrecision,
  formatDateValue,
  isWithin,
  monthGrid,
  parseDateValue,
  today,
  toDisplayDate,
} from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { controlFrameClasses, FieldError, FieldHint, FieldLabel } from './form-field';
import { menuSurfaceClasses } from './select-menu';

type View = 'day' | 'month' | 'year';

interface DatePickerProps {
  label: string;
  name: string;
  /** « AAAA-MM-JJ » (précision jour) ou « AAAA-MM » (précision mois) ; chaîne vide si aucune date. */
  value: string;
  onChange: (value: string) => void;
  precision?: DatePrecision;
  placeholder: string;
  icon?: LucideIcon;
  /** Bornes incluses, à la même précision que la valeur. */
  min?: string;
  max?: string;
  /** Années proposées quand aucune borne ne les fixe. */
  yearsBack?: number;
  yearsAhead?: number;
  /** Date obligatoire : pas de bouton « Effacer ». */
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  hint?: ReactNode;
  optionalLabel?: string;
  className?: string;
}

/**
 * Sélecteur de date du design system, pour tous les formulaires : un clic sur le champ ouvre un
 * calendrier (année, mois, puis jour en précision jour). La valeur reste au format attendu par
 * l'API ; une ancienne valeur saisie librement (texte) est affichée telle quelle et conservée tant
 * que l'utilisateur ne choisit pas une nouvelle date.
 */
export function DatePicker({
  label,
  name,
  value,
  onChange,
  precision = 'day',
  placeholder,
  icon: Icon = CalendarDays,
  min,
  max,
  yearsBack = 80,
  yearsAhead = 10,
  required,
  disabled,
  error,
  hint,
  optionalLabel,
  className,
}: DatePickerProps) {
  const locale = useLocale();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const selected = parseDateValue(value, precision);

  const display = useMemo(() => {
    if (!selected) return value.trim();
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      ...(precision === 'day' ? { dateStyle: 'long' } : { month: 'long', year: 'numeric' }),
    }).format(toDisplayDate(selected));
  }, [selected, value, locale, precision]);

  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <FieldLabel htmlFor={id} optional={optionalLabel}>
        {label}
      </FieldLabel>
      <Popover className="relative">
        <PopoverButton
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={cn(
            controlFrameClasses(Boolean(error), disabled),
            'cursor-pointer gap-2 pr-3 text-left outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring data-open:border-primary',
          )}
        >
          <Icon className="ml-3 size-[18px] shrink-0 text-fg-subtle sm:size-4" aria-hidden="true" />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-base sm:text-sm',
              display ? 'text-fg' : 'text-fg-subtle',
            )}
          >
            {display || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
        </PopoverButton>
        <PopoverPanel
          anchor={{ to: 'bottom start', gap: 6, padding: 12 }}
          transition
          className={cn(menuSurfaceClasses, 'w-[min(20rem,calc(100vw-1.5rem))] p-3')}
        >
          {({ close }) => (
            <Calendar
              close={close}
              precision={precision}
              selected={selected}
              min={min ? parseDateValue(min, precision) : null}
              max={max ? parseDateValue(max, precision) : null}
              yearsBack={yearsBack}
              yearsAhead={yearsAhead}
              clearable={!required && Boolean(value)}
              onSelect={(date) => onChange(date ? formatDateValue(date, precision) : '')}
            />
          )}
        </PopoverPanel>
      </Popover>
      <input type="hidden" name={name} value={value} />
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

const navButton =
  'grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-30 sm:size-8';
const cellButton =
  'grid h-10 place-items-center rounded-md text-sm text-fg transition-colors outline-none hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:text-fg-subtle/50 sm:h-9';
const selectedCell = 'bg-primary font-semibold text-primary-fg hover:bg-primary-hover';

function Calendar({
  close,
  precision,
  selected,
  min,
  max,
  yearsBack,
  yearsAhead,
  clearable,
  onSelect,
}: {
  close: () => void;
  precision: DatePrecision;
  selected: CalendarDate | null;
  min: CalendarDate | null;
  max: CalendarDate | null;
  yearsBack: number;
  yearsAhead: number;
  clearable: boolean;
  onSelect: (date: CalendarDate | null) => void;
}) {
  const t = useTranslations('common.datePicker');
  const locale = useLocale();
  const now = today();
  const start = selected ?? (max && compareDates(now, max, 'day') > 0 ? max : now);
  // Sans date, la précision mois commence par l'année (dates de CV, souvent anciennes).
  const [view, setView] = useState<View>(precision === 'month' && !selected ? 'year' : precision);
  const [cursor, setCursor] = useState<CalendarDate>(start);
  const [focusRequest, setFocusRequest] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const firstYear = Math.max(min?.year ?? now.year - yearsBack, 1900);
  const lastYear = max?.year ?? now.year + yearsAhead;

  const monthLabel = (month: number, style: 'long' | 'short') =>
    new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(
      toDisplayDate({ year: 2000, month, day: 1 }),
    );
  const weekdays = useMemo(
    () =>
      // 3 janvier 2000 : un lundi.
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
          toDisplayDate({ year: 2000, month: 1, day: 3 + index }),
        ),
      ),
    [locale],
  );

  // Focus sur la case active à l'ouverture, au changement de vue et lors de la navigation clavier.
  useEffect(() => {
    const target =
      gridRef.current?.querySelector<HTMLElement>('[data-active="true"]') ??
      gridRef.current?.querySelector<HTMLElement>('button:not([disabled])');
    target?.focus({ preventScroll: true });
    // Liste des années : seule la liste défile jusqu'à l'année active (jamais la page).
    const list = target?.parentElement;
    if (view === 'year' && target && list) {
      list.scrollTop =
        target.offsetTop - list.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2;
    }
  }, [view, focusRequest]);

  const pick = (date: CalendarDate) => {
    onSelect(date);
    close();
  };

  function onDayKey(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: CalendarDate | null = null;
    if (event.key in steps) next = addDays(cursor, steps[event.key]!);
    else if (event.key === 'PageUp') next = addMonths(cursor, -1);
    else if (event.key === 'PageDown') next = addMonths(cursor, 1);
    if (!next) return;
    event.preventDefault();
    if (!isWithin(next, 'day', min, max)) return;
    setCursor(next);
    setFocusRequest((count) => count + 1);
  }

  // Flèches : mois voisin (vue jours) ou année voisine (vue mois), dans les bornes.
  const canGoBack =
    view === 'day'
      ? !min || compareDates(addMonths(cursor, -1), min, 'month') >= 0
      : cursor.year - 1 >= firstYear;
  const canGoForward =
    view === 'day'
      ? !max || compareDates(addMonths(cursor, 1), max, 'month') <= 0
      : cursor.year + 1 <= lastYear;
  const showToday = isWithin(now, precision, min, max);

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1">
        {view !== 'year' && (
          <button
            type="button"
            className={navButton}
            aria-label={view === 'day' ? t('previousMonth') : t('previousYear')}
            disabled={!canGoBack}
            onClick={() => setCursor((c) => addMonths(c, view === 'day' ? -1 : -12))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md text-sm font-semibold text-fg capitalize transition-colors hover:bg-surface-2 sm:h-8"
          aria-label={view === 'day' ? t('chooseMonth') : t('chooseYear')}
          onClick={() => setView(view === 'day' ? 'month' : view === 'month' ? 'year' : precision)}
        >
          {view === 'day'
            ? `${monthLabel(cursor.month, 'long')} ${cursor.year}`
            : view === 'month'
              ? cursor.year
              : t('years')}
          <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden="true" />
        </button>
        {view !== 'year' && (
          <button
            type="button"
            className={navButton}
            aria-label={view === 'day' ? t('nextMonth') : t('nextYear')}
            disabled={!canGoForward}
            onClick={() => setCursor((c) => addMonths(c, view === 'day' ? 1 : 12))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div ref={gridRef}>
        {view === 'year' && (
          <div
            role="listbox"
            aria-label={t('years')}
            className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto overscroll-contain pr-0.5"
          >
            {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index).map(
              (year) => {
                const active = year === cursor.year;
                return (
                  <button
                    key={year}
                    type="button"
                    role="option"
                    aria-selected={selected?.year === year}
                    data-active={active}
                    className={cn(
                      cellButton,
                      'tabular-nums',
                      selected?.year === year && selectedCell,
                      year === now.year && selected?.year !== year && 'font-semibold text-brand',
                    )}
                    onClick={() => {
                      setCursor((c) => ({ ...c, year, day: Math.min(c.day, 28) }));
                      setView('month');
                    }}
                  >
                    {year}
                  </button>
                );
              },
            )}
          </div>
        )}

        {view === 'month' && (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
              const date = { year: cursor.year, month, day: 1 };
              const isSelected = selected?.year === cursor.year && selected.month === month;
              const isCurrent = now.year === cursor.year && now.month === month;
              return (
                <button
                  key={month}
                  type="button"
                  data-active={month === cursor.month}
                  aria-pressed={isSelected}
                  disabled={!isWithin(date, 'month', min, max)}
                  className={cn(
                    cellButton,
                    'capitalize',
                    isSelected && selectedCell,
                    isCurrent && !isSelected && 'font-semibold text-brand',
                  )}
                  onClick={() => {
                    if (precision === 'month') pick(date);
                    else {
                      setCursor((c) => ({ ...c, month, day: Math.min(c.day, 28) }));
                      setView('day');
                    }
                  }}
                >
                  {monthLabel(month, 'short')}
                </button>
              );
            })}
          </div>
        )}

        {view === 'day' && (
          <div
            role="grid"
            aria-label={`${monthLabel(cursor.month, 'long')} ${cursor.year}`}
            onKeyDown={onDayKey}
          >
            <div role="row" className="grid grid-cols-7 pb-1">
              {weekdays.map((weekday) => (
                <span
                  key={weekday}
                  role="columnheader"
                  className="text-center text-[11px] font-medium text-fg-subtle uppercase"
                >
                  {weekday.replace('.', '')}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {monthGrid(cursor.year, cursor.month).map((date, index) => {
                if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
                const isSelected = selected && compareDates(selected, date, 'day') === 0;
                const isToday = compareDates(now, date, 'day') === 0;
                const active = date.day === cursor.day;
                return (
                  <button
                    key={date.day}
                    type="button"
                    role="gridcell"
                    tabIndex={active ? 0 : -1}
                    data-active={active}
                    aria-selected={Boolean(isSelected)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={new Intl.DateTimeFormat(locale, {
                      dateStyle: 'full',
                      timeZone: 'UTC',
                    }).format(toDisplayDate(date))}
                    disabled={!isWithin(date, 'day', min, max)}
                    className={cn(
                      cellButton,
                      'tabular-nums',
                      isSelected && selectedCell,
                      isToday &&
                        !isSelected &&
                        'font-semibold text-brand ring-1 ring-primary/40 ring-inset',
                    )}
                    onClick={() => pick(date)}
                  >
                    {date.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {(showToday || clearable) && (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
          {showToday ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-brand transition-colors hover:bg-surface-2 sm:h-8 sm:text-[13px]"
              onClick={() => pick(now)}
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              {precision === 'day' ? t('today') : t('thisMonth')}
            </button>
          ) : (
            <span />
          )}
          {clearable && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:h-8 sm:text-[13px]"
              onClick={() => {
                onSelect(null);
                close();
              }}
            >
              <Eraser className="size-4" aria-hidden="true" />
              {t('clear')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
