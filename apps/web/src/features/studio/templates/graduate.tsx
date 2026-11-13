import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="inline-block rounded-[4px] bg-[#dbeafe] px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-[#1e40af] uppercase">
        {title}
      </h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

function Entry({
  title,
  subtitle,
  period,
  description,
}: {
  title: string;
  subtitle: string;
  period: string;
  description: string;
}) {
  return (
    <div className="break-inside-avoid">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13px] font-semibold text-[#0f172a]">{title}</p>
        {period && <p className="shrink-0 text-[11px] font-medium text-[#2563eb]">{period}</p>}
      </div>
      {subtitle && <p className="text-[#475569]">{subtitle}</p>}
      <Description text={description} className="text-[#334155]" />
    </div>
  );
}

/** Initiales du nom, pour la pastille d'en-tête (aucune photo n'est demandée). */
function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Modèle « Jeune diplômé » : formation et projets avant l'expérience, compétences mises en avant.
 * Pensé pour un premier emploi, un stage ou une alternance.
 */
export function GraduateTemplate({ content, labels, countryName }: CvTemplateProps) {
  const { personal } = content;
  const contact = joinParts([
    personal.email,
    personal.phone,
    personal.address,
    formatPlace(personal.city, countryName),
  ]);
  const letters = initials(personal.fullName);

  return (
    <article className="px-[52px] py-[46px] text-[12px] leading-[1.5] text-[#1e293b]">
      <header className="flex items-center gap-5 rounded-[10px] bg-[#eff6ff] px-6 py-5">
        {letters && (
          <span
            className="grid size-[60px] shrink-0 place-items-center rounded-full bg-[#2563eb] text-[20px] font-bold text-white"
            aria-hidden="true"
          >
            {letters}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-bold text-[#0f172a]">
            {personal.fullName}
          </h1>
          {personal.headline && (
            <p className="mt-0.5 text-[13px] font-medium text-[#1d4ed8]">{personal.headline}</p>
          )}
          {contact && <p className="mt-1.5 text-[11px] text-[#475569]">{contact}</p>}
        </div>
      </header>

      <When show={Boolean(personal.summary)}>
        <Section title={labels.summary}>
          <Description text={personal.summary} className="text-[#334155]" />
        </Section>
      </When>

      <When show={content.education.length > 0}>
        <Section title={labels.education}>
          {content.education.map((item) => (
            <Entry
              key={item.id}
              title={item.degree}
              subtitle={joinParts([item.school, item.location])}
              period={formatPeriod(item.startDate, item.endDate, false, labels)}
              description={item.description}
            />
          ))}
        </Section>
      </When>

      <When show={content.skills.length > 0}>
        <Section title={labels.skills}>
          <ul className="flex flex-wrap gap-1.5">
            {content.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-[#bfdbfe] px-2.5 py-0.5 text-[11px] text-[#1e3a8a]"
              >
                {skill}
              </li>
            ))}
          </ul>
        </Section>
      </When>

      <When show={content.projects.length > 0}>
        <Section title={labels.projects}>
          {content.projects.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              <p className="text-[13px] font-semibold text-[#0f172a]">{item.name}</p>
              {item.url && <p className="text-[11px] text-[#2563eb]">{item.url}</p>}
              <Description text={item.description} className="text-[#334155]" />
            </div>
          ))}
        </Section>
      </When>

      <When show={content.experiences.length > 0}>
        <Section title={labels.experiences}>
          {content.experiences.map((item) => (
            <Entry
              key={item.id}
              title={item.role}
              subtitle={joinParts([item.organization, item.location])}
              period={formatPeriod(item.startDate, item.endDate, item.current, labels)}
              description={item.description}
            />
          ))}
        </Section>
      </When>

      <When show={content.languages.length > 0 || content.certifications.length > 0}>
        <div className="grid grid-cols-2 gap-8">
          <When show={content.languages.length > 0}>
            <Section title={labels.languages}>
              {content.languages.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[#0f172a]">{item.name}</span>
                  <span className="text-[11px] text-[#475569]">{labels.levels[item.level]}</span>
                </div>
              ))}
            </Section>
          </When>
          <When show={content.certifications.length > 0}>
            <Section title={labels.certifications}>
              {content.certifications.map((item) => (
                <div key={item.id}>
                  <p className="font-medium text-[#0f172a]">{item.name}</p>
                  <p className="text-[11px] text-[#475569]">
                    {joinParts([item.issuer, item.date ? formatMonth(item.date, labels) : ''])}
                  </p>
                </div>
              ))}
            </Section>
          </When>
        </div>
      </When>

      <When show={content.references.length > 0}>
        <Section title={labels.references}>
          <div className="grid grid-cols-2 gap-3">
            {content.references.map((item) => (
              <div key={item.id}>
                <p className="font-semibold text-[#0f172a]">{item.name}</p>
                <p className="text-[#475569]">{joinParts([item.role, item.organization])}</p>
                {item.contact && <p className="text-[#475569]">{item.contact}</p>}
              </div>
            ))}
          </div>
        </Section>
      </When>
    </article>
  );
}
