import { type ReactNode } from 'react';
import { type CvTemplateProps, formatMonth, formatPeriod, formatPlace } from '../cv-format';
import { Description, joinParts, When } from './shared';

function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[10px] font-bold tracking-[0.16em] text-[#93c5fd] uppercase">{title}</h2>
      <div className="mt-2.5 grid gap-2">{children}</div>
    </section>
  );
}

function MainSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] text-[#0f2a4a] uppercase">
        <span className="h-[3px] w-5 rounded-full bg-[#2563eb]" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3 grid gap-4">{children}</div>
    </section>
  );
}

function TimelineEntry({
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
    <div className="relative break-inside-avoid border-l-2 border-[#dbeafe] pl-4">
      <span
        className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-[#2563eb]"
        aria-hidden="true"
      />
      {period && (
        <p className="text-[10.5px] font-semibold tracking-wide text-[#2563eb] uppercase">
          {period}
        </p>
      )}
      <p className="text-[13px] font-semibold text-[#0f172a]">{title}</p>
      {subtitle && <p className="text-[#475569]">{subtitle}</p>}
      <Description text={description} className="text-[#334155]" />
    </div>
  );
}

/** Modèle « Moderne » : colonne latérale bleu foncé (contact, compétences, langues) et parcours. */
export function ModernTemplate({ content, labels, countryName, photoUrl }: CvTemplateProps) {
  const { personal } = content;
  const place = formatPlace(personal.city, countryName);
  const contacts = [personal.email, personal.phone, personal.address, place].filter(Boolean);

  return (
    <article className="flex min-h-[1123px] text-[12px] leading-[1.5] text-[#1e293b]">
      <aside className="w-[250px] shrink-0 bg-[#0f2a4a] px-7 py-12 text-[#e2e8f0]">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- image privée ou data URI, imprimée telle quelle
          <img
            src={photoUrl}
            alt=""
            className="mb-6 size-[120px] rounded-full object-cover ring-4 ring-white/15"
          />
        )}
        <h1 className="text-[24px] leading-tight font-bold tracking-[-0.01em] text-white">
          {personal.fullName}
        </h1>
        {personal.headline && (
          <p className="mt-2 text-[13px] font-medium text-[#bfdbfe]">{personal.headline}</p>
        )}

        <When show={contacts.length > 0}>
          <SideSection title={labels.contact}>
            {contacts.map((value) => (
              <p key={value} className="text-[11px] break-words text-[#e2e8f0]">
                {value}
              </p>
            ))}
          </SideSection>
        </When>

        <When show={content.skills.length > 0}>
          <SideSection title={labels.skills}>
            <ul className="flex flex-wrap gap-1.5">
              {content.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-[4px] bg-white/10 px-2 py-0.5 text-[10.5px] text-white"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </SideSection>
        </When>

        <When show={content.languages.length > 0}>
          <SideSection title={labels.languages}>
            {content.languages.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2">
                <span className="text-white">{item.name}</span>
                <span className="text-[10.5px] text-[#bfdbfe]">{labels.levels[item.level]}</span>
              </div>
            ))}
          </SideSection>
        </When>

        <When show={content.certifications.length > 0}>
          <SideSection title={labels.certifications}>
            {content.certifications.map((item) => (
              <div key={item.id}>
                <p className="text-white">{item.name}</p>
                <p className="text-[10.5px] text-[#bfdbfe]">
                  {joinParts([item.issuer, item.date ? formatMonth(item.date, labels) : ''])}
                </p>
              </div>
            ))}
          </SideSection>
        </When>

        <When show={(content.interests ?? []).length > 0}>
          <SideSection title={labels.interests}>
            {(content.interests ?? []).map((interest) => (
              <p key={interest} className="text-[11px] text-[#e2e8f0]">
                {interest}
              </p>
            ))}
          </SideSection>
        </When>
      </aside>

      <div className="min-w-0 flex-1 px-9 py-12">
        <When show={Boolean(personal.summary)}>
          <MainSection title={labels.summary}>
            <Description text={personal.summary} className="text-[#334155]" />
          </MainSection>
        </When>

        <When show={content.experiences.length > 0}>
          <MainSection title={labels.experiences}>
            {content.experiences.map((item) => (
              <TimelineEntry
                key={item.id}
                title={item.role}
                subtitle={joinParts([item.organization, item.location])}
                period={formatPeriod(item.startDate, item.endDate, item.current, labels)}
                description={item.description}
              />
            ))}
          </MainSection>
        </When>

        <When show={content.education.length > 0}>
          <MainSection title={labels.education}>
            {content.education.map((item) => (
              <TimelineEntry
                key={item.id}
                title={item.degree}
                subtitle={joinParts([item.school, item.location])}
                period={formatPeriod(item.startDate, item.endDate, false, labels)}
                description={item.description}
              />
            ))}
          </MainSection>
        </When>

        <When show={content.projects.length > 0}>
          <MainSection title={labels.projects}>
            {content.projects.map((item) => (
              <div key={item.id} className="break-inside-avoid">
                <p className="text-[13px] font-semibold text-[#0f172a]">{item.name}</p>
                {item.url && <p className="text-[11px] text-[#2563eb]">{item.url}</p>}
                <Description text={item.description} className="text-[#334155]" />
              </div>
            ))}
          </MainSection>
        </When>

        <When show={content.references.length > 0}>
          <MainSection title={labels.references}>
            <div className="grid grid-cols-2 gap-4">
              {content.references.map((item) => (
                <div key={item.id}>
                  <p className="font-semibold text-[#0f172a]">{item.name}</p>
                  <p className="text-[#475569]">{joinParts([item.role, item.organization])}</p>
                  {item.contact && <p className="text-[#475569]">{item.contact}</p>}
                </div>
              ))}
            </div>
          </MainSection>
        </When>
      </div>
    </article>
  );
}
