import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h2 className="flex items-center gap-3 text-[12px] font-semibold tracking-[0.18em] text-[#0f2a4a] uppercase">
        {title}
        <span className="h-px flex-1 bg-[#94a3b8]" aria-hidden="true" />
      </h2>
      <div className="mt-2.5 grid gap-2.5">{children}</div>
    </section>
  );
}

/** Entrée datée : la période dans une colonne fixe à gauche, comme dans un CV universitaire. */
function Dated({
  period,
  title,
  subtitle,
  description,
}: {
  period: string;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 break-inside-avoid">
      <p className="text-[11px] text-[#475569] tabular-nums">{period}</p>
      <div>
        <p className="font-semibold text-[#0f172a]">{title}</p>
        {subtitle && <p className="text-[#334155] italic">{subtitle}</p>}
        <Description text={description} className="text-[#334155]" />
      </div>
    </div>
  );
}

/**
 * Modèle « Académique » : formation en tête, puis certifications et travaux, dates en colonne.
 * Adapté aux candidatures d'enseignement, de recherche, de bourses et d'organisations.
 */
export function AcademicTemplate({ content, labels, countryName }: CvTemplateProps) {
  const { personal } = content;
  const contact = joinParts([
    personal.email,
    personal.phone,
    personal.address,
    formatPlace(personal.city, countryName),
  ]);

  return (
    <article className="px-[60px] py-[54px] text-[12px] leading-[1.55] text-[#1e293b]">
      <header className="border-b-[3px] border-double border-[#0f2a4a] pb-4 text-center">
        <h1 className="text-[25px] leading-tight font-semibold tracking-[0.04em] text-[#0f2a4a] uppercase">
          {personal.fullName}
        </h1>
        {personal.headline && (
          <p className="mt-1 text-[13px] text-[#334155] italic">{personal.headline}</p>
        )}
        {contact && <p className="mt-2 text-[11px] text-[#475569]">{contact}</p>}
      </header>

      <When show={Boolean(personal.summary)}>
        <Section title={labels.summary}>
          <Description text={personal.summary} className="text-justify text-[#334155]" />
        </Section>
      </When>

      <When show={content.education.length > 0}>
        <Section title={labels.education}>
          {content.education.map((item) => (
            <Dated
              key={item.id}
              period={formatPeriod(item.startDate, item.endDate, false, labels)}
              title={item.degree}
              subtitle={joinParts([item.school, item.location])}
              description={item.description}
            />
          ))}
        </Section>
      </When>

      <When show={content.certifications.length > 0}>
        <Section title={labels.certifications}>
          {content.certifications.map((item) => (
            <Dated
              key={item.id}
              period={item.date ? formatMonth(item.date, labels) : ''}
              title={item.name}
              subtitle={item.issuer}
              description=""
            />
          ))}
        </Section>
      </When>

      <When show={content.projects.length > 0}>
        <Section title={labels.projects}>
          {content.projects.map((item) => (
            <div key={item.id} className="break-inside-avoid">
              <p className="font-semibold text-[#0f172a]">{item.name}</p>
              {item.url && <p className="text-[11px] text-[#1d4ed8]">{item.url}</p>}
              <Description text={item.description} className="text-[#334155]" />
            </div>
          ))}
        </Section>
      </When>

      <When show={content.experiences.length > 0}>
        <Section title={labels.experiences}>
          {content.experiences.map((item) => (
            <Dated
              key={item.id}
              period={formatPeriod(item.startDate, item.endDate, item.current, labels)}
              title={item.role}
              subtitle={joinParts([item.organization, item.location])}
              description={item.description}
            />
          ))}
        </Section>
      </When>

      <When show={content.languages.length > 0 || content.skills.length > 0}>
        <div className="grid grid-cols-2 gap-8">
          <When show={content.languages.length > 0}>
            <Section title={labels.languages}>
              {content.languages.map((item) => (
                <p key={item.id}>
                  <span className="font-semibold text-[#0f172a]">{item.name}</span>
                  <span className="text-[#475569]"> : {labels.levels[item.level]}</span>
                </p>
              ))}
            </Section>
          </When>
          <When show={content.skills.length > 0}>
            <Section title={labels.skills}>
              <p className="text-[#334155]">{content.skills.join(', ')}</p>
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
                <p className="text-[#475569] italic">{joinParts([item.role, item.organization])}</p>
                {item.contact && <p className="text-[#475569]">{item.contact}</p>}
              </div>
            ))}
          </div>
        </Section>
      </When>
    </article>
  );
}
