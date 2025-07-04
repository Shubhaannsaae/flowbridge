import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { Portfolio } from './Portfolio';

export interface YieldStrategyAttributes {
  id: string;
  portfolioId: string;
  protocol: string;
  contractAddress: string;
  tokenAddress: string;
  chain: string;
  allocation: number;
  deployedAmount: string;
  currentValue: string;
  yieldEarned: string;
  currentAPY: number;
  riskScore: number;
  isActive: boolean;
  entryPrice: string;
  entryTimestamp: Date;
  lastHarvestTime?: Date;
  performanceData: {
    totalReturn: number;
    annualizedReturn: number;
    dailyYield: number[];
    maxDrawdown: number;
    sharpeRatio: number;
  };
  strategyMetadata: {
    category: string;
    autoCompound: boolean;
    lockupPeriod?: number;
    minimumDeposit?: string;
    fees: {
      deposit: number;
      withdrawal: number;
      performance: number;
      management: number;
    };
    riskFactors: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface YieldStrategyCreationAttributes extends Optional<YieldStrategyAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class YieldStrategy extends Model<YieldStrategyAttributes, YieldStrategyCreationAttributes> implements YieldStrategyAttributes {
  public id!: string;
  public portfolioId!: string;
  public protocol!: string;
  public contractAddress!: string;
  public tokenAddress!: string;
  public chain!: string;
  public allocation!: number;
  public deployedAmount!: string;
  public currentValue!: string;
  public yieldEarned!: string;
  public currentAPY!: number;
  public riskScore!: number;
  public isActive!: boolean;
  public entryPrice!: string;
  public entryTimestamp!: Date;
  public lastHarvestTime?: Date;
  public performanceData!: {
    totalReturn: number;
    annualizedReturn: number;
    dailyYield: number[];
    maxDrawdown: number;
    sharpeRatio: number;
  };
  public strategyMetadata!: {
    category: string;
    autoCompound: boolean;
    lockupPeriod?: number;
    minimumDeposit?: string;
    fees: {
      deposit: number;
      withdrawal: number;
      performance: number;
      management: number;
    };
    riskFactors: string[];
  };
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

YieldStrategy.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    portfolioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Portfolio,
        key: 'id'
      }
    },
    protocol: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contractAddress: {
      type: DataTypes.STRING(42),
      allowNull: false,
      validate: {
        isEthereumAddress(value: string) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid contract address');
          }
        }
      }
    },
    tokenAddress: {
      type: DataTypes.STRING(42),
      allowNull: false,
      validate: {
        isEthereumAddress(value: string) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid token address');
          }
        }
      }
    },
    chain: {
      type: DataTypes.STRING,
      allowNull: false
    },
    allocation: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      }
    },
    deployedAmount: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false
    },
    currentValue: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false
    },
    yieldEarned: {
      type: DataTypes.DECIMAL(36, 18),
      defaultValue: '0',
      allowNull: false
    },
    currentAPY: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false
    },
    riskScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    entryPrice: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false
    },
    entryTimestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    lastHarvestTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    performanceData: {
      type: DataTypes.JSON,
      defaultValue: {
        totalReturn: 0,
        annualizedReturn: 0,
        dailyYield: [],
        maxDrawdown: 0,
        sharpeRatio: 0
      },
      allowNull: false
    },
    strategyMetadata: {
      type: DataTypes.JSON,
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
    modelName: 'YieldStrategy',
    tableName: 'yield_strategies',
    timestamps: true,
    indexes: [
      {
        fields: ['portfolioId']
      },
      {
        fields: ['protocol']
      },
      {
        fields: ['chain']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['currentAPY']
      },
      {
        fields: ['riskScore']
      },
      {
        fields: ['entryTimestamp']
      },
      {
        fields: ['lastHarvestTime']
      }
    ]
  }
);

// Define associations
YieldStrategy.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });
Portfolio.hasMany(YieldStrategy, { foreignKey: 'portfolioId', as: 'strategies' });
