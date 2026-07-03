import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import QRCode from 'qrcode';

import { linkIdParamSchema, qrQuerySchema } from '@/domains/link/link.schema';
import { LinkService } from '@/domains/link/link.service';
import { config } from '@/shared/config/config';
import { errorResponseSchema } from '@/shared/schemas/error.schema';

const route = createRoute({
  method: 'get',
  path: '/links/{id}/qr.png',
  summary: 'QR code',
  description: 'PNG com QR code apontando pro link curto.',
  tags: ['Links'],
  request: { params: linkIdParamSchema, query: qrQuerySchema },
  responses: {
    200: { content: { 'image/png': { schema: z.any() } }, description: 'QR code PNG' },
    404: { content: { 'application/json': { schema: errorResponseSchema } }, description: 'Link não existe' },
  },
});

export function registerGetLinkQrRoute(app: OpenAPIHono) {
  app.openapi(route, async (c) => {
    const linkService = new LinkService();
    const link = await linkService.resolveLink(c.req.valid('param').id);
    const png = await QRCode.toBuffer(`${config.BASE_URL}/${link.id}`, {
      width: c.req.valid('query').size,
      margin: 1,
    });
    return c.body(png.buffer as ArrayBuffer, 200, { 'Content-Type': 'image/png' });
  });
}
