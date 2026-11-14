"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_js_1 = require("./env.js");
exports.supabaseAdmin = env_js_1.config.supabase.url && env_js_1.config.supabase.serviceRoleKey
    ? (0, supabase_js_1.createClient)(env_js_1.config.supabase.url, env_js_1.config.supabase.serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;
