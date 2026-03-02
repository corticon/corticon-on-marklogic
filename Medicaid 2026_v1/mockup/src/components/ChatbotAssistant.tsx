import { useState } from 'react';
import { Send, Bot, User, Loader, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatbotAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m here to help you with Medicaid eligibility questions. You can ask me about:\n\n• Checking application status\n• Eligibility requirements\n• Common denial reasons\n• Document requirements\n• Appeal processes\n\nHow can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateResponse(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('status') || lowerQuery.includes('application')) {
      return 'To check your application status, I\'ll need your Application ID. Once you provide it, I can look up:\n\n• Current status (Approved, Denied, Pending, Under Review)\n• Processing timeline\n• Required documents\n• Next steps\n\nPlease share your Application ID (format: APL-XXXXXX).';
    }

    if (lowerQuery.includes('eligible') || lowerQuery.includes('qualify')) {
      return 'Medicaid eligibility is based on several factors:\n\n**Income Requirements:**\n• Must be at or below 138% of Federal Poverty Level (FPL) in expansion states\n• Income limits vary by household size and category\n\n**Categories:**\n• Children under 19\n• Pregnant women\n• Parents and caretakers\n• Elderly (65+)\n• People with disabilities\n\n**Other Factors:**\n• State residency\n• U.S. citizenship or qualified immigration status\n• Social Security Number\n\nWould you like to know about a specific category?';
    }

    if (lowerQuery.includes('denied') || lowerQuery.includes('rejection')) {
      return 'Common reasons for Medicaid denial include:\n\n1. **Income exceeds limits** - Household income above state threshold\n2. **Incomplete documentation** - Missing required documents\n3. **Residency issues** - Cannot verify state residency\n4. **Citizenship/Immigration** - Documentation not provided\n5. **Assets exceed limits** - In states with asset tests\n\n**Your Rights:**\n• You can appeal any denial within 90 days\n• You have the right to a fair hearing\n• Free legal assistance may be available\n\nWould you like information on how to appeal?';
    }

    if (lowerQuery.includes('document') || lowerQuery.includes('proof')) {
      return 'Required documents typically include:\n\n**Identity:**\n• Driver\'s license or State ID\n• Birth certificate\n• Social Security card\n\n**Income:**\n• Pay stubs (last 2 months)\n• Tax returns\n• Bank statements\n• Unemployment benefits letter\n\n**Residency:**\n• Utility bills\n• Lease agreement\n• Mortgage statement\n\n**Special Categories:**\n• Pregnancy verification (if applicable)\n• Disability documentation (if applicable)\n\nDocuments can usually be uploaded through the online portal or mailed to your local office.';
    }

    if (lowerQuery.includes('appeal')) {
      return 'To appeal a Medicaid denial:\n\n**Timeline:**\n• You have 90 days from the denial date to file an appeal\n• Request a fair hearing in writing\n\n**Process:**\n1. Submit written appeal to state Medicaid office\n2. Include your case number and reasons for appeal\n3. Provide any additional documentation\n4. Attend the hearing (in-person, phone, or video)\n5. Receive a written decision\n\n**Support Available:**\n• Legal Aid organizations offer free assistance\n• Patient advocates can help navigate the process\n• Interpreter services available if needed\n\nWould you like contact information for legal assistance?';
    }

    if (lowerQuery.includes('thank') || lowerQuery.includes('thanks')) {
      return 'You\'re welcome! I\'m here to help. Feel free to ask if you have any other questions about Medicaid eligibility or the application process.';
    }

    return 'I understand you\'re asking about Medicaid eligibility. I can help you with:\n\n• **Application status** - Check where your application stands\n• **Eligibility requirements** - Learn if you qualify\n• **Required documents** - What you need to provide\n• **Denial reasons** - Understanding why applications are denied\n• **Appeals process** - How to challenge a denial\n\nCould you please rephrase your question or let me know which topic you\'d like to explore?';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Medicaid Eligibility Assistant</h2>
            <p className="text-sm text-blue-100">Ask me anything about eligibility and applications</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            )}

            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
              <p
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {formatTime(message.timestamp)}
              </p>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your question here..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {isTyping ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <MessageSquare className="w-4 h-4" />
          <span>This assistant provides general information. For official determinations, please contact your local office.</span>
        </div>
      </div>
    </div>
  );
}
