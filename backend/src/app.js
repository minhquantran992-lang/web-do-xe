const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const mongoose = require('mongoose');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { configurePassport } = require('./config/passport');
const { securityContext } = require('./middleware/securityContext');
const { rateLimit } = require('./middleware/rateLimit');
const { botDetection } = require('./middleware/botDetection');

const authRoutes = require('./routes/authRoutes');
const carsRoutes = require('./routes/carsRoutes');
const partsRoutes = require('./routes/partsRoutes');
const brandsRoutes = require('./routes/brandsRoutes');
const backgroundsRoutes = require('./routes/backgroundsRoutes');
const configurationRoutes = require('./routes/configurationRoutes');
const buildRoutes = require('./routes/buildRoutes');
const adminCarsRoutes = require('./routes/adminCarsRoutes');
const adminPartsRoutes = require('./routes/adminPartsRoutes');
const adminBrandsRoutes = require('./routes/adminBrandsRoutes');
const adminBackgroundsRoutes = require('./routes/adminBackgroundsRoutes');
const adminVendorsRoutes = require('./routes/adminVendorsRoutes');
const adminUsersRoutes = require('./routes/adminUsersRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vendorsRoutes = require('./routes/vendorsRoutes');
const bookingsRoutes = require('./routes/bookingsRoutes');
const vendorBookingsRoutes = require('./routes/vendorBookingsRoutes');
const vendorCarsRoutes = require('./routes/vendorCarsRoutes');
const publicCarsRoutes = require('./routes/publicCarsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const chatRoutes = require('./routes/chatRoutes');
const vendorChatRoutes = require('./routes/vendorChatRoutes');
const shadowTrackRoutes = require('./routes/shadowTrackRoutes');
const adminShadowRoutes = require('./routes/adminShadowRoutes');
const ticketsRoutes = require('./routes/ticketsRoutes');
const adminTicketsRoutes = require('./routes/adminTicketsRoutes');
const vendorTicketsRoutes = require('./routes/vendorTicketsRoutes');
const adminFinanceRoutes = require('./routes/adminFinanceRoutes');
const followRoutes = require('./routes/followRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const ordersRoutes = require('./routes/ordersRoutes');
const vendorOrdersRoutes = require('./routes/vendorOrdersRoutes');
const adminSecurityRoutes = require('./routes/adminSecurityRoutes');

const createServer = () => {
  const app = express();
  const bootAt = Date.now();

  // MVP defaults:
  // - CORS open for local development
  // - JSON only APIs
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));
  app.use(securityContext);

  app.use(
    '/api',
    botDetection,
    rateLimit({
      name: 'api_global_ip',
      keyPrefix: 'api_global_ip',
      points: 600,
      durationSec: 60,
      keyFn: (req) => req.clientIp
    })
  );

  configurePassport(passport);
  app.use(passport.initialize());

  // Healthcheck for quick verification
  const healthHandler = async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const now = new Date();
    const db = {
      ok: false,
      state: mongoose?.connection?.readyState ?? null,
    };

    try {
      if (mongoose?.connection?.db) {
        await mongoose.connection.db.admin().ping();
        db.ok = true;
      }
    } catch (e) {
      db.ok = false;
      db.error = String(e?.code || e?.name || 'DB_PING_FAILED');
    }

    res.json({
      ok: Boolean(db.ok),
      service: 'carbanana-backend',
      time: now.toISOString(),
      uptimeSec: Math.max(0, Math.floor(process.uptime())),
      since: new Date(bootAt).toISOString(),
      db,
      memory: process.memoryUsage(),
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.use('/auth', authRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/cars', carsRoutes);
  app.use('/api/backgrounds', backgroundsRoutes);
  app.use('/api/admin/cars', adminCarsRoutes);
  app.use('/api/admin/parts', adminPartsRoutes);
  app.use('/api/admin/brands', adminBrandsRoutes);
  app.use('/api/admin/backgrounds', adminBackgroundsRoutes);
  app.use('/api/admin/vendors', adminVendorsRoutes);
  app.use('/api/admin/users', adminUsersRoutes);
  app.use('/api/admin/settings', adminSettingsRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/vendor', vendorRoutes);
  app.use('/api/vendor/bookings', vendorBookingsRoutes);
  app.use('/api/vendor/cars', vendorCarsRoutes);
  app.use('/api/vendor/chat', vendorChatRoutes);
  app.use('/api/vendor/tickets', vendorTicketsRoutes);
  app.use('/api/vendor/orders', vendorOrdersRoutes);
  app.use('/api/public-cars', publicCarsRoutes);
  app.use('/vendors', vendorsRoutes);
  app.use('/api/vendors', vendorsRoutes);
  app.use('/api/bookings', bookingsRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/follow', followRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/parts', partsRoutes);
  app.use('/brands', brandsRoutes);
  app.use('/configurations', configurationRoutes);
  app.use(buildRoutes);
  app.use(shadowTrackRoutes);
  app.use('/api/admin/shadow', adminShadowRoutes);
  app.use('/admin/shadow', adminShadowRoutes);
  app.use('/api/admin/tickets', adminTicketsRoutes);
  app.use('/api/admin/finance', adminFinanceRoutes);
  app.use('/api/admin/security', adminSecurityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = { createServer };
