import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="border-b border-[#cbd5e1] pb-1 text-[11px] font-bold tracking-[0.14em] text-[#0f2a4a] uppercase">
        {title}
      </h2>
      <div className="mt-2.5 grid gap-3">{children}</div>
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
        <p className="font-semibold text-[#0f172a]">{title}</p>
        {period && <p className="shrink-0 text-[11px] text-[#475569]">{period}</p>}
      </div>
      {subtitle && <p className="text-[#334155] italic">{subtitle}</p>}
      <Description text={description} className="text-[#334155]" />
    </div>
  );
}

/** Modèle « Classique » : une colonne, sobre, adapté à tous les secteurs et aux logiciels de tri. */
export function ClassicTemplate({ content, labels, countryName }: CvTemplateProps) {
  const { personal } = content;
  const contact = joinParts([
    personal.email,
    personal.phone,
    personal.address,
    formatPlace(personal.city, countryName),
  ]);

  return (
    <article className="px-[56px] py-[52px] text-[12px] leading-[1.5] text-[#1e293b]">
      <header className="text-center">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.01em] text-[#0f2a4a]">
          {personal.fullName}
        </h1>
        {personal.headline && (
          <p className="mt-1 text-[14px] font-medium text-[#1d4ed8]">{personal.headline}</p>
        )}
        {contact && <p className="mt-2 text-[11px] text-[#475569]">{contact}</p>}
      </header>

      <When show={Boolean(personal.summary)}>
        <Section title={labels.summary}>
          <Description text={personal.summary} className="text-[#334155]" />
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
          <p className="text-[#334155]">{content.skills.join(' · ')}</p>
        </Section>
      </When>

      <When show={content.languages.length > 0}>
        <Section title={labels.languages}>
          <p className="text-[#334155]">
            {content.languages
              .map((item) => `${item.name} (${labels.levels[item.level]})`)
              .join(' · ')}
          </p>
        </Section>
      </When>

      <When show={content.certifications.length > 0}>
        <Section title={labels.certifications}>
          {content.certifications.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-4">
              <p>
                <span className="font-semibold text-[#0f172a]">{item.name}</span>
                {item.issuer && <span className="text-[#475569]">, {item.issuer}</span>}
              </p>
              {item.date && (
                <p className="shrink-0 text-[11px] text-[#475569]">
                  {formatMonth(item.date, labels)}
                </p>
              )}
            </div>
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

      <When show={(content.interests ?? []).length > 0}>
        <Section title={labels.interests}>
          <p className="text-[#334155]">{(content.interests ?? []).join(' · ')}</p>
        </Section>
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
