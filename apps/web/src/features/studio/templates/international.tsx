import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

/** Section à deux colonnes : titre dans la marge gauche, contenu à droite. */
function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[150px_minmax(0,1fr)] gap-6 border-t border-[#e2e8f0] py-4 break-inside-avoid-page">
      <h2 className="pt-px text-[11.5px] sm:text-[10.5px] font-bold tracking-[0.12em] text-[#1d4ed8] uppercase">
        {title}
      </h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Item({
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
        <p className="font-semibold text-[#0f172a]">
          {title}
          {subtitle && <span className="font-normal text-[#475569]">, {subtitle}</span>}
        </p>
        {period && <p className="shrink-0 text-xs sm:text-[11px] text-[#64748b]">{period}</p>}
      </div>
      <Description text={description} className="text-[#334155]" />
    </div>
  );
}

/**
 * Modèle « Professionnel international » : titres de section dans la marge, lecture en Z,
 * mise en page sobre et bien lue par les logiciels de recrutement (une seule colonne de texte).
 */
export function InternationalTemplate({ content, labels, countryName }: CvTemplateProps) {
  const { personal } = content;
  const contacts = [
    personal.email,
    personal.phone,
    personal.address,
    formatPlace(personal.city, countryName),
  ].filter(Boolean);

  return (
    <article className="text-[13px] sm:text-[12px] leading-[1.5] text-[#1e293b]">
      <div className="h-[6px] bg-[#1d4ed8]" aria-hidden="true" />
      <div className="px-[52px] pt-[40px] pb-[44px]">
        <header className="flex items-end justify-between gap-8 pb-5">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] text-[#0f172a]">
              {personal.fullName}
            </h1>
            {personal.headline && (
              <p className="mt-1 text-[14px] font-medium text-[#1d4ed8]">{personal.headline}</p>
            )}
          </div>
          {contacts.length > 0 && (
            <div className="shrink-0 text-right text-xs sm:text-[11px] leading-[1.6] text-[#475569]">
              {contacts.map((value) => (
                <p key={value}>{value}</p>
              ))}
            </div>
          )}
        </header>

        <When show={Boolean(personal.summary)}>
          <Row title={labels.summary}>
            <Description text={personal.summary} className="text-[#334155]" />
          </Row>
        </When>

        <When show={content.experiences.length > 0}>
          <Row title={labels.experiences}>
            {content.experiences.map((item) => (
              <Item
                key={item.id}
                title={item.role}
                subtitle={joinParts([item.organization, item.location])}
                period={formatPeriod(item.startDate, item.endDate, item.current, labels)}
                description={item.description}
              />
            ))}
          </Row>
        </When>

        <When show={content.education.length > 0}>
          <Row title={labels.education}>
            {content.education.map((item) => (
              <Item
                key={item.id}
                title={item.degree}
                subtitle={joinParts([item.school, item.location])}
                period={formatPeriod(item.startDate, item.endDate, false, labels)}
                description={item.description}
              />
            ))}
          </Row>
        </When>

        <When show={content.skills.length > 0}>
          <Row title={labels.skills}>
            <p className="text-[#334155]">{content.skills.join(' · ')}</p>
          </Row>
        </When>

        <When show={content.languages.length > 0}>
          <Row title={labels.languages}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {content.languages.map((item) => (
                <p key={item.id}>
                  <span className="font-semibold text-[#0f172a]">{item.name}</span>
                  <span className="text-[#64748b]"> · {labels.levels[item.level]}</span>
                </p>
              ))}
            </div>
          </Row>
        </When>

        <When show={content.certifications.length > 0}>
          <Row title={labels.certifications}>
            {content.certifications.map((item) => (
              <Item
                key={item.id}
                title={item.name}
                subtitle={item.issuer}
                period={item.date ? formatMonth(item.date, labels) : ''}
                description=""
              />
            ))}
          </Row>
        </When>

        <When show={content.projects.length > 0}>
          <Row title={labels.projects}>
            {content.projects.map((item) => (
              <div key={item.id} className="break-inside-avoid">
                <p className="font-semibold text-[#0f172a]">{item.name}</p>
                {item.url && <p className="text-xs sm:text-[11px] text-[#1d4ed8]">{item.url}</p>}
                <Description text={item.description} className="text-[#334155]" />
              </div>
            ))}
          </Row>
        </When>

        <When show={(content.interests ?? []).length > 0}>
          <Row title={labels.interests}>
            <p className="text-[#334155]">{(content.interests ?? []).join(' · ')}</p>
          </Row>
        </When>

        <When show={content.references.length > 0}>
          <Row title={labels.references}>
            <div className="grid grid-cols-2 gap-3">
              {content.references.map((item) => (
                <div key={item.id}>
                  <p className="font-semibold text-[#0f172a]">{item.name}</p>
                  <p className="text-[#475569]">{joinParts([item.role, item.organization])}</p>
                  {item.contact && <p className="text-[#475569]">{item.contact}</p>}
                </div>
              ))}
            </div>
          </Row>
        </When>
      </div>
    </article>
  );
}
