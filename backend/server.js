const path = require('path');

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const { createServer } = require('./src/app');
const { connectDb } = require('./src/config/db');
const { seedIfEmpty } = require('./src/seed/seed');
const User = require('./src/models/User');
const { backfillSearchText } = require('./src/utils/backfillSearchText');
const { expirePendingBookings } = require('./src/controllers/bookingsController');
const { expireQuotedOrders } = require('./src/controllers/ordersController');

const port = Number(process.env.PORT || 5000);

const start = async () => {
  await connectDb(process.env.MONGODB_URI);
  await seedIfEmpty();
  await backfillSearchText().catch(() => {});
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

  let bookingSweepBusy = false;
  setInterval(async () => {
    if (bookingSweepBusy) return;
    bookingSweepBusy = true;
    try {
      const count = await expirePendingBookings();
      if (count) console.log(`[booking] expired ${count} pending booking(s)`);
    } catch (e) {
      console.warn('[booking] expiry sweep failed:', e?.message || e);
    } finally {
      bookingSweepBusy = false;
    }
  }, 20_000);

  let orderSweepBusy = false;
  setInterval(async () => {
    if (orderSweepBusy) return;
    orderSweepBusy = true;
    try {
      const count = await expireQuotedOrders();
      if (count) console.log(`[order] auto-cancelled ${count} quoted order(s)`);
    } catch (e) {
      console.warn('[order] expiry sweep failed:', e?.message || e);
    } finally {
      orderSweepBusy = false;
    }
  }, 20_000);
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
