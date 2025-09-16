import React, { useEffect, useRef, useState } from 'react';
import { useApp, ChatMessage, generateId } from '../context/AppContext';
import Sidebar from './sidebar';
import WalletPanel from './walletPanel';
import { 
  backend,
  idlFactory as backend_idlFactory,
  canisterId as backend_canisterId,
} from '../../../src/declarations/backend';

// Icons
const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const BotIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ThinkingDots = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
  </div>
);

export default function ChatArea() {
  const { state, dispatch } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileWallet, setShowMobileWallet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChat = state.chats.find(chat => chat.id === state.currentChatId);

  // Convert ChatMessage to backend format
  const convertToBackendMessage = (message: ChatMessage) => {
    return message.sender === 'user' 
      ? { user: { content: message.content } }
      : { system: { content: message.content } };
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const askAgent = async (messages: ChatMessage[]) => {
    try {
      // Convert to backend format
      const backendMessages = messages.map(convertToBackendMessage);
      
      const response = await backend.copilot_chat(backendMessages);
      
      if (currentChat) {
        // Remove thinking message first
        dispatch({ type: 'REMOVE_THINKING_MESSAGE', payload: { chatId: currentChat.id } });
        
        // Then add response
        const assistantMessage: ChatMessage = {
          id: generateId(),
          chatId: currentChat.id,
          content: response,
          sender: 'assistant',
          timestamp: new Date()
        };

        dispatch({ type: 'ADD_MESSAGE', payload: { chatId: currentChat.id, message: assistantMessage } });
      }
    } catch (e) {
      console.error('Chat error:', e);
      const errorMessage = String(e);
      const match = errorMessage.match(/(SysTransient|CanisterReject), \\+"([^\\"]+)/);
      const errorContent = match ? match[2] : 'Sorry, there was an error processing your request.';
      
      if (currentChat) {
        // Remove thinking message first
        dispatch({ type: 'REMOVE_THINKING_MESSAGE', payload: { chatId: currentChat.id } });
        
        // Then add error message
        const errorMsg: ChatMessage = {
          id: generateId(),
          chatId: currentChat.id,
          content: errorContent,
          sender: 'assistant',
          timestamp: new Date(),
          metadata: { error: errorContent }
        };

        dispatch({ type: 'ADD_MESSAGE', payload: { chatId: currentChat.id, message: errorMsg } });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !currentChat) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      chatId: currentChat.id,
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    const thinkingMessage: ChatMessage = {
      id: generateId(),
      chatId: currentChat.id,
      content: 'Thinking...',
      sender: 'assistant',
      timestamp: new Date(),
      metadata: { isThinking: true }
    };

    // Add user message and thinking indicator
    dispatch({ type: 'ADD_MESSAGE', payload: { chatId: currentChat.id, message: userMessage } });
    dispatch({ type: 'ADD_MESSAGE', payload: { chatId: currentChat.id, message: thinkingMessage } });

    setInputValue('');
    setIsLoading(true);

    // Get all messages except the thinking one for backend
    const messagesToSend = [...currentChat.messages, userMessage];
    await askAgent(messagesToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!currentChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-slate-800">
        <div className="text-center p-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <BotIcon />
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-4">
            Welcome to CoFi Xyntra
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            Your intelligent financial copilot on the Internet Computer
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-gray-800 p-4 rounded-xl border border-blue-200 dark:border-gray-700">
            Start a new chat to begin your conversation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-slate-800 relative h-full overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileSidebar(false)} />
          <div className="relative w-80 h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Mobile Wallet Overlay */}
      {showMobileWallet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileWallet(false)} />
          <div className="absolute right-0 w-80 h-full">
            <WalletPanel />
          </div>
        </div>
      )}

      {/* Header - STATIC */}
      <div className="border-b border-gradient-to-r from-blue-200 to-purple-200 dark:from-gray-700 dark:to-slate-700 p-6 bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-slate-800 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden p-2 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
            >
              <MenuIcon />
            </button>
            
            <div>
              <h2 className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                {currentChat?.title || 'CoFi Xyntra'}
              </h2>
              {currentChat && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {currentChat.messages.length} messages • Updated {formatTimestamp(currentChat.updatedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Mobile Wallet Button */}
          <button
            onClick={() => setShowMobileWallet(true)}
            className="lg:hidden p-2 hover:bg-purple-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
          >
            <WalletIcon />
          </button>
        </div>
      </div>

      {/* Messages - SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-100 dark:scrollbar-track-slate-800 scrollbar-thumb-blue-500 dark:scrollbar-thumb-indigo-600">
        <div className="max-w-4xl mx-auto p-6">
          {currentChat.messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <BotIcon />
              </div>
              <h3 className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-4">
                How can I help you today?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                I can help you check balances, send tokens, and manage your finances on the Internet Computer.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {currentChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`group flex gap-4 ${
                    message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                  }`}>
                    {message.sender === 'user' ? <UserIcon /> : <BotIcon />}
                  </div>

                  {/* Message */}
                  <div className={`flex-1 max-w-3xl ${
                    message.sender === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    <div className={`inline-block p-4 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                        : 'bg-gradient-to-r from-white to-gray-50 dark:from-slate-800 dark:to-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    }`}>
                      {message.metadata?.isThinking ? (
                        <div className="flex items-center gap-3">
                          <ThinkingDots />
                          <span className="text-gray-600 dark:text-gray-300">Thinking...</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                      )}
                    </div>

                    {/* Message actions */}
                    {!message.metadata?.isThinking && (
                      <div className={`flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 ${
                        message.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        <span>{formatTimestamp(message.timestamp)}</span>
                        {message.sender === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-200"
                            title="Copy message"
                          >
                            <CopyIcon />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - STATIC */}
      <div className="border-t border-gradient-to-r from-blue-200 to-purple-200 dark:from-gray-700 dark:to-slate-700 p-6 bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-slate-800 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-slate-800 dark:to-gray-800 rounded-2xl border border-blue-200 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200 shadow-sm">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message CoFi Xyntra..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none min-h-[24px] max-h-32"
                style={{ height: 'auto' }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <SendIcon />
              </button>
            </div>
            
            {/* Character counter for long messages */}
            {inputValue.length > 100 && (
              <div className="text-xs text-gray-500 mt-2 text-right">
                {inputValue.length} characters
              </div>
            )}
          </form>

          {/* Quick actions */}
          <div className="flex gap-3 mt-4 text-sm">
            <button
              onClick={() => setInputValue('Check my ICP balance')}
              className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 hover:from-emerald-200 hover:to-green-200 dark:hover:from-emerald-800/50 dark:hover:to-green-800/50 rounded-xl text-emerald-700 dark:text-emerald-300 transition-all duration-200 border border-emerald-200 dark:border-emerald-700"
            >
              💰 Check balance
            </button>
            <button
              onClick={() => setInputValue('Help me send tokens')}
              className="px-4 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 hover:from-purple-200 hover:to-indigo-200 dark:hover:from-purple-800/50 dark:hover:to-indigo-800/50 rounded-xl text-purple-700 dark:text-purple-300 transition-all duration-200 border border-purple-200 dark:border-purple-700"
            >
              📤 Send tokens
            </button>
            <button
              onClick={() => setInputValue('Show recent transactions')}
              className="px-4 py-2 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 hover:from-orange-200 hover:to-amber-200 dark:hover:from-orange-800/50 dark:hover:to-amber-800/50 rounded-xl text-orange-700 dark:text-orange-300 transition-all duration-200 border border-orange-200 dark:border-orange-700"
            >
              📊 Recent transactions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}