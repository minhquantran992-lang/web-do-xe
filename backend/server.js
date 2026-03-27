const path = require('path');

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const { createServer } = require('./src/app');
const { connectDb } = require('./src/config/db');
const { seedIfEmpty } = require('./src/seed/seed');
const User = require('./src/models/User');

const port = Number(process.env.PORT || 5000);

const start = async () => {
  await connectDb(process.env.MONGODB_URI);
  await seedIfEmpty();
  try {
    const indexes = await User.collection.indexes().catch(() => []);
    for (const idx of indexes) {
      const key = idx?.key || {};
      const isTarget = key.provider === 1 && key.providerId === 1;
      const hasPartial = Boolean(idx?.partialFilterExpression && idx.partialFilterExpression.providerId);
      if (isTarget && !hasPartial) {
        if (idx?.name) {
          await User.collection.dropIndex(idx.name).catch(() => {});
        }
      }
    }
    await User.collection.createIndex(
      { provider: 1, providerId: 1 },
      { unique: true, partialFilterExpression: { providerId: { $type: 'string' } } }
    ).catch(() => {});
  } catch {}

  const app = createServer();
  const tryListen = (p, retries = 5) =>
    new Promise((resolve, reject) => {
      const server = app
        .listen(p, () => {
          process.env.PORT = String(p);
          console.log(`Backend running on http://localhost:${p}`);
          resolve(server);
        })
        .on('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && retries > 0) {
            const np = p + 1;
            console.warn(`Port ${p} in use, retrying on ${np}...`);
            resolve(tryListen(np, retries - 1));
          } else {
            reject(err);
          }
        });
    });
  await tryListen(port);
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
