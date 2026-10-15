import { createVercelApiServer } from './vercel-service.ts';

const server = createVercelApiServer();
server.listen(Number(process.env.PORT ?? 3000));
