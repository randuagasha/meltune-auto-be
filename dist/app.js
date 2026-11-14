"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_js_1 = require("./config/env.js");
const error_js_1 = require("./middleware/error.js");
const response_js_1 = require("./utils/response.js");
const routes_js_1 = require("./modules/auth/routes.js");
const routes_js_2 = require("./modules/vehicles/routes.js");
const routes_js_3 = require("./modules/services/routes.js");
const routes_js_4 = require("./modules/bookings/routes.js");
const routes_js_5 = require("./modules/products/routes.js");
const routes_js_6 = require("./modules/orders/routes.js");
const routes_js_7 = require("./modules/loyalty/routes.js");
const routes_js_8 = require("./modules/support/routes.js");
const routes_js_9 = require("./modules/admin/routes.js");
const routes_js_10 = require("./modules/dashboard/routes.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: [env_js_1.config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
exports.app.get('/health', (_req, res) => {
    (0, response_js_1.sendSuccess)(res, {
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'torsi-be',
        version: '1.0.0',
        environment: env_js_1.config.nodeEnv,
    }, 'TORSI REST API Service Healthy');
});
const v1Router = express_1.default.Router();
v1Router.use('/auth', routes_js_1.authRouter);
v1Router.use('/vehicles', routes_js_2.vehiclesRouter);
v1Router.use('/services', routes_js_3.servicesRouter);
v1Router.use('/bookings', routes_js_4.bookingsRouter);
v1Router.use('/products', routes_js_5.productsRouter);
v1Router.use('/orders', routes_js_6.ordersRouter);
v1Router.use('/loyalty', routes_js_7.loyaltyRouter);
v1Router.use('/support', routes_js_8.supportRouter);
v1Router.use('/admin', routes_js_9.adminRouter);
v1Router.use('/dashboard', routes_js_10.dashboardRouter);
exports.app.use('/api/v1', v1Router);
exports.app.use(error_js_1.errorHandler);
if (process.env.NODE_ENV !== 'test') {
    exports.app.listen(env_js_1.config.port, () => {
        console.log(`[TORSI Backend] REST API Server listening on port ${env_js_1.config.port}`);
        console.log(`[TORSI Backend] API base: http://localhost:${env_js_1.config.port}/api/v1`);
    });
}
