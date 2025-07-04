-- FlowBridge Protocol - Complete Database Schema
-- Production-grade PostgreSQL schema for MetaMask SDK integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Execute all migrations in order
\i migrations/001_initial_schema.sql
\i migrations/002_ai_insights.sql
\i migrations/003_card_integration.sql

-- Create additional views for common queries
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
    p.id,
    p.user_id,
    u.wallet_address,
    u.ens_name,
    p.name AS portfolio_name,
    p.total_deposited,
    p.current_value,
    p.total_yield_earned,
    CASE 
        WHEN p.total_deposited > 0 THEN 
            ((p.current_value - p.total_deposited) / p.total_deposited * 100)
        ELSE 0 
    END AS return_percentage,
    p.risk_level,
    p.auto_rebalance_enabled,
    p.card_linked,
    p.card_liquidity_reserve,
    COUNT(ys.id) AS active_strategies,
    p.created_at,
    p.updated_at
FROM portfolios p
JOIN users u ON p.user_id = u.id
LEFT JOIN yield_strategies ys ON p.id = ys.portfolio_id AND ys.is_active = true
GROUP BY p.id, u.id;

-- Create view for protocol performance metrics
CREATE OR REPLACE VIEW protocol_performance AS
SELECT 
    pr.id,
    pr.name,
    pr.slug,
    pr.category,
    pr.risk_score,
    pr.apy_current,
    pr.tvl,
    COUNT(ys.id) AS active_positions,
    SUM(ys.deployed_amount) AS total_deployed,
    AVG(ys.current_apy) AS avg_realized_apy,
    pr.integration_status,
    pr.updated_at
FROM protocols pr
LEFT JOIN yield_strategies ys ON pr.id = ys.protocol_id AND ys.is_active = true
WHERE pr.is_active = true
GROUP BY pr.id;

-- Create view for user analytics
CREATE OR REPLACE VIEW user_analytics AS
SELECT 
    u.id,
    u.wallet_address,
    u.ens_name,
    u.risk_tolerance,
    COUNT(p.id) AS portfolio_count,
    COALESCE(SUM(p.total_deposited), 0) AS total_deposited,
    COALESCE(SUM(p.current_value), 0) AS total_value,
    COALESCE(SUM(p.total_yield_earned), 0) AS total_yield,
    COUNT(CASE WHEN p.card_linked THEN 1 END) AS linked_cards,
    u.last_login_at,
    u.created_at
FROM users u
LEFT JOIN portfolios p ON u.id = p.user_id
WHERE u.is_active = true
GROUP BY u.id;

-- Create indexes on views for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_summary_user_id ON portfolios(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_summary_performance ON portfolios((current_value - total_deposited) DESC);

-- Create materialized view for heavy analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_protocol_metrics AS
SELECT 
    DATE(created_at) AS metric_date,
    protocol_id,
    pr.name AS protocol_name,
    COUNT(*) AS daily_transactions,
    SUM(amount) AS daily_volume,
    AVG(gas_cost) AS avg_gas_cost
FROM transactions t
JOIN protocols pr ON t.protocol_id = pr.id
WHERE t.status = 'confirmed'
  AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), protocol_id, pr.name
ORDER BY metric_date DESC, daily_volume DESC;

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW daily_protocol_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create functions for common calculations
CREATE OR REPLACE FUNCTION calculate_portfolio_apy(portfolio_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
    weighted_apy NUMERIC := 0;
    total_value NUMERIC := 0;
    strategy_record RECORD;
BEGIN
    FOR strategy_record IN 
        SELECT current_value, current_apy 
        FROM yield_strategies 
        WHERE portfolio_id = portfolio_uuid AND is_active = true
    LOOP
        weighted_apy := weighted_apy + (strategy_record.current_value * strategy_record.current_apy);
        total_value := total_value + strategy_record.current_value;
    END LOOP;
    
    IF total_value > 0 THEN
        RETURN weighted_apy / total_value;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's total gas spent
CREATE OR REPLACE FUNCTION get_user_gas_spent(user_address VARCHAR(42))
RETURNS NUMERIC AS $$
DECLARE
    total_gas NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(t.gas_cost), 0) INTO total_gas
    FROM transactions t
    JOIN portfolios p ON t.portfolio_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE u.wallet_address = user_address
      AND t.status = 'confirmed';
    
    RETURN total_gas;
END;
$$ LANGUAGE plpgsql;

-- Create security policies (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only see their own data
CREATE POLICY user_isolation_policy ON users
    FOR ALL TO authenticated_user
    USING (wallet_address = current_setting('app.current_user_address'));

CREATE POLICY portfolio_isolation_policy ON portfolios
    FOR ALL TO authenticated_user
    USING (user_id IN (
        SELECT id FROM users 
        WHERE wallet_address = current_setting('app.current_user_address')
    ));

-- Grant permissions to application roles
CREATE ROLE IF NOT EXISTS flowbridge_app;
CREATE ROLE IF NOT EXISTS flowbridge_readonly;
CREATE ROLE IF NOT EXISTS authenticated_user;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO flowbridge_app, flowbridge_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flowbridge_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO flowbridge_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flowbridge_app;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_portfolio_status ON transactions(portfolio_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yield_strategies_performance ON yield_strategies(protocol_id, current_apy DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_insights_actionable ON ai_insights(portfolio_id, is_actionable, priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_transactions_user_merchant ON card_transactions(user_id, merchant_name);

-- Final schema validation
DO $$
BEGIN
    -- Verify all required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Required table users does not exist';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portfolios') THEN
        RAISE EXCEPTION 'Required table portfolios does not exist';
    END IF;
    
    -- Verify constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_type = 'UNIQUE' 
        AND constraint_name LIKE '%wallet_address%'
    ) THEN
        RAISE EXCEPTION 'Unique constraint on wallet_address is missing';
    END IF;
    
    RAISE NOTICE 'Schema validation completed successfully';
END $$;
