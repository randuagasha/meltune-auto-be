import dotenv from 'dotenv';
import path from 'path';

// In CommonJS, __dirname is available; also resolve from cwd
const envPath = typeof __dirname !== 'undefined'
  ? path.resolve(__dirname, '../../.env')
  : path.resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), 'meltune-be/.env') });
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
