import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ConnectPlugButton } from './connectButton';
import { usePlug } from '../helper/usePlug';

// Icons
const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const ReceiveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export default function WalletPanel() {
  const { state, dispatch } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realTransactions, setRealTransactions] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  
  // Estados para el modal de contactos
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    address: '',
    notes: ''
  });
  
  // Use real Plug wallet hook
  const { 
    connected: isConnected, 
    principal, 
    disconnect,
    fetchAssets,
    available 
  } = usePlug({
    ledgers: [
      { canisterId: "mxzaz-hqaaa-aaaar-qaada-cai", label: "CFXN" },
      { canisterId: "rrkah-fqaaa-aaaaa-aaaaq-cai", label: "ICP" }
    ],
    host: "http://127.0.0.1:4943"
  });

  // Calculate balances from assets
  const icpBalance = assets.find((a: any) => a.label === 'ICP');
  const cfxBalance = assets.find((a: any) => a.label === 'CFXN');
  
  const getDisplayBalance = (asset: any, decimals: number = 8) => {
    if (!asset || !asset.raw) return 0;
    return parseFloat(asset.raw) / Math.pow(10, decimals);
  };

  // Fetch real balance when connected
  useEffect(() => {
    if (isConnected && available) {
      loadAssets();
    }
  }, [isConnected, available]);

  const loadAssets = async () => {
    try {
      const assetsList = await fetchAssets();
      setAssets(assetsList);
      console.log('Real assets loaded:', assetsList);
    } catch (error) {
      console.error('Error loading assets:', error);
    }
  };

  // Update wallet state in global context
  useEffect(() => {
    const icpAsset = assets.find(a => a.label === 'ICP');
    const cfxAsset = assets.find(a => a.label === 'CFXN');
    
    dispatch({
      type: 'SET_WALLET_STATE',
      payload: {
        isConnected,
        principal: principal || '',
        balance: {
          icp: icpAsset ? parseFloat(icpAsset.raw) / Math.pow(10, 8) : 0, // ICP has 8 decimals
          cfx: cfxAsset ? parseFloat(cfxAsset.raw) : 0 // CFXN has 0 decimals
        },
        recentTransactions: realTransactions
      }
    });
  }, [isConnected, principal, assets, realTransactions, dispatch]);

  // Load real transactions (mock for now - would come from IC)
  useEffect(() => {
    if (isConnected) {
      // In a real app, you would fetch these from the blockchain
      setRealTransactions([
        {
          id: Date.now().toString(),
          type: 'received',
          amount: '1.0 ICP',
          from: 'Recent connection',
          timestamp: new Date(),
          status: 'completed'
        }
      ]);
    } else {
      setRealTransactions([]);
    }
  }, [isConnected]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAssets();
    } catch (error) {
      console.error('Error refreshing assets:', error);
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Funciones para manejar contactos
  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.address.trim()) {
      alert('Please fill in both name and address fields');
      return;
    }
    
    const contact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      address: newContact.address.trim(),
      notes: newContact.notes.trim(),
      addedDate: new Date(),
      lastContact: undefined
    };
    
    dispatch({ type: 'ADD_CONTACT', payload: contact });
    setNewContact({ name: '', address: '', notes: '' });
    setShowAddContactModal(false);
  };

  const handleCancelAddContact = () => {
    setNewContact({ name: '', address: '', notes: '' });
    setShowAddContactModal(false);
  };



  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  if (state.rightPanelCollapsed) {
    return (
      <div className="w-12 sm:w-16 bg-gray-900 border-l border-gray-700 flex flex-col items-center py-2 sm:py-4 space-y-2 sm:space-y-4">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
          className="p-2 sm:p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="Expand Wallet Panel"
        >
          <WalletIcon />
        </button>
        <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
    );
  }

  return (
    <div className="w-64 sm:w-72 lg:w-80 xl:w-96 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
            <WalletIcon />
            <span className="hidden sm:inline">Wallet</span>
          </h2>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <ChevronRightIcon />
          </button>
        </div>

        {/* Connection Status */}

      </div>

      {/* Wallet Actions */}
      <div className="p-4 border-b border-gray-700">
        {!isConnected ? (
          <div className="w-full">
            <ConnectPlugButton
              ledgers={[
                { canisterId: "mxzaz-hqaaa-aaaar-qaada-cai", label: "CFXN" },
              ]}
              host="http://127.0.0.1:4943"
              className="w-full"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <ConnectPlugButton
                  ledgers={[
                    { canisterId: "mxzaz-hqaaa-aaaar-qaada-cai", label: "CFXN" },
                  ]}
                  host="http://127.0.0.1:4943"
                  className="w-full"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh Balance"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Contacts</h3>
          <button
            onClick={() => setShowAddContactModal(true)}
            className="text-blue-400 hover:text-blue-300 p-1"
            title="Add Contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        {state.contacts.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-sm">
            No contacts yet
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{contact.name}</div>
                  <div className="text-gray-400 text-xs font-mono truncate">{formatAddress(contact.address)}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(contact.address);
                    }}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Copy Address"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_CONTACT', payload: contact.id })}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete Contact"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Contact Modal */}
        {showAddContactModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Add New Contact</h3>
                <button
                  onClick={handleCancelAddContact}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Name *</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter contact name"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Address *</label>
                  <input
                    type="text"
                    value={newContact.address}
                    onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Enter wallet address"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Notes</label>
                  <textarea
                    value={newContact.notes}
                    onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Optional notes"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelAddContact}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContact}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {isConnected && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-white font-medium mb-3">Recent Transactions</h3>
            
            {realTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-sm">No transactions yet</div>
                <div className="text-xs mt-1">Your transaction history will appear here</div>
              </div>
            ) : (
              <div className="space-y-2">
                {realTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {tx.status === 'completed' ? <CheckIcon /> : <XIcon />}
                        <span className={`text-sm font-medium ${
                          tx.type === 'sent' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {tx.type === 'sent' ? 'Sent' : 'Received'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-mono ${
                          tx.type === 'sent' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {tx.type === 'sent' ? '-' : '+'}{tx.amount}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>{tx.type === 'sent' ? 'To:' : 'From:'}</span>
                        <span className="font-mono">
                          {formatAddress(tx.to || tx.from)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{formatTimestamp(tx.timestamp)}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 hover:text-blue-400 transition-all"
                          title="View on explorer"
                        >
                          <ExternalLinkIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          <div>Internet Computer Network</div>
          <div className="mt-1">CoFi Xyntra v1.0.0</div>
        </div>
      </div>
    </div>
  );
}