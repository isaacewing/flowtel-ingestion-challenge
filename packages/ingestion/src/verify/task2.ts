import 'dotenv/config';
import { createApiClient } from '../api/client';
import pino from 'pino';
import { writeFileSync } from 'fs';

const logger = pino({ transport: { target: 'pino-pretty' } });

async function verifyTask2() {
  const client = createApiClient({
    baseUrl: process.env.API_BASE_URL!,
    apiKey: process.env.API_KEY!,
  });

  logger.info('Fetching first page of events...');
  const response = await client.getEvents({ limit: 10 });
  logger.info({ eventCount: response.data.length, hasNextCursor: !!response.nextCursor }, 'First page received');

  writeFileSync('api-samples/verify-task2-response.json', JSON.stringify(response, null, 2));
  logger.info('Response saved to api-samples/verify-task2-response.json');

  if (response.data.length === 0) throw new Error('No events returned');
  if (typeof response.data[0].id !== 'string') throw new Error('Event ID is not a string');
  if (!response.nextCursor) logger.warn('No next cursor — pagination may not work correctly');

  logger.info('Task 2 verification PASSED');
}

verifyTask2().catch(err => {
  logger.error(err, 'Task 2 verification FAILED');
  process.exit(1);
});
