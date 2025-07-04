import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface UserAttributes {
  id: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
  email?: string;
  isActive: boolean;
  riskTolerance: number;
  preferredChains: string[];
  notificationSettings: {
    email: boolean;
    push: boolean;
    rebalancing: boolean;
    yields: boolean;
    alerts: boolean;
  };
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public address!: string;
  public email?: string;
  public isActive!: boolean;
  public riskTolerance!: number;
  public preferredChains!: string[];
  public notificationSettings!: {
    email: boolean;
    push: boolean;
    rebalancing: boolean;
    yields: boolean;
    alerts: boolean;
  };
  public lastLogin!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    address: {
      type: DataTypes.STRING(42),
      allowNull: false,
      unique: true,
      validate: {
        isEthereumAddress(value: string) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid Ethereum address');
          }
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    riskTolerance: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      allowNull: false,
      validate: {
        min: 1,
        max: 10
      }
    },
    preferredChains: {
      type: DataTypes.JSON,
      defaultValue: ['ethereum'],
      allowNull: false
    },
    notificationSettings: {
      type: DataTypes.JSON,
      defaultValue: {
        email: true,
        push: true,
        rebalancing: true,
        yields: true,
        alerts: true
      },
      allowNull: false
    },
    lastLogin: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
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
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['address']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['lastLogin']
      }
    ]
  }
);
