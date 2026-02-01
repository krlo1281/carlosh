-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  dni text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- Create dosimeters table
CREATE TABLE IF NOT EXISTS public.dosimeters (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id bigserial PRIMARY KEY,
  period date NOT NULL,
  dosimeter_id bigint REFERENCES dosimeters(id),
  user_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(period, dosimeter_id)
);

-- Create readings table
CREATE TABLE IF NOT EXISTS public.readings (
  id bigserial PRIMARY KEY,
  assignment_id bigint REFERENCES assignments(id) ON DELETE CASCADE,
  hp10_msv numeric(10,4),
  hp007_msv numeric(10,4),
  reading_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(assignment_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dosimeters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own assignments" ON public.assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own readings" ON public.readings FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = readings.assignment_id AND a.user_id = auth.uid())
);
CREATE POLICY "Authenticated users can view dosimeters" ON public.dosimeters FOR SELECT TO authenticated USING (true);
