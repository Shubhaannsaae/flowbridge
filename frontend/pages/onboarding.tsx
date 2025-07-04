// FlowBridge Frontend - Onboarding Page
import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import OnboardingFlow from '../components/features/onboarding/OnboardingFlow';

const OnboardingPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Welcome to FlowBridge - Get Started</title>
        <meta name="description" content="Set up your FlowBridge account and start earning optimized DeFi yields." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <OnboardingFlow />
    </>
  );
};

export default OnboardingPage;
