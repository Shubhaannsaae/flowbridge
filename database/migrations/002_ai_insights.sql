-- FlowBridge Protocol - AI Insights and Analytics Schema
-- Production-grade AI/ML integration for yield optimization

-- AI insights table - Machine learning generated insights
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    
    -- Insight classification
    insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('yield_optimization', 'risk_alert', 'rebalance_suggestion', 'market_trend', 'protocol_analysis')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('performance', 'risk', 'opportunity', 'warning', 'information')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Insight content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    
    -- AI model data
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    confidence_score NUMERIC(3, 2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    accuracy_score NUMERIC(3, 2) CHECK (accuracy_score BETWEEN 0 AND 1),
    
    -- Insight data and metadata
    data JSONB NOT NULL DEFAULT '{}',
    features_used JSONB DEFAULT '[]',
    prediction_horizon_hours INTEGER,
    
    -- Implementation tracking
    is_actionable BOOLEAN NOT NULL DEFAULT true,
    is_implemented BOOLEAN NOT NULL DEFAULT false,
    implementation_status VARCHAR(20) DEFAULT 'pending' CHECK (implementation_status IN ('pending', 'in_progress', 'completed', 'rejected', 'expired')),
    implemented_at TIMESTAMP WITH TIME ZONE,
    implementation_result JSONB,
    
    -- Validity and expiration
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Relationships and tracking
    correlation_id UUID,
    parent_insight_id UUID REFERENCES ai_insights(id),
    source_transaction_id UUID REFERENCES transactions(id),
    
    -- Tags and categorization
    tags JSONB NOT NULL DEFAULT '[]',
    market_conditions JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ML model performance table - Track model accuracy and performance
CREATE TABLE ml_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Model identification
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('classification', 'regression', 'time_series', 'optimization')),
    
    -- Performance metrics
    accuracy NUMERIC(5, 4) CHECK (accuracy BETWEEN 0 AND 1),
    precision_score NUMERIC(5, 4) CHECK (precision_score BETWEEN 0 AND 1),
    recall NUMERIC(5, 4) CHECK (recall BETWEEN 0 AND 1),
    f1_score NUMERIC(5, 4) CHECK (f1_score BETWEEN 0 AND 1),
    mse NUMERIC(10, 6),
    mae NUMERIC(10, 6),
    r2_score NUMERIC(5, 4),
    
    -- Training and validation data
    training_data_size INTEGER NOT NULL CHECK (training_data_size > 0),
    validation_data_size INTEGER NOT NULL CHECK (validation_data_size > 0),
    test_data_size INTEGER CHECK (test_data_size >= 0),
    
    -- Feature importance
    feature_importance JSONB DEFAULT '{}',
    feature_count INTEGER NOT NULL CHECK (feature_count > 0),
    
    -- Training details
    training_duration_minutes INTEGER,
    training_parameters JSONB DEFAULT '{}',
    hyperparameters JSONB DEFAULT '{}',
    
    -- Production metrics
    predictions_made INTEGER NOT NULL DEFAULT 0,
    correct_predictions INTEGER NOT NULL DEFAULT 0,
    false_positives INTEGER NOT NULL DEFAULT 0,
    false_negatives INTEGER NOT NULL DEFAULT 0,
    
    -- Deployment info
    is_production BOOLEAN NOT NULL DEFAULT false,
    deployed_at TIMESTAMP WITH TIME ZONE,
    last_retrain_at TIMESTAMP WITH TIME ZONE,
    next_retrain_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_name, model_version)
);

-- Market analysis table - Store market trend analysis
CREATE TABLE market_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Analysis scope
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('global', 'defi', 'chain_specific', 'protocol_specific', 'token_specific')),
    scope_identifier VARCHAR(255), -- Chain ID, protocol name, token address, etc.
    
    -- Market metrics
    total_market_cap NUMERIC(36, 18),
    total_volume_24h NUMERIC(36, 18),
    market_dominance JSONB DEFAULT '{}',
    volatility_index NUMERIC(8, 4),
    
    -- Sentiment analysis
    sentiment_score NUMERIC(3, 2) CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_category VARCHAR(20) CHECK (sentiment_category IN ('very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish')),
    fear_greed_index INTEGER CHECK (fear_greed_index BETWEEN 0 AND 100),
    
    -- Technical indicators
    rsi_14d NUMERIC(5, 2) CHECK (rsi_14d BETWEEN 0 AND 100),
    moving_avg_20d NUMERIC(36, 18),
    moving_avg_50d NUMERIC(36, 18),
    bollinger_upper NUMERIC(36, 18),
    bollinger_lower NUMERIC(36, 18),
    
    -- DeFi specific metrics
    defi_tvl NUMERIC(36, 18),
    defi_volume_24h NUMERIC(36, 18),
    active_protocols INTEGER,
    new_protocols_30d INTEGER,
    
    -- Analysis results
    trends JSONB DEFAULT '{}',
    predictions JSONB DEFAULT '{}',
    risk_factors JSONB DEFAULT '[]',
    opportunities JSONB DEFAULT '[]',
    
    -- Data sources and confidence
    data_sources JSONB DEFAULT '[]',
    confidence_level NUMERIC(3, 2) CHECK (confidence_level BETWEEN 0 AND 1),
    
    -- Temporal data
    analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Portfolio optimization suggestions table
CREATE TABLE optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    
    -- Optimization details
    optimization_type VARCHAR(50) NOT NULL CHECK (optimization_type IN ('rebalance', 'new_strategy', 'exit_strategy', 'risk_adjustment')),
    priority_score INTEGER NOT NULL CHECK (priority_score BETWEEN 1 AND 100),
    
    -- Current vs suggested allocation
    current_allocation JSONB NOT NULL DEFAULT '{}',
    suggested_allocation JSONB NOT NULL DEFAULT '{}',
    allocation_changes JSONB NOT NULL DEFAULT '{}',
    
    -- Expected outcomes
    expected_apy_improvement NUMERIC(8, 4),
    expected_risk_reduction NUMERIC(8, 4),
    estimated_gas_cost NUMERIC(36, 18),
    implementation_complexity VARCHAR(20) CHECK (implementation_complexity IN ('low', 'medium', 'high')),
    
    -- Rationale and analysis
    reasoning TEXT NOT NULL,
    risk_analysis JSONB DEFAULT '{}',
    market_conditions JSONB DEFAULT '{}',
    
    -- Implementation tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'implementing', 'completed', 'rejected', 'expired')),
    user_feedback VARCHAR(20) CHECK (user_feedback IN ('accepted', 'rejected', 'deferred')),
    
    -- Timestamps
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    implemented_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for AI insights and analytics
CREATE INDEX idx_ai_insights_portfolio_id ON ai_insights(portfolio_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority);
CREATE INDEX idx_ai_insights_valid ON ai_insights(valid_from, valid_to);
CREATE INDEX idx_ai_insights_implemented ON ai_insights(is_implemented);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at DESC);

CREATE INDEX idx_ml_model_performance_model ON ml_model_performance(model_name, model_version);
CREATE INDEX idx_ml_model_performance_production ON ml_model_performance(is_production) WHERE is_production = true;
CREATE INDEX idx_ml_model_performance_accuracy ON ml_model_performance(accuracy DESC);

CREATE INDEX idx_market_analysis_type ON market_analysis(analysis_type);
CREATE INDEX idx_market_analysis_scope ON market_analysis(scope_identifier);
CREATE INDEX idx_market_analysis_timestamp ON market_analysis(analysis_timestamp DESC);

CREATE INDEX idx_optimization_suggestions_portfolio_id ON optimization_suggestions(portfolio_id);
CREATE INDEX idx_optimization_suggestions_status ON optimization_suggestions(status);
CREATE INDEX idx_optimization_suggestions_priority ON optimization_suggestions(priority_score DESC);
CREATE INDEX idx_optimization_suggestions_expires ON optimization_suggestions(expires_at);

-- Apply updated_at triggers
CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON ai_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_model_performance_updated_at BEFORE UPDATE ON ml_model_performance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_analysis_updated_at BEFORE UPDATE ON market_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_optimization_suggestions_updated_at BEFORE UPDATE ON optimization_suggestions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
