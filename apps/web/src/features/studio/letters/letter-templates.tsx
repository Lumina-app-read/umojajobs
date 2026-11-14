import { type LetterTemplateProps, lines, paragraphs, placeAndDate } from './letter-format';

/** Bloc d'adresse : lignes non vides seulement. */
function Address({ values, className }: { values: string[]; className?: string }) {
  const visible = values.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <div className={className}>
      {visible.map((value) => (
        <p key={value}>{value}</p>
      ))}
    </div>
  );
}

/** Corps commun : objet, référence, formule d'appel, paragraphes, politesse, signature, pièces. */
function LetterBody({
  content,
  labels,
  accent,
}: Pick<LetterTemplateProps, 'content' | 'labels'> & { accent: string }) {
  const enclosures = lines(content.enclosures);
  return (
    <>
      {(content.subject || content.reference) && (
        <div className="mt-8 grid gap-0.5">
          {content.subject && (
            <p className="font-semibold text-[#0f172a]">
              <span className={accent}>{labels.subject}</span> {content.subject}
            </p>
          )}
          {content.reference && (
            <p className="text-[#475569]">
              {labels.reference} {content.reference}
            </p>
          )}
        </div>
      )}
      {content.salutation && <p className="mt-7">{content.salutation}</p>}
      <div className="mt-4 grid gap-3.5 text-justify">
        {paragraphs(content.body).map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
      {content.closing && <p className="mt-5 text-justify">{content.closing}</p>}
      {content.sender.fullName && (
        // Espace réservé à la signature manuscrite, au-dessus du nom.
        <p className="mt-16 ml-auto w-fit min-w-[200px] text-center font-semibold text-[#0f172a]">
          {content.sender.fullName}
        </p>
      )}
      {enclosures.length > 0 && (
        <div className="mt-10 text-[12.5px] sm:text-[11.5px] text-[#475569]">
          <p className="font-semibold">{labels.enclosures}</p>
          <ul className="mt-1 list-disc pl-5">
            {enclosures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Lettre « Classique » : présentation administrative française et africaine francophone
 * (expéditeur en haut à gauche, destinataire à droite, lieu et date, objet).
 */
export function ClassicLetter({ content, labels, language, countryName }: LetterTemplateProps) {
  const { sender, recipient } = content;
  return (
    <article className="min-h-[1123px] px-[72px] py-[64px] text-[13.5px] sm:text-[12.5px] leading-[1.65] text-[#1e293b]">
      <Address
        className="leading-[1.5]"
        values={[
          sender.fullName,
          sender.address,
          [sender.city, countryName].filter(Boolean).join(', '),
          sender.phone,
          sender.email,
        ]}
      />
      <Address
        className="mt-8 ml-[52%] leading-[1.5]"
        values={[
          recipient.name,
          recipient.role,
          recipient.organization,
          recipient.address,
          recipient.city,
        ]}
      />
      <p className="mt-8 ml-[52%]">{placeAndDate(content, labels, language)}</p>
      <LetterBody content={content} labels={labels} accent="underline underline-offset-2" />
    </article>
  );
}

/** Lettre « Moderne » : bandeau d'en-tête au nom de l'expéditeur, destinataire et date alignés. */
export function ModernLetter({ content, labels, language, countryName }: LetterTemplateProps) {
  const { sender, recipient } = content;
  const contacts = [
    sender.email,
    sender.phone,
    sender.address,
    [sender.city, countryName].filter(Boolean).join(', '),
  ].filter(Boolean);
  return (
    <article className="min-h-[1123px] text-[13.5px] sm:text-[12.5px] leading-[1.65] text-[#1e293b]">
      <header className="border-l-[6px] border-[#2563eb] bg-[#0f2a4a] px-[66px] py-8 text-white">
        <h1 className="text-[24px] leading-tight font-bold tracking-[-0.01em]">
          {sender.fullName}
        </h1>
        {contacts.length > 0 && (
          <p className="mt-2 text-xs sm:text-[11px] text-[#cbd5e1]">{contacts.join('  ·  ')}</p>
        )}
      </header>
      <div className="px-[72px] pt-10 pb-[64px]">
        <div className="flex items-start justify-between gap-8">
          <Address
            className="leading-[1.5]"
            values={[
              recipient.name,
              recipient.role,
              recipient.organization,
              recipient.address,
              recipient.city,
            ]}
          />
          <p className="shrink-0 text-[#475569]">{placeAndDate(content, labels, language)}</p>
        </div>
        <LetterBody content={content} labels={labels} accent="text-[#2563eb]" />
      </div>
    </article>
  );
}

/** Lettre dans le modèle choisi (Classique par défaut). */
export function LetterDocument({
  templateKey,
  ...props
}: LetterTemplateProps & { templateKey: string }) {
  return templateKey === 'modern' ? <ModernLetter {...props} /> : <ClassicLetter {...props} />;
}
