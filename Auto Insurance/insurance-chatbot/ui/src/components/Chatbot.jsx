// src/components/Chatbot.jsx
import { useState, useRef, useEffect } from "react";
import { ChatBot } from "ml-fasttrack";
import { sendMessage } from "../api/marklogicService";
import PolicyCard from "./PolicyCard";
import ReactMarkdown from "react-markdown";

// Define user and bot outside component to ensure stable references
const bot = {
  id: 0,
  name: "AI Assistant",
  avatarUrl: "/chatbot.jpg",
};

const user = {
  id: 1,
  name: "User",
  avatarUrl: "/user.png",
};

const MessageTemplate = (props) => {
    // Check for typing indicator
    if (props.item.typing) {
        return (
            <div className="k-bubble">
                <span className="k-typing-indicator">
                    <span></span><span></span><span></span>
                </span>
            </div>
        );
    }

    // Bot messages get Markdown
    if (props.item.author.id === bot.id) {
        return (
            <div className="k-bubble">
                <ReactMarkdown>{props.item.text}</ReactMarkdown>
            </div>
        );
    }

    // User messages (and others) get plain text
    return (
        <div className="k-bubble">
            {props.item.text}
        </div>
    );
};

export default function Chatbot({ policy }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      author: bot,
      text: `Hello, this is the FastTrack ChatBot.`,
      timestamp: new Date()
    }
  ]);
  const messageListRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messageListRef.current) {
      const messageList = messageListRef.current.querySelector('.k-message-list');
      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (event) => {
    // Ensure the message author matches our user object reference with unique ID
    const userMessage = { 
        id: Date.now() + Math.random(),
        ...event.message,
        text: event.message.text || ' ', // Fallback for empty text
        author: user,
        timestamp: new Date(),
        status: 'sent'
    };
    
    console.log('User message being added:', userMessage);
    
    // 1. Add user message immediately
    setMessages((prev) => {
        const updated = [...prev, userMessage];
        console.log('Messages after adding user message:', updated);
        return updated;
    });

    if (!policy) {
        // Add typing indicator with slight delay
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                id: Date.now() + Math.random(),
                author: bot, 
                typing: true 
            }]);
        }, 300);
        
        setTimeout(() => {
             setMessages(prev => {
                const withoutTyping = prev.filter(m => !m.typing);
                return [...withoutTyping, { 
                    id: Date.now() + Math.random(),
                    author: bot, 
                    text: "You must provide a policy reference in order to answer your questions.", 
                    timestamp: new Date(),
                    status: 'delivered'
                }];
             });
        }, 800);
        return;
    }

    // 2. Add typing indicator with slight delay for natural feel
    setTimeout(() => {
        setMessages((prev) => [...prev, { 
            id: Date.now() + Math.random(),
            author: bot, 
            typing: true 
        }]);
    }, 300);

    try {
      // 3. Prepare payload
      const input = userMessage.text;
      const policyId = policy?.payload?.[0]?.applicationId;
      const policyData = policy?.payload?.[0];
      const contextData = {
        policyId: policyId,
        policy: policyData,
        driverCount: policyData?.drivers?.length || 0,
        vehicleCount: policyData?.vehicles?.length || 0
      };

      const payload = {
          context: contextData,
          ...contextData
      };

      const driversList = policyData?.drivers?.map(d => `${d.first} ${d.last}`).join(', ') || 'None';
      const vehiclesList = policyData?.vehicles?.map(v => `${v.modelYear} ${v.make} ${v.model}`).join(', ') || 'None';
      
      const contextPreamble = `
CONTEXT INFORMATION:
Policy ID: ${policyId}
State: ${policyData?.state || 'Unknown'}
Drivers: ${driversList}
Vehicles: ${vehiclesList}
Active Tab: Chatbot

RESPONSE FORMATTING INSTRUCTIONS:
- You are the Corticon Policy Explainer for Auto Insurance integrated with MarkLogic and Corticon.js.
- Only answer using the specific policy JSON provided for the current question.
- If no policy JSON is present, respond with exactly:
  "Please provide a policy ID (e.g., include the applicationId) so I can explain the specific policy details."
- Do not invent or assume policy details.
- Focus on discounts, surcharges, and key policy attributes.
- Be concise and professional - avoid repetition
- Use simple, clean formatting - no tables
- Do NOT repeat policy ID in response
- Use bold formatting, but only for section headers- remainder plain text only
- CRITICAL: Never put empty lines after section headers - section content must start immediately on the next line
- Use simple bullet points with a dash icon with proper spacing
- Combine related information to avoid repetition
- Start with summary of the answers contextualized for insurance applications, then section headers depending on the answer content starting with a brief explanation of that section too.
- Finish with a section called Corticon Explanations in which you list and comment on the rule messages produced by Corticon in the payload. 

EXAMPLE FORMAT:
Summary
The discounts for this policy were determined using various rules based on driver qualifications and vehicle features.

Policy Discounts
Short concise textual summary of this section.
- Paid In Full Discount
- Rule: Policy qualifies for discount
- Message: Andriessen family's policy qualifies for the paid in full discount

Driver Discounts
Short concise textual summary of this section.
- Tarra Andriessen: Safe Driver / Incident-Free discount (Driver Level Discounts, Rule 2)
- Gare Andriessen: Age 65 or older discount, Safe Driver / Incident-Free discount (Driver Level Discounts, Rule 1, Rule 2)

Vehicle Discounts (BMW 530e)
Short concise textual summary of this section.
- Anti-Theft Device / Vehicle Recovery System discount (Vehicle Level Discounts, Rule 3)
- Electronic Stability Control discount (Vehicle Level Discounts, Rule 4)
- Forward Collision Warning discount (Vehicle Level Discounts, Rule 5)

Corticon Explanations
Short concise textual summary of this section.
- INFO - Andriessen family's policy qualifies for the paid in full discount
- WARNING - message text.
- VIOLATION - message text.

User Question: ${input}
`;

      // 4. Call API
      const response = await sendMessage(contextPreamble, payload);
      let reply = (response.reply || "").trim();
      
      // Clean up reply
      reply = reply.replace(/^([*#\s]*(?:Greetings?|Hello|Hi|Hey)[\s.,!:;\-]*)+[*#\s]*/i, '').trim();
      
      // Simple formatting fixes:
      // 1. Remove leading colons from any line
      reply = reply.replace(/^\s*:\s*/gm, '');
      // 2. Fix double colons
      reply = reply.replace(/::\s*/g, ': ');
      
      if (!reply) reply = "_No response._";

      // 5. Replace typing indicator with actual response
      setMessages((prev) => {
        const withoutTyping = prev.filter(m => !m.typing);
        return [
          ...withoutTyping,
          {
            id: Date.now() + Math.random(),
            author: bot,
            text: reply,
            timestamp: new Date(),
            status: 'delivered'
          }
        ];
      });

    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => {
        const withoutTyping = prev.filter(m => !m.typing);
        return [
            ...withoutTyping, 
            { 
              id: Date.now() + Math.random(),
              author: bot, 
              text: `Error: ${e.message || "Failed to get response"}`, 
              timestamp: new Date(),
              status: 'error'
            }
        ];
      });
    }
  };

  return (
    <div className="chatbot-wrapper">
      {policy && policy.payload && policy.payload[0] && (
        <div className="policy-context-card">
          <PolicyCard policyData={policy.payload[0]} />
        </div>
      )}
      <div className="chatbot-container" ref={messageListRef}>
         <ChatBot
            bot={bot}
            user={user}
            authorId={user.id}
            messages={messages}
            onSendMessage={handleSendMessage}
            placeholder="Type your question here..."
            width="100%"
            customBotResponse={true}
            uploadConfig={false}
            showRestart={true}
            onRestart={() => setMessages([])}
            messageTemplate={MessageTemplate}
            parameters={{}} 
         />
      </div>
    </div>
  );
}