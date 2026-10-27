// O SST carrega .env e .env.<stage> no process.env do config.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não está definido. Copie o .env.example pra .env e preencha antes do deploy.`);
  }
  return value;
}

const rootDomain = required('DOMAIN');

// Produção no apex; qualquer outro stage ganha o seu próprio subdomínio.
const redirectDomain = $app.stage === 'production' ? rootDomain : `${$app.stage}.${rootDomain}`;

export const stage = {
  redirectDomain,
  baseUrl: `https://${redirectDomain}`,
  /** Datasets do Analytics Engine não são criados por IaC; o nome é a identidade. */
  clicksDataset: `${$app.name}_${$app.stage}_clicks`.replace(/[^a-zA-Z0-9_]/g, '_'),
};
