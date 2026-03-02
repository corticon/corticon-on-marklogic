/*
  # Medicaid Eligibility Analysis System

  ## Overview
  Creates the database schema for tracking Medicaid eligibility determinations and supporting analytics.

  ## New Tables
  
  ### `eligibility_determinations`
  Stores individual eligibility determination records with comprehensive applicant information.
  
  - `id` (uuid, primary key) - Unique identifier for each determination
  - `application_id` (text) - Human-readable application reference number
  - `applicant_name` (text) - Full name of applicant
  - `date_of_birth` (date) - Applicant's date of birth
  - `ssn_last_four` (text) - Last 4 digits of SSN for identification
  - `determination_date` (timestamptz) - When the determination was made
  - `application_date` (timestamptz) - When the application was submitted
  - `status` (text) - Current status: approved, denied, pending, under_review
  - `eligibility_category` (text) - Category: children, pregnant_women, parents, elderly, disabled, other
  - `income_level` (numeric) - Monthly household income
  - `household_size` (integer) - Number of people in household
  - `fpl_percentage` (numeric) - Percentage of Federal Poverty Level
  - `state` (text) - State abbreviation
  - `county` (text) - County name
  - `zip_code` (text) - ZIP code
  - `denial_reasons` (jsonb) - Array of denial reasons if denied
  - `case_worker_id` (text) - ID of assigned case worker
  - `notes` (text) - Additional case notes
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to read eligibility data
  - Add policies for authenticated users to manage determinations

  ## Indexes
  - Index on application_id for quick lookups
  - Index on status for filtering
  - Index on determination_date for date range queries
  - Index on state and county for geographic analytics
*/

-- Create eligibility determinations table
CREATE TABLE IF NOT EXISTS eligibility_determinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text UNIQUE NOT NULL,
  applicant_name text NOT NULL,
  date_of_birth date NOT NULL,
  ssn_last_four text,
  determination_date timestamptz NOT NULL,
  application_date timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('approved', 'denied', 'pending', 'under_review')),
  eligibility_category text NOT NULL CHECK (eligibility_category IN ('children', 'pregnant_women', 'parents', 'elderly', 'disabled', 'other')),
  income_level numeric NOT NULL,
  household_size integer NOT NULL,
  fpl_percentage numeric NOT NULL,
  state text NOT NULL,
  county text NOT NULL,
  zip_code text NOT NULL,
  denial_reasons jsonb DEFAULT '[]'::jsonb,
  case_worker_id text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_eligibility_application_id ON eligibility_determinations(application_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_status ON eligibility_determinations(status);
CREATE INDEX IF NOT EXISTS idx_eligibility_determination_date ON eligibility_determinations(determination_date);
CREATE INDEX IF NOT EXISTS idx_eligibility_state ON eligibility_determinations(state);
CREATE INDEX IF NOT EXISTS idx_eligibility_county ON eligibility_determinations(county);
CREATE INDEX IF NOT EXISTS idx_eligibility_category ON eligibility_determinations(eligibility_category);

-- Enable Row Level Security
ALTER TABLE eligibility_determinations ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all eligibility determinations
CREATE POLICY "Authenticated users can read eligibility determinations"
  ON eligibility_determinations
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert eligibility determinations
CREATE POLICY "Authenticated users can insert eligibility determinations"
  ON eligibility_determinations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update eligibility determinations
CREATE POLICY "Authenticated users can update eligibility determinations"
  ON eligibility_determinations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete eligibility determinations
CREATE POLICY "Authenticated users can delete eligibility determinations"
  ON eligibility_determinations
  FOR DELETE
  TO authenticated
  USING (true);