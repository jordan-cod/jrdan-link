import type { ContentfulStatusCode } from 'hono/utils/http-status';

export abstract class AppError extends Error {
  abstract readonly statusCode: ContentfulStatusCode;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
}
