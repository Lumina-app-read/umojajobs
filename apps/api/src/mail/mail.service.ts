import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { type EnvironmentVariables } from '../config/env.validation';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envoi SMTP : Brevo en production, Mailpit en développement et en test (aucun envoi réel).
 * Une file d'envoi avec reprise (outbox) est prévue en phase 5.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASSWORD', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  /**
   * Envoie un email. Un échec est journalisé sans interrompre l'opération métier :
   * l'utilisateur peut redemander l'email (vérification, réinitialisation).
   */
  async send(email: OutgoingEmail): Promise<boolean> {
    try {
      await this.transporter.sendMail({ from: this.from, ...email });
      return true;
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email « ${email.subject} » : ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
