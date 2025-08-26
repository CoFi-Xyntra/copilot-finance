import React from 'react';

export const ProductsSection: React.FC = () => {
  const products = [
    {
      id: 'ai-trading',
      title: 'AI Trading Assistant',
      description: 'Intelligent trading strategies powered by advanced AI algorithms and real-time market analysis.',
      icon: '🤖',
      features: ['Smart Order Execution', 'Risk Management', 'Market Analysis', 'Portfolio Optimization'],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'portfolio-manager',
      title: 'Portfolio Manager',
      description: 'Comprehensive portfolio tracking and management across multiple DeFi protocols and chains.',
      icon: '📊',
      features: ['Multi-Chain Support', 'Real-time Tracking', 'Performance Analytics', 'Auto-Rebalancing'],
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'yield-farming',
      title: 'Yield Farming Optimizer',
      description: 'Maximize your yields by automatically finding and executing the best farming opportunities.',
      icon: '🌾',
      features: ['Auto-Compounding', 'Gas Optimization', 'Risk Assessment', 'APY Tracking'],
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'defi-analytics',
      title: 'DeFi Analytics',
      description: 'Deep insights and analytics for DeFi protocols, tokens, and market trends.',
      icon: '📈',
      features: ['Protocol Analytics', 'Token Metrics', 'Market Trends', 'Custom Dashboards'],
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <section id="products" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Products</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover our suite of intelligent DeFi tools designed to maximize your returns and minimize risks
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:transform hover:scale-105"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${product.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`}></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${product.color} flex items-center justify-center text-2xl shadow-lg`}>
                    {product.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all duration-300">
                      {product.title}
                    </h3>
                  </div>
                </div>

                <p className="text-gray-300 mb-6 leading-relaxed">
                  {product.description}
                </p>

                {/* Features */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {product.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full"></div>
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button className={`w-full bg-gradient-to-r ${product.color} hover:opacity-90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform group-hover:scale-105`}>
                  Learn More
                </button>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl"></div>
              <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-lg"></div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-8 border border-blue-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h3>
            <p className="text-gray-300 mb-6">Join thousands of users already using our DeFi tools to maximize their returns</p>
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105">
              Start Trading Now 🚀
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
