import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MapPin, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EligibilityDetermination } from '../types/eligibility';

interface DenialReason {
  reason: string;
  count: number;
}

interface StateStats {
  state: string;
  total: number;
  approved: number;
  denied: number;
}

interface CategoryStats {
  category: string;
  count: number;
  approvalRate: number;
}

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [determinations, setDeterminations] = useState<EligibilityDetermination[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    denied: 0,
    pending: 0,
    approvalRate: 0,
  });
  const [denialReasons, setDenialReasons] = useState<DenialReason[]>([]);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('eligibility_determinations')
        .select('*');

      if (error) throw error;

      const records = data || [];
      setDeterminations(records);
      calculateAnalytics(records);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (data: EligibilityDetermination[]) => {
    const total = data.length;
    const approved = data.filter(d => d.status === 'approved').length;
    const denied = data.filter(d => d.status === 'denied').length;
    const pending = data.filter(d => d.status === 'pending').length;
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    setStats({ total, approved, denied, pending, approvalRate });

    const reasonsMap = new Map<string, number>();
    data.forEach(d => {
      if (d.denial_reasons && Array.isArray(d.denial_reasons)) {
        d.denial_reasons.forEach(reason => {
          reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + 1);
        });
      }
    });

    const reasons = Array.from(reasonsMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setDenialReasons(reasons);

    const stateMap = new Map<string, { total: number; approved: number; denied: number }>();
    data.forEach(d => {
      const current = stateMap.get(d.state) || { total: 0, approved: 0, denied: 0 };
      current.total++;
      if (d.status === 'approved') current.approved++;
      if (d.status === 'denied') current.denied++;
      stateMap.set(d.state, current);
    });

    const states = Array.from(stateMap.entries())
      .map(([state, stats]) => ({ state, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    setStateStats(states);

    const categoryMap = new Map<string, { count: number; approved: number }>();
    data.forEach(d => {
      const current = categoryMap.get(d.eligibility_category) || { count: 0, approved: 0 };
      current.count++;
      if (d.status === 'approved') current.approved++;
      categoryMap.set(d.eligibility_category, current);
    });

    const categories = Array.from(categoryMap.entries())
      .map(([category, { count, approved }]) => ({
        category,
        count,
        approvalRate: count > 0 ? (approved / count) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    setCategoryStats(categories);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Applications</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.approved.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">{stats.approvalRate.toFixed(1)}% approval rate</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Denied</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.denied.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-600">{((stats.denied / stats.total) * 100).toFixed(1)}% denial rate</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Top Denial Reasons</h3>
          </div>

          <div className="space-y-4">
            {denialReasons.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No denial data available</p>
            ) : (
              denialReasons.map((reason, index) => {
                const maxCount = denialReasons[0]?.count || 1;
                const percentage = (reason.count / maxCount) * 100;

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{reason.reason}</span>
                      <span className="text-sm font-semibold text-gray-900">{reason.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Approval by Category</h3>
          </div>

          <div className="space-y-4">
            {categoryStats.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No category data available</p>
            ) : (
              categoryStats.map((cat, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">
                      {cat.category.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{cat.count} applications</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{cat.approvalRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">approval rate</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg">
            <MapPin className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Geographic Distribution</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">State</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Applications</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Approved</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Denied</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {stateStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                    No geographic data available
                  </td>
                </tr>
              ) : (
                stateStats.map((state, index) => {
                  const approvalRate = state.total > 0 ? (state.approved / state.total) * 100 : 0;
                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{state.state}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-right">{state.total}</td>
                      <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">{state.approved}</td>
                      <td className="py-3 px-4 text-sm text-red-600 text-right font-medium">{state.denied}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          approvalRate >= 70 ? 'bg-green-100 text-green-800' :
                          approvalRate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {approvalRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics Insights</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• Current overall approval rate: <span className="font-semibold">{stats.approvalRate.toFixed(1)}%</span></p>
              {denialReasons.length > 0 && (
                <p>• Most common denial reason: <span className="font-semibold">{denialReasons[0].reason}</span> ({denialReasons[0].count} cases)</p>
              )}
              {categoryStats.length > 0 && (
                <p>• Highest volume category: <span className="font-semibold capitalize">{categoryStats[0].category.replace('_', ' ')}</span> ({categoryStats[0].count} applications)</p>
              )}
              {stats.pending > 0 && (
                <p>• Applications awaiting review: <span className="font-semibold">{stats.pending}</span></p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
