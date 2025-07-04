// FlowBridge Frontend - Settings Page
import React, { useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { withAuth } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useMetaMask } from '../hooks/useMetaMask';
import { useToastNotification } from '../components/ui/Toast';
import RiskSettings from '../components/features/yield-optimizer/RiskSettings';
import { formatAddress } from '../utils/formatters';

const SettingsPage: NextPage = () => {
  const { account, chainId, disconnect } = useMetaMask();
  const { success: showSuccess, error: showError } = useToastNotification();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'risk' | 'notifications'>('profile');

  const tabs = [
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'security', label: 'Security', icon: '🔒' },
    { key: 'risk', label: 'Risk Management', icon: '⚠️' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
  ];

  const handleDisconnect = async () => {
    try {
      await disconnect();
      showSuccess('Wallet Disconnected', 'Your wallet has been disconnected');
    } catch (error: any) {
      showError('Disconnect Failed', error.message);
    }
  };

  return (
    <>
      <Head>
        <title>Settings - FlowBridge</title>
        <meta name="description" content="Manage your FlowBridge account settings and preferences." />
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">
            Manage your account preferences and security settings
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Connected Wallet
                  </label>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{formatAddress(account || '', 6)}</div>
                      <div className="text-sm text-gray-500">MetaMask Wallet</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Network
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">Network ID: {chainId}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Currency
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Dark Mode</div>
                    <div className="text-sm text-gray-500">Use dark theme</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Transaction Confirmation</div>
                    <div className="text-sm text-gray-500">Require confirmation for all transactions</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">High-Value Alert</div>
                    <div className="text-sm text-gray-500">Alert for transactions above $1,000</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="destructive" className="w-full">
                  Emergency Stop All Strategies
                </Button>
                <p className="text-sm text-gray-500">
                  This will immediately stop all active yield strategies and secure your funds.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Risk Management Tab */}
        {activeTab === 'risk' && (
          <RiskSettings />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'portfolio', label: 'Portfolio Updates', description: 'Get notified about portfolio performance' },
                  { key: 'transactions', label: 'Transaction Alerts', description: 'Notifications for all transactions' },
                  { key: 'yield', label: 'Yield Opportunities', description: 'New yield strategies and opportunities' },
                  { key: 'security', label: 'Security Alerts', description: 'Important security notifications' },
                  { key: 'marketing', label: 'Product Updates', description: 'News and feature announcements' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Push Notifications</div>
                    <div className="text-sm text-gray-500">Browser notifications</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </div>
    </>
  );
};

export default withAuth(SettingsPage);
