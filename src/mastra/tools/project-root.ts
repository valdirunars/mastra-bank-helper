import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function hasProjectMarker(dir: string): Promise<boolean> {
  try {
    await access(path.join(dir, 'scrapers', 'requirements.txt'));
    await access(path.join(dir, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

export async function resolveProjectRoot(): Promise<string> {
  const candidates = [
    process.cwd(),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'),
  ];

  for (const candidate of candidates) {
    if (await hasProjectMarker(candidate)) {
      return candidate;
    }
  }

  return process.cwd();
}
