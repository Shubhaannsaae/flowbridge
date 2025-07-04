import { Router } from 'express';
import { CardController } from '../controllers/cardController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { body, param, query } from 'express-validator';

const router = Router();
const cardController = new CardController();

// Validation schemas
const spendingValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

const automationValidation = [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address'),
  body('automationType')
    .isIn(['rebalancing', 'topup', 'liquidityManagement'])
    .withMessage('Invalid automation type'),
  body('preferences')
    .isObject()
    .withMessage('Preferences must be an object')
];

const balanceValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

const transactionHistoryValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

const rebalanceValidation = [
  body('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

// Apply authentication and rate limiting
router.use(authenticate);
router.use(rateLimit);

// Routes
router.get('/spending/:address',
  spendingValidation,
  validateRequest,
  async (req, res) => {
    await cardController.trackSpending(req, res);
  }
);

router.post('/automation/setup',
  automationValidation,
  validateRequest,
  async (req, res) => {
    await cardController.setupAutomation(req, res);
  }
);

router.get('/balance/:address',
  balanceValidation,
  validateRequest,
  async (req, res) => {
    await cardController.getCardBalance(req, res);
  }
);

router.get('/transactions/:address',
  transactionHistoryValidation,
  validateRequest,
  async (req, res) => {
    await cardController.getTransactionHistory(req, res);
  }
);

router.post('/rebalance/trigger',
  rebalanceValidation,
  validateRequest,
  async (req, res) => {
    await cardController.triggerRebalance(req, res);
  }
);

export default router;
