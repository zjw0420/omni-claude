import { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const models = [
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", desc: "0.5/M input", link: "https://platform.deepseek.com/api_keys" },
  { id: "qwen-max", name: "Qwen Max", desc: "0.8/M input", link: "https://dashscope.console.aliyun.com/apiKey" },
  { id: "doubao-pro", name: "Doubao Pro", desc: "0.3/M input", link: "https://console.volcengine.com/ark/region:cn-beijing/api_key" }
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function App() {
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: selectedModel.id, api_key: apiKey })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setMessages([{ role: "assistant", content: "Connected to " + selectedModel.name + ". Start chatting!" }]);
      }
    } catch (e) {
      setMessages([{ role: "assistant", content: "Connection failed: " + String(e) }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  const last = updated[lastIdx];
                  if (last.role === "assistant") {
                    updated[lastIdx] = { ...last, content: last.content + delta };
                  }
                  return updated;
                });
              }
              if (json.error) {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (updated[lastIdx].role === "assistant") {
                    updated[lastIdx] = { ...updated[lastIdx], content: "Error: " + json.error };
                  }
                  return updated;
                });
              }
            } catch {
            }
          }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx].role === "assistant") {
          updated[lastIdx] = { ...updated[lastIdx], content: "Error: " + String(e) };
        }
        return updated;
      });
    }
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (token) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <header className="bg-gray-800 p-3 flex items-center justify-between border-b border-gray-700">
          <span className="font-medium">{selectedModel.name}</span>
          <button
            onClick={() => { setToken(""); setMessages([]); }}
            className="text-sm text-gray-400 hover:text-white"
          >
            Switch Model
          </button>
        </header>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={"max-w-[80%] rounded-xl p-3 " + (msg.role === "user" ? "bg-blue-600" : "bg-gray-700")}>
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={streaming}
              className="flex-1 p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:bg-gray-600"
            >
              {streaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-6">Claude Code Multi-Model Assistant</h1>

        <div className="space-y-3 mb-6">
          {models.map(model => (
            <div key={model.id}>
              <div
                onClick={() => setSelectedModel(model)}
                className={"p-4 rounded-lg border cursor-pointer transition-all " + (
                  selectedModel.id === model.id
                    ? "border-blue-500 bg-blue-900/30"
                    : "border-gray-700 hover:border-gray-600"
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-sm text-gray-400">{model.desc}</span>
                </div>
              </div>
              <a
                href={model.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline mt-1 inline-block ml-1"
                onClick={e => e.stopPropagation()}
              >
                Get API Key
              </a>
            </div>
          ))}
        </div>

        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="Enter your API key"
          className="w-full p-3 mb-4 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !apiKey}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:bg-gray-600"
        >
          {loading ? "Connecting..." : "Launch Assistant"}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Enter any model API key to start chatting with streaming responses
        </p>
      </div>
    </div>
  );
}
