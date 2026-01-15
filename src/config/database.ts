import { Pool, PoolConfig } from 'pg';
import { logger } from '@/utils/logger';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'gobuddy',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection
pool.query('SELECT NOW()')
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch((err) => {
    logger.error('Database connection error', err);
  });

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, error });
    throw error;
  }
}

/**
 * Get database connection pool stats
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
