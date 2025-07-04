// FlowBridge Frontend - Dashboard Page
import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { withAuth } from '../components/layout/DashboardLayout';
import PortfolioDashboard from '../components/features/dashboard/PortfolioDashboard';
import YieldMetrics from '../components/features/dashboard/YieldMetrics';
import TransactionHistory from '../components/features/dashboard/TransactionHistory';
import AIInsights from '../components/features/dashboard/AIInsights';
import YieldChart from '../components/charts/YieldChart';
import AllocationChart from '../components/charts/AllocationChart';
import PerformanceChart from '../components/charts/PerformanceChart';
import { Button } from '../components/ui/Button';

const DashboardPage: NextPage = () => {
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'insights'>('overview');

  const viewOptions = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'analytics', label: 'Analytics', icon: '📈' },
    { key: 'insights', label: 'AI Insights', icon: '🤖' },
  ];

  return (
    <>
      <Head>
        <title>Dashboard - FlowBridge</title>
        <meta name="description" content="Monitor your DeFi portfolio performance and yield strategies." />
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Monitor your portfolio performance and manage your yield strategies
            </p>
          </div>

          {/* View Selector */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setActiveView(option.key as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === option.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview View */}
        {activeView === 'overview' && (
          <div className="space-y-8">
            {/* Main Portfolio Dashboard */}
            <PortfolioDashboard />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <YieldChart />
              <AllocationChart />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TransactionHistory />
              <AIInsights />
            </div>
          </div>
        )}

        {/* Analytics View */}
        {activeView === 'analytics' && (
          <div className="space-y-8">
            {/* Performance Analysis */}
            <PerformanceChart height={500} />

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <YieldMetrics />
              <AllocationChart />
            </div>

            {/* Historical Data */}
            <YieldChart height={600} />
          </div>
        )}

        {/* AI Insights View */}
        {activeView === 'insights' && (
          <div className="space-y-8">
            {/* AI Recommendations */}
            <AIInsights />

            {/* Supporting Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <PerformanceChart />
              <YieldChart />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default withAuth(DashboardPage);
