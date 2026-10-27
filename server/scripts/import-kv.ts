import { loadConfig } from '../src/config';
import { openDatabase } from '../src/db/database';
import { CloudflareEdge } from '../src/edge/cloudflare';
import { LinkRepository } from '../src/links/repository';

const config = loadConfig();
const repository = new LinkRepository(openDatabase(config.databasePath));
const edge = new CloudflareEdge({ ...config.cloudflare, shortBaseUrl: config.shortBaseUrl });

const remote = await edge.list();
let imported = 0;

for (const link of remote) {
	if (repository.insert({ ...link, updatedAt: link.createdAt })) imported++;
}

console.log(`Found ${remote.length} links on the edge, imported ${imported} new ones.`);
