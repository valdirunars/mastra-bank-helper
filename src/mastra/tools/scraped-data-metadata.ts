import { access, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { allScrapeOutputTargets } from './assert-scraped-data';
import { resolveProjectRoot } from './project-root';

export const SCRAPE_OUTPUT_DIR = '.scraper-output';
export const SCRAPE_METADATA_FILENAME = 'metadata.json';
export const SCRAPE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const scrapeMetadataSchema = z.object({
  scrapedAt: z.string(),
});

export type ScrapeDataMetadata = {
  scrapedAt: string;
};

export type ScrapeDataAge = {
  scrapedAt: string;
  ageMs: number;
  isOlderThanWeek: boolean;
  source: 'metadata' | 'file_mtime';
};

export function getScrapeMetadataRelativePath(): string {
  return path.join(SCRAPE_OUTPUT_DIR, SCRAPE_METADATA_FILENAME);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function writeScrapeMetadata(scrapedAt: string): Promise<void> {
  const projectRoot = await resolveProjectRoot();
  const metadataPath = path.join(projectRoot, getScrapeMetadataRelativePath());
  await writeFile(
    metadataPath,
    `${JSON.stringify({ scrapedAt }, null, 2)}\n`,
    'utf-8',
  );
}

export async function readScrapeMetadata(): Promise<ScrapeDataMetadata | null> {
  const projectRoot = await resolveProjectRoot();
  const metadataPath = path.join(projectRoot, getScrapeMetadataRelativePath());

  if (!(await pathExists(metadataPath))) {
    return null;
  }

  try {
    const parsed = JSON.parse(await readFile(metadataPath, 'utf-8'));
    return scrapeMetadataSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function inferScrapedAtFromFiles(): Promise<string | null> {
  const projectRoot = await resolveProjectRoot();
  let oldestMs: number | null = null;

  for (const target of allScrapeOutputTargets()) {
    const outputPath = path.join(projectRoot, target.path);
    if (!(await pathExists(outputPath))) {
      continue;
    }

    const fileStat = await stat(outputPath);
    if (oldestMs === null || fileStat.mtimeMs < oldestMs) {
      oldestMs = fileStat.mtimeMs;
    }
  }

  return oldestMs === null ? null : new Date(oldestMs).toISOString();
}

export async function getScrapeDataAge(): Promise<ScrapeDataAge | null> {
  const metadata = await readScrapeMetadata();
  const scrapedAt =
    metadata?.scrapedAt ?? (await inferScrapedAtFromFiles());

  if (!scrapedAt) {
    return null;
  }

  const ageMs = Date.now() - Date.parse(scrapedAt);

  return {
    scrapedAt,
    ageMs,
    isOlderThanWeek: ageMs > SCRAPE_DATA_MAX_AGE_MS,
    source: metadata ? 'metadata' : 'file_mtime',
  };
}
