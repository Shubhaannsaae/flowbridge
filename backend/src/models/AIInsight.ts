import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { Portfolio } from './Portfolio';

export interface AIInsightAttributes {
  id: string;
  portfolioId: string;
  insightType: 'optimization' | 'risk_analysis' | 'market_prediction' | 'rebalancing' | 'performance' | 'alert';
  category: 'yield' | 'risk' | 'market' | 'portfolio' | 'strategy';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: {
    metrics?: Record<string, any>;
    recommendations?: string[];
    predictions?: Record<string, any>;
    alerts?: Record<string, any>;
    analysis?: Record<string, any>;
  };
  confidence: number;
  accuracy?: number;
  actionable: boolean;
  implemented: boolean;
  implementedAt?: Date;
  expiresAt?: Date;
  validFrom: Date;
  validTo?: Date;
  modelVersion: string;
  correlationId?: string;
  parentInsightId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIInsightCreationAttributes extends Optional<AIInsightAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class AIInsight extends Model<AIInsightAttributes, AIInsightCreationAttributes> implements AIInsightAttributes {
  public id!: string;
  public portfolioId!: string;
  public insightType!: 'optimization' | 'risk_analysis' | 'market_prediction' | 'rebalancing' | 'performance' | 'alert';
  public category!: 'yield' | 'risk' | 'market' | 'portfolio' | 'strategy';
  public priority!: 'low' | 'medium' | 'high' | 'critical';
  public title!: string;
  public description!: string;
  public data!: {
    metrics?: Record<string, any>;
    recommendations?: string[];
    predictions?: Record<string, any>;
    alerts?: Record<string, any>;
    analysis?: Record<string, any>;
  };
  public confidence!: number;
  public accuracy?: number;
  public actionable!: boolean;
  public implemented!: boolean;
  public implementedAt?: Date;
  public expiresAt?: Date;
  public validFrom!: Date;
  public validTo?: Date;
  public modelVersion!: string;
  public correlationId?: string;
  public parentInsightId?: string;
  public tags!: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AIInsight.init(
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
    insightType: {
      type: DataTypes.ENUM('optimization', 'risk_analysis', 'market_prediction', 'rebalancing', 'performance', 'alert'),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('yield', 'risk', 'market', 'portfolio', 'strategy'),
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false
    },
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 1
      }
    },
    accuracy: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 1
      }
    },
    actionable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    implemented: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    implementedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    validFrom: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    validTo: {
      type: DataTypes.DATE,
      allowNull: true
    },
    modelVersion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0.0'
    },
    correlationId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    parentInsightId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
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
    modelName: 'AIInsight',
    tableName: 'ai_insights',
    timestamps: true,
    indexes: [
      {
        fields: ['portfolioId']
      },
      {
        fields: ['insightType']
      },
      {
        fields: ['category']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['confidence']
      },
      {
        fields: ['actionable']
      },
      {
        fields: ['implemented']
      },
      {
        fields: ['validFrom']
      },
      {
        fields: ['validTo']
      },
      {
        fields: ['expiresAt']
      },
      {
        fields: ['correlationId']
      },
      {
        fields: ['parentInsightId']
      },
      {
        fields: ['createdAt']
      }
    ]
  }
);

// Define associations
AIInsight.belongsTo(Portfolio, { foreignKey: 'portfolioId', as: 'portfolio' });
Portfolio.hasMany(AIInsight, { foreignKey: 'portfolioId', as: 'insights' });

// Self-referencing association for parent-child insights
AIInsight.belongsTo(AIInsight, { foreignKey: 'parentInsightId', as: 'parentInsight' });
AIInsight.hasMany(AIInsight, { foreignKey: 'parentInsightId', as: 'childInsights' });
