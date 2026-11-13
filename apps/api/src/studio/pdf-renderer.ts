import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Browser, launch } from 'puppeteer-core';
import { type EnvironmentVariables } from '../config/env.validation';

/** Impression d'une page web en PDF. Remplaçable dans les tests. */
export interface PdfRenderer {
  readonly enabled: boolean;
  /** Imprime l'adresse donnée au format A4 ; échoue si la page ne signale pas qu'elle est prête. */
  render(url: string): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PDF_RENDERER');

const PAGE_TIMEOUT_MS = 30_000;
/** Impressions simultanées au plus : Chromium est gourmand en mémoire. */
const MAX_CONCURRENT = 2;

/**
 * Impression par Chromium sans interface (puppeteer-core, aucun navigateur téléchargé : le chemin
 * vient de CHROMIUM_EXECUTABLE_PATH). Le navigateur est lancé à la première impression puis réutilisé ;
 * chaque impression utilise un contexte isolé, sans cookies ni stockage partagés.
 */
@Injectable()
export class ChromiumPdfRenderer implements PdfRenderer, OnModuleDestroy {
  private readonly logger = new Logger(ChromiumPdfRenderer.name);
  private readonly executablePath: string | undefined;
  private browser: Promise<Browser> | null = null;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.executablePath = config.get('CHROMIUM_EXECUTABLE_PATH', { infer: true }) || undefined;
  }

  get enabled(): boolean {
    return Boolean(this.executablePath);
  }

  async render(url: string): Promise<Buffer> {
    await this.acquire();
    try {
      const browser = await this.getBrowser();
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: PAGE_TIMEOUT_MS,
        });
        if (!response?.ok()) throw new Error(`page d'impression : HTTP ${response?.status() ?? 0}`);
        // La page pose ce marqueur une fois le document et les polices chargés.
        await page.waitForSelector('[data-print-ready="true"]', { timeout: PAGE_TIMEOUT_MS });
        // Évalué dans la page (chaîne : le code de l'API n'a pas les types du navigateur).
        await page.evaluate('document.fonts.ready.then(() => true)');
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        return Buffer.from(pdf);
      } finally {
        await context.close().catch(() => undefined);
      }
    } catch (error) {
      // Navigateur arrêté entre deux impressions : il sera relancé à la prochaine.
      if (!(await this.browser?.then((b) => b.connected).catch(() => false))) this.browser = null;
      throw error;
    } finally {
      this.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const browser = await this.browser?.catch(() => null);
    await browser?.close().catch(() => undefined);
  }

  private getBrowser(): Promise<Browser> {
    if (!this.executablePath) throw new Error('CHROMIUM_EXECUTABLE_PATH non configuré');
    this.browser ??= launch({
      executablePath: this.executablePath,
      headless: true,
      args: ['--no-first-run', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    }).catch((error: unknown) => {
      this.browser = null;
      this.logger.error(`Chromium ne démarre pas : ${(error as Error).message}`);
      throw error;
    });
    return this.browser;
  }

  private async acquire(): Promise<void> {
    if (this.running < MAX_CONCURRENT) {
      this.running += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running += 1;
  }

  private release(): void {
    this.running -= 1;
    this.waiting.shift()?.();
  }
}
