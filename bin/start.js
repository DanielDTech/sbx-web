import { createClient } from '../src/client.js';
import { createServer } from '../src/server.js';

const port = Number(process.env.PORT ?? 4700);
const client = createClient({ baseUrl: process.env.SBX_API_URL ?? 'http://localhost:4600', apiKey: process.env.SBX_API_KEY ?? 'dev-key' });
createServer({ client }).listen(port, () => console.log(`sbx-web on http://localhost:${port}`));
