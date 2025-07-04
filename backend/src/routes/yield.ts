import { Router } from 'express';
import { YieldController } from '../controllers/yieldController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { param, query } from 'express-validator';

const router = Router();
const yieldController = new YieldController();

// Validation schemas
const yieldDataValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

const protocolsValidation = [
  query('chain')
    .optional()
    .isIn(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'avalanche'])
    .withMessage('Invalid chain specified')
];

const historicalValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address'),
  param('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

// Apply authentication and rate limiting
router.use(authenticate);
router.use(rateLimit);

// Routes
router.get('/data/:address',
  yieldDataValidation,
  validateRequest,
  async (req, res) => {
    await yieldController.getYieldData(req, res);
  }
);

router.get('/protocols',
  protocolsValidation,
  validateRequest,
  async (req, res) => {
    await yieldController.getAvailableProtocols(req, res);
  }
);

router.get('/historical/:address/:days?',
  historicalValidation,
  validateRequest,
  async (req, res) => {
    await yieldController.getHistoricalYield(req, res);
  }
);

export default router;
