import { useEffect, useRef, useState } from 'react';
import { backend } from '../../../src/declarations/backend';

// Definir tipos para los mensajes
type SystemMessage = { system: { content: string } };
type UserMessage = { user: { content: string } };
type ChatMessage = SystemMessage | UserMessage;

export default function ChatWindow() {

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      system: { content: "I'm a Copilot Finance agent living on the Internet Computer. Ask me anything." }
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date) => {
    const h = '0' + date.getHours();
    const m = '0' + date.getMinutes();
    return `${h.slice(-2)}:${m.slice(-2)}`;
  };

  const askAgent = async (messages: ChatMessage[]) => {
    try {
      const response = await backend.chat(messages);
      setChat((prevChat) => {
        const newChat = [...prevChat];
        newChat.pop(); // Remove the "Thinking..." message
        newChat.push({ system: { content: response } });
        return newChat;
      });
    } catch (e) {
      console.log(e);
      const eStr = String(e);
      const match = eStr.match(/(SysTransient|CanisterReject), \\+"([^\\"]+)/);
      if (match) {
        alert(match[2]);
      }
      setChat((prevChat) => {
        const newChat = [...prevChat];
        newChat.pop(); // Remove the "Thinking..." message
        return newChat;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: UserMessage = {
      user: { content: inputValue }
    };
    const thinkingMessage: SystemMessage = {
      system: { content: 'Thinking ...' }
    };
    
    setChat((prevChat) => [...prevChat, userMessage, thinkingMessage]);
    setInputValue('');
    setIsLoading(true);

    const messagesToSend = chat.slice(1).concat([userMessage]);
    askAgent(messagesToSend);
  };

  useEffect(() => {
    // if (chatBoxRef.current) {
    //   chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    // }
  }, [chat]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto p-6 space-y-4 flex flex-col" ref={chatBoxRef}>
        {chat.map((message, index) => {
          const isUser = 'user' in message;
          const content = isUser ? message.user.content : message.system.content;

          return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-lg w-fit max-w-2xl ${isUser ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-white'}`}>
                {content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-zinc-700 bg-zinc-900">
        <form className="flex items-center gap-2" onSubmit={handleSubmit}>
          <input
            type="text"
            className="flex-1 p-2 rounded bg-zinc-800 text-white outline-none"
            placeholder="Send a message"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white"
            disabled={isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}