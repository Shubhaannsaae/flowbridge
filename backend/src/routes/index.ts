import { Router } from 'express';
import authRoutes from './auth';
import portfolioRoutes from './portfolio';
import yieldRoutes from './yield';
import aiRoutes from './ai';
import cardRoutes from './card';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'FlowBridge API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI-Powered Cross-Chain Yield Optimizer for MetaMask Card',
    endpoints: {
      auth: {
        'POST /api/auth/authenticate': 'Authenticate user with wallet signature',
        'POST /api/auth/verify': 'Verify JWT token'
      },
      portfolio: {
        'GET /api/portfolio/:address': 'Get portfolio data',
        'POST /api/portfolio/create': 'Create new portfolio',
        'POST /api/portfolio/rebalance': 'Rebalance portfolio'
      },
      yield: {
        'GET /api/yield/data/:address': 'Get yield data for portfolio',
        'GET /api/yield/protocols': 'Get available yield protocols',
        'GET /api/yield/historical/:address/:days': 'Get historical yield data'
      },
      ai: {
        'POST /api/ai/optimize': 'AI portfolio optimization',
        'GET /api/ai/risk-analysis/:portfolioId': 'Risk analysis',
        'POST /api/ai/predict': 'Yield predictions',
        'GET /api/ai/insights/:portfolioId': 'Get AI insights',
        'POST /api/ai/recommendations': 'Generate recommendations'
      },
      card: {
        'GET /api/card/spending/:address': 'Get spending analytics',
        'POST /api/card/automation/setup': 'Setup automation',
        'GET /api/card/balance/:address': 'Get card balance',
        'GET /api/card/transactions/:address': 'Get transaction history',
        'POST /api/card/rebalance/trigger': 'Trigger rebalancing'
      }
    },
    documentation: 'https://docs.flowbridge.app'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/yield', yieldRoutes);
router.use('/ai', aiRoutes);
router.use('/card', cardRoutes);

export default router;