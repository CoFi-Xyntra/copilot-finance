export default function Sidebar() {
  return (
    <div className="w-64 bg-zinc-800 p-4 flex flex-col">
      <button className="bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded mb-4">
        + New Chat
      </button>
      <div className="flex-1 overflow-auto">
        <ul className="space-y-2">
          {Array.from({ length: 10 }).map((_, idx) => (
            <li key={idx} className="p-2 hover:bg-zinc-700 rounded cursor-pointer">
              Chat #{idx + 1}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
