import { type NextFunction, type Response } from 'express';
import { uuidv7 } from '../uuid-v7';
import { type AppRequest } from './app-request';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Attribue un identifiant de corrélation à chaque requête et le renvoie dans X-Request-Id.
 * Un identifiant fourni par le reverse proxy est conservé s'il est bien formé.
 */
export function requestIdMiddleware(req: AppRequest, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : uuidv7();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
