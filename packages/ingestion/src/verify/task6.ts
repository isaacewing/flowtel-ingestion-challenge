import { ProgressTracker } from '../ingestion/progress';

async function verifyTask6(): Promise<void> {
  const tracker = new ProgressTracker(0);
  tracker.start(200);

  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    tracker.add(10000);
  }

  tracker.stop();

  if (tracker.total !== 50000) throw new Error(`Expected 50000 total, got ${tracker.total}`);
  console.log('Task 6 verification PASSED');
}

verifyTask6().catch(err => {
  console.error('Task 6 verification FAILED', err);
  process.exit(1);
});
