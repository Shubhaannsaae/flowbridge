-- FlowBridge Protocol - Test Data for Development
-- Production-grade test data with realistic scenarios

-- Clear existing test data
TRUNCATE TABLE users, portfolios, transactions, yield_strategies, ai_insights RESTART IDENTITY CASCADE;

-- Create test users with realistic MetaMask addresses
INSERT INTO users (
    wallet_address, ens_name, email, risk_tolerance, preferred_chains,
    notification_settings, kyc_status, is_active
) VALUES
(
    '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1',
    'alice.eth',
    'alice@example.com',
    7,
    '[1, 137, 42161]'::jsonb,
    '{"email": true, "push": true, "sms": false}'::jsonb,
    'verified',
    true
),
(
    '0x8ba1f109551bD432803012645Hac136c10415121',
    'bob.eth',
    'bob@example.com',
    4,
    '[1, 10, 8453]'::jsonb,
    '{"email": true, "push": false, "sms": true}'::jsonb,
    'verified',
    true
),
(
    '0x1234567890123456789012345678901234567890',
    'charlie.eth',
    'charlie@example.com',
    9,
    '[1, 137, 42161, 10, 43114]'::jsonb,
    '{"email": false, "push": true, "sms": false}'::jsonb,
    'pending',
    true
),
(
    '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12',
    'diana.eth',
    'diana@example.com',
    5,
    '[1, 59144]'::jsonb,
    '{"email": true, "push": true, "sms": true}'::jsonb,
    'verified',
    true
),
(
    '0x9876543210987654321098765432109876543210',
    'eve.eth',
    'eve@example.com',
    6,
    '[1, 137, 42161, 8453]'::jsonb,
    '{"email": true, "push": false, "sms": false}'::jsonb,
    'verified',
    true
);

-- Create test portfolios
INSERT INTO portfolios (
    user_id, name, wallet_address, total_deposited, current_value,
    total_yield_earned, card_linked, card_liquidity_reserve,
    risk_level, auto_rebalance_enabled
) VALUES
(
    (SELECT id FROM users WHERE wallet_address = '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1'),
    'Conservative Portfolio',
    '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1',
    50000.00,
    52500.00,
    2500.00,
    true,
    500.00,
    3,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x8ba1f109551bD432803012645Hac136c10415121'),
    'Balanced Growth',
    '0x8ba1f109551bD432803012645Hac136c10415121',
    25000.00,
    28750.00,
    3750.00,
    true,
    250.00,
    5,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x1234567890123456789012345678901234567890'),
    'High Yield Hunter',
    '0x1234567890123456789012345678901234567890',
    100000.00,
    115000.00,
    15000.00,
    false,
    0.00,
    8,
    false
),
(
    (SELECT id FROM users WHERE wallet_address = '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12'),
    'Linea Explorer',
    '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12',
    15000.00,
    16200.00,
    1200.00,
    true,
    150.00,
    4,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x9876543210987654321098765432109876543210'),
    'Multi-Chain Diversified',
    '0x9876543210987654321098765432109876543210',
    75000.00,
    82500.00,
    7500.00,
    true,
    750.00,
    6,
    true
);

-- Create test transactions
INSERT INTO transactions (
    portfolio_id, transaction_hash, type, status, amount,
    token_address, token_symbol, chain_id, protocol_id,
    gas_cost, gas_used, gas_price
) VALUES
(
    (SELECT id FROM portfolios WHERE name = 'Conservative Portfolio'),
    '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    'deposit',
    'confirmed',
    10000.00,
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    'USDC',
    1,
    (SELECT id FROM protocols WHERE slug = 'aave'),
    15.50,
    150000,
    25000000000
),
(
    (SELECT id FROM portfolios WHERE name = 'Balanced Growth'),
    '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    'deposit',
    'confirmed',
    5000.00,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WETH',
    1,
    (SELECT id FROM protocols WHERE slug = 'compound'),
    12.75,
    180000,
    22000000000
),
(
    (SELECT id FROM portfolios WHERE name = 'High Yield Hunter'),
    '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    'rebalance',
    'confirmed',
    20000.00,
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    'USDC',
    1,
    (SELECT id FROM protocols WHERE slug = 'yearn'),
    45.20,
    300000,
    30000000000
);

-- Create test yield strategies
INSERT INTO yield_strategies (
    portfolio_id, protocol_id, strategy_name, strategy_type,
    token_address, token_symbol, chain_id, allocation_percentage,
    deployed_amount, current_value, current_apy, entry_price, risk_score
) VALUES
(
    (SELECT id FROM portfolios WHERE name = 'Conservative Portfolio'),
    (SELECT id FROM protocols WHERE slug = 'aave'),
    'USDC Lending',
    'lending',
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    'USDC',
    1,
    60.00,
    30000.00,
    31350.00,
    4.50,
    1.00,
    25
),
(
    (SELECT id FROM portfolios WHERE name = 'Conservative Portfolio'),
    (SELECT id FROM protocols WHERE slug = 'compound'),
    'ETH Lending',
    'lending',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WETH',
    1,
    40.00,
    20000.00,
    21150.00,
    3.80,
    2500.00,
    30
),
(
    (SELECT id FROM portfolios WHERE name = 'High Yield Hunter'),
    (SELECT id FROM protocols WHERE slug = 'yearn'),
    'YFI Vault Strategy',
    'vault',
    '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
    'YFI',
    1,
    50.00,
    50000.00,
    57500.00,
    8.20,
    8500.00,
    45
),
(
    (SELECT id FROM portfolios WHERE name = 'High Yield Hunter'),
    (SELECT id FROM protocols WHERE slug = 'uniswap-v3'),
    'ETH/USDC LP',
    'lp_token',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WETH',
    1,
    50.00,
    50000.00,
    57500.00,
    12.50,
    2500.00,
    60
);

-- Create test AI insights
INSERT INTO ai_insights (
    portfolio_id, insight_type, category, priority, title, description,
    model_name, model_version, confidence_score, data, is_actionable
) VALUES
(
    (SELECT id FROM portfolios WHERE name = 'Conservative Portfolio'),
    'yield_optimization',
    'opportunity',
    'medium',
    'Rebalance to Higher Yield Protocol',
    'Current Aave USDC yield at 4.5% could be improved by moving 30% allocation to Compound at 5.2% APY.',
    'yield_optimizer_v2',
    '2.1.0',
    0.85,
    '{"suggested_allocation": {"aave": 30, "compound": 70}, "expected_yield_increase": 0.7, "estimated_gas_cost": 25.50}'::jsonb,
    true
),
(
    (SELECT id FROM portfolios WHERE name = 'High Yield Hunter'),
    'risk_alert',
    'warning',
    'high',
    'High Concentration Risk Detected',
    'Portfolio has 80% allocation in high-risk yield farming protocols. Consider diversifying.',
    'risk_analyzer_v1',
    '1.5.2',
    0.92,
    '{"risk_score": 8.5, "concentration_ratio": 0.8, "recommended_max_allocation": 0.6}'::jsonb,
    true
),
(
    (SELECT id FROM portfolios WHERE name = 'Balanced Growth'),
    'market_trend',
    'information',
    'low',
    'DeFi Yield Rates Trending Upward',
    'Market analysis shows DeFi yields increasing by average 1.2% across major protocols in the last 7 days.',
    'market_analyzer_v3',
    '3.0.1',
    0.78,
    '{"trend_direction": "up", "average_increase": 1.2, "timeframe_days": 7, "protocols_analyzed": 15}'::jsonb,
    false
);

-- Create card-related test data
INSERT INTO card_balances (user_id, token_address, available_balance, auto_topup_enabled, auto_topup_threshold, auto_topup_amount) VALUES
(
    (SELECT id FROM users WHERE wallet_address = '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1'),
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    450.00,
    true,
    100.00,
    200.00
),
(
    (SELECT id FROM users WHERE wallet_address = '0x8ba1f109551bD432803012645Hac136c10415121'),
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    225.00,
    true,
    50.00,
    150.00
);

INSERT INTO card_spending_limits (user_id, limit_type, limit_amount, is_active) VALUES
(
    (SELECT id FROM users WHERE wallet_address = '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1'),
    'daily',
    500.00,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1'),
    'monthly',
    5000.00,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x8ba1f109551bD432803012645Hac136c10415121'),
    'daily',
    300.00,
    true
),
(
    (SELECT id FROM users WHERE wallet_address = '0x8ba1f109551bD432803012645Hac136c10415121'),
    'monthly',
    3000.00,
    true
);

-- Create sample card transactions
INSERT INTO card_transactions (
    user_id, card_transaction_id, amount, token_address, token_symbol,
    token_amount, exchange_rate, merchant_name, merchant_category,
    transaction_type, status, chain_id
) VALUES
(
    (SELECT id FROM users WHERE wallet_address = '0x742C3cF9Af45f91B109a81EfAb1C8D843e7046A1'),
    'CTX_001_20241225_001',
    45.99,
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    'USDC',
    45.99,
    1.00,
    'Amazon',
    'Online Retail',
    'purchase',
    'settled',
    1
),
(
    (SELECT id FROM users WHERE wallet_address = '0x8ba1f109551bD432803012645Hac136c10415121'),
    'CTX_002_20241225_002',
    12.50,
    '0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c',
    'USDC',
    12.50,
    1.00,
    'Starbucks',
    'Food & Beverage',
    'purchase',
    'settled',
    1
);

-- Create sample price history data
INSERT INTO price_history (token_address, token_symbol, chain_id, price_usd, volume_24h, market_cap, timestamp) VALUES
('0xA0b86a33E6441A0E81E6e3F7E0E9a0e2c2A4E43c', 'USDC', 1, 1.00, 2500000000, 25000000000, NOW() - INTERVAL '1 hour'),
('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 1, 2450.00, 1200000000, 295000000000, NOW() - INTERVAL '1 hour'),
('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 1, 43500.00, 450000000, 850000000000, NOW() - INTERVAL '1 hour');

-- Update timestamps for all test data
UPDATE users SET created_at = NOW() - INTERVAL '30 days', updated_at = NOW() - INTERVAL '1 day';
UPDATE portfolios SET created_at = NOW() - INTERVAL '25 days', updated_at = NOW() - INTERVAL '1 hour';
UPDATE transactions SET created_at = NOW() - INTERVAL '20 days', submitted_at = NOW() - INTERVAL '20 days', confirmed_at = NOW() - INTERVAL '20 days' + INTERVAL '5 minutes';
UPDATE yield_strategies SET created_at = NOW() - INTERVAL '18 days', updated_at = NOW() - INTERVAL '2 hours';
UPDATE ai_insights SET created_at = NOW() - INTERVAL '12 hours', updated_at = NOW() - INTERVAL '1 hour';
