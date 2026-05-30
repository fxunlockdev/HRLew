-- ============================================================================
-- demo_data.sql
-- Optional demo dataset for local testing. NOT applied automatically.
-- Run with:  psql $DATABASE_URL -f supabase/demo_data.sql
-- ============================================================================

-- A handful of clients
insert into public.clients (name, industry, location, status, website) values
  ('Acme Corp',      'SaaS',         'Bengaluru', 'active',   'https://acme.example.com'),
  ('Zenith Labs',    'AI/ML',        'Pune',      'active',   'https://zenith.example.com'),
  ('Northwind Bank', 'Banking',      'Mumbai',    'prospect', 'https://nw.example.com')
on conflict do nothing;

-- A handful of jobs (auto-links to first client)
insert into public.job_requirements (client_id, title, location, work_mode, employment_type, openings, min_experience_years, max_experience_years, min_salary, max_salary, required_skills, status, priority)
select c.id, 'Senior Backend Engineer', 'Bengaluru', 'hybrid', 'full_time', 2, 4, 8, 1800000, 3500000, array['Go','PostgreSQL','AWS'], 'open', 'high'
from public.clients c where c.name = 'Acme Corp'
on conflict do nothing;

insert into public.job_requirements (client_id, title, location, work_mode, employment_type, openings, min_experience_years, max_experience_years, min_salary, max_salary, required_skills, status, priority)
select c.id, 'AI Product Manager', 'Remote', 'remote', 'full_time', 1, 3, 7, 2200000, 4500000, array['Product','ML','LLM'], 'open', 'urgent'
from public.clients c where c.name = 'Zenith Labs'
on conflict do nothing;

-- A handful of candidates
insert into public.candidates (full_name, email, phone, current_company, current_designation, current_location, total_experience_years, current_ctc, expected_ctc, notice_period_days, skills, source, status) values
  ('Aarav Mehta',    'aarav.mehta@example.com',    '+91-9000000001', 'Flipkart',  'SDE 3',                 'Bengaluru', 5.5, 2400000, 3200000, 30, array['Go','Kubernetes','PostgreSQL'], 'linkedin', 'screened'),
  ('Diya Sharma',    'diya.sharma@example.com',    '+91-9000000002', 'Razorpay',  'Senior Product Manager','Bengaluru', 6.0, 3000000, 4000000, 60, array['Product','SQL','Roadmap'],       'referral', 'submitted'),
  ('Kabir Singh',    'kabir.singh@example.com',    '+91-9000000003', 'Swiggy',    'Backend Engineer',      'Hyderabad', 3.0, 1500000, 2200000, 30, array['Java','Spring','Kafka'],          'naukri',   'new')
on conflict do nothing;
