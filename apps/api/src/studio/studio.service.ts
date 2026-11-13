import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AVAILABLE_DOCUMENT_TYPES,
  type CareerDocumentCreateInput,
  type CareerDocumentResponse,
  type CareerDocumentSummary,
  type CareerDocumentUpdateInput,
  type CareerDocumentBrief,
  type CareerDocumentContent,
  emptyCv,
  emptyLetter,
  isLetterType,
  templatesFor,
  ERROR_CODES,
  STUDIO_LIMITS,
} from '@opportinities/shared';
import { getTranslator } from '@opportinities/i18n';
import { type AuthContext } from '../auth/auth-context';
import { type CareerDocument, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeBrief } from './brief-content';
import { normalizeCv } from './cv-content';
import { normalizeLetter } from './letter-content';

const toSummary = (row: CareerDocument): CareerDocumentSummary => ({
  id: row.id,
  type: row.type,
  title: row.title,
  language: row.language,
  templateKey: row.templateKey,
  version: row.version,
  updatedAt: row.updatedAt.toISOString(),
});

const toResponse = (row: CareerDocument): CareerDocumentResponse => ({
  ...toSummary(row),
  content: row.content as unknown as CareerDocumentContent,
  brief: row.brief as unknown as CareerDocumentBrief,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Documents du Career Studio : brouillons gratuits, enregistrés au fil de la saisie.
 * Le contenu est validé et normalisé ici (jamais tel quel depuis le navigateur) ; une version
 * optimiste empêche qu'un onglet écrase les modifications d'un autre.
 */
@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<CareerDocumentSummary[]> {
    const rows = await this.prisma.careerDocument.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: STUDIO_LIMITS.documentsMax,
    });
    return rows.map(toSummary);
  }

  async get(userId: string, id: string): Promise<CareerDocumentResponse> {
    return toResponse(await this.find(userId, id));
  }

  /**
   * Nouveau document prérempli avec les informations du compte (nom, email, téléphone, pays) ;
   * une lettre reçoit en plus les formules d'appel et de politesse dans la langue du document.
   */
  async create(
    auth: AuthContext,
    input: CareerDocumentCreateInput,
  ): Promise<CareerDocumentResponse> {
    if (!AVAILABLE_DOCUMENT_TYPES.includes(input.type)) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.CAREER_DOCUMENT_TYPE_UNAVAILABLE,
      });
    }
    const count = await this.prisma.careerDocument.count({
      where: { userId: auth.user.id, deletedAt: null },
    });
    if (count >= STUDIO_LIMITS.documentsMax) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_DOCUMENT_LIMIT });
    }
    const identity = {
      fullName: `${auth.user.firstName} ${auth.user.lastName}`,
      email: auth.user.email,
      phone: auth.user.phoneE164 ?? '',
      countryIso2: auth.user.countryIso2,
    };
    const t = getTranslator(input.language, 'studio');
    const content: CareerDocumentContent = isLetterType(input.type)
      ? emptyLetter(identity, {
          salutation: t('letterDefaults.salutation'),
          closing: t('letterDefaults.closing'),
          subject: '',
        })
      : emptyCv(identity);
    const row = await this.prisma.careerDocument.create({
      data: {
        userId: auth.user.id,
        type: input.type,
        title: input.title,
        language: input.language,
        templateKey: templatesFor(input.type)[0] as string,
        content: content as unknown as Prisma.InputJsonValue,
      },
    });
    return toResponse(row);
  }

  async update(
    userId: string,
    id: string,
    input: CareerDocumentUpdateInput,
  ): Promise<CareerDocumentResponse> {
    const existing = await this.find(userId, id);
    const data: Prisma.CareerDocumentUpdateManyMutationInput = { version: { increment: 1 } };
    if (input.title !== undefined) data.title = input.title;
    if (input.language !== undefined) data.language = input.language;
    if (input.templateKey !== undefined) {
      if (!templatesFor(existing.type).includes(input.templateKey)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          details: [{ field: 'templateKey', rules: ['isIn'] }],
        });
      }
      data.templateKey = input.templateKey;
    }
    if (input.content !== undefined) {
      const { content, issues } = isLetterType(existing.type)
        ? normalizeLetter(input.content)
        : normalizeCv(input.content);
      if (issues.length > 0) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          details: issues.map((issue) => ({
            field: `content.${issue.field}`,
            rules: [issue.rule],
          })),
        });
      }
      data.content = content as unknown as Prisma.InputJsonValue;
    }
    if (input.brief !== undefined) {
      const { brief, issues } = normalizeBrief(existing.type, input.brief);
      if (issues.length > 0) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_FAILED,
          details: issues.map((issue) => ({ field: `brief.${issue.field}`, rules: [issue.rule] })),
        });
      }
      data.brief = brief as unknown as Prisma.InputJsonValue;
    }
    // Mise à jour conditionnelle : seule la version lue peut être remplacée.
    const result = await this.prisma.careerDocument.updateMany({
      where: { id, userId, deletedAt: null, version: input.version },
      data,
    });
    if (result.count === 0) {
      throw new ConflictException({ code: ERROR_CODES.CAREER_DOCUMENT_VERSION_CONFLICT });
    }
    return this.get(userId, id);
  }

  /** Suppression par l'utilisateur : masqué, mais conservé (exports déjà payés, litiges). */
  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.careerDocument.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    }
  }

  private async find(userId: string, id: string): Promise<CareerDocument> {
    const row = await this.prisma.careerDocument.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    return row;
  }
}
