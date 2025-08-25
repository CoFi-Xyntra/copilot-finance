import React, { useState } from 'react';

export const DocumentationSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('getting-started');

  const documentationCategories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      description: 'Learn the basics of using COFI XYNTRA'
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      icon: '📡',
      description: 'Comprehensive API documentation'
    },
    {
      id: 'tutorials',
      title: 'Tutorials',
      icon: '📖',
      description: 'Step-by-step guides and examples'
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      description: 'Common issues and solutions'
    }
  ];

  const documentationContent = {
    'getting-started': [
      {
        title: 'Quick Start Guide',
        description: 'Get up and running with COFI XYNTRA in 5 minutes',
        readTime: '5 min read',
        difficulty: 'Beginner',
        topics: ['Wallet Connection', 'First Trade', 'Portfolio Setup']
      },
      {
        title: 'Understanding DeFi Basics',
        description: 'Essential concepts for decentralized finance',
        readTime: '10 min read',
        difficulty: 'Beginner',
        topics: ['Liquidity Pools', 'Yield Farming', 'Smart Contracts']
      },
      {
        title: 'Security Best Practices',
        description: 'Keep your assets safe in the DeFi ecosystem',
        readTime: '8 min read',
        difficulty: 'Intermediate',
        topics: ['Private Keys', 'Smart Contract Risks', 'Phishing Protection']
      }
    ],
    'api-reference': [
      {
        title: 'Authentication',
        description: 'Learn how to authenticate with our API',
        readTime: '3 min read',
        difficulty: 'Intermediate',
        topics: ['API Keys', 'OAuth', 'Rate Limiting']
      },
      {
        title: 'Trading Endpoints',
        description: 'Execute trades programmatically',
        readTime: '15 min read',
        difficulty: 'Advanced',
        topics: ['Order Types', 'Market Data', 'Trade Execution']
      },
      {
        title: 'Portfolio Management',
        description: 'Manage portfolios via API',
        readTime: '12 min read',
        difficulty: 'Intermediate',
        topics: ['Balance Queries', 'Transaction History', 'Performance Metrics']
      }
    ],
    'tutorials': [
      {
        title: 'Building Your First DeFi Strategy',
        description: 'Create and deploy automated trading strategies',
        readTime: '20 min read',
        difficulty: 'Intermediate',
        topics: ['Strategy Design', 'Backtesting', 'Deployment']
      },
      {
        title: 'Yield Farming Optimization',
        description: 'Maximize yields across multiple protocols',
        readTime: '15 min read',
        difficulty: 'Advanced',
        topics: ['Protocol Analysis', 'Risk Assessment', 'Auto-Compounding']
      },
      {
        title: 'Cross-Chain Asset Management',
        description: 'Manage assets across different blockchains',
        readTime: '18 min read',
        difficulty: 'Advanced',
        topics: ['Bridge Protocols', 'Multi-Chain Strategies', 'Gas Optimization']
      }
    ],
    'troubleshooting': [
      {
        title: 'Common Connection Issues',
        description: 'Resolve wallet and network connection problems',
        readTime: '5 min read',
        difficulty: 'Beginner',
        topics: ['Wallet Setup', 'Network Errors', 'RPC Issues']
      },
      {
        title: 'Transaction Failures',
        description: 'Understanding and fixing failed transactions',
        readTime: '8 min read',
        difficulty: 'Intermediate',
        topics: ['Gas Errors', 'Slippage', 'MEV Protection']
      },
      {
        title: 'Performance Optimization',
        description: 'Improve application performance and speed',
        readTime: '10 min read',
        difficulty: 'Advanced',
        topics: ['Caching', 'Batch Requests', 'Network Optimization']
      }
    ]
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-400 bg-green-400/20 border-green-400/30';
      case 'Intermediate': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      case 'Advanced': return 'text-red-400 bg-red-400/20 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
    }
  };

  return (
    <section id="documentation" className="py-20 bg-gradient-to-br from-black via-gray-900 to-gray-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400">Documentation</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Everything you need to know to get started with COFI XYNTRA and build amazing DeFi applications
          </p>
        </div>

        {/* Category Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {documentationCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`p-6 rounded-xl border transition-all duration-300 text-left hover:transform hover:scale-105 ${
                activeCategory === category.id
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:border-gray-600/50'
              }`}
            >
              <div className="text-2xl mb-2">{category.icon}</div>
              <h3 className="font-semibold mb-1">{category.title}</h3>
              <p className="text-sm text-gray-400">{category.description}</p>
            </button>
          ))}
        </div>

        {/* Documentation Content */}
        <div className="grid md:grid-cols-1 lg:grid-cols-1 gap-6">
          {documentationContent[activeCategory as keyof typeof documentationContent].map((doc, index) => (
            <div
              key={index}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:transform hover:scale-105"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2 hover:text-blue-400 transition-colors cursor-pointer">
                    {doc.title}
                  </h3>
                  <p className="text-gray-300 mb-4">{doc.description}</p>
                </div>
                <div className="flex flex-col md:items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(doc.difficulty)}`}>
                    {doc.difficulty}
                  </span>
                  <span className="text-sm text-gray-400">{doc.readTime}</span>
                </div>
              </div>

              {/* Topics */}
              <div className="flex flex-wrap gap-2 mb-4">
                {doc.topics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-lg border border-gray-600/50"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <a href="https://docs.cofi-xyntra.roracash.com/" target="_blank" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                <span>Read More</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-500/20">
            <div className="text-3xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-white mb-2">Community Support</h3>
            <p className="text-gray-300 mb-4">Join our Discord for real-time help and discussions</p>
            <a href="https://discord.gg/8RvnTUUY45" target="_blank" rel="noopener noreferrer">
              <button className="text-purple-400 hover:text-purple-300 transition-colors">
                Join Discord →
              </button>
            </a>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-6 border border-green-500/20">
            <div className="text-3xl mb-4">📺</div>
            <h3 className="text-xl font-bold text-white mb-2">Video Tutorials</h3>
            <p className="text-gray-300 mb-4">Watch step-by-step video guides on YouTube</p>
            <a href="https://youtu.be/1H9N9YJLtoM" target="_blank" rel="noopener noreferrer">
              <button className="text-green-400 hover:text-green-300 transition-colors">
                Watch Videos →
              </button>
            </a>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-500/20">
            <div className="text-3xl mb-4">🎓</div>
            <h3 className="text-xl font-bold text-white mb-2">DeFi Academy</h3>
            <p className="text-gray-300 mb-4">Comprehensive courses on DeFi and blockchain</p>
            <a href="https://discord.gg/8RvnTUUY45" target="_blank" rel="noopener noreferrer">
              <button className="text-orange-400 hover:text-orange-300 transition-colors">
                Start Learning →
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
