import { supabase } from '../lib/supabase';

const states = ['CA', 'TX', 'NY', 'FL', 'PA', 'IL', 'OH', 'GA'];
const counties = {
  CA: ['Los Angeles', 'San Diego', 'Orange', 'Riverside'],
  TX: ['Harris', 'Dallas', 'Tarrant', 'Bexar'],
  NY: ['New York', 'Kings', 'Queens', 'Bronx'],
  FL: ['Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough'],
  PA: ['Philadelphia', 'Allegheny', 'Montgomery', 'Bucks'],
  IL: ['Cook', 'DuPage', 'Lake', 'Will'],
  OH: ['Cuyahoga', 'Franklin', 'Hamilton', 'Summit'],
  GA: ['Fulton', 'Gwinnett', 'Cobb', 'DeKalb']
};

const denialReasons = [
  'Income exceeds state threshold',
  'Incomplete documentation provided',
  'Unable to verify residency',
  'Missing proof of citizenship',
  'Assets exceed limit',
  'Failed to respond to information request',
  'Not eligible under current category'
];

const names = [
  'Maria Rodriguez', 'James Wilson', 'Jennifer Chen', 'Michael Brown',
  'Patricia Davis', 'Robert Johnson', 'Linda Martinez', 'David Anderson',
  'Elizabeth Taylor', 'William Thomas', 'Sarah Jackson', 'Christopher White',
  'Mary Harris', 'Daniel Martin', 'Jessica Thompson', 'Matthew Garcia',
  'Nancy Robinson', 'Joseph Clark', 'Karen Lewis', 'Charles Walker'
];

const categories: Array<'children' | 'pregnant_women' | 'parents' | 'elderly' | 'disabled' | 'other'> = [
  'children', 'pregnant_women', 'parents', 'elderly', 'disabled', 'other'
];

const statuses: Array<'approved' | 'denied' | 'pending' | 'under_review'> = [
  'approved', 'denied', 'pending', 'under_review'
];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateZipCode(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function generateApplicationId(): string {
  return `APL-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function seedDatabase() {
  try {
    console.log('Starting to seed database...');

    const determinations = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 50; i++) {
      const state = states[Math.floor(Math.random() * states.length)];
      const countyList = counties[state as keyof typeof counties];
      const county = countyList[Math.floor(Math.random() * countyList.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];

      const applicationDate = randomDate(startDate, endDate);
      const determinationDate = new Date(applicationDate.getTime() + Math.random() * 60 * 24 * 60 * 60 * 1000);

      const householdSize = Math.floor(1 + Math.random() * 6);
      const baseIncome = 1000 + Math.random() * 4000;
      const income = Math.floor(baseIncome);
      const fplPercentage = Math.floor(50 + Math.random() * 150);

      let denial_reasons: string[] = [];
      if (status === 'denied') {
        const numReasons = Math.floor(1 + Math.random() * 3);
        const shuffled = [...denialReasons].sort(() => 0.5 - Math.random());
        denial_reasons = shuffled.slice(0, numReasons);
      }

      determinations.push({
        application_id: generateApplicationId(),
        applicant_name: names[Math.floor(Math.random() * names.length)],
        date_of_birth: randomDate(new Date(1940, 0, 1), new Date(2015, 0, 1)).toISOString().split('T')[0],
        ssn_last_four: String(Math.floor(1000 + Math.random() * 9000)),
        determination_date: determinationDate.toISOString(),
        application_date: applicationDate.toISOString(),
        status,
        eligibility_category: category,
        income_level: income,
        household_size: householdSize,
        fpl_percentage: fplPercentage,
        state,
        county,
        zip_code: generateZipCode(),
        denial_reasons: JSON.stringify(denial_reasons),
        case_worker_id: `CW-${Math.floor(100 + Math.random() * 900)}`,
        notes: status === 'pending' ? 'Awaiting additional documentation' : ''
      });
    }

    const { error } = await supabase
      .from('eligibility_determinations')
      .insert(determinations);

    if (error) {
      console.error('Error seeding database:', error);
      throw error;
    }

    console.log(`Successfully seeded ${determinations.length} records`);
    return { success: true, count: determinations.length };
  } catch (error) {
    console.error('Failed to seed database:', error);
    return { success: false, error };
  }
}
