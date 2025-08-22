import React, { useState, useEffect } from 'react';
import { ConnectPlugButton } from './connectButton';

interface LandingPageProps {
  onEnterApp: () => void;
}

// Animated Background Component - FLUID & ELEGANT VERSION
const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient waves background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))',
            animation: 'gradientShift 8s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse at 30% 50%, rgba(249, 115, 22, 0.15), transparent 50%)',
            animation: 'radialMove 12s ease-in-out infinite',
          }}
        />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={`shape-${i}`}
            className="absolute opacity-10"
            style={{
              left: `${Math.random() * 90}%`,
              top: `${Math.random() * 90}%`,
              width: `${40 + Math.random() * 60}px`,
              height: `${40 + Math.random() * 60}px`,
              background: `linear-gradient(135deg, ${
                i % 4 === 0 ? 'rgba(59, 130, 246, 0.3)' :
                i % 4 === 1 ? 'rgba(139, 92, 246, 0.3)' :
                i % 4 === 2 ? 'rgba(6, 182, 212, 0.3)' :
                'rgba(249, 115, 22, 0.3)'
              }, transparent)`,
              borderRadius: i % 2 === 0 ? '50%' : '20%',
              animation: `floatGentle ${10 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
      </div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Smooth light rays */}
      <div className="absolute inset-0">
        {[...Array(5)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute opacity-20"
            style={{
              left: `${i * 20 + 10}%`,
              top: '-10%',
              width: '2px',
              height: '120%',
              background: 'linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.4), transparent)',
              transform: `rotate(${-10 + i * 5}deg)`,
              animation: `lightRay ${6 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Subtle crypto symbols */}
      <div className="absolute inset-0">
        {['₿', '⟐', '◊', '◈'].map((symbol, i) => (
          <div
            key={`crypto-${i}`}
            className="absolute text-2xl font-light opacity-5"
            style={{
              left: `${20 + i * 20}%`,
              top: `${30 + (i % 2) * 40}%`,
              color: i % 2 === 0 ? '#3b82f6' : '#8b5cf6',
              animation: `symbolFloat ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          >
            {symbol}
          </div>
        ))}
      </div>

      {/* Animated mesh background */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%">
          <defs>
            <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1">
                <animate attributeName="stop-opacity" values="0.1;0.3;0.1" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.2">
                <animate attributeName="stop-opacity" values="0.2;0.4;0.2" dur="6s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1">
                <animate attributeName="stop-opacity" values="0.1;0.3;0.1" dur="5s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#meshGradient)" />
        </svg>
      </div>
    </div>
  );
};

// Bitcoin Price Ticker Animation
const BTCTicker = () => {
  const [price, setPrice] = useState(67890);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPrice(prev => prev + (Math.random() - 0.5) * 100);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-8 right-8 bg-gray-800/50 backdrop-blur-sm border border-orange-500/30 rounded-xl p-3 text-center">
      <div className="flex items-center gap-2 text-orange-400">
        <span className="text-lg font-bold">₿</span>
        <div>
          <div className="text-xs text-gray-400">BTC/USD</div>
          <div className="font-mono text-sm">${price.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
};

// AI Status Indicator
const AIStatusIndicator = () => {
  return (
    <div className="absolute top-8 left-8 bg-gray-800/50 backdrop-blur-sm border border-blue-500/30 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-sm text-blue-400">🤖 AI Online</span>
      </div>
    </div>
  );
};

// Logo creado con CSS
const AILogo = () => {
  return (
    <div className="relative group mb-8">
      <div className="flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-ping"></div>
        </div>
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
          <div className="w-24 h-24 rounded-full bg-gray-900 flex items-center justify-center relative overflow-hidden">
            <div className="text-white font-bold text-lg tracking-widest">
              COFI
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-50 group-hover:animate-ping"></div>
          </div>
          <div className="absolute inset-0">
            <div className="absolute top-2 left-1/2 w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
            <div className="absolute bottom-2 right-4 w-1.5 h-1.5 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute left-2 top-1/2 w-1 h-1 bg-cyan-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>
        </div>
        {/* AI Brain Icon Animation */}
        <div className="absolute -top-4 -right-8 text-2xl animate-bounce">🧠</div>
        <div className="absolute -top-2 -left-8 text-xl animate-pulse">⚡</div>
      </div>
      <div className="text-center mt-4">
        <div className="text-2xl font-light text-gray-300 tracking-[0.5em]">
          XYNTRA
        </div>
        <p className="text-xl text-zinc-300 mt-2 animate-pulse">Your Intelligent DeFi Copilot</p>
      </div>
    </div>
  );
};

// Animated Text Component
const AnimatedText = () => {
  const texts = [
    "Your Intelligent Financial Copilot",
    "Navigate DeFi with AI Precision",
    "Smart Trading, Smarter Returns",
    "The Future of Decentralized Finance",
  ];

  return (
    <div className="h-16 flex items-center justify-center relative">
      <h2 className="text-2xl md:text-3xl text-gray-300 font-light transition-all duration-500">
        {texts[0]}
      </h2>
      {/* AI Processing Dots */}
      <div className="absolute -right-4 top-2 flex space-x-1">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
};

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentText, setCurrentText] = useState(0);  const texts = [
    "Your Intelligent Financial Copilot",
    "Navigate DeFi with AI Precision", 
    "Smart Trading, Smarter Returns",
    "The Future of Decentralized Finance",
  ];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentText(prev => (prev + 1) % texts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [texts.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-800 text-white relative overflow-hidden">
      <AnimatedBackground />
      <BTCTicker />
      <AIStatusIndicator />
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-16">
          {/* Logo con animaciones AI */}
          <AILogo />

          {/* Main Headline con efecto typing */}
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                        <h1 className="text-6xl md:text-8xl font-light text-white tracking-wider leading-tight">
              COFI XYNTRA
            </h1>
            
            {/* Subtítulo animado */}
            <div className="h-16 flex items-center justify-center relative">
              <h2 className="text-2xl md:text-3xl text-gray-300 font-light transition-all duration-500">
                {texts[currentText]}
              </h2>
              {/* AI Processing Dots */}
              <div className="absolute -right-4 top-2 flex space-x-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
            
            <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed mt-6">
              Experience the future of decentralized finance with the power of artificial intelligence. 
              Manage tokens, verify balances, and interact with DeFi protocols intelligently and securely.
            </p>
          </div>

          {/* Connect Wallet Button CENTRADO con efectos mejorados */}
          <div className="mb-16 relative flex justify-center">
            {/* Glow effect background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-30 animate-pulse"></div>
            
            <div className="relative">
              {/* Animated Background Ring */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-xl blur-lg opacity-30 animate-pulse"></div>
              
              <div className="relative inline-block p-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <div className="bg-zinc-900 rounded-lg px-8 py-4">
                  <ConnectPlugButton
                    whitelist={["uxrrr-q7777-77774-qaaaq-cai"]}
                    ledgers={[
                      { canisterId: "mxzaz-hqaaa-aaaar-qaada-cai", label: "CFXN" },
                    ]}
                    host="http://127.0.0.1:4943"
                    className="transform hover:scale-105 transition-all duration-300"
                  />
                </div>
              </div>
              
              {/* Floating Particles Around Button */}
              <div className="absolute -top-2 -left-2 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
              <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-60" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 -left-4 w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="absolute top-1/2 -right-4 w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              
              {/* Bitcoin symbols around button */}
              <div className="absolute -top-6 left-1/4 text-orange-400/60 text-sm animate-bounce">₿</div>
              <div className="absolute -bottom-6 right-1/4 text-orange-400/60 text-sm animate-bounce" style={{ animationDelay: '1s' }}>₿</div>
            </div>
            
            <p className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-sm text-zinc-400 animate-pulse whitespace-nowrap">
              🚀 Connect your wallet to start your DeFi journey
            </p>
            
            {/* Data Flow Animation */}
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Features Grid con animaciones hover mejoradas */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="group bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 hover:border-blue-500/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
            <div className="text-3xl mb-4 group-hover:animate-bounce">🤖</div>
            <h3 className="text-xl font-semibold mb-3 group-hover:text-blue-400 transition-colors">Advanced AI</h3>
            <p className="text-zinc-300 group-hover:text-zinc-200 transition-colors">
              Assistant powered by Ollama and DeepSeek for intelligent DeFi operations.
            </p>
            <div className="mt-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-blue-400">AI Processing</span>
            </div>
          </div>

          <div className="group bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 hover:border-orange-500/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20">
            <div className="text-3xl mb-4 group-hover:animate-bounce">₿</div>
            <h3 className="text-xl font-semibold mb-3 group-hover:text-orange-400 transition-colors">Multi-Crypto</h3>
            <p className="text-zinc-300 group-hover:text-zinc-200 transition-colors">
              Support for Bitcoin, Ethereum, ICP and multiple tokens in one place.
            </p>
            <div className="mt-4 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-4 bg-orange-400 animate-pulse"></div>
              <div className="w-1 h-6 bg-orange-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-3 bg-orange-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <span className="text-xs text-orange-400 ml-2">Live Prices</span>
            </div>
          </div>

          <div className="group bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
            <div className="text-3xl mb-4 group-hover:animate-bounce">🔐</div>
            <h3 className="text-xl font-semibold mb-3 group-hover:text-green-400 transition-colors">Total Security</h3>
            <p className="text-zinc-300 group-hover:text-zinc-200 transition-colors">
              Built on Internet Computer with maximum security and decentralization.
            </p>
            <div className="mt-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-3 h-3 border-2 border-green-400 rounded-full animate-ping"></div>
              <span className="text-xs text-green-400">Protected</span>
            </div>
          </div>
        </div>

        {/* Botón para entrar a la app con animaciones mejoradas */}
        <div className="text-center relative">
          <div className="relative inline-block">
            {/* Animated Background Ring */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-xl blur-lg opacity-30 animate-pulse"></div>
            
            <button
              onClick={onEnterApp}
              className="relative bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 
                       text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-300 
                       transform hover:scale-105 shadow-lg hover:shadow-xl group"
            >
              <span className="relative z-10 flex items-center space-x-2">
                <span>Explore Application</span>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce group-hover:animate-ping"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce group-hover:animate-ping" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce group-hover:animate-ping" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </span>
            </button>
          </div>
          
          <p className="text-sm text-zinc-400 mt-4 animate-pulse">
            Ready to explore DeFi? Your AI copilot is waiting.
          </p>
          
          {/* AI Status Indicator */}
          <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-cyan-400">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            <span>🤖 AI Assistant Ready</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="flex justify-center items-center space-x-8 mb-4">
            <div className="flex items-center space-x-2 text-blue-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Internet Computer</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-400">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <span className="text-sm">AI Powered</span>
            </div>
            <div className="flex items-center space-x-2 text-orange-400">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <span className="text-sm">Multi-Crypto</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm">
            © 2025 COFI XYNTRA. The future of decentralized finance is here
          </p>
        </div>
      </div>

      {/* CSS para el nuevo fondo fluido */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { 
            transform: translateX(0) translateY(0) rotate(0deg); 
            opacity: 0.3; 
          }
          25% { 
            transform: translateX(-20px) translateY(-10px) rotate(5deg); 
            opacity: 0.4; 
          }
          50% { 
            transform: translateX(10px) translateY(20px) rotate(-3deg); 
            opacity: 0.2; 
          }
          75% { 
            transform: translateX(-10px) translateY(-15px) rotate(2deg); 
            opacity: 0.35; 
          }
        }

        @keyframes radialMove {
          0%, 100% { 
            transform: translateX(0) translateY(0) scale(1); 
            opacity: 0.2; 
          }
          33% { 
            transform: translateX(30px) translateY(-20px) scale(1.1); 
            opacity: 0.3; 
          }
          66% { 
            transform: translateX(-25px) translateY(30px) scale(0.9); 
            opacity: 0.15; 
          }
        }

        @keyframes floatGentle {
          0%, 100% { 
            transform: translateY(0) rotate(0deg); 
            opacity: 0.1; 
          }
          25% { 
            transform: translateY(-15px) rotate(2deg); 
            opacity: 0.15; 
          }
          50% { 
            transform: translateY(-25px) rotate(-1deg); 
            opacity: 0.12; 
          }
          75% { 
            transform: translateY(-10px) rotate(1deg); 
            opacity: 0.18; 
          }
        }

        @keyframes lightRay {
          0%, 100% { 
            opacity: 0.1; 
            transform: translateX(0) scaleY(1); 
          }
          50% { 
            opacity: 0.3; 
            transform: translateX(5px) scaleY(1.05); 
          }
        }

        @keyframes symbolFloat {
          0%, 100% { 
            transform: translateY(0) rotate(0deg); 
            opacity: 0.05; 
          }
          33% { 
            transform: translateY(-8px) rotate(5deg); 
            opacity: 0.1; 
          }
          66% { 
            transform: translateY(-12px) rotate(-3deg); 
            opacity: 0.08; 
          }
        }
      `}</style>
    </div>
  );
}