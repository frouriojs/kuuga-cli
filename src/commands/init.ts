import fs from 'fs-extra';
import path from 'path';
import { mainTemplate } from '../templates/mainTemplate';
import { metaTemplate } from '../templates/metaTemplate';
import { manifestTemplate } from '../templates/manifestTemplate';
import { readmeTemplate } from '../templates/readmeTemplate';
import { githubWorkflowTemplate } from '../templates/githubWorkflowTemplate';
import { dockerfileTemplate } from '../templates/dockerfileTemplate';
import { publishScriptTemplate } from '../templates/publishScriptTemplate';

export async function init(paperPath: string) {
  const fullPath = path.resolve(paperPath);
  await fs.ensureDir(fullPath);

  await fs.writeFile(path.join(fullPath, 'main.md'), mainTemplate);
  await fs.writeFile(path.join(fullPath, 'meta.json'), metaTemplate('Sample Title', 'Sample Author'));
  await fs.writeFile(path.join(fullPath, 'manifest.json'), manifestTemplate);
  await fs.writeFile(path.join(fullPath, 'README.md'), readmeTemplate('Sample Title'));

  const workflowDir = path.join(fullPath, '.github', 'workflows');
  await fs.ensureDir(workflowDir);
  await fs.writeFile(path.join(workflowDir, 'commit-zips.yml'), githubWorkflowTemplate);

  const dockerDir = path.join(fullPath, 'docker');
  await fs.ensureDir(dockerDir);
  await fs.writeFile(path.join(fullPath, 'Dockerfile'), dockerfileTemplate);
  await fs.writeFile(path.join(dockerDir, 'publish.sh'), publishScriptTemplate);

  console.log(`✅ Initialized paper template at ${fullPath}`);
}
