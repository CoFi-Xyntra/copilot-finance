import React, { useState, useMemo } from 'react';
import { useApp, createNewChat } from '../context/AppContext';

// Icons (you can replace with your preferred icon library)
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter chats based on search
  const filteredChats = useMemo(() => {
    return state.chats
      .filter(chat => 
        chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.messages.some(msg => 
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [state.chats, searchTerm]);

  const handleNewChat = () => {
    const newChat = createNewChat();
    dispatch({ type: 'ADD_CHAT', payload: newChat });
  };

  const handleSelectChat = (chatId: string) => {
    dispatch({ type: 'SET_CURRENT_CHAT', payload: chatId });
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      dispatch({ type: 'DELETE_CHAT', payload: chatId });
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessage = (chat: any) => {
    if (chat.messages.length === 0) return 'No messages';
    const lastMsg = chat.messages[chat.messages.length - 1];
    return lastMsg.content.length > 50 
      ? lastMsg.content.substring(0, 50) + '...'
      : lastMsg.content;
  };

  if (state.sidebarCollapsed) {
    return (
      <div className="w-16 bg-gradient-to-b from-slate-900 to-gray-900 border-r border-indigo-500/20 flex flex-col items-center py-4 space-y-4">
        <button
          onClick={handleNewChat}
          className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          title="New Chat"
        >
          <PlusIcon />
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-indigo-500/25"
          title="Expand Sidebar"
        >
          <ChatIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gradient-to-b from-slate-900 via-gray-900 to-slate-900 border-r border-indigo-500/20 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-indigo-500/20 bg-gradient-to-r from-slate-800/50 to-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text">CoFi Xyntra</h2>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1 hover:bg-indigo-600/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-200 text-white font-medium shadow-lg hover:shadow-blue-500/25"
        >
          <PlusIcon />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-indigo-500/20">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-indigo-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-400">
            <SearchIcon />
          </div>
        </div>
      </div>

      {/* Chat Header */}
      <div className="flex border-b border-indigo-500/20">
        <div className="flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium text-blue-400 border-b-2 border-blue-400 bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
          <ChatIcon />
          Chats ({state.chats.length})
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-indigo-600">
        <div className="space-y-1 p-2">
          {filteredChats.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchTerm ? 'No chats found' : 'No chats yet'}
              <div className="text-sm mt-2 text-indigo-400">
                {!searchTerm && 'Start a new conversation!'}
              </div>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  state.currentChatId === chat.id
                    ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 shadow-lg'
                    : 'hover:bg-slate-800/50 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium truncate text-sm">
                        {chat.title}
                      </h3>
                      <span className="text-xs text-indigo-400 ml-2">
                        {formatDate(chat.updatedAt)}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1 truncate">
                      {getLastMessage(chat)}
                    </p>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <span>{chat.messages.length} messages</span>
                    </div>
                  </div>
                </div>
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-600/20 rounded-lg transition-all duration-200"
                  title="Delete chat"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
