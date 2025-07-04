import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitStrict } from '../middleware/rateLimit';
import { body, param, query } from 'express-validator';

const router = Router();
const aiController = new AIController();

// Validation schemas
const optimizeValidation = [
  body('portfolioId')
    .isUUID()
    .withMessage('Invalid portfolio ID'),
  body('forceRebalance')
    .optional()
    .isBoolean()
    .withMessage('Force rebalance must be a boolean')
];

const riskAnalysisValidation = [
  param('portfolioId')
    .isUUID()
    .withMessage('Invalid portfolio ID')
];

const predictValidation = [
  body('protocol')
    .notEmpty()
    .withMessage('Protocol is required'),
  body('timeframe')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Timeframe must be between 1 and 90 days')
];

const insightsValidation = [
  param('portfolioId')
    .isUUID()
    .withMessage('Invalid portfolio ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

const recommendationsValidation = [
  body('portfolioId')
    .isUUID()
    .withMessage('Invalid portfolio ID')
];

// Apply authentication and rate limiting
router.use(authenticate);
router.use(rateLimitStrict);

// Routes
router.post('/optimize',
  optimizeValidation,
  validateRequest,
  async (req, res) => {
    await aiController.optimize(req, res);
  }
);

router.get('/risk-analysis/:portfolioId',
  riskAnalysisValidation,
  validateRequest,
  async (req, res) => {
    await aiController.analyzeRisk(req, res);
  }
);

router.post('/predict',
  predictValidation,
  validateRequest,
  async (req, res) => {
    await aiController.predict(req, res);
  }
);

router.get('/insights/:portfolioId',
  insightsValidation,
  validateRequest,
  async (req, res) => {
    await aiController.getInsights(req, res);
  }
);

router.post('/recommendations',
  recommendationsValidation,
  validateRequest,
  async (req, res) => {
    await aiController.generateRecommendations(req, res);
  }
);

export default router;
