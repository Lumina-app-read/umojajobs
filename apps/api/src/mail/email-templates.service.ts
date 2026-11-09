import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTranslator, type I18nLocale } from '@opportinities/i18n';
import { APP_NAME } from '@opportinities/shared';
import { type EnvironmentVariables } from '../config/env.validation';
import { type OutgoingEmail } from './mail.service';

export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_MINUTES = 60;

interface Recipient {
  email: string;
  firstName: string;
  locale: I18nLocale;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EmailContent {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  closing: string[];
}

/**
 * Emails transactionnels bilingues. Tous les textes viennent de @opportinities/i18n.
 * Les jetons sont placés dans le fragment de l'URL (#token=…) : ils ne sont jamais envoyés
 * aux serveurs (journaux d'accès, en-tête Referer). La page web les lit puis les soumet à l'API.
 */
@Injectable()
export class EmailTemplatesService {
  private readonly appUrl: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/+$/, '');
  }

  verifyEmail(to: Recipient, token: string): OutgoingEmail {
    const t = getTranslator(to.locale, 'emails');
    return this.render(to, {
      subject: t('verifyEmail.subject'),
      paragraphs: [t('verifyEmail.intro')],
      action: { label: t('verifyEmail.action'), url: this.link(to.locale, 'verify-email', token) },
      closing: [
        t('verifyEmail.expiry', { hours: EMAIL_VERIFICATION_TTL_HOURS }),
        t('verifyEmail.ignore'),
      ],
    });
  }

  accountExists(to: Recipient): OutgoingEmail {
    const t = getTranslator(to.locale, 'emails');
    return this.render(to, {
      subject: t('accountExists.subject'),
      paragraphs: [t('accountExists.intro'), t('accountExists.hint')],
      action: {
        label: t('accountExists.action'),
        url: `${this.appUrl}/${to.locale}/forgot-password`,
      },
      closing: [t('accountExists.ignore')],
    });
  }

  passwordReset(to: Recipient, token: string): OutgoingEmail {
    const t = getTranslator(to.locale, 'emails');
    return this.render(to, {
      subject: t('passwordReset.subject'),
      paragraphs: [t('passwordReset.intro')],
      action: {
        label: t('passwordReset.action'),
        url: this.link(to.locale, 'reset-password', token),
      },
      closing: [
        t('passwordReset.expiry', { minutes: PASSWORD_RESET_TTL_MINUTES }),
        t('passwordReset.ignore'),
      ],
    });
  }

  passwordChanged(to: Recipient): OutgoingEmail {
    const t = getTranslator(to.locale, 'emails');
    return this.render(to, {
      subject: t('passwordChanged.subject'),
      paragraphs: [t('passwordChanged.intro')],
      closing: [t('passwordChanged.warning')],
    });
  }

  private link(locale: I18nLocale, page: string, token: string): string {
    return `${this.appUrl}/${locale}/${page}#token=${encodeURIComponent(token)}`;
  }

  private render(to: Recipient, content: EmailContent): OutgoingEmail {
    const t = getTranslator(to.locale, 'emails');
    const greeting = t('common.greeting', { firstName: to.firstName });
    const signature = t('common.signature');
    const footer = t('common.footer');

    const textParts = [greeting, '', ...content.paragraphs, ''];
    if (content.action) {
      textParts.push(content.action.label, content.action.url, '');
    }
    textParts.push(...content.closing, '', signature, '', footer);

    const p = (text: string): string =>
      `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(text)}</p>`;
    const action = content.action
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(content.action.url)}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(content.action.label)}</a></p>` +
        p(t('common.linkFallback')) +
        `<p style="margin:0 0 16px;word-break:break-all;font-size:13px;color:#475569;">${escapeHtml(content.action.url)}</p>`
      : '';

    const html = `<!doctype html>
<html lang="${to.locale}">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'IBM Plex Sans',Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;">
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1e3a8a;">${APP_NAME}</p>
    ${p(greeting)}
    ${content.paragraphs.map(p).join('\n    ')}
    ${action}
    ${content.closing.map(p).join('\n    ')}
    ${p(signature)}
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#64748b;">${escapeHtml(footer)}</p>
</body>
</html>`;

    return {
      to: to.email,
      subject: `${content.subject} — ${APP_NAME}`,
      text: textParts.join('\n'),
      html,
    };
  }
}
