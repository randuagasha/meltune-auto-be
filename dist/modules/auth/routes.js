"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const response_js_1 = require("../../utils/response.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.get('/me', auth_js_1.authenticateToken, (req, res) => {
    (0, response_js_1.sendSuccess)(res, { user: req.user }, 'Current session profile');
});
exports.authRouter.post('/logout', auth_js_1.authenticateToken, (_req, res) => {
    (0, response_js_1.sendSuccess)(res, { loggedOut: true }, 'Successfully logged out');
});
