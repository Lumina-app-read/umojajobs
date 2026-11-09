import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, ERROR_CODES, type ErrorCode } from '@opportinities/shared';
import { type Response } from 'express';
import { type AppRequest } from './app-request';

const DEFAULT_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODES.BAD_REQUEST,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
};

const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));

interface ErrorPayload {
  code?: unknown;
  details?: unknown;
  meta?: unknown;
}

/** Erreurs du parseur JSON d'Express (corps mal formé ou trop volumineux). */
function clientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { status, type } = exception as { status?: unknown; type?: unknown };
  if (typeof status === 'number' && status >= 400 && status < 500 && typeof type === 'string') {
    return status;
  }
  return null;
}

/**
 * Format unique des erreurs : { statusCode, code, requestId, details?, meta? }.
 * Aucun message technique, trace ou donnée saisie n'est renvoyé au client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const res = http.getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: ErrorPayload = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        payload = response;
      }
    } else {
      const status = clientErrorStatus(exception);
      if (status !== null) {
        statusCode = status;
      }
    }

    const code =
      typeof payload.code === 'string' && KNOWN_CODES.has(payload.code)
        ? (payload.code as ErrorCode)
        : (DEFAULT_CODES[statusCode] ?? ERROR_CODES.INTERNAL_ERROR);

    if (statusCode >= 500) {
      this.logger.error(
        `Erreur ${statusCode} [${req.requestId}] ${req.method} ${req.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = { statusCode, code, requestId: req.requestId };
    if (Array.isArray(payload.details)) {
      body.details = payload.details as ApiErrorBody['details'];
    }
    if (typeof payload.meta === 'object' && payload.meta !== null) {
      body.meta = payload.meta as Record<string, unknown>;
    }

    res.status(statusCode).json(body);
  }
}
