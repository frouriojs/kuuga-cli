import type { UnixFS } from '@helia/unixfs';
import fs from 'fs/promises';
import type { CID } from 'multiformats/cid';
import path from 'path';

// HeliaとUnixFSを使ってディレクトリを追加してCIDを取得
export async function addDirectory(heliaFs: UnixFS, dirPath: string): Promise<CID> {
  async function* addDirectoryEntries(): AsyncGenerator<{
    path: string;
    content: AsyncIterable<Uint8Array> | Uint8Array;
  }> {
    async function* walkDirectory(
      currentPath: string,
      basePath: string = '',
    ): AsyncGenerator<{ path: string; content: AsyncIterable<Uint8Array> | Uint8Array }> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          yield* walkDirectory(fullPath, relativePath);
        } else {
          // Exclude cid.txt and .ots files from IPFS upload
          if (entry.name === 'cid.txt' || entry.name === 'cid.txt.ots') {
            continue;
          }
          const content = await fs.readFile(fullPath);
          yield { path: relativePath, content };
        }
      }
    }

    yield* walkDirectory(dirPath);
  }

  const entries = addDirectoryEntries();
  const addResults = heliaFs.addAll(entries, { wrapWithDirectory: true });

  let directoryCid: CID | undefined;
  for await (const result of addResults) {
    if (!result.path || result.path === '') {
      directoryCid = result.cid;
    }
  }

  if (!directoryCid) {
    throw new Error('Failed to get directory CID');
  }

  return directoryCid;
}
