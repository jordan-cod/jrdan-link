import type { OpenAPIHono } from '@hono/zod-openapi';

import { registerCreateLinkRoute } from '@/domains/link/routes/create-link-route';
import { registerDeleteLinkRoute } from '@/domains/link/routes/delete-link-route';
import { registerGetLinkQrRoute } from '@/domains/link/routes/get-link-qr-route';
import { registerListLinksRoute } from '@/domains/link/routes/list-links-route';
import { registerRedirectLinkRoute } from '@/domains/link/routes/redirect-link-route';
import { registerUpdateLinkRoute } from '@/domains/link/routes/update-link-route';

export function registerLinkRoutes(app: OpenAPIHono) {
  registerCreateLinkRoute(app);
  registerListLinksRoute(app);
  registerUpdateLinkRoute(app);
  registerDeleteLinkRoute(app);
  registerGetLinkQrRoute(app);

  // Por último: /{id} é catch-all e não pode engolir /links.
  registerRedirectLinkRoute(app);
}
