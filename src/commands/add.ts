import fs from 'fs-extra';
import path from 'path';
import { mainTemplate } from '../templates/mainTemplate.js';
import { metaTemplate } from '../templates/metaTemplate.js';
import { readmeTemplate } from '../templates/readmeTemplate.js';

export async function add(paperName: string) {
  const papersDir = path.resolve('papers');
  const fullPath = path.join(papersDir, paperName);
  
  await fs.ensureDir(fullPath);

  await fs.writeFile(path.join(fullPath, 'main.md'), mainTemplate);
  await fs.writeFile(path.join(fullPath, 'meta.json'), metaTemplate);
  await fs.writeFile(path.join(fullPath, 'README.md'), readmeTemplate);

  console.log(`✅ Created paper template at ${fullPath}`);
}
