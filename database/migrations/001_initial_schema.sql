-- FlowBridge Protocol - Initial Database Schema
-- Production-grade schema for MetaMask SDK integration and DeFi operations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table - MetaMask wallet integration
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    ens_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    
    -- User preferences
    risk_tolerance INTEGER NOT NULL DEFAULT 5 CHECK (risk_tolerance BETWEEN 1 AND 10),
    preferred_chains JSONB NOT NULL DEFAULT '[]',
    notification_settings JSONB NOT NULL DEFAULT '{"email": true, "push": true, "sms": false}',
    
    -- Security and compliance
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_data JSONB,
    two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
    two_fa_secret VARCHAR(255),
    
    -- Activity tracking
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Portfolios table - User investment portfolios
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Portfolio identification
    name VARCHAR(255) NOT NULL DEFAULT 'My Portfolio',
    wallet_address VARCHAR(42) NOT NULL CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Financial metrics
    total_deposited NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (total_deposited >= 0),
    current_value NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
    total_yield_earned NUMERIC(36, 18) NOT NULL DEFAULT 0,
    unrealized_pnl NUMERIC(36, 18) NOT NULL DEFAULT 0,
    realized_pnl NUMERIC(36, 18) NOT NULL DEFAULT 0,
    
    -- Card integration
    card_linked BOOLEAN NOT NULL DEFAULT false,
    card_liquidity_reserve NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (card_liquidity_reserve >= 0),
    card_spending_limit_daily NUMERIC(36, 18) NOT NULL DEFAULT 1000,
    card_spending_limit_monthly NUMERIC(36, 18) NOT NULL DEFAULT 10000,
    
    -- Risk and strategy settings
    risk_level INTEGER NOT NULL DEFAULT 5 CHECK (risk_level BETWEEN 1 AND 10),
    auto_rebalance_enabled BOOLEAN NOT NULL DEFAULT false,
    rebalance_threshold NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (rebalance_threshold > 0),
    
    -- Performance tracking
    performance_metrics JSONB NOT NULL DEFAULT '{}',
    last_rebalance_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, wallet_address)
);

-- Protocols table - Supported DeFi protocols
CREATE TABLE protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Protocol identification
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('lending', 'dex', 'yield_farming', 'liquidity_mining', 'derivatives', 'insurance')),
    
    -- Protocol details
    description TEXT,
    website_url VARCHAR(500),
    documentation_url VARCHAR(500),
    audit_reports JSONB DEFAULT '[]',
    
    -- Technical details
    supported_chains JSONB NOT NULL DEFAULT '[]',
    contract_addresses JSONB NOT NULL DEFAULT '{}',
    
    -- Risk assessment
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 1 AND 100),
    risk_factors JSONB DEFAULT '[]',
    
    -- Status and metrics
    is_active BOOLEAN NOT NULL DEFAULT true,
    tvl NUMERIC(36, 18) DEFAULT 0,
    apy_current NUMERIC(8, 4) DEFAULT 0,
    apy_7d_avg NUMERIC(8, 4) DEFAULT 0,
    apy_30d_avg NUMERIC(8, 4) DEFAULT 0,
    
    -- Integration details
    integration_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (integration_status IN ('active', 'deprecated', 'maintenance', 'disabled')),
    gas_estimate_deposit INTEGER DEFAULT 150000,
    gas_estimate_withdraw INTEGER DEFAULT 200000,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Transactions table - All blockchain transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    
    -- Transaction identification
    transaction_hash VARCHAR(66) UNIQUE CHECK (transaction_hash ~ '^0x[a-fA-F0-9]{64}$'),
    block_number BIGINT,
    transaction_index INTEGER,
    
    -- Transaction details
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdraw', 'rebalance', 'harvest', 'swap', 'bridge', 'card_topup', 'card_spend')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
    
    -- Financial details
    amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol VARCHAR(20) NOT NULL,
    token_decimals INTEGER NOT NULL DEFAULT 18,
    
    -- Protocol and chain info
    protocol_id UUID REFERENCES protocols(id),
    from_protocol VARCHAR(255),
    to_protocol VARCHAR(255),
    chain_id INTEGER NOT NULL,
    from_chain_id INTEGER,
    to_chain_id INTEGER,
    
    -- Gas and fees
    gas_limit INTEGER,
    gas_used INTEGER,
    gas_price NUMERIC(36, 0),
    gas_cost NUMERIC(36, 18),
    protocol_fee NUMERIC(36, 18) DEFAULT 0,
    network_fee NUMERIC(36, 18) DEFAULT 0,
    
    -- Cross-chain details
    bridge_provider VARCHAR(50),
    destination_address VARCHAR(42),
    
    -- Metadata and tracking
    nonce INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Yield strategies table - Active yield positions
CREATE TABLE yield_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    protocol_id UUID NOT NULL REFERENCES protocols(id),
    
    -- Strategy identification
    strategy_name VARCHAR(255) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL CHECK (strategy_type IN ('single_asset', 'lp_token', 'vault', 'lending', 'staking')),
    
    -- Asset details
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol VARCHAR(20) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Position details
    allocation_percentage NUMERIC(5, 2) NOT NULL CHECK (allocation_percentage BETWEEN 0 AND 100),
    deployed_amount NUMERIC(36, 18) NOT NULL CHECK (deployed_amount >= 0),
    current_value NUMERIC(36, 18) NOT NULL CHECK (current_value >= 0),
    shares_owned NUMERIC(36, 18) DEFAULT 0,
    
    -- Performance metrics
    yield_earned NUMERIC(36, 18) NOT NULL DEFAULT 0,
    current_apy NUMERIC(8, 4) NOT NULL,
    entry_price NUMERIC(36, 18) NOT NULL,
    current_price NUMERIC(36, 18),
    
    -- Risk metrics
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 1 AND 100),
    volatility_30d NUMERIC(8, 4),
    max_drawdown NUMERIC(8, 4),
    
    -- Status and timing
    is_active BOOLEAN NOT NULL DEFAULT true,
    entry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_harvest_at TIMESTAMP WITH TIME ZONE,
    next_harvest_at TIMESTAMP WITH TIME ZONE,
    
    -- Strategy metadata
    performance_data JSONB NOT NULL DEFAULT '{}',
    strategy_metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Price history table - Token price tracking
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Token identification
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol VARCHAR(20) NOT NULL,
    chain_id INTEGER NOT NULL,
    
    -- Price data
    price_usd NUMERIC(36, 18) NOT NULL CHECK (price_usd >= 0),
    volume_24h NUMERIC(36, 18),
    market_cap NUMERIC(36, 18),
    
    -- Price change metrics
    price_change_1h NUMERIC(8, 4),
    price_change_24h NUMERIC(8, 4),
    price_change_7d NUMERIC(8, 4),
    price_change_30d NUMERIC(8, 4),
    
    -- Data source
    source VARCHAR(50) NOT NULL DEFAULT 'coingecko',
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(token_address, chain_id, timestamp)
);

-- Create indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolios_wallet_address ON portfolios(wallet_address);
CREATE INDEX idx_portfolios_card_linked ON portfolios(card_linked) WHERE card_linked = true;

CREATE INDEX idx_protocols_category ON protocols(category);
CREATE INDEX idx_protocols_active ON protocols(is_active) WHERE is_active = true;
CREATE INDEX idx_protocols_slug ON protocols(slug);

CREATE INDEX idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_chain_id ON transactions(chain_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_yield_strategies_portfolio_id ON yield_strategies(portfolio_id);
CREATE INDEX idx_yield_strategies_protocol_id ON yield_strategies(protocol_id);
CREATE INDEX idx_yield_strategies_active ON yield_strategies(is_active) WHERE is_active = true;
CREATE INDEX idx_yield_strategies_token ON yield_strategies(token_address, chain_id);

CREATE INDEX idx_price_history_token ON price_history(token_address, chain_id);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON protocols FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_yield_strategies_updated_at BEFORE UPDATE ON yield_strategies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
