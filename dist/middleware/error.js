"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const response_js_1 = require("../utils/response.js");
function errorHandler(err, _req, res, _next) {
    console.error('Unhandled server error:', err);
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';
    (0, response_js_1.sendError)(res, message, status, 'INTERNAL_ERROR');
}
