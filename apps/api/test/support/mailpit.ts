/** Lecture des emails capturés par Mailpit (API REST), pour vérifier les envois de bout en bout. */

interface MailpitSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

interface MailpitMessage {
  Subject: string;
  Text: string;
  HTML: string;
}

function apiUrl(path: string): string {
  const base = process.env.MAILPIT_API_URL;
  if (!base) throw new Error('MAILPIT_API_URL absent (global-setup).');
  return `${base}${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path));
  if (!response.ok) throw new Error(`Mailpit ${path} : HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function listMessagesTo(email: string): Promise<MailpitSummary[]> {
  const result = await getJson<{ messages: MailpitSummary[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  );
  return result.messages;
}

/** Attend un email dont le sujet contient le texte donné (l'envoi SMTP est asynchrone). */
export async function waitForEmail(
  email: string,
  subjectContains: string,
  timeoutMs = 10_000,
): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = (await listMessagesTo(email)).find((message) =>
      message.Subject.includes(subjectContains),
    );
    if (match) {
      return getJson<MailpitMessage>(`/api/v1/message/${match.ID}`);
    }
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 200));
  }
  throw new Error(`Aucun email « ${subjectContains} » reçu par ${email}.`);
}

/** Extrait le jeton du lien (fragment #token=…). */
export function extractToken(message: MailpitMessage): string {
  const match = /#token=([A-Za-z0-9_-]+)/.exec(message.Text);
  if (!match?.[1]) throw new Error('Aucun jeton dans le message.');
  return match[1];
}
