import { ConflictError, NotFoundError } from '@/shared/error-handling/app-error';

export const LinkExceptions = {
  notFound: () => new NotFoundError('link.not_found', 'link not found'),
  slugTaken: () => new ConflictError('link.slug_taken', 'slug already taken'),
};
