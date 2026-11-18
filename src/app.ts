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
  origin: [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
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
  app.listen(config.port, () => {
    console.log(`[MELTUNE Backend] REST API Server listening on port ${config.port}`);
    console.log(`[MELTUNE Backend] API base: http://localhost:${config.port}/api/v1`);
  });
}
