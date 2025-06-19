import fs from 'fs-extra';
import path from 'path';
import { githubWorkflowTemplate } from '../templates/githubWorkflowTemplate.js';
import { dockerfileTemplate } from '../templates/dockerfileTemplate.js';
import { publishScriptTemplate } from '../templates/publishScriptTemplate.js';

export async function init(paperPath: string) {
  const fullPath = path.resolve(paperPath);
  const workflowDir = path.join(fullPath, '.github', 'workflows');

  await fs.ensureDir(workflowDir);
  await fs.writeFile(path.join(workflowDir, 'commit-zips.yml'), githubWorkflowTemplate);
  await fs.writeFile(path.join(fullPath, 'Dockerfile'), dockerfileTemplate);
  await fs.writeFile(path.join(fullPath, 'publish.sh'), publishScriptTemplate);

  console.log(`✅ Initialized kuuga project at ${fullPath}`);
  console.log('📝 Use "kuuga add <dir>" to create a new paper directory');
}
