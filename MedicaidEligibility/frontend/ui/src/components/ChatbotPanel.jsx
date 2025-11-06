import React, { useState } from "react";
import "../App.css";

/**
 * ChatbotPanel
 * ----------------------------------------------------
 * Simple conversational assistant panel.
 * Mirrors the Insurance project’s chat layout.
 * Replace the `fetchResponse` logic to connect to your
 * real Corticon/MarkLogic or OpenAI proxy later.
 */
export default function ChatbotPanel() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! 👋 I'm your Medicaid Assistant. How can I help today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Mock response logic
  async function fetchResponse(userInput) {
    // simulate network delay
    await new Promise((r) => setTimeout(r, 700));

    if (userInput.toLowerCase().includes("eligibility")) {
      return "You can check Medicaid eligibility using the search tab — just enter a name, ID, or state filter.";
    } else if (userInput.toLowerCase().includes("income")) {
      return "Income thresholds vary by family size and state — typically between 133% and 200% of the federal poverty level.";
    } else if (userInput.toLowerCase().includes("help")) {
      return "You can search households, view state summaries, or ask me general Medicaid questions!";
    } else {
      return "I'm not sure about that — try asking about 'eligibility', 'income limits', or 'search'.";
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const reply = await fetchResponse(input);
      const botMessage = { sender: "bot", text: reply };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot-panel">
      <div className="chat-header">
        <h2>Medicaid Assistant 🤖</h2>
      </div>

      {/* Chat history */}
      <div className="chat-body">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.sender === "user" ? "user" : "bot"}`}
          >
            {msg.text}
          </div>
        ))}
        {loading && <div className="chat-message bot">Typing...</div>}
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Ask about Medicaid eligibility..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
