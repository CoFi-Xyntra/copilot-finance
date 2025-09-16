import React from 'react';
import { AppProvider } from '../context/AppContext';
import Sidebar from './sidebar';
import ChatArea from './chatArea';
import WalletPanel from './walletPanel';

export default function MainLayout() {
  return (
    <AppProvider>
      <div className="h-screen flex bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-800 overflow-hidden">
        {/* Left Sidebar - Hidden on mobile, collapsible on tablet */}
        <div className="hidden md:flex h-full overflow-hidden">
          <Sidebar />
        </div>
        
        {/* Center - Chat Area */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <ChatArea />
        </div>
        
        {/* Right Panel - Hidden on mobile, adaptive width on larger screens */}
        <div className="hidden lg:flex h-full overflow-hidden">
          <WalletPanel />
        </div>
      </div>
    </AppProvider>
  );
}