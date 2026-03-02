import { useState, useEffect } from 'react';
import { Search, Filter, FileText, Calendar, User, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EligibilityDetermination } from '../types/eligibility';

export function EligibilitySearch() {
  const [determinations, setDeterminations] = useState<EligibilityDetermination[]>([]);
  const [filteredData, setFilteredData] = useState<EligibilityDetermination[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<EligibilityDetermination | null>(null);

  useEffect(() => {
    fetchDeterminations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, categoryFilter, determinations]);

  const fetchDeterminations = async () => {
    try {
      const { data, error } = await supabase
        .from('eligibility_determinations')
        .select('*')
        .order('determination_date', { ascending: false });

      if (error) throw error;
      setDeterminations(data || []);
    } catch (error) {
      console.error('Error fetching determinations:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...determinations];

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.application_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.county.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(d => d.eligibility_category === categoryFilter);
    }

    setFilteredData(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'denied': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'under_review': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading eligibility records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by Application ID, Name, or County..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">All Categories</option>
              <option value="children">Children</option>
              <option value="pregnant_women">Pregnant Women</option>
              <option value="parents">Parents</option>
              <option value="elderly">Elderly</option>
              <option value="disabled">Disabled</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>{filteredData.length} records found</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          {filteredData.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No records found matching your criteria</p>
            </div>
          ) : (
            filteredData.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedRecord?.id === record.id ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{record.applicant_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                          {record.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Application ID: {record.application_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(record.determination_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{record.eligibility_category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{record.county}, {record.state}</span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-medium">FPL:</span> {record.fpl_percentage}%
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="xl:col-span-1">
          {selectedRecord ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Applicant Name</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedRecord.applicant_name}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Date of Birth</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(selectedRecord.date_of_birth)}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Household Information</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedRecord.household_size} members | ${selectedRecord.income_level.toLocaleString()}/mo
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedRecord.county} County, {selectedRecord.state} {selectedRecord.zip_code}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Federal Poverty Level</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedRecord.fpl_percentage}%</p>
                </div>

                {selectedRecord.denial_reasons && selectedRecord.denial_reasons.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Denial Reasons</label>
                    <ul className="text-sm text-gray-900 mt-1 space-y-1">
                      {selectedRecord.denial_reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRecord.case_worker_id && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Case Worker</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedRecord.case_worker_id}</p>
                  </div>
                )}

                {selectedRecord.notes && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Notes</label>
                    <p className="text-sm text-gray-900 mt-1">{selectedRecord.notes}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <label className="text-xs font-medium text-gray-500 uppercase">Application Date</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(selectedRecord.application_date)}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Determination Date</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(selectedRecord.determination_date)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center sticky top-6">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a record to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
