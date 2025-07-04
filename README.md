# FlowBridge - Next-Generation DeFi Platform

FlowBridge is a next-generation DeFi platform that seamlessly integrates yield optimization, cross-chain bridging, and MetaMask Card spending. Built with production-ready MetaMask SDK integration and powered by AI-driven portfolio optimization.

## 🚀 Features

### Core Functionality
- **🔗 MetaMask SDK Integration** - Production-ready, battle-tested wallet connection
- **🌉 Cross-Chain Bridging** - Powered by LI.FI for seamless asset transfers
- **🤖 AI-Powered Optimization** - Intelligent yield strategy recommendations
- **💳 MetaMask Card Integration** - Spend DeFi yields in the real world
- **📊 Advanced Analytics** - Comprehensive portfolio performance tracking
- **🛡️ Risk Management** - Sophisticated risk assessment and protection

### Technical Features
- **⚡ Next.js 14** - Modern React framework with App Router
- **🎨 Tailwind CSS** - Utility-first CSS framework
- **📱 Responsive Design** - Mobile-first, cross-platform compatibility
- **🔒 Security First** - Industry-standard security practices
- **🎯 TypeScript** - Full type safety and developer experience
- **🔄 Real-time Updates** - Live portfolio and market data


## Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the `config/` directory with the following variables:

MetaMask SDK Configuration
NEXT_PUBLIC_METAMASK_SDK_ENABLED=true
NEXT_PUBLIC_INFURA_API_KEY=your_infura_api_key

LI.FI Cross-Chain Integration
NEXT_PUBLIC_LIFI_API_KEY=your_lifi_api_key
NEXT_PUBLIC_LIFI_INTEGRATOR=flowbridge

Verax Attestation Registry
NEXT_PUBLIC_VERAX_PORTAL_ADDRESS=your_verax_portal_address
NEXT_PUBLIC_VERAX_SCHEMA_ID=your_verax_schema_id

Security
JWT_SECRET=your_jwt_secret_minimum_32_characters
ENCRYPTION_KEY=your_encryption_key_32_characters


### Supported Networks

- **Ethereum Mainnet** (Chain ID: 1)
- **Polygon** (Chain ID: 137)
- **Arbitrum One** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)
- **Base** (Chain ID: 8453)
- **Linea** (Chain ID: 59144)

## 🔗 Integrations

### MetaMask SDK
FlowBridge uses the official MetaMask SDK for wallet connectivity:
- Cross-platform support (Mobile, Desktop, Browser)
- Secure connection management
- Deep linking for mobile apps
- Production-ready implementation

### LI.FI Protocol
Cross-chain bridging powered by LI.FI:
- Multi-bridge aggregation
- Best route optimization
- Real-time transaction tracking
- Support for 20+ bridges

### Verax Attestation Registry
On-chain attestations for:
- Yield performance verification
- Risk assessment records
- Protocol audit confirmations
- User reputation building

## 🛠️ Development

### Available Scripts

Development
npm run dev # Start development server
npm run build # Build for production
npm run start # Start production server
npm run lint # Run ESLint
npm run type-check # TypeScript type checking

Frontend specific
cd frontend
npm run dev # Start frontend development
npm run build # Build frontend
npm run analyze # Bundle analysis
npm run test # Run tests


### Code Quality

- **ESLint** - Code linting with strict rules
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **Husky** - Git hooks for pre-commit checks
- **Lint-staged** - Staged file linting

## 🤝 Contributing

We welcome contributions!


## 📄 License

This project is licensed under the MIT License

---

**Built with ❤️ by the FlowBridge Team**