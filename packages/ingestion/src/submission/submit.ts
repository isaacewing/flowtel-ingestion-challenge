import 'dotenv/config';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import { asc, gt } from 'drizzle-orm';
import pino from 'pino';
import { getDb, closeDb } from '../db/client';
import { events } from '../db/schema';
import { runMigrations } from '../db/migrate';

const logger = pino({ transport: { target: 'pino-pretty' } });

const OUTPUT_FILE = path.join(__dirname, '../../../event_ids.txt');
const PAGE_SIZE = 10_000;

async function streamEventIds(outputPath: string): Promise<number> {
  const db = getDb();
  const stream = createWriteStream(outputPath);
  let lastId: string | null = null;
  let totalWritten = 0;

  logger.info({ outputPath }, 'Streaming event IDs to file using keyset pagination...');

  while (true) {
    // Keyset pagination — O(n) total using the primary key index
    let rows: { id: string }[];
    if (lastId) {
      rows = await db.select({ id: events.id }).from(events).where(gt(events.id, lastId)).orderBy(asc(events.id)).limit(PAGE_SIZE);
    } else {
      rows = await db.select({ id: events.id }).from(events).orderBy(asc(events.id)).limit(PAGE_SIZE);
    }

    if (rows.length === 0) break;

    for (const row of rows) {
      stream.write(row.id + '\n');
    }

    totalWritten += rows.length;
    lastId = rows[rows.length - 1].id;

    if (totalWritten % 100_000 === 0) {
      logger.info({ totalWritten }, 'IDs written so far...');
    }
  }

  await new Promise<void>((resolve, reject) =>
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()))
  );

  logger.info({ totalWritten }, 'All IDs written to file');
  return totalWritten;
}

async function submit(): Promise<void> {
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.API_BASE_URL ??
    'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1';
  const githubRepo = process.env.GITHUB_REPO;

  if (!apiKey) throw new Error('API_KEY is required');
  if (!githubRepo || githubRepo.includes('YOUR_USERNAME')) {
    throw new Error('Set GITHUB_REPO in .env to your actual GitHub repo URL before submitting');
  }

  await runMigrations();
  const totalWritten = await streamEventIds(OUTPUT_FILE);
  logger.info({ totalWritten }, `Submitting ${totalWritten.toLocaleString()} event IDs`);

  const response = await axios.post(
    `${baseUrl}/submissions`,
    createReadStream(OUTPUT_FILE),
    {
      params: { github_repo: githubRepo },
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'text/plain' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  logger.info({ result: response.data }, 'Submission complete');
}

submit()
  .catch(err => {
    logger.error(err, 'Submission failed');
    process.exit(1);
  })
  .finally(() => closeDb());
