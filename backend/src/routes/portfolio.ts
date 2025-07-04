import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolioController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { body, param, query } from 'express-validator';

const router = Router();
const portfolioController = new PortfolioController();

// Validation schemas
const createPortfolioValidation = [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address'),
  body('riskLevel')
    .isInt({ min: 1, max: 10 })
    .withMessage('Risk level must be between 1 and 10'),
  body('cardLiquidityReserve')
    .optional()
    .isDecimal()
    .withMessage('Card liquidity reserve must be a valid number')
];

const rebalanceValidation = [
  body('portfolioId')
    .isUUID()
    .withMessage('Invalid portfolio ID')
];

const portfolioParamValidation = [
  param('address')
    .isEthereumAddress()
    .withMessage('Invalid wallet address')
];

// Apply authentication to all routes
router.use(authenticate);
router.use(rateLimit);

// Routes
router.get('/:address',
  portfolioParamValidation,
  validateRequest,
  async (req, res) => {
    await portfolioController.getPortfolio(req, res);
  }
);

router.post('/create',
  createPortfolioValidation,
  validateRequest,
  async (req, res) => {
    await portfolioController.createPortfolio(req, res);
  }
);

router.post('/rebalance',
  rebalanceValidation,
  validateRequest,
  async (req, res) => {
    await portfolioController.rebalance(req, res);
  }
);

export default router;
