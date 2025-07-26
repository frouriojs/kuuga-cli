import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import type { MetaSchema } from '../commands/validate';

export const ConfigSchema = z.object({
  author: z.object({ name: z.string(), pubKey: z.string().startsWith('sha256:') }),
});

export async function createMetaTemplate(): Promise<z.infer<typeof MetaSchema>> {
  const configPath = path.join(path.resolve(), '.kuuga', 'config.json');
  const config = ConfigSchema.parse(await fs.readJSON(configPath));

  return {
    title: '',
    language: 'earth:ja',
    version: 1,
    authors: [config.author],
    references: [],
    license: 'CC0-1.0',
  };
}
