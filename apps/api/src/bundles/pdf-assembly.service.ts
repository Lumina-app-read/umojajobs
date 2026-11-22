import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Injectable } from '@nestjs/common';

export interface AssemblyPart {
  kind: 'pdf' | 'image';
  data: Buffer;
}

/** Échec de lecture d'un PDF : protégé par mot de passe, illisible ou trop long à traiter. */
export class PdfAssemblyError extends Error {
  constructor(readonly reason: 'protected' | 'unreadable' | 'timeout') {
    super(reason);
  }
}

type Reply =
  { ok: true; pages: number; pdf?: Uint8Array } | { ok: false; reason: 'protected' | 'unreadable' };

const INSPECT_TIMEOUT_MS = 30_000;
const ASSEMBLE_TIMEOUT_MS = 60_000;
/** Assemblages simultanés au plus : chacun garde plusieurs dizaines de Mo en mémoire. */
const MAX_CONCURRENT = 2;
const MAX_HEAP_MB = 512;

/** Même emplacement en développement (TypeScript lu par Node) et après compilation. */
const WORKER_FILE = join(
  __dirname,
  __filename.endsWith('.ts') ? 'pdf-assembly.worker.mts' : 'pdf-assembly.worker.mjs',
);

/** Lecture et assemblage de PDF, chacun dans un fil isolé, borné en temps et en mémoire. */
@Injectable()
export class PdfAssemblyService {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  /** Nombre de pages d'un PDF reçu ; échoue s'il est protégé ou illisible. */
  async inspect(pdf: Buffer): Promise<number> {
    return (await this.run({ operation: 'inspect', pdf }, INSPECT_TIMEOUT_MS)).pages;
  }

  /** Un seul PDF, dans l'ordre reçu, débarrassé des éléments actifs des fichiers d'origine. */
  async assemble(title: string, parts: AssemblyPart[]): Promise<{ pdf: Buffer; pages: number }> {
    const reply = await this.run({ operation: 'assemble', title, parts }, ASSEMBLE_TIMEOUT_MS);
    if (!reply.pdf) throw new PdfAssemblyError('unreadable');
    return { pdf: Buffer.from(reply.pdf), pages: reply.pages };
  }

  private async run(task: object, timeoutMs: number) {
    await this.acquire();
    try {
      return await this.execute(task, timeoutMs);
    } finally {
      this.release();
    }
  }

  private execute(task: object, timeoutMs: number): Promise<Extract<Reply, { ok: true }>> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_FILE, {
        workerData: task,
        // Ni variables d'environnement ni secrets dans le fil qui lit des fichiers inconnus.
        env: {},
        resourceLimits: { maxOldGenerationSizeMb: MAX_HEAP_MB },
      });
      const stop = () => {
        clearTimeout(timer);
        void worker.terminate();
      };
      const timer = setTimeout(() => {
        stop();
        reject(new PdfAssemblyError('timeout'));
      }, timeoutMs);
      worker.once('message', (reply: Reply) => {
        stop();
        if (reply.ok) resolve(reply);
        else reject(new PdfAssemblyError(reply.reason));
      });
      // Mémoire épuisée ou erreur interne de lecture : le fichier est considéré comme illisible.
      worker.once('error', () => {
        stop();
        reject(new PdfAssemblyError('unreadable'));
      });
      worker.once('exit', () => {
        stop();
        reject(new PdfAssemblyError('unreadable'));
      });
    });
  }

  private async acquire(): Promise<void> {
    if (this.running >= MAX_CONCURRENT) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
      return;
    }
    this.running += 1;
  }

  private release(): void {
    const next = this.waiting.shift();
    // La place passe directement au suivant : le compteur ne change pas.
    if (next) next();
    else this.running -= 1;
  }
}
