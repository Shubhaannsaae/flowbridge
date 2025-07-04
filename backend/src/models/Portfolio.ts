import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './User';

export interface PortfolioAttributes {
  id: string;
  userId: string;
  walletAddress: string;
  totalDeposited: string;
  currentValue: string;
  totalYieldEarned: string;
  cardLiquidityReserve: string;
  riskLevel: number;
  autoRebalanceEnabled: boolean;
  lastRebalanceTime?: Date;
  performanceMetrics: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioCreationAttributes extends Optional<PortfolioAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Portfolio extends Model<PortfolioAttributes, PortfolioCreationAttributes> implements PortfolioAttributes {
  public id!: string;
  public userId!: string;
  public walletAddress!: string;
  public totalDeposited!: string;
  public currentValue!: string;
  public totalYieldEarned!: string;
  public cardLiquidityReserve!: string;
  public riskLevel!: number;
  public autoRebalanceEnabled!: boolean;
  public lastRebalanceTime?: Date;
  public performanceMetrics!: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Portfolio.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      }
    },
    walletAddress: {
      type: DataTypes.STRING(42),
      allowNull: false,
      validate: {
        isEthereumAddress(value: string) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid Ethereum address');
          }
        }
      }
    },
    totalDeposited: {
      type: DataTypes.DECIMAL(36, 18),
      defaultValue: '0',
      allowNull: false
    },
    currentValue: {
      type: DataTypes.DECIMAL(36, 18),
      defaultValue: '0',
      allowNull: false
    },
    totalYieldEarned: {
      type: DataTypes.DECIMAL(36, 18),
      defaultValue: '0',
      allowNull: false
    },
    cardLiquidityReserve: {
      type: DataTypes.DECIMAL(36, 18),
      defaultValue: '100',
      allowNull: false
    },
    riskLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    autoRebalanceEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    lastRebalanceTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    performanceMetrics: {
      type: DataTypes.JSON,
      defaultValue: {
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0
      },
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Portfolio',
    tableName: 'portfolios',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['walletAddress']
      },
      {
        unique: true,
        fields: ['userId', 'walletAddress']
      },
      {
        fields: ['autoRebalanceEnabled']
      },
      {
        fields: ['lastRebalanceTime']
      }
    ]
  }
);

// Define associations
Portfolio.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Portfolio, { foreignKey: 'userId', as: 'portfolios' });
