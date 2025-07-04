-- FlowBridge Protocol - MetaMask Card Integration Schema
-- Production-grade card transaction and liquidity management

-- Card transactions table - MetaMask Card spending transactions
CREATE TABLE card_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    
    -- Transaction identification
    card_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    merchant_transaction_id VARCHAR(255),
    
    -- Financial details
    amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol VARCHAR(20) NOT NULL,
    token_amount NUMERIC(36, 18) NOT NULL CHECK (token_amount > 0),
    
    -- Exchange rate at time of transaction
    exchange_rate NUMERIC(36, 18) NOT NULL CHECK (exchange_rate > 0),
    
    -- Merchant information
    merchant_name VARCHAR(255) NOT NULL,
    merchant_category_code VARCHAR(10),
    merchant_category VARCHAR(100),
    merchant_location JSONB DEFAULT '{}',
    
    -- Transaction details
    transaction_type VARCHAR(30) NOT NULL DEFAULT 'purchase' CHECK (transaction_type IN ('purchase', 'refund', 'chargeback', 'fee', 'cashback')),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'card' CHECK (payment_method IN ('card', 'contactless', 'online', 'atm')),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'settled', 'failed', 'cancelled', 'refunded')),
    authorization_code VARCHAR(50),
    settlement_date DATE,
    
    -- Fees and charges
    processing_fee NUMERIC(36, 18) NOT NULL DEFAULT 0,
    foreign_exchange_fee NUMERIC(36, 18) NOT NULL DEFAULT 0,
    network_fee NUMERIC(36, 18) NOT NULL DEFAULT 0,
    total_fees NUMERIC(36, 18) NOT NULL DEFAULT 0,
    
    -- Blockchain integration
    funding_transaction_hash VARCHAR(66) CHECK (funding_transaction_hash ~ '^0x[a-fA-F0-9]{64}$'),
    chain_id INTEGER NOT NULL,
    
    -- Fraud and security
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    fraud_flags JSONB DEFAULT '[]',
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    
    -- Geographic and temporal data
    transaction_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timezone VARCHAR(50),
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Card balances table - Real-time card balance tracking
CREATE TABLE card_balances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Balance information
    available_balance NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    pending_balance NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
    reserved_balance NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
    total_balance NUMERIC(36, 18) GENERATED ALWAYS AS (available_balance + pending_balance + reserved_balance) STORED,
    
    -- Auto top-up configuration
    auto_topup_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_topup_threshold NUMERIC(36, 18) NOT NULL DEFAULT 50,
    auto_topup_amount NUMERIC(36, 18) NOT NULL DEFAULT 100,
    
    -- Balance history
    last_topup_at TIMESTAMP WITH TIME ZONE,
    last_spend_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, token_address)
);

-- Card spending limits table - Dynamic spending controls
CREATE TABLE card_spending_limits (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Limit types and periods
    limit_type VARCHAR(20) NOT NULL CHECK (limit_type IN ('daily', 'weekly', 'monthly', 'per_transaction', 'velocity')),
    
    -- Limit values
    limit_amount NUMERIC(36, 18) NOT NULL CHECK (limit_amount > 0),
    limit_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    
    -- Category-specific limits
    merchant_category VARCHAR(100),
    merchant_category_code VARCHAR(10),
    
    -- Geographic limits
    allowed_countries JSONB DEFAULT '[]',
    blocked_countries JSONB DEFAULT '[]',
    
    -- Temporal limits
    time_restrictions JSONB DEFAULT '{}', -- Hour ranges, days of week
    
    -- Status and override
    is_active BOOLEAN NOT NULL DEFAULT true,
    can_be_overridden BOOLEAN NOT NULL DEFAULT true,
    override_requires_auth BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, limit_type, COALESCE(merchant_category, ''))
);

-- Card top-up history table - Track all card funding events
CREATE TABLE card_topup_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    
    -- Top-up details
    amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
    token_address VARCHAR(42) NOT NULL CHECK (token_address ~ '^0x[a-fA-F0-9]{40}$'),
    token_symbol VARCHAR(20) NOT NULL,
    
    -- Source of funds
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('portfolio', 'external_wallet', 'bank_transfer', 'auto_topup')),
    source_transaction_id UUID REFERENCES transactions(id),
    source_wallet_address VARCHAR(42) CHECK (source_wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
    
    -- Blockchain details
    transaction_hash VARCHAR(66) CHECK (transaction_hash ~ '^0x[a-fA-F0-9]{64}$'),
    chain_id INTEGER NOT NULL,
    gas_cost NUMERIC(36, 18),
    
    -- Processing details
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_fee NUMERIC(36, 18) NOT NULL DEFAULT 0,
    
    -- Timing
    initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Liquidity management table - Card liquidity optimization
CREATE TABLE card_liquidity_management (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Liquidity strategy
    strategy_type VARCHAR(30) NOT NULL CHECK (strategy_type IN ('conservative', 'balanced', 'aggressive', 'custom')),
    target_liquidity_ratio NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (target_liquidity_ratio BETWEEN 0 AND 100),
    
    -- Thresholds
    low_liquidity_threshold NUMERIC(36, 18) NOT NULL DEFAULT 50,
    optimal_liquidity_amount NUMERIC(36, 18) NOT NULL DEFAULT 200,
    max_liquidity_amount NUMERIC(36, 18) NOT NULL DEFAULT 1000,
    
    -- Auto-management settings
    auto_rebalance_enabled BOOLEAN NOT NULL DEFAULT true,
    rebalance_frequency_hours INTEGER NOT NULL DEFAULT 24 CHECK (rebalance_frequency_hours > 0),
    
    -- Source protocols for liquidity
    preferred_source_protocols JSONB DEFAULT '[]',
    emergency_liquidation_protocols JSONB DEFAULT '[]',
    
    -- Performance tracking
    total_liquidity_moved NUMERIC(36, 18) NOT NULL DEFAULT 0,
    avg_rebalance_time_minutes INTEGER,
    total_gas_spent NUMERIC(36, 18) NOT NULL DEFAULT 0,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_rebalance_at TIMESTAMP WITH TIME ZONE,
    next_rebalance_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Card analytics table - Spending pattern analysis
CREATE TABLE card_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Analysis period
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Spending analytics
    total_spent NUMERIC(36, 18) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    average_transaction_amount NUMERIC(36, 18) NOT NULL DEFAULT 0,
    largest_transaction_amount NUMERIC(36, 18) NOT NULL DEFAULT 0,
    
    -- Category breakdown
    spending_by_category JSONB DEFAULT '{}',
    top_merchants JSONB DEFAULT '[]',
    
    -- Behavioral patterns
    most_active_day_of_week INTEGER CHECK (most_active_day_of_week BETWEEN 1 AND 7),
    most_active_hour INTEGER CHECK (most_active_hour BETWEEN 0 AND 23),
    spending_velocity NUMERIC(8, 4), -- Transactions per day
    
    -- Geographic patterns
    spending_by_country JSONB DEFAULT '{}',
    unique_locations_count INTEGER NOT NULL DEFAULT 0,
    
    -- Yield impact analysis
    yield_sacrificed NUMERIC(36, 18) NOT NULL DEFAULT 0,
    opportunity_cost NUMERIC(36, 18) NOT NULL DEFAULT 0,
    liquidity_efficiency_score NUMERIC(3, 2) CHECK (liquidity_efficiency_score BETWEEN 0 AND 1),
    
    -- Fraud and risk metrics
    unusual_transaction_count INTEGER NOT NULL DEFAULT 0,
    risk_events_count INTEGER NOT NULL DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, period_type, period_start)
);

-- Create indexes for card integration tables
CREATE INDEX idx_card_transactions_user_id ON card_transactions(user_id);
CREATE INDEX idx_card_transactions_status ON card_transactions(status);
CREATE INDEX idx_card_transactions_merchant ON card_transactions(merchant_name);
CREATE INDEX idx_card_transactions_timestamp ON card_transactions(transaction_timestamp DESC);
CREATE INDEX idx_card_transactions_amount ON card_transactions(amount DESC);
CREATE INDEX idx_card_transactions_token ON card_transactions(token_address);

CREATE INDEX idx_card_balances_user_id ON card_balances(user_id);
CREATE INDEX idx_card_balances_token ON card_balances(token_address);
CREATE INDEX idx_card_balances_total ON card_balances(total_balance DESC);

CREATE INDEX idx_card_spending_limits_user_id ON card_spending_limits(user_id);
CREATE INDEX idx_card_spending_limits_active ON card_spending_limits(is_active) WHERE is_active = true;

CREATE INDEX idx_card_topup_history_user_id ON card_topup_history(user_id);
CREATE INDEX idx_card_topup_history_status ON card_topup_history(processing_status);
CREATE INDEX idx_card_topup_history_initiated ON card_topup_history(initiated_at DESC);

CREATE INDEX idx_card_liquidity_management_user_id ON card_liquidity_management(user_id);
CREATE INDEX idx_card_liquidity_management_active ON card_liquidity_management(is_active) WHERE is_active = true;

CREATE INDEX idx_card_analytics_user_id ON card_analytics(user_id);
CREATE INDEX idx_card_analytics_period ON card_analytics(period_type, period_start);

-- Apply updated_at triggers
CREATE TRIGGER update_card_transactions_updated_at BEFORE UPDATE ON card_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_card_spending_limits_updated_at BEFORE UPDATE ON card_spending_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_card_topup_history_updated_at BEFORE UPDATE ON card_topup_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_card_liquidity_management_updated_at BEFORE UPDATE ON card_liquidity_management FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_card_analytics_updated_at BEFORE UPDATE ON card_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update card_balances last_updated on any change
CREATE OR REPLACE FUNCTION update_card_balances_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_card_balances_timestamp BEFORE UPDATE ON card_balances FOR EACH ROW EXECUTE FUNCTION update_card_balances_timestamp();
