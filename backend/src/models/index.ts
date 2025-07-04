import { User } from './User';
import { Portfolio } from './Portfolio';
import { Transaction } from './Transaction';
import { YieldStrategy } from './YieldStrategy';
import { AIInsight } from './AIInsight';

// Export all models
export {
  User,
  Portfolio,
  Transaction,
  YieldStrategy,
  AIInsight
};

// Initialize all associations
export const initializeAssociations = () => {
  // User <-> Portfolio
  User.hasMany(Portfolio, { foreignKey: 'userId', as: 'portfolios' });
  Portfolio.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Portfolio <-> Transaction
  Portfolio.hasMany(Transaction, { foreignKey: 'portfolioId', as: 'transactions' });
  Transaction.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });

  // Portfolio <-> YieldStrategy
  Portfolio.hasMany(YieldStrategy, { foreignKey: 'portfolioId', as: 'strategies' });
  YieldStrategy.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });

  // Portfolio <-> AIInsight
  Portfolio.hasMany(AIInsight, { foreignKey: 'portfolioId', as: 'insights' });
  AIInsight.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });

  // AIInsight self-referencing
  AIInsight.belongsTo(AIInsight, { foreignKey: 'parentInsightId', as: 'parentInsight' });
  AIInsight.hasMany(AIInsight, { foreignKey: 'parentInsightId', as: 'childInsights' });
};

// Model synchronization
export const syncModels = async (force: boolean = false) => {
  try {
    await User.sync({ force });
    await Portfolio.sync({ force });
    await Transaction.sync({ force });
    await YieldStrategy.sync({ force });
    await AIInsight.sync({ force });
    
    console.log('All models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing models:', error);
    throw error;
  }
};
