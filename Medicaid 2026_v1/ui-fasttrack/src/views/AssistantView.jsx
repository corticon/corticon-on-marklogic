import { useEffect, useMemo, useState } from "react";
import { Bot, Send, User, Loader2, Sparkles, Link as LinkIcon } from "lucide-react";
import SectionCard from "../components/SectionCard";
import JsonPreview from "../components/JsonPreview";
import { debugLog, postJson, shortRulesheetName } from "../lib/api";

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function normalizeMdText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function renderInlineMarkdown(text, keyPrefix) {
  const source = normalizeMdText(text);
  if (!source) return null;

  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(source.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <a
          key={`${keyPrefix}-link-${idx}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer noopener"
          className="chat-md-link"
        >
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      parts.push(<code key={`${keyPrefix}-code-${idx}`} className="chat-md-code-inline">{match[5]}</code>);
    } else if (match[6]) {
      parts.push(<strong key={`${keyPrefix}-strong-${idx}`}>{match[7]}</strong>);
    } else if (match[8]) {
      parts.push(<em key={`${keyPrefix}-em-${idx}`}>{match[9]}</em>);
    }

    lastIndex = pattern.lastIndex;
    idx += 1;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return parts;
}

function renderMarkdownBlocks(text) {
  const source = normalizeMdText(text).replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const nodes = [];
  let i = 0;

  function pushParagraph(buffer, key) {
    if (!buffer.length) return;
    const joined = buffer.join(" ").trim();
    if (!joined) return;
    nodes.push(<p key={key}>{renderInlineMarkdown(joined, `${key}-inline`)}</p>);
    buffer.length = 0;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && /^```/.test(lines[i].trim())) i += 1;
      nodes.push(
        <pre key={`code-${nodes.length}`} className="chat-md-code-block">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length);
      const content = renderInlineMarkdown(headingMatch[2], `h-${nodes.length}`);
      if (level === 1) nodes.push(<h2 key={`h-${nodes.length}`}>{content}</h2>);
      else if (level === 2) nodes.push(<h3 key={`h-${nodes.length}`}>{content}</h3>);
      else nodes.push(<h4 key={`h-${nodes.length}`}>{content}</h4>);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      nodes.push(
        <blockquote key={`q-${nodes.length}`} className="chat-md-quote">
          {renderInlineMarkdown(quoteLines.join(" "), `q-${nodes.length}`)}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="chat-md-list">
          {items.map((item, itemIdx) => (
            <li key={`ul-${nodes.length}-${itemIdx}`}>{renderInlineMarkdown(item, `ul-${nodes.length}-${itemIdx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="chat-md-list">
          {items.map((item, itemIdx) => (
            <li key={`ol-${nodes.length}-${itemIdx}`}>{renderInlineMarkdown(item, `ol-${nodes.length}-${itemIdx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphBuffer = [];
    while (i < lines.length) {
      const current = lines[i];
      const currentTrimmed = current.trim();
      if (!currentTrimmed) break;
      if (/^(#{1,4})\s+/.test(currentTrimmed) || /^```/.test(currentTrimmed) || /^>\s?/.test(currentTrimmed) || /^[-*]\s+/.test(currentTrimmed) || /^\d+\.\s+/.test(currentTrimmed)) {
        break;
      }
      paragraphBuffer.push(currentTrimmed);
      i += 1;
    }
    pushParagraph(paragraphBuffer, `p-${nodes.length}`);
  }

  if (!nodes.length) {
    return <p>{source}</p>;
  }
  return nodes;
}

function ChatMessageContent({ text, role }) {
  if (role !== "assistant") {
    return <div className="chat-text">{text}</div>;
  }
  return <div className="chat-text chat-text-markdown">{renderMarkdownBlocks(text)}</div>;
}

function summarizeAssistantResponse(data) {
  if (!data) return "No response received.";
  const lines = [data.answerText || data.responseDraft || "Response received."];
  if (data.analytics?.topIneligibilityReasons?.length) {
    const top = data.analytics.topIneligibilityReasons.slice(0, 3)
      .map((x) => `${x.value} (${x.count})`)
      .join(", ");
    lines.push(`Top ineligibility reasons: ${top}`);
  }
  if (data.matchCount) lines.push(`Matched determinations: ${data.matchCount}`);
  if (data.ruleInfluence?.topRulesheets?.length) {
    const top = data.ruleInfluence.topRulesheets.slice(0, 3)
      .map((x) => `${shortRulesheetName(x.value)} (${x.count})`)
      .join(", ");
    lines.push(`Frequent rulesheets: ${top}`);
  }
  return lines.join("\n\n");
}

const QUICK_PROMPTS = [
  "Common ineligibility reasons",
  "Common ineligibility reasons in West Virginia",
  "Why HH-12 ineligible?",
  "Population commonalities by state",
  "Amort family determination overview"
];

export default function AssistantView({ proxyBaseUrl }) {
  const introMessage = {
    id: "intro",
    role: "assistant",
    content:
      "Ask questions about eligibility determinations, ineligibility patterns, or population-level analytics. This view uses proxy orchestration for MarkLogic retrieval plus optional OpenAI synthesis.",
    ts: nowLabel()
  };
  const [messages, setMessages] = useState([
    introMessage
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastStructured, setLastStructured] = useState(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(() => {
    try {
      return typeof window !== "undefined" ? (window.localStorage.getItem("dl_medicaid_chat_session_id") || "") : "";
    } catch (e) {
      return "";
    }
  });
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (sessionId) window.localStorage.setItem("dl_medicaid_chat_session_id", sessionId);
      else window.localStorage.removeItem("dl_medicaid_chat_session_id");
    } catch (e) {}
  }, [sessionId]);

  const topSuggestions = useMemo(() => {
    if (!lastStructured?.suggestedActions) return [];
    return lastStructured.suggestedActions.slice(0, 6);
  }, [lastStructured]);

  const resetConversation = () => {
    debugLog("assistant", "Resetting conversation", { priorSessionId: sessionId || null });
    setMessages([{
      ...introMessage,
      id: `intro-${Date.now()}`,
      ts: nowLabel()
    }]);
    setDraft("");
    setError("");
    setLastStructured(null);
    setSessionId("");
    setSessionInfo(null);
  };

  const sendMessage = async (questionText) => {
    const question = (questionText || draft).trim();
    if (!question || loading) return;

    setError("");
    setLoading(true);
    setDraft("");
    const started = performance.now();
    debugLog("assistant", "Submitting question", { question, sessionId: sessionId || null });
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: question, ts: nowLabel() }]);

    try {
      const response = await postJson(proxyBaseUrl, "/api/chatbot", {
        query: question,
        ...(sessionId ? { sessionId } : {})
      });
      debugLog("assistant", `Received response in ${Math.round(performance.now() - started)}ms`, {
        intent: response?.intent,
        matchCount: response?.matchCount,
        sessionId: response?.sessionId || null,
        sessionTurnCount: response?.session?.turnCount || null,
        llm: response?.llm ? {
          used: response.llm.used,
          model: response.llm.model,
          durationMs: response.llm.durationMs,
          reason: response.llm.reason
        } : null
      });
      setSessionId(response?.sessionId || sessionId || "");
      setSessionInfo(response?.session || null);
      setLastStructured(response);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: summarizeAssistantResponse(response),
        ts: nowLabel()
      }]);
    } catch (e) {
      debugLog("assistant", `Request failed in ${Math.round(performance.now() - started)}ms`, {
        error: e.message,
        payload: e.payload
      });
      setError(e.message || "Chat request failed");
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "I could not complete that request. Check the proxy and MarkLogic resource endpoint, then try again.",
        ts: nowLabel()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-stack">
      <div className="chat-layout">
        <SectionCard
          title="Medicaid Support Assistant"
          subtitle="Chat-oriented workflow for determinations lookup and analytics context."
          className="chat-main"
        >
          <div className="chat-header-banner">
            <div className="chat-header-icon"><Bot size={22} /></div>
            <div>
              <div className="chat-header-title">Decision Support Assistant</div>
                <div className="chat-header-subtitle">
                Uses proxy orchestration (`/api/chatbot`) for MarkLogic retrieval + optional OpenAI answer synthesis.
                </div>
            </div>
          </div>

          <div className="quick-prompt-row">
            <button type="button" className="quick-prompt" onClick={resetConversation} disabled={loading}>
              <span>New Conversation</span>
            </button>
            {sessionId ? <div className="chat-disclaimer mono">Session: {sessionId.slice(0, 8)}…</div> : null}
          </div>

          <div className="quick-prompt-row">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="quick-prompt"
                onClick={() => sendMessage(prompt)}
                disabled={loading}
              >
                <Sparkles size={14} />
                <span>{prompt}</span>
              </button>
            ))}
          </div>

          <div className="chat-thread" role="log" aria-live="polite">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-row ${msg.role}`}>
                {msg.role === "assistant" ? <div className="chat-avatar assistant"><Bot size={16} /></div> : null}
                <div className={`chat-bubble ${msg.role}`}>
                  <ChatMessageContent text={msg.content} role={msg.role} />
                  <div className="chat-ts">{msg.ts}</div>
                </div>
                {msg.role === "user" ? <div className="chat-avatar user"><User size={16} /></div> : null}
              </div>
            ))}
            {loading ? (
              <div className="chat-row assistant">
                <div className="chat-avatar assistant"><Bot size={16} /></div>
                <div className="chat-bubble assistant typing">
                  <Loader2 size={14} className="spin" />
                  <span>Querying determinations, analytics, and trace summaries…</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="chat-compose">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about a household, ineligibility reasons, geography, cohorts, or rule influence..."
              rows={3}
              disabled={loading}
            />
            <div className="chat-compose-actions">
              {error ? <div className="error-inline">{error}</div> : <div className="chat-disclaimer">Validate operational decisions against official determinations and workflow procedures.</div>}
              <button type="button" className="primary-button" onClick={() => sendMessage()} disabled={loading || !draft.trim()}>
                {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                Send
              </button>
            </div>
          </div>
        </SectionCard>

        <div className="chat-side">
          <SectionCard title="Structured Response" subtitle="Last chatbot payload from the middleware endpoint.">
            {lastStructured ? (
              <div className="detail-stack">
                <div className="detail-block">
                  <div className="detail-label">Intent</div>
                  <div className="detail-value">{lastStructured.intent || "—"}</div>
                </div>

                {(lastStructured.session || sessionInfo || sessionId) ? (
                  <div className="detail-block">
                    <div className="detail-label">Session</div>
                    <div className="detail-value mono wrap">
                      {(lastStructured.sessionId || sessionId || "—")}
                      {lastStructured.session?.turnCount ? ` · ${lastStructured.session.turnCount} turns` : ""}
                      {lastStructured.sessionHistoryUsed ? ` · history=${lastStructured.sessionHistoryUsed}` : ""}
                    </div>
                  </div>
                ) : null}

                {lastStructured.llm ? (
                  <div className="detail-block">
                    <div className="detail-label">LLM</div>
                    <div className="detail-value">
                      {lastStructured.llm.used ? `OpenAI ${lastStructured.llm.model || ""}`.trim() : "Deterministic fallback"}
                      {lastStructured.llm.durationMs ? ` · ${lastStructured.llm.durationMs}ms` : ""}
                      {lastStructured.llm.reason ? ` · ${lastStructured.llm.reason}` : ""}
                    </div>
                  </div>
                ) : null}

                {lastStructured.analytics?.topIneligibilityReasons?.length ? (
                  <div className="detail-block">
                    <div className="detail-label">Top Ineligibility Reasons</div>
                    <div className="list-rows">
                      {lastStructured.analytics.topIneligibilityReasons.slice(0, 5).map((item) => (
                        <div className="list-row" key={`${item.value}-${item.count}`}>
                          <span className="mono wrap">{item.value}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lastStructured.matches?.length ? (
                  <div className="detail-block">
                    <div className="detail-label">Matched Determinations</div>
                    <div className="list-rows">
                      {lastStructured.matches.slice(0, 6).map((match, idx) => (
                        <div className="list-row list-row-stacked" key={`${match.correlationId || "m"}-${idx}`}>
                          <div><strong>{match.householdId || "—"}</strong> · {match.state || "—"}</div>
                          <div className="subtle">{match.eligibility || "—"} · {match.reasonCode || "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {lastStructured.ruleInfluence?.topRulesheets?.length ? (
                  <div className="detail-block">
                    <div className="detail-label">Rule Influence</div>
                    <div className="list-rows">
                      {lastStructured.ruleInfluence.topRulesheets.slice(0, 6).map((item) => (
                        <div className="list-row" key={`${item.value}-${item.count}`}>
                          <span className="wrap">{shortRulesheetName(item.value)}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {topSuggestions.length ? (
                  <div className="detail-block">
                    <div className="detail-label">Suggested Actions</div>
                    <div className="list-rows">
                      {topSuggestions.map((action) => (
                        <div className="list-row list-row-stacked" key={`${action.action}-${action.endpoint}`}>
                          <div><LinkIcon size={12} /> {action.action}</div>
                          <div className="mono subtle wrap">{action.endpoint}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-panel compact">
                <Bot size={20} />
                <p>Send a question to populate structured chatbot output and suggested actions.</p>
              </div>
            )}
          </SectionCard>

          {lastStructured ? (
            <SectionCard title="Raw Payload" subtitle="Helpful while wiring UI widgets to middleware contracts.">
              <JsonPreview value={lastStructured} maxHeight={320} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
