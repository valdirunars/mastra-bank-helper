import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { getBankPricingOutputPath } from './read-bank-pricing';
import { resolveProjectRoot } from './project-root';
import {
  getScraperConfigPath,
  SCRAPER_BANKS,
  SCRAPER_LOCALES,
  type ScraperBank,
  type ScraperLocale,
} from './scraper-config';

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
        ),
      );
    });
  });
}

async function ensureScraperEnvironment(projectRoot: string): Promise<void> {
  const venvPython = path.join(projectRoot, '.venv/bin/python');
  try {
    await runCommand(venvPython, ['--version'], projectRoot);
  } catch {
    await runCommand('npm', ['run', 'scrape:install'], projectRoot);
  }
}

async function runBankScraper(
  bank: ScraperBank,
  locale: ScraperLocale,
  projectRoot: string,
): Promise<void> {
  const configPath = getScraperConfigPath(bank, locale);
  const outputPath = getBankPricingOutputPath(bank, locale);
  const python = path.join(projectRoot, '.venv/bin/python');

  await runCommand(
    python,
    [
      '-m',
      'scrapers',
      '--config',
      configPath,
      '--output',
      'json',
      '--output-file',
      outputPath,
    ],
    projectRoot,
  );
}

/** Scrape all banks in both Icelandic and English (four output files). */
export async function runAllBankScrapers(): Promise<void> {
  const projectRoot = await resolveProjectRoot();
  await ensureScraperEnvironment(projectRoot);
  await mkdir(path.join(projectRoot, '.scraper-output'), { recursive: true });

  for (const bank of SCRAPER_BANKS) {
    for (const locale of SCRAPER_LOCALES) {
      await runBankScraper(bank, locale, projectRoot);
    }
  }
}
