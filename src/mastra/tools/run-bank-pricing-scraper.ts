import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  bankPricingCatalogSchema,
  type BankPricingCatalog,
  type BankPricingToolInput,
} from './bank-pricing-schemas';

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function runBankPricingScraper(
  configPath: string,
  input: BankPricingToolInput = {},
): Promise<BankPricingCatalog> {
  const pythonPath = path.join(projectRoot, '.venv/bin/python');
  const configFile = path.join(projectRoot, configPath);

  if (!(await pathExists(pythonPath))) {
    throw new Error(
      'Python scraper environment not found. Run `npm run scrape:install` first.',
    );
  }

  if (!(await pathExists(configFile))) {
    throw new Error(`Scraper config not found: ${configPath}`);
  }

  const args = [
    '-m',
    'scrapers',
    '--config',
    configFile,
    '--output',
    'json',
  ];

  if (input.documentsOnly) {
    args.push('--documents-only');
  }

  const { stdout, stderr } = await execFileAsync(pythonPath, args, {
    cwd: projectRoot,
    maxBuffer: 50 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    env: process.env,
  });

  if (stderr.trim()) {
    console.warn(`[bank-scraper:${configPath}] ${stderr.trim()}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Failed to parse scraper output. stdout: ${stdout.slice(0, 500)}`,
    );
  }

  return bankPricingCatalogSchema.parse(parsed);
}
