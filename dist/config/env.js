"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// In CommonJS, __dirname is available; also resolve from cwd
const envPath = typeof __dirname !== 'undefined'
    ? path_1.default.resolve(__dirname, '../../.env')
    : path_1.default.resolve(process.cwd(), '.env');
dotenv_1.default.config({ path: envPath });
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), 'meltune-be/.env') });
dotenv_1.default.config();
exports.config = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    supabase: {
        url: process.env.SUPABASE_URL || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
