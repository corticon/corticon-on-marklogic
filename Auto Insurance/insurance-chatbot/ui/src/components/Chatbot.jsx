// src/components/Chatbot.jsx
import { useMemo, useRef, useState } from "react";
import { sendMessage } from "../api/marklogicService";
import ReactMarkdown from "react-markdown";
import { getPolicyPayload } from "../utils/policyUtils";

export default function Chatbot({ policy }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);
  const policyData = getPolicyPayload(policy);

  const suggestions = useMemo(() => {
    if (!policyData?.applicationId) {
      return [
        "Explain what the chatbot needs from me.",
        "How do I ask about discounts for a policy?",
        "What policy ID should I include in my question?"
      ];
    }

    return [
      `Explain the premium for ${policyData.applicationId}.`,
      `What discounts were applied to ${policyData.applicationId}?`,
      `Summarize the Corticon messages for ${policyData.applicationId}.`
    ];
  }, [policyData]);

  function resizeComposer() {
    if (!textareaRef.current) {
      return;
    }
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }

  const handleSend = async (nextMessage = input) => {
    if (!nextMessage.trim()) return;

    const newMessages = [...messages, { role: "user", content: nextMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await sendMessage(nextMessage);
      const reply = (response.reply || "").trim();
      setMessages([...newMessages, { role: "assistant", content: reply || "_No response produced._" }]);
    } catch (e) {
      setError(e.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="chat-shell">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Policy concierge</span>
          <h2>Ask for premium, discount, and decision explanations in plain language.</h2>
          <p>
            {policyData?.applicationId
              ? `Chat is currently centered on ${policyData.applicationId}, so you can ask policy-specific follow-ups immediately.`
              : "Select a policy in the workspace first if you want grounded answers about one specific decision."}
          </p>
        </div>
      </div>

      <div className="chat-layout">
        <section className="widget-panel chat-panel">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <h3>Conversation starters</h3>
                <p>Use one of the prompts below or write your own underwriting question.</p>
              </div>
            ) : null}

            {messages.map((msg, index) => (
              <div key={index} className={`chat-bubble ${msg.role}`}>
                {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
              </div>
            ))}

            {loading ? <div className="chat-bubble assistant">Working through the latest policy context…</div> : null}
          </div>

          <div className="chat-composer">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                resizeComposer();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask why a discount applied, why a warning was emitted, or what is driving the premium."
              rows="1"
            />
            <button onClick={() => handleSend()} className="primary-action">Send</button>
          </div>

          {error ? <div className="search-feedback error">{error}</div> : null}
        </section>

        <aside className="widget-panel chat-sidebar">
          <div className="widget-heading compact">
            <div>
              <h3>Suggested prompts</h3>
              <p>These prompts are tuned to the current Auto Insurance use case.</p>
            </div>
          </div>
          <div className="suggestion-stack">
            {suggestions.map((suggestion) => (
              <button key={suggestion} className="prompt-chip" onClick={() => handleSend(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}