// FlowBridge Frontend - Next.js Configuration
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'FlowBridge',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },

  // Public runtime configuration
  publicRuntimeConfig: {
    appName: 'FlowBridge',
    version: '1.0.0',
  },

  // Experimental features
  experimental: {
    appDir: false, // Using pages router
    optimizeCss: true,
    optimizePackageImports: [
      '@metamask/sdk-react',
      '@lifi/sdk',
      'ethers',
      'react-hot-toast',
    ],
  },

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Image optimization
  images: {
    domains: [
      'assets.coingecko.com',
      'raw.githubusercontent.com',
      'logos.covalenthq.com',
      'wallet-asset.matic.network',
      'ethereum-optimism.github.io',
      'bridge.arbitrum.io',
      'assets.trustwalletapp.com',
    ],
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' 
              ? 'https://flowbridge.app' 
              : 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/app',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/wallet',
        destination: '/onboarding',
        permanent: false,
      },
    ];
  },

  // Rewrites for API proxying
  async rewrites() {
    return [
      {
        source: '/api/proxy/coingecko/:path*',
        destination: 'https://api.coingecko.com/api/v3/:path*',
      },
      {
        source: '/api/proxy/lifi/:path*',
        destination: 'https://li.quest/v1/:path*',
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle .mjs files
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    // Fallbacks for Node.js modules in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      url: require.resolve('url/'),
      zlib: require.resolve('browserify-zlib'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      assert: require.resolve('assert/'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
    };

    // Provide polyfills
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );

    // Optimize bundle splitting
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        metamask: {
          test: /[\\/]node_modules[\\/]@metamask[\\/]/,
          name: 'metamask',
          chunks: 'all',
          priority: 20,
        },
        ethers: {
          test: /[\\/]node_modules[\\/]ethers[\\/]/,
          name: 'ethers',
          chunks: 'all',
          priority: 15,
        },
        lifi: {
          test: /[\\/]node_modules[\\/]@lifi[\\/]/,
          name: 'lifi',
          chunks: 'all',
          priority: 10,
        },
      };
    }

    return config;
  },

  // Build output configuration
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['pages', 'components', 'hooks', 'utils', 'types'],
  },

  // Bundle analyzer (conditional)
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesRouterDependencies: true,
    },
  }),
};

// Bundle analyzer setup
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: true,
  });
  module.exports = withBundleAnalyzer(nextConfig);
} else {
  module.exports = nextConfig;
}
