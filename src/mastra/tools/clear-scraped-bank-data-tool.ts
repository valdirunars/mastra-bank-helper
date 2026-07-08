import { access, unlink } from 'node:fs/promises';
import path from 'node:path';

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { allScrapeOutputTargets } from './assert-scraped-data';
import { resolveProjectRoot } from './project-root';
import {
  getScrapeDataAge,
  getScrapeMetadataRelativePath,
} from './scraped-data-metadata';

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export const clearScrapedBankDataTool = createTool({
  id: 'clear-scraped-bank-pricing',
  description:
    'Delete all saved bank pricing scrape files (Arion and Landsbankinn, Icelandic and English) plus scrape metadata. Requires user approval before running. Only suggest this when scrapedAt is more than 7 days old and the user wants to remove stale data or refresh from scratch. After clearing, call scrape-bank-pricing to fetch new data.',
  requireApproval: true,
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe(
        'Brief note on why clearing is needed (e.g. data is over a week old and user wants a fresh scrape)',
      ),
  }),
  outputSchema: z.object({
    clearedAt: z.string(),
    deletedFiles: z.array(z.string()),
    previousScrapedAt: z.string().nullable(),
    message: z.string(),
  }),
  mcp: {
    annotations: {
      title: 'Clear scraped bank pricing',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  execute: async () => {
    const projectRoot = await resolveProjectRoot();
    const previousAge = await getScrapeDataAge();
    const deletedFiles: string[] = [];

    for (const target of allScrapeOutputTargets()) {
      const outputPath = path.join(projectRoot, target.path);
      if (await pathExists(outputPath)) {
        await unlink(outputPath);
        deletedFiles.push(target.path);
      }
    }

    const metadataPath = path.join(projectRoot, getScrapeMetadataRelativePath());
    const metadataRelativePath = getScrapeMetadataRelativePath();
    if (await pathExists(metadataPath)) {
      await unlink(metadataPath);
      deletedFiles.push(metadataRelativePath);
    }

    if (deletedFiles.length === 0) {
      return {
        clearedAt: new Date().toISOString(),
        deletedFiles,
        previousScrapedAt: null,
        message: 'No scraped bank pricing files were found on disk.',
      };
    }

    return {
      clearedAt: new Date().toISOString(),
      deletedFiles,
      previousScrapedAt: previousAge?.scrapedAt ?? null,
      message:
        'Cleared saved bank pricing scrape files. Call scrape-bank-pricing when you need fresh data.',
    };
  },
});
