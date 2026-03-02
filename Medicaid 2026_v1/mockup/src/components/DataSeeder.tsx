import { useState } from 'react';
import { Database, Loader } from 'lucide-react';
import { seedDatabase } from '../utils/seedData';

export function DataSeeder() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSeed = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await seedDatabase();

      if (result.success) {
        setMessage(`Successfully added ${result.count} sample records to the database`);
      } else {
        setMessage('Failed to seed database. Please check console for errors.');
      }
    } catch (error) {
      setMessage('Error seeding database. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Development Tools</h3>
            <p className="text-xs text-gray-500">Seed sample data</p>
          </div>
        </div>

        <button
          onClick={handleSeed}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Seeding...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Seed Sample Data
            </>
          )}
        </button>

        {message && (
          <div className={`mt-3 p-2 rounded text-xs ${
            message.includes('Successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
