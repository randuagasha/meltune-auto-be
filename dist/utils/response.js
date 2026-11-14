"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, message, statusCode = 200, meta) {
    return res.status(statusCode).json({
        status: 'success',
        ...(message ? { message } : {}),
        data,
        ...(meta ? { meta } : {}),
    });
}
function sendError(res, message, statusCode = 400, code) {
    return res.status(statusCode).json({
        status: 'error',
        message,
        ...(code ? { code } : {}),
    });
}
