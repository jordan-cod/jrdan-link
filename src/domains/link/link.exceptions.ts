import createError from 'http-errors';

export const linkNotFound = (id: string) => createError.NotFound(`link "${id}" not found`);

export const slugTaken = (slug: string) => createError.Conflict(`slug "${slug}" already taken`);
