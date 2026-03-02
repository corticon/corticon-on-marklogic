import { useState } from 'react';
import { Shield, Search, MessageSquare, BarChart3 } from 'lucide-react';
import { EligibilitySearch } from './components/EligibilitySearch';
import { ChatbotAssistant } from './components/ChatbotAssistant';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { DataSeeder } from './components/DataSeeder';

type View = 'search' | 'chatbot' | 'analytics';

function App() {
  const [activeView, setActiveView] = useState<View>('search');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Medicaid Eligibility Portal</h1>
                <p className="text-xs text-gray-500">Determination Management System</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                System Active
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveView('search')}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeView === 'search'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Search className="w-4 h-4" />
              Eligibility Search
            </button>

            <button
              onClick={() => setActiveView('chatbot')}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeView === 'chatbot'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              AI Assistant
            </button>

            <button
              onClick={() => setActiveView('analytics')}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 ${
                activeView === 'analytics'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics Dashboard
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'search' && <EligibilitySearch />}
        {activeView === 'chatbot' && <ChatbotAssistant />}
        {activeView === 'analytics' && <AnalyticsDashboard />}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>Medicaid Eligibility Portal - Secure Determination Management System</p>
            <p className="mt-1">All data is encrypted and HIPAA compliant</p>
          </div>
        </div>
      </footer>

      <DataSeeder />
    </div>
  );
}

export default App;
