/* eslint-disable no-console */
require('dotenv/config');

const { Queue } = require('bullmq');

async function main() {
  const roundId = process.argv[2];
  if (!roundId) {
    console.error('Usage: node scripts/enqueue-close-round.js <roundId>');
    process.exit(1);
  }

  const queue = new Queue('round-close', {
    connection: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });

  // BullMQ: custom jobId must NOT contain ':'
  const jobId = `round-close__${roundId}`;

  await queue.add(
    'close-round',
    { roundId },
    {
      jobId,
      delay: 1000,
      removeOnComplete: true,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
    },
  );

  console.log('Enqueued close-round for', roundId, 'jobId=', jobId);
  await queue.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
