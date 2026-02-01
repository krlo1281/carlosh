-- Seed Data for Testing
DO $$
DECLARE
  test_uid uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  test_dni text := '44445555';
BEGIN
  -- User should already exist from setup, this is for reference or re-run
  -- ... (User creation logic skipped for brevity in seed file, usually handled by Auth) ...

  INSERT INTO public.profiles (id, dni, full_name)
  VALUES (test_uid, test_dni, 'Carlos Dosimetrista')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.dosimeters (code) VALUES ('D001'), ('D002') ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.assignments (period, dosimeter_id, user_id)
  SELECT '2024-02-01', id, test_uid FROM public.dosimeters WHERE code = 'D001'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.readings (assignment_id, hp10_msv, hp007_msv, reading_date, notes)
  SELECT id, 0.45, 0.50, '2024-02-15', 'Lectura normal'
  FROM public.assignments WHERE period = '2024-02-01' AND user_id = test_uid
  ON CONFLICT DO NOTHING;
END $$;
