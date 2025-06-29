import fs from 'fs-extra';
import path from 'path';
import { dockerfileTemplate } from '../templates/dockerfileTemplate.js';
import { githubWorkflowTemplate } from '../templates/githubWorkflowTemplate.js';

export async function init(): Promise<void> {
  const fullPath = path.resolve();
  const workflowDir = path.join(fullPath, '.github', 'workflows');

  await fs.ensureDir(workflowDir);
  await fs.writeFile(path.join(workflowDir, 'build-papers.yml'), githubWorkflowTemplate);
  await fs.writeFile(path.join(fullPath, 'Dockerfile'), dockerfileTemplate);

  console.log(`✅ Initialized kuuga project at ${fullPath}`);
  console.log('📝 Use "kuuga add <name>" to create a new draft directory');
}
