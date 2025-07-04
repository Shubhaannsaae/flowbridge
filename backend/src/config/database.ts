import { Sequelize, Options } from 'sequelize';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  development: Options;
  test: Options;
  production: Options;
}

const config: DatabaseConfig = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'flowbridge',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'flowbridge_dev',
    logging: (sql: string) => logger.debug(sql),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ConnectionError/,
        /ConnectionRefusedError/,
        /ConnectionTimedOutError/,
        /TimeoutError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 3
    },
    define: {
      underscored: true,
      freezeTableName: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      },
      timestamps: true
    }
  },
  test: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'flowbridge',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME_TEST || 'flowbridge_test',
    logging: false,
    pool: {
      max: 2,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      underscored: true,
      freezeTableName: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      },
      timestamps: true
    }
  },
  production: {
    dialect: 'postgres',
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 30000
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    retry: {
      match: [
        /ConnectionError/,
        /ConnectionRefusedError/,
        /ConnectionTimedOutError/,
        /TimeoutError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 5
    },
    define: {
      underscored: true,
      freezeTableName: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      },
      timestamps: true
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env as keyof DatabaseConfig];

export const sequelize = new Sequelize(dbConfig);

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Test the connection
    await sequelize.query('SELECT 1');
    logger.info('Database connection verified');
    
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
}

export async function syncDatabase(force: boolean = false): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'production' && force) {
      throw new Error('Cannot force sync in production environment');
    }
    
    await sequelize.sync({ force });
    logger.info(`Database synchronized${force ? ' (forced)' : ''}`);
    
  } catch (error) {
    logger.error('Database synchronization failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

export default sequelize;
