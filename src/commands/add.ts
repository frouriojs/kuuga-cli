import fs from 'fs-extra';
import path from 'path';
import { mainTemplate } from '../templates/mainTemplate.js';
import { metaTemplate } from '../templates/metaTemplate.js';

export async function add(paperName: string): Promise<void> {
  const draftsDir = path.resolve('drafts');
  const fullPath = path.join(draftsDir, paperName);

  await fs.ensureDir(fullPath);

  await fs.writeFile(path.join(fullPath, 'main.md'), mainTemplate);
  await fs.writeFile(path.join(fullPath, 'meta.json'), metaTemplate);

  console.log(`✅ Created draft template at ${fullPath}`);
}
