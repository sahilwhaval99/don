import dotenv from 'dotenv';
dotenv.config();

import { buildServer } from './server.js';

const server = buildServer();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = '0.0.0.0';

server.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`DON API Server listening on ${address}`);
});
