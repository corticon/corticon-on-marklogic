import React from 'react';

const HouseholdCard = ({ row }) => {
  // Handle different potential data shapes (direct document or pre-processed 'row' prop)
  const data = row?.payload || row || {};
  const {
    householdId,
    familyName,
    householdPercentFPL,
    familySize,
    stateOfResidence,
    monthlyIncome,
    individual = []
  } = data;

  // Helper to safely get numeric values
  const getNumber = (val) => {
      const num = Number(val);
      return isNaN(num) ? null : num;
  };

  const fpl = getNumber(householdPercentFPL);
  const size = getNumber(familySize);
  const income = getNumber(monthlyIncome);

  // Find primary applicant
  const applicant = individual.find(ind => ind.relationToApplicant === 'Self') || individual[0];
  const memberCount = size || individual.length || 'N/A';

  // Badge logic
  let badgeColor = "bg-gray-100 text-gray-800";
  let badgeLabel = "Unknown FPL";
  if (fpl !== null) {
    if (fpl <= 1.0) {
      badgeColor = "bg-green-100 text-green-800 border-green-200";
      badgeLabel = `${(fpl * 100).toFixed(0)}% FPL (Eligible)`;
    } else if (fpl <= 1.38) {
        badgeColor = "bg-yellow-100 text-yellow-800 border-yellow-200";
        badgeLabel = `${(fpl * 100).toFixed(0)}% FPL (Near Limit)`;
    } else {
      badgeColor = "bg-red-100 text-red-800 border-red-200";
      badgeLabel = `${(fpl * 100).toFixed(0)}% FPL (Over Income)`;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {familyName || 'Unknown'} Household
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">ID: {householdId}</span>
          </h3>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <span className="block text-xs text-gray-400 uppercase font-semibold mb-1">State</span>
          <span className="font-medium text-gray-900">{stateOfResidence || 'N/A'}</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <span className="block text-xs text-gray-400 uppercase font-semibold mb-1">Members</span>
          <span className="font-medium text-gray-900">{memberCount}</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <span className="block text-xs text-gray-400 uppercase font-semibold mb-1">Monthly Inc.</span>
          <span className="font-medium text-gray-900">{income !== null ? `$${income.toLocaleString()}` : 'N/A'}</span>
        </div>
      </div>

      {applicant && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500 mb-2">Primary Applicant: <span className="font-medium text-gray-900">{applicant.first} {applicant.last}</span></p>
          <div className="flex flex-wrap gap-2">
            {applicant.isPregnant && <span className="px-2 py-1 text-xs font-medium bg-pink-50 text-pink-700 rounded-md border border-pink-100">Pregnant</span>}
            {applicant.isDisabled && <span className="px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-md border border-purple-100">Disabled</span>}
            {applicant.isBlind && <span className="px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">Blind</span>}
            {applicant.age >= 65 && <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-100">Senior ({applicant.age})</span>}
             {applicant.bornToMedicaidMother && <span className="px-2 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded-md border border-teal-100">Born to Medicaid Mom</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdCard;