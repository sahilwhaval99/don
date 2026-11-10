import fs from 'fs';
import path from 'path';
import { buildServer } from '../apps/api/src/server.js';

async function verifyDocker() {
  console.log('--- Round 7: Docker Container & Cloud Run Readiness Check ---');

  const dockerfilePath = path.resolve('apps/api/Dockerfile');
  const dockerignorePath = path.resolve('apps/api/.dockerignore');
  const cloudbuildPath = path.resolve('cloudbuild.yaml');

  // 1. Check Dockerfile existence
  if (!fs.existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile missing at ${dockerfilePath}`);
  }
  console.log('✓ Found apps/api/Dockerfile');

  // 2. Inspect Dockerfile contents
  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');

  // Check multi-stage
  if (!dockerfileContent.includes('AS builder') || !dockerfileContent.includes('AS runner')) {
    throw new Error('Dockerfile does not implement multi-stage build (builder + runner stages required).');
  }
  console.log('✓ Multi-stage build pattern validated (builder -> runner)');

  // Check non-root user
  if (!dockerfileContent.includes('USER nodejs') && !dockerfileContent.includes('USER node')) {
    throw new Error('Dockerfile does not enforce non-root user execution.');
  }
  console.log('✓ Container security: Non-root user execution enforced');

  // Check Cloud Run PORT=8080
  if (!dockerfileContent.includes('8080')) {
    throw new Error('Dockerfile does not configure standard Cloud Run port (8080).');
  }
  console.log('✓ Cloud Run port 8080 standard configured');

  // Check Healthcheck instruction
  if (!dockerfileContent.includes('HEALTHCHECK') || !dockerfileContent.includes('/health')) {
    throw new Error('Dockerfile lacks container HEALTHCHECK pointing to /health.');
  }
  console.log('✓ Container HEALTHCHECK probe configured against /health endpoint');

  // 3. Check .dockerignore
  if (!fs.existsSync(dockerignorePath)) {
    throw new Error('.dockerignore missing in apps/api');
  }
  console.log('✓ Validated apps/api/.dockerignore');

  // 4. Check cloudbuild.yaml
  if (!fs.existsSync(cloudbuildPath)) {
    throw new Error('cloudbuild.yaml missing in repo root');
  }
  const cloudbuildContent = fs.readFileSync(cloudbuildPath, 'utf-8');
  if (!cloudbuildContent.includes('don-api') || !cloudbuildContent.includes('gcloud')) {
    throw new Error('cloudbuild.yaml does not define valid Cloud Run deployment steps.');
  }
  console.log('✓ Validated cloudbuild.yaml Cloud Run deployment pipeline');

  // 5. Test Fastify /health endpoint response directly
  console.log('Testing Fastify /health endpoint response...');
  const app = buildServer();
  await app.ready();
  const res = await app.inject({ method: 'GET', url: '/health' });
  await app.close();

  if (res.statusCode !== 200) {
    throw new Error(`Server /health returned status ${res.statusCode}`);
  }
  const healthBody = JSON.parse(res.body);
  if (healthBody.status !== 'healthy') {
    throw new Error(`Unexpected /health body: ${res.body}`);
  }
  console.log(`✓ Live /health response: HTTP 200 ${JSON.stringify(healthBody)}`);

  console.log('=== Round 7 PASSED: Docker & Cloud Run container ready. ===');
}

verifyDocker().catch((err) => {
  console.error('Docker verification failed:', err);
  process.exit(1);
});
