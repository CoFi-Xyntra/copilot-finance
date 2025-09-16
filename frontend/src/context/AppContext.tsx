import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Types
export interface Contact {
  id: string;
  name: string;
  address: string;
  addedDate: Date;
  lastContact?: Date;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    isThinking?: boolean;
    error?: string;
  };
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  contactId?: string;
}

export interface WalletState {
  isConnected: boolean;
  principal?: string;
  balance?: {
    icp: number;
    cfx: number;
  };
  recentTransactions: any[];
}

export interface AppState {
  // Chat state
  chats: Chat[];
  currentChatId: string | null;
  isLoading: boolean;
  
  // Contacts
  contacts: Contact[];
  
  // Wallet
  wallet: WalletState;
  
  // UI state
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

// Actions
type AppAction = 
  | { type: 'SET_CURRENT_CHAT'; payload: string | null }
  | { type: 'ADD_CHAT'; payload: Chat }
  | { type: 'UPDATE_CHAT'; payload: { id: string; chat: Partial<Chat> } }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { chatId: string; message: ChatMessage } }
  | { type: 'REMOVE_THINKING_MESSAGE'; payload: { chatId: string } }
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'UPDATE_CONTACT'; payload: { id: string; contact: Partial<Contact> } }
  | { type: 'DELETE_CONTACT'; payload: string }
  | { type: 'SET_WALLET_STATE'; payload: Partial<WalletState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<AppState> };

const initialState: AppState = {
  chats: [],
  currentChatId: null,
  isLoading: false,
  contacts: [],
  wallet: {
    isConnected: false,
    recentTransactions: []
  },
  theme: 'dark',
  sidebarCollapsed: false,
  rightPanelCollapsed: false
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_CHAT':
      return { ...state, currentChatId: action.payload };
    
    case 'ADD_CHAT':
      return { 
        ...state, 
        chats: [...state.chats, action.payload],
        currentChatId: action.payload.id
      };
    
    case 'UPDATE_CHAT':
      return {
        ...state,
        chats: state.chats.map(chat => 
          chat.id === action.payload.id 
            ? { ...chat, ...action.payload.chat, updatedAt: new Date() }
            : chat
        )
      };
    
    case 'DELETE_CHAT':
      return {
        ...state,
        chats: state.chats.filter(chat => chat.id !== action.payload),
        currentChatId: state.currentChatId === action.payload ? null : state.currentChatId
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        chats: state.chats.map(chat =>
          chat.id === action.payload.chatId
            ? { 
                ...chat, 
                messages: [...chat.messages, action.payload.message],
                updatedAt: new Date()
              }
            : chat
        )
      };
    
    case 'REMOVE_THINKING_MESSAGE':
      return {
        ...state,
        chats: state.chats.map(chat =>
          chat.id === action.payload.chatId
            ? { 
                ...chat, 
                messages: chat.messages.filter(msg => !msg.metadata?.isThinking),
                updatedAt: new Date()
              }
            : chat
        )
      };
    
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };
    
    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map(contact =>
          contact.id === action.payload.id
            ? { ...contact, ...action.payload.contact }
            : contact
        )
      };
    
    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter(contact => contact.id !== action.payload)
      };
    
    case 'SET_WALLET_STATE':
      return { ...state, wallet: { ...state.wallet, ...action.payload } };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    
    case 'TOGGLE_RIGHT_PANEL':
      return { ...state, rightPanelCollapsed: !state.rightPanelCollapsed };
    
    case 'LOAD_FROM_STORAGE':
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        console.log('Loading data from localStorage...');
        const storedChats = localStorage.getItem('cofi-chats');
        const storedContacts = localStorage.getItem('cofi-contacts');
        const storedTheme = localStorage.getItem('cofi-theme');
        const storedCurrentChat = localStorage.getItem('cofi-current-chat');
        const storedWallet = localStorage.getItem('cofi-wallet');

        console.log('Raw localStorage data:', {
          chats: storedChats ? JSON.parse(storedChats).length : 0,
          contacts: storedContacts ? JSON.parse(storedContacts).length : 0,
          theme: storedTheme,
          currentChat: storedCurrentChat,
          wallet: storedWallet ? 'exists' : 'none'
        });

        const loadData: Partial<AppState> = {};

        if (storedChats) {
          const chats = JSON.parse(storedChats);
          // Parse dates
          loadData.chats = chats.map((chat: any) => ({
            ...chat,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          console.log('Loaded chats:', loadData.chats?.length || 0);
        }

        if (storedContacts) {
          const contacts = JSON.parse(storedContacts);
          loadData.contacts = contacts.map((contact: any) => ({
            ...contact,
            addedDate: new Date(contact.addedDate),
            lastContact: contact.lastContact ? new Date(contact.lastContact) : undefined
          }));
          console.log('Loaded contacts:', loadData.contacts?.length || 0);
        }

        if (storedTheme) {
          loadData.theme = storedTheme as 'light' | 'dark';
          console.log('Loaded theme:', loadData.theme);
        }

        if (storedCurrentChat) {
          loadData.currentChatId = storedCurrentChat;
          console.log('Loaded current chat:', loadData.currentChatId);
        }

        if (storedWallet) {
          const walletData = JSON.parse(storedWallet);
          loadData.wallet = {
            ...walletData,
            recentTransactions: walletData.recentTransactions || []
          };
          console.log('Loaded wallet data:', loadData.wallet);
        }

        dispatch({ type: 'LOAD_FROM_STORAGE', payload: loadData });
        
        // Auto-create initial chat if no chats exist
        if ((loadData.chats || []).length === 0) {
          console.log('No chats found, creating initial chat');
          const initialChat = createNewChat('Welcome to CoFi Xyntra');
          dispatch({ type: 'ADD_CHAT', payload: initialChat });
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    };

    loadFromStorage();
  }, []);

  // Save to localStorage on state changes
  useEffect(() => {
    try {
      console.log('Saving chats to localStorage:', state.chats.length, 'chats');
      localStorage.setItem('cofi-chats', JSON.stringify(state.chats));
    } catch (error) {
      console.error('Error saving chats to localStorage:', error);
    }
  }, [state.chats]);

  useEffect(() => {
    try {
      console.log('Saving contacts to localStorage:', state.contacts.length, 'contacts');
      localStorage.setItem('cofi-contacts', JSON.stringify(state.contacts));
    } catch (error) {
      console.error('Error saving contacts to localStorage:', error);
    }
  }, [state.contacts]);

  useEffect(() => {
    try {
      console.log('Saving theme to localStorage:', state.theme);
      localStorage.setItem('cofi-theme', state.theme);
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [state.theme]);

  useEffect(() => {
    try {
      console.log('Saving wallet to localStorage:', state.wallet);
      localStorage.setItem('cofi-wallet', JSON.stringify(state.wallet));
    } catch (error) {
      console.error('Error saving wallet to localStorage:', error);
    }
  }, [state.wallet]);

  useEffect(() => {
    try {
      if (state.currentChatId) {
        console.log('Saving current chat to localStorage:', state.currentChatId);
        localStorage.setItem('cofi-current-chat', state.currentChatId);
      } else {
        console.log('Removing current chat from localStorage');
        localStorage.removeItem('cofi-current-chat');
      }
    } catch (error) {
      console.error('Error saving current chat to localStorage:', error);
    }
  }, [state.currentChatId]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Helper functions
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function createNewChat(title?: string): Chat {
  const id = generateId();
  return {
    id,
    title: title || `Chat ${new Date().toLocaleDateString()}`,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function createNewContact(name: string, address: string): Contact {
  return {
    id: generateId(),
    name,
    address,
    addedDate: new Date()
  };
}