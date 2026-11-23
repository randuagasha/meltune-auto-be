import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { sendSuccess } from './utils/response.js';

import { authRouter } from './modules/auth/routes.js';
import { vehiclesRouter } from './modules/vehicles/routes.js';
import { servicesRouter } from './modules/services/routes.js';
import { bookingsRouter } from './modules/bookings/routes.js';
import { productsRouter } from './modules/products/routes.js';
import { ordersRouter } from './modules/orders/routes.js';
import { loyaltyRouter } from './modules/loyalty/routes.js';
import { supportRouter } from './modules/support/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';

export const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow dev localhost, LAN IPs (192.168.x.x, 10.x.x.x), Expo web (8081, 19006), and web frontend (3000)
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('192.168.') ||
      origin.includes('10.0.') ||
      origin.startsWith('exp://') ||
      origin === config.corsOrigin
    ) {
      return callback(null, true);
    }
    // Permissive callback in development
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'meltune-be',
    version: '1.0.0',
    environment: config.nodeEnv,
  }, 'MELTUNE REST API Service Healthy');
});

const v1Router = express.Router();

v1Router.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'meltune-be',
    version: '1.0.0',
    environment: config.nodeEnv,
  }, 'MELTUNE REST API Service Healthy');
});
v1Router.use('/auth', authRouter);
v1Router.use('/vehicles', vehiclesRouter);
v1Router.use('/services', servicesRouter);
v1Router.use('/bookings', bookingsRouter);
v1Router.use('/products', productsRouter);
v1Router.use('/orders', ordersRouter);
v1Router.use('/loyalty', loyaltyRouter);
v1Router.use('/support', supportRouter);
v1Router.use('/admin', adminRouter);
v1Router.use('/dashboard', dashboardRouter);

app.use('/api/v1', v1Router);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const portNumber = Number(config.port) || 4000;
  app.listen(portNumber, '0.0.0.0', () => {
    console.log(`[MELTUNE Backend] REST API Server listening on 0.0.0.0:${portNumber}`);
    console.log(`[MELTUNE Backend] API base: http://localhost:${portNumber}/api/v1`);
  });
}
