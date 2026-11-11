import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../config/env.validation';

/**
 * Stockage objet privé compatible S3 (Garage en développement, fournisseur S3 en production).
 * Le bucket n'autorise aucun accès anonyme : un fichier n'est lisible que par un lien signé
 * de courte durée, délivré par l'API après contrôle des droits. Connaître la clé ne suffit pas.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;
  readonly urlTtlSeconds: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.urlTtlSeconds = config.get('FILE_URL_TTL_SECONDS', { infer: true });
    this.client = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async put(key: string, body: Buffer, contentType: string, sha256Base64: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Le stockage vérifie l'intégrité du contenu reçu.
        ChecksumSHA256: sha256Base64,
      }),
    );
  }

  /** Contenu d'un objet, lu côté serveur (rendu des documents ; jamais transmis tel quel). */
  async read(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Objet vide : ${key}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Lien de téléchargement signé, valable quelques secondes, avec le nom de fichier d'origine. */
  async signedDownloadUrl(
    key: string,
    fileName: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.urlTtlSeconds * 1000);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        ResponseContentType: 'application/pdf',
      }),
      { expiresIn: this.urlTtlSeconds },
    );
    return { url, expiresAt };
  }
}
