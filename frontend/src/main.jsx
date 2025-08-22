import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { backend } from '../../src/declarations/backend';
import ChatWindow from './components/chatWindow';
import LandingPage from './components/landingPage';
import '/index.css';
import { client } from "./../config/client";
import { useProfiles, useActiveAccount, ConnectButton, ThirdwebProvider } from "thirdweb/react";
import { ConnectPlugButton } from "./components/connectButton";

export  function WalletConnectComponent() {
  const account = useActiveAccount(); // thirdweb hook

  useEffect(() => {
    if (account) {
    
      const address = account.address;
      console.log("Wallet connected:", address);

      backend.create_account(address) // panggil canister
        .then(() => console.log("Account registered"))
        .catch(err => console.error("Failed to register:", err));
    }
  }, [account]);

  return <ConnectButton client={client} />;
}
 function App() {
  const [showLanding, setShowLanding] = useState(true);

  const handleEnterApp = () => {
    setShowLanding(false);
  };

  if (showLanding) {
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  return (
    <div className="flex h-screen dark bg-zinc-900 text-white">
      <ChatWindow />
      <div className="w-64 bg-zinc-800 p-4 flex flex-col">
        <ConnectPlugButton
           whitelist={["uxrrr-q7777-77774-qaaaq-cai"]}
          ledgers={[
            { canisterId: "mxzaz-hqaaa-aaaar-qaada-cai", label: "CFXN" }, // ledger ICRC-1 lokal kamu
          ]}
          host="http://127.0.0.1:4943"
          
        />
      </div>
    </div>
  )
}
// const App = () => {
//   const [chat, setChat] = useState([
//     {
//       system: { content: "I'm a sovereign AI agent living on the Internet Computer. Ask me anything." }
//     }
//   ]);
//   const [inputValue, setInputValue] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const chatBoxRef = useRef(null);

//   const formatDate = (date) => {
//     const h = '0' + date.getHours();
//     const m = '0' + date.getMinutes();
//     return `${h.slice(-2)}:${m.slice(-2)}`;
//   };

//   const askAgent = async (messages) => {
//     try {
//       const response = await backend.chat(messages);
//       setChat((prevChat) => {
//         const newChat = [...prevChat];
//         newChat.pop();
//         newChat.push({ system: { content: response } });
//         return newChat;
//       });
//     } catch (e) {
//       console.log(e);
//       const eStr = String(e);
//       const match = eStr.match(/(SysTransient|CanisterReject), \\+"([^\\"]+)/);
//       if (match) {
//         alert(match[2]);
//       }
//       setChat((prevChat) => {
//         const newChat = [...prevChat];
//         newChat.pop();
//         return newChat;
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (!inputValue.trim() || isLoading) return;

//     const userMessage = {
//       user: { content: inputValue }
//     };
//     const thinkingMessage = {
//       system: { content: 'Thinking ...' }
//     };
//     setChat((prevChat) => [...prevChat, userMessage, thinkingMessage]);
//     setInputValue('');
//     setIsLoading(true);

//     const messagesToSend = chat.slice(1).concat(userMessage);
//     askAgent(messagesToSend);
//   };

//   useEffect(() => {
//     if (chatBoxRef.current) {
//       chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
//     }
//   }, [chat]);

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
//       <ConnectButton client={client} />;
//       <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-lg">
//         <div className="flex-1 overflow-y-auto rounded-t-lg bg-gray-100 p-4" ref={chatBoxRef}>
//           {chat.map((message, index) => {
//             const isUser = 'user' in message;
//             const img = isUser ? userImg : botImg;
//             const name = isUser ? 'User' : 'System';
//             const text = isUser ? message.user.content : message.system.content;

//             return (
//               <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
//                 {!isUser && (
//                   <div
//                     className="mr-2 h-10 w-10 rounded-full"
//                     style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover' }}
//                   ></div>
//                 )}
//                 <div className={`max-w-[70%] rounded-lg p-3 ${isUser ? 'bg-blue-500 text-white' : 'bg-white shadow'}`}>
//                   <div
//                     className={`mb-1 flex items-center justify-between text-sm ${isUser ? 'text-white' : 'text-gray-500'}`}
//                   >
//                     <div>{name}</div>
//                     <div className="mx-2">{formatDate(new Date())}</div>
//                   </div>
//                   <div>{text}</div>
//                 </div>
//                 {isUser && (
//                   <div
//                     className="ml-2 h-10 w-10 rounded-full"
//                     style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover' }}
//                   ></div>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//         <form className="flex rounded-b-lg border-t bg-white p-4" onSubmit={handleSubmit}>
//           <input
//             type="text"
//             className="flex-1 rounded-l border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Ask anything ..."
//             value={inputValue}
//             onChange={(e) => setInputValue(e.target.value)}
//             disabled={isLoading}
//           />
//           <button
//             type="submit"
//             className="rounded-r bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:bg-blue-300"
//             disabled={isLoading}
//           >
//             Send
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// };

// import React from "react";
// import { createThirdwebClient } from "thirdweb";
// import { inAppWallet } from "thirdweb/wallets";
// import { ConnectEmbed } from "thirdweb/react";
// import { ThirdwebProvider } from "thirdweb/react";
// 1. Buat client thirdweb


// 2. Konfigurasi dompet
// 3. Komponen utama
// function App() {
//   return (
//     <div style={{ maxWidth: 400, margin: "auto", paddingTop: "100px" }}>
//       <ConnectButton client={client} />;
//     </div>
//   );
// }

// export default App;

export default App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThirdwebProvider client={client}>
      <App />
    </ThirdwebProvider>
  </React.StrictMode>
);
