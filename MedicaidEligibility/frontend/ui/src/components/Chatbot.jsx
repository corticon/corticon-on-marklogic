// src/components/Chatbot.jsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { sendMessage } from "../api/marklogicService";

/**
 * Chatbot Panel for Medicaid Eligibility Assistant
 * ------------------------------------------------
 * Lets users ask natural-language questions and view responses.
 */
export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await sendMessage(input);
      const reply = (response.reply || "").trim();
      setMessages([
        ...newMessages,
        { role: "assistant", content: reply || "_No response._" },
      ]);
    } catch (err) {
      setError(err.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chatbot-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "assistant" ? (
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
          placeholder="Ask about Medicaid eligibility or policies..."
          rows="1"
          style={{ flex: 1, resize: "none", overflow: "hidden" }}
        />
        <button onClick={handleSend}>Send</button>
      </div>

      {error && <div className="text-red-600 mt-2">{error}</div>}
    </div>
  );
}
