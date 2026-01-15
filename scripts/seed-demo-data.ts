/**
 * Seed Demo Data Script
 * Run this script to populate the database with demo data for testing/demo purposes
 * 
 * Usage: tsx scripts/seed-demo-data.ts
 */

import { query, pool } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/utils/logger';

async function seedDemoData() {
  try {
    logger.info('Starting demo data seed...');

    // Read seed SQL file
    const seedSqlPath = join(__dirname, '../docker/seed.sql');
    const seedSql = readFileSync(seedSqlPath, 'utf-8');

    // Execute seed SQL
    await query(seedSql);

    logger.info('Demo data seeded successfully!');
    logger.info('');
    logger.info('Demo Users:');
    logger.info('  - demo@example.com');
    logger.info('  - admin@example.com (super admin)');
    logger.info('  - traveler@example.com');
    logger.info('');
    logger.info('Demo Trips:');
    logger.info('  - Bangkok Adventure');
    logger.info('  - Tokyo Family Trip');
    logger.info('');
    logger.info('Note: Use OTP login for demo users');

  } catch (error) {
    logger.error('Error seeding demo data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedDemoData()
    .then(() => {
      logger.info('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

export { seedDemoData };
