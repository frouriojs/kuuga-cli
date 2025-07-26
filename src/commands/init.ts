import { createHash, generateKeyPairSync } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { ConfigSchema } from 'src/templates/metaTemplate.js';
import type { z } from 'zod';
import { dockerfileTemplate } from '../templates/dockerfileTemplate.js';
import { githubWorkflowTemplate } from '../templates/githubWorkflowTemplate.js';

export async function init(): Promise<void> {
  const fullPath = path.resolve();
  const workflowDir = path.join(fullPath, '.github', 'workflows');

  await fs.ensureDir(workflowDir);

  const gitignoreContent = `.kuuga/private_key.pem
node_modules
`;

  await fs.writeFile(path.join(fullPath, '.gitignore'), gitignoreContent);
  await fs.writeFile(path.join(workflowDir, 'build-papers.yml'), githubWorkflowTemplate);
  await fs.writeFile(path.join(fullPath, 'Dockerfile'), dockerfileTemplate);

  console.log(`✅ Initialized kuuga project at ${fullPath}`);
  console.log('📝 Use "kuuga add <name>" to create a new draft directory');

  const kuugaDir = path.join(fullPath, '.kuuga');

  if (fs.existsSync(kuugaDir)) return;

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const publicKeyHash = createHash('sha256').update(publicKey).digest('hex');
  const config = ConfigSchema.parse({
    author: { name: 'My Name', pubKey: `sha256:${publicKeyHash}` },
  } satisfies z.infer<typeof ConfigSchema>);

  await fs.mkdir(kuugaDir);
  await fs.writeFile(path.join(kuugaDir, 'private_key.pem'), privateKey);
  await fs.writeFile(path.join(kuugaDir, 'public_key.pem'), publicKey);
  await fs.writeJSON(path.join(kuugaDir, 'config.json'), config, { spaces: 2 });

  console.log('🔐 Generated RSA key pair in .kuuga directory');
}
