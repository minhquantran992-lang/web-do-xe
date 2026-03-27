const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const passport = require('passport');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { configurePassport } = require('./config/passport');

const authRoutes = require('./routes/authRoutes');
const carsRoutes = require('./routes/carsRoutes');
const partsRoutes = require('./routes/partsRoutes');
const brandsRoutes = require('./routes/brandsRoutes');
const backgroundsRoutes = require('./routes/backgroundsRoutes');
const configurationRoutes = require('./routes/configurationRoutes');
const adminCarsRoutes = require('./routes/adminCarsRoutes');
const adminPartsRoutes = require('./routes/adminPartsRoutes');
const adminBrandsRoutes = require('./routes/adminBrandsRoutes');
const adminBackgroundsRoutes = require('./routes/adminBackgroundsRoutes');
const adminVendorsRoutes = require('./routes/adminVendorsRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vendorCarsRoutes = require('./routes/vendorCarsRoutes');
const publicCarsRoutes = require('./routes/publicCarsRoutes');
const vendorsRoutes = require('./routes/vendorsRoutes');

const createServer = () => {
  const app = express();

  // MVP defaults:
  // - CORS open for local development
  // - JSON only APIs
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  configurePassport(passport);
  app.use(passport.initialize());

  // Healthcheck for quick verification
  app.get('/health', (req, res) => res.json({ ok: true }));

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
  app.use('/api/vendor', vendorRoutes);
  app.use('/vendor', vendorRoutes);
  app.use('/api/vendor/cars', vendorCarsRoutes);
  app.use('/vendor/cars', vendorCarsRoutes);
  app.use('/cars', publicCarsRoutes);
  app.use('/vendors', vendorsRoutes);
  app.use('/api/vendors', vendorsRoutes);
  app.use('/parts', partsRoutes);
  app.use('/brands', brandsRoutes);
  app.use('/configurations', configurationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = { createServer };
