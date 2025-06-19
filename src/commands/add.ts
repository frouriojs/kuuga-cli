import fs from 'fs-extra';
import path from 'path';
import { mainTemplate } from '../templates/mainTemplate.js';
import { metaTemplate } from '../templates/metaTemplate.js';
import { manifestTemplate } from '../templates/manifestTemplate.js';
import { readmeTemplate } from '../templates/readmeTemplate.js';

export async function add(paperPath: string) {
  const fullPath = path.resolve(paperPath);
  await fs.ensureDir(fullPath);

  await fs.writeFile(path.join(fullPath, 'main.md'), mainTemplate);
  await fs.writeFile(path.join(fullPath, 'meta.json'), metaTemplate('Sample Title', 'Sample Author'));
  await fs.writeFile(path.join(fullPath, 'manifest.json'), manifestTemplate);
  await fs.writeFile(path.join(fullPath, 'README.md'), readmeTemplate('Sample Title'));

  console.log(`✅ Created paper template at ${fullPath}`);
}
