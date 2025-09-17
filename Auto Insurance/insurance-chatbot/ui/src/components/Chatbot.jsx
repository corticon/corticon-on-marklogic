// src/components/Chatbot.jsx
import { useState } from "react";
import { sendMessage } from "../api/marklogicService";
import ReactMarkdown from "react-markdown";

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    // Reset textarea height after sending
    const textarea = document.querySelector(".input-area textarea");
    if (textarea) {
      textarea.style.height = "auto";
    }

    try {
      const response = await sendMessage(input);
      const reply = (response.reply || "").trim();
      setMessages([...newMessages, { role: "assistant", content: reply || "_No response._" }]);
    } catch (e) {
      setError(e.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevents adding a new line on Enter
      handleSend();
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="chatbot-container">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.role === 'assistant' ? (
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {loading && <div className="message assistant">...</div>}
      </div>
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onInput={autoResize} // <-- Autofit on input
          placeholder="Ask me anything..."
          rows="1" // <-- Start with a single row
          style={{ overflow: 'hidden' }} // Hide the scrollbar
        />
        <button onClick={handleSend}>Send</button>
      </div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}