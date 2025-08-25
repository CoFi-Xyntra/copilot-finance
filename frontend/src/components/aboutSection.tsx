import React from 'react';

export const AboutSection: React.FC = () => {
  const teamMembers = [
    {
      id: 'product-manager',
      name: 'Christian Jauhari',
      role: 'Product Manager',
      bio: 'Strategic product leader with expertise in fintech and DeFi. Drives product vision and roadmap development, ensuring user-centric design and market fit.',
      image: '/api/placeholder/200/200', // Placeholder - replace with actual images
      linkedin: 'https://www.linkedin.com/in/christian-jauhari-1b723122a/',
      github: 'https://github.com/blackhespy',
      specialties: ['Product Strategy', 'Market Research', 'User Experience']
    },
    {
      id: 'full-stack-dev',
      name: 'Rozaq Abdul',
      role: 'Full-Stack Developer',
      bio: 'Experienced full-stack developer specializing in modern web technologies and blockchain integration. Expert in building scalable applications with React, Node.js, and Web3.',
      image: '/api/placeholder/200/200',
      linkedin: 'https://www.linkedin.com/in/abdul-rozaq/',
      github: 'https://github.com/rozaqabdul656',
      specialties: ['React/TypeScript', 'Node.js', 'Web3 Integration']
    },
    {
      id: 'tech-writer-qa',
      name: 'Gerald Eberhard',
      role: 'Tech Writer and QA',
      bio: 'Technical documentation specialist and quality assurance expert. Ensures code quality, comprehensive testing, and clear documentation for optimal user experience.',
      image: '/api/placeholder/200/200',
      linkedin: 'https://www.linkedin.com/in/gerald-eberhard-660910299/',
      github: 'https://github.com/Hi-Gerald',
      specialties: ['Technical Writing', 'Quality Assurance', 'Documentation']
    },
    {
      id: 'blockchain-dev',
      name: 'Yamil Navia',
      role: 'Blockchain Developer',
      bio: 'Blockchain architect with deep expertise in smart contract development and DeFi protocols. Specializes in Internet Computer and cross-chain solutions.',
      image: '/api/placeholder/200/200',
      linkedin: 'https://www.linkedin.com/in/srllamadev/',
      Github: 'https://github.com/srllamadev',
      specialties: ['Smart Contracts', 'Internet Computer', 'DeFi Protocols']
    },
    {
      id: 'frontend-dev',
      name: 'Omar Quispe',
      role: 'Frontend Developer',
      bio: 'Frontend specialist focused on creating intuitive and responsive user interfaces. Expert in modern frontend technologies and user experience optimization.',
      image: '/api/placeholder/200/200',
      linkedin: 'https://www.linkedin.com/in/omar-quispe-vargas-7b5601204',
      Github: 'https://github.com/OmarQV',
      specialties: ['Frontend Development', 'UI/UX Design', 'Responsive Design']
    }
  ];

  const companyStats = [
    { label: 'Years of Experience', value: '50+', icon: '📈' },
    { label: 'DeFi Protocols Integrated', value: '25+', icon: '🔗' },
    { label: 'Total Value Locked', value: '$10M+', icon: '💰' },
    { label: 'Active Users', value: '5K+', icon: '👥' }
  ];

  return (
    <section id="about" className="py-20 bg-gradient-to-br from-gray-800 via-gray-900 to-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">COFI XYNTRA</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            We're a team of passionate innovators building the future of decentralized finance. 
            Our mission is to democratize access to sophisticated financial tools through AI-powered solutions.
          </p>
        </div>

        {/* Company Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {companyStats.map((stat, index) => (
            <div
              key={index}
              className="text-center bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-cyan-500/50 transition-all duration-300"
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl md:text-3xl font-bold text-cyan-400 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mission Statement */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-8 mb-20 border border-blue-500/20">
          <div className="text-center">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Our Mission</h3>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
              To bridge the gap between traditional finance and DeFi by providing intelligent, 
              user-friendly tools that empower everyone to participate in the decentralized economy. 
              We believe in a future where financial opportunities are accessible to all.
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-16">
          <h3 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Meet Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Team</span>
          </h3>
          <p className="text-gray-300 text-center mb-12 max-w-2xl mx-auto">
            A diverse group of experts from finance, technology, and design working together to revolutionize DeFi
          </p>

          {/* Team Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, index) => (
              <div
                key={member.id}
                className="group bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Profile Image */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1">
                    <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-400 w-6 h-6 rounded-full border-2 border-gray-800 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>

                {/* Member Info */}
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
                    {member.name}
                  </h4>
                  <p className="text-purple-400 font-medium text-sm mb-3">{member.role}</p>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    {member.bio}
                  </p>
                </div>

                {/* Specialties */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {member.specialties.map((specialty, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex justify-center gap-4">
                  <a
                    href={member.linkedin}
                    className="w-10 h-10 bg-blue-600/20 hover:bg-blue-600/40 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <a
                    href={member.github}
                    className="w-10 h-10 bg-sky-600/20 hover:bg-sky-600/40 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.418 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.368-1.34-3.368-1.34-.454-1.158-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.529 2.341 1.085 2.91.821.092-.63.359-1.085.654-1.336-2.22-.253-4.555-1.11-4.555-4.942 0-1.093.39-1.988 1.029-2.681-.103-.253-.446-1.278.098-2.651 0 0 .84-.268 2.75 1.022A9.613 9.613 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.29 2.747-1.022 2.747-1.022.546 1.373.202 2.398.1 2.651.64.693 1.029 1.587 1.029 2.681 0 3.841-2.339 4.681-4.566 4.935.359.309.678.92.678 1.855 0 1.336-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-xl"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Join Us CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-2xl font-bold text-white mb-4">Join Our Mission</h3>
            <a href="https://youtu.be/1H9N9YJLtoM" target="_blank" rel="noopener noreferrer">
              <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
                CoFi Xyntra
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
