/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const isProduction = input.stage === 'production';
    return {
      name: process.env.APP_NAME ?? 'jrdan-link',
      home: 'cloudflare',
      removal: isProduction ? 'retain' : 'remove',
      protect: isProduction,
    };
  },

  async run() {
    const { registerInfrastructure } = await import('./infra/index');
    return registerInfrastructure();
  },
});
