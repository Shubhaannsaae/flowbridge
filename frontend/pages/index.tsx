// FlowBridge Frontend - Landing Page
import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMetaMask } from '../hooks/useMetaMask';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { withPublicLayout } from '../components/layout/DashboardLayout';

const LandingPage: NextPage = () => {
  const router = useRouter();
  const { isConnected, connect, isConnecting } = useMetaMask();

  const handleGetStarted = async () => {
    if (isConnected) {
      router.push('/dashboard');
    } else {
      try {
        await connect();
        router.push('/onboarding');
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const features = [
    {
      title: 'AI-Powered Yield Optimization',
      description: 'Let our AI find the best yield opportunities across DeFi protocols automatically.',
      icon: (
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      title: 'Seamless Cross-Chain',
      description: 'Move assets across multiple blockchains with integrated LI.FI bridge technology.',
      icon: (
        <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      title: 'MetaMask Card Integration',
      description: 'Spend your yield directly in the real world with MetaMask Card integration.',
      icon: (
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      title: 'Advanced Risk Management',
      description: 'Sophisticated risk controls and automated portfolio protection.',
      icon: (
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  const stats = [
    { label: 'Total Value Locked', value: '$2.4B+', description: 'Across all protocols' },
    { label: 'Active Users', value: '150K+', description: 'Monthly active users' },
    { label: 'Supported Chains', value: '12+', description: 'EVM compatible networks' },
    { label: 'Average APY', value: '8.2%', description: 'Historical performance' },
  ];

  return (
    <>
      <Head>
        <title>FlowBridge - Next-Generation DeFi Platform</title>
        <meta name="description" content="The next-generation DeFi platform that seamlessly integrates yield optimization, cross-chain bridging, and MetaMask Card spending." />
      </Head>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative container mx-auto px-4 py-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-6xl font-bold tracking-tight text-gray-900 mb-6">
              The Future of{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                DeFi Yield
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Seamlessly integrate yield optimization, cross-chain bridging, and MetaMask Card spending 
              in one powerful platform powered by AI.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-12">
              <Button 
                size="xl" 
                variant="gradient"
                onClick={handleGetStarted}
                loading={isConnecting}
                className="w-full sm:w-auto"
              >
                {isConnected ? 'Go to Dashboard' : 'Get Started'}
              </Button>
              
              <Link href="/docs" className="w-full sm:w-auto">
                <Button size="xl" variant="outline" className="w-full">
                  Learn More
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Audited Smart Contracts</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Lightning Fast</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Non-Custodial</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-lg font-medium text-gray-700 mb-1">{stat.label}</div>
                <div className="text-sm text-gray-500">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need for DeFi success
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              FlowBridge combines the best of DeFi into one seamless experience, 
              powered by cutting-edge AI and blockchain technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-8 hover:shadow-lg transition-shadow">
                <CardContent className="text-center">
                  <div className="flex justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-600 text-lg">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How FlowBridge Works</h2>
            <p className="text-xl text-gray-600">Simple steps to maximize your DeFi returns</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Your Wallet',
                description: 'Securely connect your MetaMask wallet to get started with FlowBridge.',
              },
              {
                step: '2',
                title: 'Set Your Strategy',
                description: 'Configure your risk tolerance and let our AI find optimal yield opportunities.',
              },
              {
                step: '3',
                title: 'Earn & Spend',
                description: 'Watch your yield grow and spend directly with your MetaMask Card.',
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-2xl font-bold mb-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to maximize your DeFi returns?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of users who are already earning optimized yields 
            with FlowBridge's AI-powered platform.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button 
              size="xl" 
              variant="secondary"
              onClick={handleGetStarted}
              loading={isConnecting}
              className="w-full sm:w-auto"
            >
              Start Earning Now
            </Button>
            
            <Link href="/security" className="w-full sm:w-auto">
              <Button size="xl" variant="outline" className="w-full border-white text-white hover:bg-white hover:text-blue-600">
                View Security
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default withPublicLayout(LandingPage, { showFooter: true });
