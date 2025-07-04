import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateRequest } from '../middleware/validation';
import { rateLimitAuth } from '../middleware/rateLimit';
import { body } from 'express-validator';

const router = Router();
const authController = new AuthController();

// Validation schemas
const authenticateValidation = [
  body('address')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('signature')
    .matches(/^0x[a-fA-F0-9]{130}$/)
    .withMessage('Invalid signature format'),
  body('message')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message is required and must be less than 500 characters'),
  body('timestamp')
    .isNumeric()
    .withMessage('Timestamp must be a number')
];

// Routes
router.post('/authenticate', 
  rateLimitAuth,
  authenticateValidation,
  validateRequest,
  async (req, res) => {
    await authController.authenticate(req, res);
  }
);

router.post('/verify',
  rateLimitAuth,
  async (req, res) => {
    await authController.verify(req, res);
  }
);

export default router;
