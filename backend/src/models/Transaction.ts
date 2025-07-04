import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { Portfolio } from './Portfolio';

export interface TransactionAttributes {
  id: string;
  portfolioId: string;
  type: 'deposit' | 'withdraw' | 'rebalance' | 'yield_harvest' | 'card_topup' | 'bridge';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: string;
  fromProtocol?: string;
  toProtocol?: string;
  fromChain: string;
  toChain?: string;
  transactionHash?: string;
  blockNumber?: number;
  gasCost?: string;
  gasUsed?: number;
  gasPrice?: string;
  nonce?: number;
  metadata: {
    description?: string;
    bridgeProvider?: string;
    estimatedTime?: number;
    slippage?: number;
    minAmountOut?: string;
    priceImpact?: number;
    route?: any;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TransactionCreationAttributes extends Optional<TransactionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> implements TransactionAttributes {
  public id!: string;
  public portfolioId!: string;
  public type!: 'deposit' | 'withdraw' | 'rebalance' | 'yield_harvest' | 'card_topup' | 'bridge';
  public status!: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  public amount!: string;
  public fromProtocol?: string;
  public toProtocol?: string;
  public fromChain!: string;
  public toChain?: string;
  public transactionHash?: string;
  public blockNumber?: number;
  public gasCost?: string;
  public gasUsed?: number;
  public gasPrice?: string;
  public nonce?: number;
  public metadata!: {
    description?: string;
    bridgeProvider?: string;
    estimatedTime?: number;
    slippage?: number;
    minAmountOut?: string;
    priceImpact?: number;
    route?: any;
  };
  public completedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Transaction.init(
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
    type: {
      type: DataTypes.ENUM('deposit', 'withdraw', 'rebalance', 'yield_harvest', 'card_topup', 'bridge'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false
    },
    fromProtocol: {
      type: DataTypes.STRING,
      allowNull: true
    },
    toProtocol: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fromChain: {
      type: DataTypes.STRING,
      allowNull: false
    },
    toChain: {
      type: DataTypes.STRING,
      allowNull: true
    },
    transactionHash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      validate: {
        isValidTxHash(value: string) {
          if (value && !/^0x[a-fA-F0-9]{64}$/.test(value)) {
            throw new Error('Invalid transaction hash');
          }
        }
      }
    },
    blockNumber: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    gasCost: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: true
    },
    gasUsed: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    gasPrice: {
      type: DataTypes.DECIMAL(36, 0),
      allowNull: true
    },
    nonce: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
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
    modelName: 'Transaction',
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['portfolioId']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['transactionHash']
      },
      {
        fields: ['fromChain']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['completedAt']
      }
    ]
  }
);

// Define associations
Transaction.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });
Portfolio.hasMany(Transaction, { foreignKey: 'portfolioId', as: 'transactions' });
