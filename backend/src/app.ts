import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { connectDatabase, closeDatabase } from './config/database';
import { initializeAssociations } from './models';
import { corsMiddleware, securityHeaders, requestLogger } from './middleware/cors';
import { errorHandler, notFoundHandler, handleUncaughtExceptions, gracefulShutdown } from './utils/errorHandler';
import { validateContentType, sanitizeRequest } from './middleware/validation';
import routes from './routes';
import { config } from './config/environment';
import { logger } from './utils/logger';

class Application {
  public app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupUncaughtExceptionHandlers();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private setupUncaughtExceptionHandlers(): void {
    handleUncaughtExceptions();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS and security headers
    this.app.use(corsMiddleware);
    this.app.use(securityHeaders);

    // Request logging
    this.app.use(requestLogger);

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({
      limit: '10mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request sanitization
    this.app.use(sanitizeRequest);

    // Content type validation for POST/PUT/PATCH
    this.app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check endpoint (before API routes)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV
      });
    });

    // API routes
    this.app.use('/api', routes);

    // 404 handler
    this.app.use(notFoundHandler);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await connectDatabase();
      
      // Initialize model associations
      initializeAssociations();

      // Start server
      this.server = this.app.listen(config.PORT, config.HOST, () => {
        logger.info(`Server started on ${config.HOST}:${config.PORT} in ${config.NODE_ENV} mode`);
        logger.info(`Health check available at http://${config.HOST}:${config.PORT}/health`);
        logger.info(`API documentation available at http://${config.HOST}:${config.PORT}/api/docs`);
      });

      // Setup graceful shutdown
      gracefulShutdown(this.server);

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        logger.info('Server stopped');
      }

      await closeDatabase();
      logger.info('Application stopped gracefully');

    } catch (error) {
      logger.error('Error stopping application:', error);
      throw error;
    }
  }
}

// Create and export application instance
const application = new Application();

// Start application if this file is executed directly
if (require.main === module) {
  application.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default application;
export { Application };
