import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid-page first:mt-0">
      <h2 className="border-b-2 border-[#0b1f3a] pb-1.5 text-[12.5px] font-bold tracking-[0.1em] text-[#0b1f3a] uppercase">
        {title}
      </h2>
      <div className="mt-3.5 grid gap-4">{children}</div>
    </section>
  );
}

function SideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="text-[10.5px] font-bold tracking-[0.14em] text-[#0b1f3a] uppercase">
        {title}
      </h2>
      <div className="mt-2 grid gap-1.5">{children}</div>
    </section>
  );
}

/**
 * Modèle « Cadre et dirigeant » : bandeau d'en-tête sombre, profil mis en exergue, parcours au
 * premier plan, colonne étroite pour les éléments complémentaires.
 */
export function ExecutiveTemplate({ content, labels, countryName, photoUrl }: CvTemplateProps) {
  const { personal } = content;
  const contacts = [
    personal.email,
    personal.phone,
    personal.address,
    formatPlace(personal.city, countryName),
  ].filter(Boolean);
  const hasSide =
    content.skills.length > 0 ||
    content.languages.length > 0 ||
    content.certifications.length > 0 ||
    (content.interests ?? []).length > 0 ||
    content.references.length > 0;

  return (
    <article className="text-[12px] leading-[1.55] text-[#1e293b]">
      <header className="bg-[#0b1f3a] px-[52px] pt-[42px] pb-[30px] text-white">
        <div className="flex items-center gap-6">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- image privée ou data URI, imprimée telle quelle
            <img
              src={photoUrl}
              alt=""
              className="size-[96px] shrink-0 rounded-[10px] object-cover ring-2 ring-white/20"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-[30px] leading-tight font-bold tracking-[-0.01em]">
              {personal.fullName}
            </h1>
            {personal.headline && (
              <p className="mt-1.5 text-[13px] font-semibold tracking-[0.16em] text-[#93c5fd] uppercase">
                {personal.headline}
              </p>
            )}
          </div>
        </div>
        {contacts.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/15 pt-3 text-[11px] text-[#cbd5e1]">
            {contacts.map((value, index) => (
              <li key={value} className="flex items-center gap-5">
                {index > 0 && <span className="h-3 w-px bg-white/25" aria-hidden="true" />}
                {value}
              </li>
            ))}
          </ul>
        )}
      </header>

      <When show={Boolean(personal.summary)}>
        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-[52px] py-5">
          <Description
            text={personal.summary}
            className="border-l-[3px] border-[#2563eb] pl-4 text-[12.5px] text-[#1e293b]"
          />
        </div>
      </When>

      <div
        className={
          hasSide ? 'grid grid-cols-[minmax(0,1fr)_190px] gap-9 px-[52px] py-8' : 'px-[52px] py-8'
        }
      >
        <div className="min-w-0">
          <When show={content.experiences.length > 0}>
            <Section title={labels.experiences}>
              {content.experiences.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[13.5px] font-bold text-[#0b1f3a]">{item.role}</p>
                    <p className="shrink-0 text-[11px] font-medium text-[#475569]">
                      {formatPeriod(item.startDate, item.endDate, item.current, labels)}
                    </p>
                  </div>
                  <p className="font-semibold text-[#2563eb]">
                    {joinParts([item.organization, item.location])}
                  </p>
                  <Description text={item.description} className="text-[#334155]" />
                </div>
              ))}
            </Section>
          </When>

          <When show={content.education.length > 0}>
            <Section title={labels.education}>
              {content.education.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-bold text-[#0b1f3a]">{item.degree}</p>
                    <p className="shrink-0 text-[11px] text-[#475569]">
                      {formatPeriod(item.startDate, item.endDate, false, labels)}
                    </p>
                  </div>
                  <p className="text-[#475569]">{joinParts([item.school, item.location])}</p>
                  <Description text={item.description} className="text-[#334155]" />
                </div>
              ))}
            </Section>
          </When>

          <When show={content.projects.length > 0}>
            <Section title={labels.projects}>
              {content.projects.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <p className="font-bold text-[#0b1f3a]">{item.name}</p>
                  {item.url && <p className="text-[11px] text-[#2563eb]">{item.url}</p>}
                  <Description text={item.description} className="text-[#334155]" />
                </div>
              ))}
            </Section>
          </When>
        </div>

        {hasSide && (
          <aside className="grid content-start gap-6">
            <When show={content.skills.length > 0}>
              <SideBlock title={labels.skills}>
                {content.skills.map((skill) => (
                  <p key={skill} className="text-[#334155]">
                    {skill}
                  </p>
                ))}
              </SideBlock>
            </When>
            <When show={content.languages.length > 0}>
              <SideBlock title={labels.languages}>
                {content.languages.map((item) => (
                  <p key={item.id}>
                    <span className="font-semibold text-[#0b1f3a]">{item.name}</span>
                    <span className="block text-[11px] text-[#64748b]">
                      {labels.levels[item.level]}
                    </span>
                  </p>
                ))}
              </SideBlock>
            </When>
            <When show={content.certifications.length > 0}>
              <SideBlock title={labels.certifications}>
                {content.certifications.map((item) => (
                  <p key={item.id}>
                    <span className="font-semibold text-[#0b1f3a]">{item.name}</span>
                    <span className="block text-[11px] text-[#64748b]">
                      {joinParts([item.issuer, item.date ? formatMonth(item.date, labels) : ''])}
                    </span>
                  </p>
                ))}
              </SideBlock>
            </When>
            <When show={content.references.length > 0}>
              <SideBlock title={labels.references}>
                {content.references.map((item) => (
                  <div key={item.id}>
                    <p className="font-semibold text-[#0b1f3a]">{item.name}</p>
                    <p className="text-[11px] text-[#475569]">
                      {joinParts([item.role, item.organization])}
                    </p>
                    {item.contact && <p className="text-[11px] text-[#475569]">{item.contact}</p>}
                  </div>
                ))}
              </SideBlock>
            </When>
            <When show={(content.interests ?? []).length > 0}>
              <SideBlock title={labels.interests}>
                {(content.interests ?? []).map((interest) => (
                  <p key={interest} className="text-[#334155]">
                    {interest}
                  </p>
                ))}
              </SideBlock>
            </When>
          </aside>
        )}
      </div>
    </article>
  );
}
