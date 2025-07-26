import fs from 'fs-extra';
import path from 'path';
import { mainTemplate } from '../templates/mainTemplate.js';
import { createMetaTemplate } from '../templates/metaTemplate.js';

export async function add(paperName: string): Promise<void> {
  const draftsDir = path.resolve('drafts');
  const fullPath = path.join(draftsDir, paperName);

  await fs.ensureDir(fullPath);

  const metaContent = await createMetaTemplate();

  await fs.writeFile(path.join(fullPath, 'main.md'), mainTemplate);
  await fs.writeJSON(path.join(fullPath, 'meta.json'), metaContent, { spaces: 2 });

  console.log(`✅ Created draft template at ${fullPath}`);
}
