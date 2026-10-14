-- ============================================================================
-- demo_data.sql
-- A worked example dataset for a Gulf recruitment firm: clients, mandates,
-- candidates spread across every pipeline stage, interviews, placements with
-- revenue, staff with KPI targets, tasks and BD leads.
--
-- Properties worth knowing:
--   * Idempotent — it checks for existing clients and does nothing if the
--     instance already has data, so it is safe in a pre-deploy step.
--   * Dates are relative to now(), so dashboards and "last 30 days" reporting
--     always have something recent to show.
--   * The demo recruiter accounts cannot sign in. Their password hashes are
--     deliberately not valid bcrypt, so no password can ever match one.
--
-- Run with:  npm run db:demo        (or SEED_DEMO=1 on a Railway deploy)
-- ============================================================================

do $$
declare
  v_actor uuid;
begin
  if exists (select 1 from public.clients) then
    raise notice 'demo data: instance already has clients - skipping';
    return;
  end if;

  -- Attribute everything to the first active profile so the audit trail and
  -- "created by" columns are not empty.
  select id into v_actor from public.profiles where status = 'active'
    order by created_at limit 1;
  perform set_config('app.profile_id', coalesce(v_actor::text, ''), true);

  -- ---------------------------------------------------------------------
  -- Demo recruiters. Sign-in is impossible: '!demo-no-login' is not a bcrypt
  -- hash, so verification always fails.
  -- ---------------------------------------------------------------------
  insert into public.app_users (email, password_hash) values
    ('amira.haddad@demo.invalid',  '!demo-no-login'),
    ('rashid.alfalasi@demo.invalid','!demo-no-login'),
    ('priya.nair@demo.invalid',    '!demo-no-login'),
    ('tomas.varga@demo.invalid',   '!demo-no-login')
  on conflict (email) do nothing;

  insert into public.profiles (user_id, email, full_name, status, role_id)
  select u.id, u.email, v.full_name, 'active',
         (select id from public.roles where name = v.role_name)
  from (values
    ('amira.haddad@demo.invalid',   'Amira Haddad',    'manager'),
    ('rashid.alfalasi@demo.invalid','Rashid Al Falasi','recruiter'),
    ('priya.nair@demo.invalid',     'Priya Nair',      'recruiter'),
    ('tomas.varga@demo.invalid',    'Tomas Varga',     'recruiter')
  ) as v(email, full_name, role_name)
  join public.app_users u on u.email = v.email::citext
  on conflict (email) do nothing;

  -- ---------------------------------------------------------------------
  -- Clients
  -- ---------------------------------------------------------------------
  insert into public.clients
    (name, industry, location, status, website, company_size, contract_type,
     replacement_period_days, payment_terms_days, commercial_terms, created_by,
     account_owner_id)
  select v.name, v.industry, v.location, v.status, v.website, v.size,
         v.contract, v.replacement, v.terms, v.commercial, v_actor,
         (select id from public.profiles where full_name = v.owner)
  from (values
    ('Falcon Capital',        'Banking & Finance', 'Dubai',     'active',   'https://falconcapital.example.ae', '500-1000', 'retained',   90, 30, '18% of annual CTC, 90-day replacement', 'Amira Haddad'),
    ('Jumeirah Health Group', 'Healthcare',        'Dubai',     'active',   'https://jhg.example.ae',           '1000+',    'contingent', 60, 45, '15% of annual CTC',                     'Priya Nair'),
    ('Desert Logistics',      'Logistics',         'Jebel Ali', 'active',   'https://desertlog.example.ae',     '200-500',  'contingent', 60, 30, '12.5% of annual CTC',                   'Rashid Al Falasi'),
    ('Emirates Retail Group', 'Retail',            'Dubai',     'active',   'https://erg.example.ae',           '1000+',    'contingent', 45, 60, '12% of annual CTC',                     'Tomas Varga'),
    ('Gulf Energy Partners',  'Energy',            'Abu Dhabi', 'active',   'https://gulfenergy.example.ae',    '500-1000', 'retained',   90, 30, '20% of annual CTC, exclusive',          'Amira Haddad'),
    ('Nakheel Properties',    'Real Estate',       'Dubai',     'dormant',  'https://nakheelp.example.ae',      '200-500',  'contingent', 60, 45, '15% of annual CTC',                     'Priya Nair'),
    ('Oasis Fintech',         'Fintech',           'Abu Dhabi', 'prospect', 'https://oasisfin.example.ae',      '50-200',   null,         null, null, null,                                 'Rashid Al Falasi'),
    ('Marina Hospitality',    'Hospitality',       'Dubai',     'prospect', 'https://marinahg.example.ae',      '500-1000', null,         null, null, null,                                 'Tomas Varga')
  ) as v(name, industry, location, status, website, size, contract, replacement, terms, commercial, owner);

  insert into public.client_contacts (client_id, name, designation, email, phone, is_primary)
  select c.id, v.name, v.designation, v.email::citext, v.phone, v.is_primary
  from (values
    ('Falcon Capital',        'Hind Al Mazrouei', 'Head of Talent',     'hind@falconcapital.example.ae', '+971-4-555-0101', true),
    ('Falcon Capital',        'Daniel Okafor',    'HR Business Partner','daniel@falconcapital.example.ae','+971-4-555-0102', false),
    ('Jumeirah Health Group', 'Dr. Leila Rahimi', 'Chief People Officer','leila@jhg.example.ae',         '+971-4-555-0201', true),
    ('Desert Logistics',      'Marcus Weber',     'Operations Director','marcus@desertlog.example.ae',   '+971-4-555-0301', true),
    ('Emirates Retail Group', 'Sana Qureshi',     'Talent Acquisition Lead','sana@erg.example.ae',       '+971-4-555-0401', true),
    ('Gulf Energy Partners',  'Khalid Al Suwaidi','VP Human Capital',   'khalid@gulfenergy.example.ae',  '+971-2-555-0501', true)
  ) as v(client, name, designation, email, phone, is_primary)
  join public.clients c on c.name = v.client;

  -- ---------------------------------------------------------------------
  -- Staff (internal team), linked to the demo recruiter profiles
  -- ---------------------------------------------------------------------
  insert into public.staff
    (profile_id, full_name, email, phone, designation, department, joining_date,
     employment_status, salary, incentive_structure)
  select (select id from public.profiles where full_name = v.full_name),
         v.full_name, v.email::citext, v.phone, v.designation, v.department,
         (current_date - v.tenure_days), 'active', v.salary, v.incentive
  from (values
    ('Amira Haddad',     'amira.haddad@demo.invalid',   '+971-50-555-0011', 'Recruitment Manager',  'Delivery', 980, 32000, '10% of billed revenue above target'),
    ('Rashid Al Falasi', 'rashid.alfalasi@demo.invalid','+971-50-555-0012', 'Senior Recruiter',     'Delivery', 610, 21000, '8% of billed revenue above target'),
    ('Priya Nair',       'priya.nair@demo.invalid',     '+971-50-555-0013', 'Senior Recruiter',     'Delivery', 455, 20000, '8% of billed revenue above target'),
    ('Tomas Varga',      'tomas.varga@demo.invalid',    '+971-50-555-0014', 'Recruitment Consultant','Delivery', 180, 14000, '6% of billed revenue above target')
  ) as v(full_name, email, phone, designation, department, tenure_days, salary, incentive);

  -- Everyone reports to the manager.
  update public.staff
  set manager_id = (select id from public.staff where full_name = 'Amira Haddad')
  where full_name <> 'Amira Haddad';

  -- ---------------------------------------------------------------------
  -- Job requirements
  -- ---------------------------------------------------------------------
  insert into public.job_requirements
    (client_id, title, department, location, work_mode, employment_type, openings,
     min_experience_years, max_experience_years, min_salary, max_salary,
     required_skills, good_to_have_skills, description, priority, status,
     target_closure_date, created_by)
  select c.id, v.title, v.department, v.location, v.work_mode, v.employment_type,
         v.openings, v.min_exp, v.max_exp, v.min_salary, v.max_salary,
         v.required, v.nice_to_have, v.description, v.priority, v.status,
         (current_date + v.closes_in_days), v_actor
  from (values
    ('Falcon Capital',        'Senior Credit Risk Analyst',   'Risk',        'Dubai',     'hybrid', 'full_time', 2, 5, 9,  280000, 360000, array['Credit Risk','IFRS 9','SQL'],            array['Python','Moody''s'],      'Second-line credit risk for the corporate book.',        'high',   'open',    35),
    ('Falcon Capital',        'Head of Compliance',           'Legal',       'Dubai',     'onsite', 'full_time', 1, 10, 15, 520000, 680000, array['AML','Regulatory Reporting','CBUAE'],    array['ACAMS'],                  'Owns the compliance function and regulator relationship.','urgent', 'open',    21),
    ('Jumeirah Health Group', 'Clinical Operations Manager',  'Operations',  'Dubai',     'onsite', 'full_time', 1, 7, 12,  300000, 400000, array['Clinical Ops','JCI','Rostering'],        array['DHA licence'],            'Runs day-to-day clinical operations across two sites.',  'high',   'open',    40),
    ('Jumeirah Health Group', 'Registered Nurse - ICU',       'Nursing',     'Dubai',     'onsite', 'full_time', 6, 3, 8,   120000, 168000, array['ICU','BLS','ACLS'],                      array['DHA licence'],            'Six ICU beds opening in Q1.',                            'normal', 'open',    60),
    ('Desert Logistics',      'Warehouse Operations Lead',    'Operations',  'Jebel Ali', 'onsite', 'full_time', 2, 4, 8,   140000, 190000, array['WMS','Lean','Safety'],                   array['Six Sigma'],              'Leads the night shift at the Jebel Ali hub.',            'normal', 'open',    45),
    ('Desert Logistics',      'Supply Chain Analyst',         'Planning',    'Dubai',     'hybrid', 'full_time', 1, 2, 5,   110000, 150000, array['SQL','Excel','Forecasting'],             array['Power BI'],               'Demand planning and network optimisation.',              'low',    'on_hold', 70),
    ('Emirates Retail Group', 'Head of E-commerce',           'Digital',     'Dubai',     'hybrid', 'full_time', 1, 8, 14,  420000, 540000, array['E-commerce','P&L','Growth'],             array['Shopify Plus'],           'Owns the online P&L across five brands.',                'urgent', 'open',    28),
    ('Emirates Retail Group', 'Visual Merchandiser',          'Retail',      'Dubai',     'onsite', 'full_time', 3, 2, 6,    90000, 130000, array['Visual Merchandising','Styling'],        array['Mall retail'],            'Flagship store refresh programme.',                      'normal', 'open',    50),
    ('Gulf Energy Partners',  'Process Safety Engineer',      'HSE',         'Abu Dhabi', 'onsite', 'full_time', 2, 6, 11,  330000, 430000, array['HAZOP','Process Safety','PHA'],          array['ADNOC experience'],       'Process safety across two downstream assets.',           'high',   'open',    38),
    ('Gulf Energy Partners',  'Senior Data Engineer',         'Technology',  'Abu Dhabi', 'hybrid', 'full_time', 1, 5, 9,   310000, 400000, array['Python','Airflow','Snowflake'],          array['dbt','Kafka'],            'Builds the production data platform.',                   'high',   'open',    42),
    ('Nakheel Properties',    'Leasing Manager',              'Commercial',  'Dubai',     'onsite', 'full_time', 1, 5, 10,  230000, 300000, array['Leasing','Negotiation','RERA'],          array['Retail leasing'],         'Community retail leasing portfolio.',                    'normal', 'closed',  -10),
    ('Falcon Capital',        'Treasury Dealer',              'Treasury',    'Dubai',     'onsite', 'full_time', 1, 4, 8,   260000, 340000, array['FX','Money Markets','Bloomberg'],        array['CFA'],                    'Covers FX and MM for corporate clients.',                'normal', 'filled',  -5)
  ) as v(client, title, department, location, work_mode, employment_type, openings,
         min_exp, max_exp, min_salary, max_salary, required, nice_to_have,
         description, priority, status, closes_in_days)
  join public.clients c on c.name = v.client;

  raise notice 'demo data: clients, staff and jobs created';
end$$;

-- ============================================================================
-- Candidates, pipeline, interviews, placements, tasks and BD
-- ============================================================================
do $$
declare
  v_actor uuid;
begin
  if exists (select 1 from public.candidates) then
    raise notice 'demo data: instance already has candidates - skipping';
    return;
  end if;

  select id into v_actor from public.profiles where status = 'active'
    order by created_at limit 1;
  perform set_config('app.profile_id', coalesce(v_actor::text, ''), true);

  -- ---------------------------------------------------------------------
  -- Candidates. created_at is backdated so "added in the last 30 days"
  -- reporting has a realistic spread.
  -- ---------------------------------------------------------------------
  insert into public.candidates
    (full_name, email, phone, current_company, current_designation, current_location,
     preferred_location, total_experience_years, relevant_experience_years,
     current_ctc, expected_ctc, notice_period_days, skills, industry, source,
     status, assigned_recruiter_id, created_by, created_at, notes)
  select v.full_name, v.email::citext, v.phone, v.company, v.designation, v.location,
         v.preferred, v.total_exp, v.rel_exp, v.current_ctc, v.expected_ctc,
         v.notice, v.skills, v.industry, v.source, v.status,
         (select id from public.profiles where full_name = v.recruiter),
         v_actor, now() - (v.added_days_ago || ' days')::interval, v.notes
  from (values
    ('Yusuf Rahman',      'yusuf.rahman@example.ae',   '+971-50-100-0001', 'Mashreq Bank',        'Credit Risk Analyst',       'Dubai',     'Dubai',     6.5, 6.0, 265000, 320000, 30, array['Credit Risk','IFRS 9','SQL'],           'Banking & Finance', 'linkedin',   'submitted',             'Rashid Al Falasi',  3,  'Strong IFRS 9 exposure.'),
    ('Elena Petrova',     'elena.petrova@example.ae',  '+971-50-100-0002', 'Emirates NBD',        'Senior Risk Analyst',       'Dubai',     'Dubai',     8.0, 7.0, 310000, 365000, 60, array['Credit Risk','Python','Moody''s'],      'Banking & Finance', 'referral',   'interview_in_progress', 'Rashid Al Falasi',  12, 'Referred by a placed candidate.'),
    ('Omar Siddiqui',     'omar.siddiqui@example.ae',  '+971-50-100-0003', 'ADCB',                'Compliance Lead',           'Abu Dhabi', 'Dubai',     12.0, 10.0, 480000, 620000, 90, array['AML','Regulatory Reporting','CBUAE'],  'Banking & Finance', 'linkedin',   'offered',               'Amira Haddad',      22, 'ACAMS certified.'),
    ('Fatima Al Marri',   'fatima.almarri@example.ae', '+971-50-100-0004', 'Cleveland Clinic AD', 'Clinical Operations Lead',  'Abu Dhabi', 'Dubai',     9.0, 8.0, 295000, 360000, 60, array['Clinical Ops','JCI','Rostering'],      'Healthcare',        'linkedin',   'shortlisted',           'Priya Nair',        8,  null),
    ('Grace Mwangi',      'grace.mwangi@example.ae',   '+971-50-100-0005', 'Mediclinic',          'ICU Charge Nurse',          'Dubai',     'Dubai',     7.0, 7.0, 142000, 165000, 30, array['ICU','BLS','ACLS'],                    'Healthcare',        'naukri',     'screened',              'Priya Nair',        5,  'DHA licence in progress.'),
    ('Arjun Menon',       'arjun.menon@example.ae',    '+971-50-100-0006', 'NMC Healthcare',      'Staff Nurse - ICU',         'Sharjah',   'Dubai',     4.0, 4.0, 118000, 140000, 30, array['ICU','BLS'],                           'Healthcare',        'naukri',     'new',                   'Priya Nair',        2,  null),
    ('Sofia Haddad',      'sofia.haddad@example.ae',   '+971-50-100-0007', 'Aster DM',            'ICU Nurse',                 'Dubai',     'Dubai',     5.5, 5.0, 128000, 150000, 60, array['ICU','ACLS'],                          'Healthcare',        'referral',   'screened',              'Priya Nair',        9,  null),
    ('Daniel Fernandes',  'daniel.fernandes@example.ae','+971-50-100-0008','Agility',             'Warehouse Supervisor',      'Dubai',     'Jebel Ali', 6.0, 5.0, 132000, 165000, 30, array['WMS','Lean','Safety'],                 'Logistics',         'internal_db','submitted',             'Tomas Varga',       15, null),
    ('Ahmed Khalifa',     'ahmed.khalifa@example.ae',  '+971-50-100-0009', 'DP World',            'Operations Lead',           'Dubai',     'Jebel Ali', 8.0, 7.5, 158000, 185000, 60, array['WMS','Safety','Six Sigma'],            'Logistics',         'linkedin',   'interview_in_progress', 'Tomas Varga',       18, 'Six Sigma Green Belt.'),
    ('Nadia Hassan',      'nadia.hassan@example.ae',   '+971-50-100-0010', 'Aramex',              'Supply Chain Analyst',      'Dubai',     'Dubai',     3.5, 3.0, 102000, 135000, 30, array['SQL','Excel','Forecasting','Power BI'],'Logistics',         'linkedin',   'on_hold',               'Tomas Varga',       26, 'Role on hold client-side.'),
    ('James Whitfield',   'james.whitfield@example.ae','+971-50-100-0011', 'Chalhoub Group',      'Head of Digital',           'Dubai',     'Dubai',     11.0, 9.0, 445000, 540000, 90, array['E-commerce','P&L','Growth'],           'Retail',            'linkedin',   'interview_in_progress', 'Amira Haddad',      20, 'Managed a USD 60m online P&L.'),
    ('Reem Al Shamsi',    'reem.alshamsi@example.ae',  '+971-50-100-0012', 'Majid Al Futtaim',    'E-commerce Director',       'Dubai',     'Dubai',     10.0, 8.0, 420000, 500000, 60, array['E-commerce','Growth','Shopify Plus'],  'Retail',            'referral',   'shortlisted',           'Amira Haddad',      11, null),
    ('Leon Carter',       'leon.carter@example.ae',    '+971-50-100-0013', 'Landmark Group',      'Visual Merchandiser',       'Dubai',     'Dubai',     4.0, 4.0,  88000, 115000, 30, array['Visual Merchandising','Styling'],      'Retail',            'website',    'new',                   'Tomas Varga',       1,  null),
    ('Mariam Juma',       'mariam.juma@example.ae',    '+971-50-100-0014', 'Apparel Group',       'Senior VM',                 'Sharjah',   'Dubai',     6.0, 5.5, 104000, 128000, 30, array['Visual Merchandising','Retail'],       'Retail',            'naukri',     'screened',              'Tomas Varga',       6,  null),
    ('Viktor Ilyin',      'viktor.ilyin@example.ae',   '+971-50-100-0015', 'ADNOC',               'Process Safety Engineer',   'Abu Dhabi', 'Abu Dhabi', 9.0, 8.0, 320000, 395000, 90, array['HAZOP','Process Safety','PHA'],        'Energy',            'linkedin',   'submitted',             'Amira Haddad',      14, 'Direct ADNOC experience.'),
    ('Sara Boutros',      'sara.boutros@example.ae',   '+971-50-100-0016', 'Petrofac',            'HSE Engineer',              'Abu Dhabi', 'Abu Dhabi', 7.0, 6.0, 285000, 350000, 60, array['Process Safety','HAZOP'],              'Energy',            'linkedin',   'shortlisted',           'Amira Haddad',      17, null),
    ('Rohan Desai',       'rohan.desai@example.ae',    '+971-50-100-0017', 'Careem',              'Senior Data Engineer',      'Dubai',     'Abu Dhabi', 7.0, 6.0, 295000, 370000, 60, array['Python','Airflow','Snowflake','dbt'],  'Technology',        'linkedin',   'offered',               'Rashid Al Falasi',  24, 'Two competing offers.'),
    ('Aisha Bello',       'aisha.bello@example.ae',    '+971-50-100-0018', 'Noon',                'Data Engineer',             'Dubai',     'Abu Dhabi', 5.0, 4.5, 245000, 310000, 30, array['Python','Airflow','Kafka'],            'Technology',        'referral',   'screened',              'Rashid Al Falasi',  7,  null),
    ('Marco Rossi',       'marco.rossi@example.ae',    '+971-50-100-0019', 'Emaar',               'Leasing Manager',           'Dubai',     'Dubai',     9.0, 8.0, 240000, 290000, 60, array['Leasing','Negotiation','RERA'],        'Real Estate',       'linkedin',   'joined',                'Priya Nair',        85, 'Placed at Nakheel.'),
    ('Hana Tsegaye',      'hana.tsegaye@example.ae',   '+971-50-100-0020', 'Standard Chartered',  'FX Dealer',                 'Dubai',     'Dubai',     6.0, 6.0, 255000, 310000, 30, array['FX','Money Markets','Bloomberg'],      'Banking & Finance', 'linkedin',   'joined',                'Rashid Al Falasi',  70, 'Placed at Falcon Capital.'),
    ('Peter Nowak',       'peter.nowak@example.ae',    '+971-50-100-0021', 'Dubai Holding',       'Treasury Analyst',          'Dubai',     'Dubai',     5.0, 4.0, 210000, 265000, 60, array['FX','Bloomberg'],                      'Banking & Finance', 'other',      'rejected',              'Rashid Al Falasi',  33, 'Client wanted more dealing experience.'),
    ('Lina Farouk',       'lina.farouk@example.ae',    '+971-50-100-0022', 'Al Tayer',            'Merchandising Manager',     'Dubai',     'Dubai',     8.0, 7.0, 190000, 240000, 60, array['Merchandising','Buying'],              'Retail',            'linkedin',   'not_interested',        'Tomas Varga',       40, 'Counter-offered.'),
    ('Ibrahim Toure',     'ibrahim.toure@example.ae',  '+971-50-100-0023', 'RTA',                 'Operations Analyst',        'Dubai',     'Dubai',     4.5, 3.5, 125000, 160000, 30, array['Excel','Forecasting'],                 'Logistics',         'website',    'new',                   'Tomas Varga',       4,  null),
    ('Claire Dubois',     'claire.dubois@example.ae',  '+971-50-100-0024', 'Jumeirah Group',      'Guest Relations Manager',   'Dubai',     'Dubai',     7.0, 6.0, 165000, 200000, 30, array['Hospitality','CRM'],                   'Hospitality',       'referral',   'new',                   'Priya Nair',        2,  'Speculative - for Marina Hospitality.')
  ) as v(full_name, email, phone, company, designation, location, preferred,
         total_exp, rel_exp, current_ctc, expected_ctc, notice, skills, industry,
         source, status, recruiter, added_days_ago, notes);

  -- ---------------------------------------------------------------------
  -- Pipeline: candidates attached to jobs, spread across stages
  -- ---------------------------------------------------------------------
  insert into public.candidate_job_pipeline
    (candidate_id, job_id, client_id, assigned_recruiter_id, current_stage,
     submitted_at, last_activity_at, next_follow_up_at, offer_amount,
     is_active, created_by, created_at)
  select cand.id, job.id, job.client_id, cand.assigned_recruiter_id, v.stage,
         case when v.submitted_days_ago is null then null
              else now() - (v.submitted_days_ago || ' days')::interval end,
         now() - (v.activity_days_ago || ' days')::interval,
         case when v.follow_up_in_days is null then null
              else now() + (v.follow_up_in_days || ' days')::interval end,
         v.offer_amount,
         case when v.stage in ('rejected', 'joined') then false else true end,
         v_actor,
         now() - (v.activity_days_ago || ' days')::interval
  from (values
    ('yusuf.rahman@example.ae',    'Senior Credit Risk Analyst',  'submitted',          2,    1,  3,    null),
    ('elena.petrova@example.ae',   'Senior Credit Risk Analyst',  'interview_round_1',  9,    2,  2,    null),
    ('omar.siddiqui@example.ae',   'Head of Compliance',          'offer_released',     18,   3,  2,    610000),
    ('fatima.almarri@example.ae',  'Clinical Operations Manager', 'client_shortlisted', 6,    2,  4,    null),
    ('grace.mwangi@example.ae',    'Registered Nurse - ICU',      'screened',           null, 4,  5,    null),
    ('sofia.haddad@example.ae',    'Registered Nurse - ICU',      'shortlisted',        null, 3,  3,    null),
    ('arjun.menon@example.ae',     'Registered Nurse - ICU',      'sourced',            null, 1,  2,    null),
    ('daniel.fernandes@example.ae','Warehouse Operations Lead',   'submitted',          5,    2,  3,    null),
    ('ahmed.khalifa@example.ae',   'Warehouse Operations Lead',   'final_interview',    14,   1,  1,    null),
    ('nadia.hassan@example.ae',    'Supply Chain Analyst',        'on_hold',            20,   12, null, null),
    ('james.whitfield@example.ae', 'Head of E-commerce',          'interview_round_2',  16,   2,  2,    null),
    ('reem.alshamsi@example.ae',   'Head of E-commerce',          'client_shortlisted', 8,    3,  4,    null),
    ('mariam.juma@example.ae',     'Visual Merchandiser',         'screened',           null, 5,  6,    null),
    ('leon.carter@example.ae',     'Visual Merchandiser',         'sourced',            null, 1,  3,    null),
    ('viktor.ilyin@example.ae',    'Process Safety Engineer',     'submitted',          4,    2,  3,    null),
    ('sara.boutros@example.ae',    'Process Safety Engineer',     'shortlisted',        null, 6,  5,    null),
    ('rohan.desai@example.ae',     'Senior Data Engineer',        'offer_discussion',   21,   1,  1,    365000),
    ('aisha.bello@example.ae',     'Senior Data Engineer',        'screened',           null, 4,  4,    null),
    ('peter.nowak@example.ae',     'Treasury Dealer',             'rejected',           28,   22, null, null),
    ('marco.rossi@example.ae',     'Leasing Manager',             'joined',             80,   60, null, 285000),
    ('hana.tsegaye@example.ae',    'Treasury Dealer',             'joined',             65,   48, null, 300000)
  ) as v(email, job_title, stage, submitted_days_ago, activity_days_ago,
         follow_up_in_days, offer_amount)
  join public.candidates cand on cand.email = v.email::citext
  join public.job_requirements job on job.title = v.job_title;

  raise notice 'demo data: candidates and pipeline created';
end$$;

-- ============================================================================
-- Interviews, placements, KPI targets, tasks and business development
-- ============================================================================
do $$
declare
  v_actor uuid;
begin
  if exists (select 1 from public.interviews) or exists (select 1 from public.bd_leads) then
    raise notice 'demo data: activity already present - skipping';
    return;
  end if;

  select id into v_actor from public.profiles where status = 'active'
    order by created_at limit 1;
  perform set_config('app.profile_id', coalesce(v_actor::text, ''), true);

  -- ---------------------------------------------------------------------
  -- Interviews: a mix of completed rounds with feedback and upcoming slots
  -- ---------------------------------------------------------------------
  insert into public.interviews
    (pipeline_id, candidate_id, job_id, client_id, round_label, interview_type,
     scheduled_at, duration_minutes, interviewer_name, interviewer_email,
     meeting_link, location, status, outcome, feedback, rating, next_step,
     scheduled_by, created_at)
  select p.id, cand.id, job.id, job.client_id, v.round_label, v.interview_type,
         now() + (v.scheduled_in_days || ' days')::interval, v.duration,
         v.interviewer, v.interviewer_email::citext, v.meeting_link, v.location,
         v.status, v.outcome, v.feedback, v.rating, v.next_step,
         cand.assigned_recruiter_id,
         now() - (v.created_days_ago || ' days')::interval
  from (values
    ('elena.petrova@example.ae',   'Senior Credit Risk Analyst',  'Round 1 - Hiring Manager', 'video',     -6,  45, 'Hind Al Mazrouei', 'hind@falconcapital.example.ae',  'https://meet.example.com/fc-risk-1', null,        'completed', 'selected', 'Excellent IFRS 9 depth. Walked through a provisioning model end to end.', 5, 'Schedule panel round',     12),
    ('elena.petrova@example.ae',   'Senior Credit Risk Analyst',  'Round 2 - Panel',          'in_person', 3,   90, 'Daniel Okafor',    'daniel@falconcapital.example.ae', null,                                'DIFC Office','scheduled', null,       null,                                                                      null, null,                       2),
    ('omar.siddiqui@example.ae',   'Head of Compliance',          'Final - CEO',              'in_person', -9,  60, 'Hind Al Mazrouei', 'hind@falconcapital.example.ae',  null,                                'DIFC Office','completed', 'selected', 'Regulator relationships are a clear strength. Offer approved at AED 610k.', 5, 'Release offer',            9),
    ('ahmed.khalifa@example.ae',   'Warehouse Operations Lead',   'Final - Site Visit',       'in_person', 2,   120,'Marcus Weber',     'marcus@desertlog.example.ae',    null,                                'Jebel Ali', 'scheduled', null,       null,                                                                      null, null,                       2),
    ('james.whitfield@example.ae', 'Head of E-commerce',          'Round 2 - Commercial',     'video',     -3,  60, 'Sana Qureshi',     'sana@erg.example.ae',            'https://meet.example.com/erg-ecom',  null,        'completed', 'on_hold',  'Strong growth record; client comparing against one internal candidate.',   4, 'Await client decision',    3),
    ('james.whitfield@example.ae', 'Head of E-commerce',          'Final - CEO',              'video',     5,   45, 'Sana Qureshi',     'sana@erg.example.ae',            'https://meet.example.com/erg-final', null,        'scheduled', null,       null,                                                                      null, null,                       1),
    ('fatima.almarri@example.ae',  'Clinical Operations Manager', 'Round 1 - CPO',            'video',     1,   45, 'Dr. Leila Rahimi', 'leila@jhg.example.ae',           'https://meet.example.com/jhg-ops',   null,        'scheduled', null,       null,                                                                      null, null,                       4),
    ('rohan.desai@example.ae',     'Senior Data Engineer',        'Technical Round',          'video',     -11, 90, 'Khalid Al Suwaidi','khalid@gulfenergy.example.ae',   'https://meet.example.com/gep-data',  null,        'completed', 'selected', 'Designed a solid incremental ingestion pattern under time pressure.',      5, 'Offer discussion',         11),
    ('peter.nowak@example.ae',     'Treasury Dealer',             'Round 1 - Desk Head',      'phone',     -24, 30, 'Hind Al Mazrouei', 'hind@falconcapital.example.ae',  null,                                null,        'completed', 'rejected', 'Limited live dealing exposure for the mandate.',                           2, 'Keep warm for junior desk',24),
    ('sara.boutros@example.ae',    'Process Safety Engineer',     'Screening',                'phone',     -2,  30, 'Khalid Al Suwaidi','khalid@gulfenergy.example.ae',   null,                                null,        'completed', 'pending',  'Good HAZOP exposure; awaiting client feedback on the shortlist.',          4, 'Client review',            2)
  ) as v(email, job_title, round_label, interview_type, scheduled_in_days, duration,
         interviewer, interviewer_email, meeting_link, location, status, outcome,
         feedback, rating, next_step, created_days_ago)
  join public.candidates cand on cand.email = v.email::citext
  join public.job_requirements job on job.title = v.job_title
  left join public.candidate_job_pipeline p
    on p.candidate_id = cand.id and p.job_id = job.id;

  -- ---------------------------------------------------------------------
  -- Placements: billed history plus one joining this month
  -- ---------------------------------------------------------------------
  insert into public.placements
    (candidate_id, client_id, job_id, pipeline_id, recruiter_id, offered_designation,
     offered_ctc, billing_percentage, placement_revenue, joining_date,
     replacement_period_days, replacement_end_date, invoice_status, payment_status,
     invoice_number, invoice_date, invoice_amount, payment_received_date,
     status, joining_status, created_by, created_at)
  select cand.id, job.client_id, job.id, p.id, cand.assigned_recruiter_id,
         v.designation, v.offered_ctc, v.billing_pct,
         round(v.offered_ctc * v.billing_pct / 100.0), (current_date - v.joined_days_ago),
         90, (current_date - v.joined_days_ago + 90), v.invoice_status, v.payment_status,
         v.invoice_number,
         case when v.invoice_number is null then null
              else (current_date - v.joined_days_ago + 2) end,
         case when v.invoice_number is null then null
              else round(v.offered_ctc * v.billing_pct / 100.0) end,
         v.payment_date,
         v.status, v.joining_status, v_actor,
         now() - (v.joined_days_ago || ' days')::interval
  from (values
    ('marco.rossi@example.ae',  'Leasing Manager',   'Leasing Manager',     285000, 15.0,  95, 'INV-2026-0041', (current_date - 60), 'paid',   'received', 'joined',         'joined'),
    ('hana.tsegaye@example.ae', 'Treasury Dealer',   'Treasury Dealer',     300000, 18.0,   8, 'INV-2026-0052', null,                'raised', 'pending',  'joined',         'joined'),
    -- Offer accepted, joining later this month: no invoice yet.
    ('omar.siddiqui@example.ae','Head of Compliance','Head of Compliance',  610000, 20.0, -12, null,            null,                'not_raised','pending','offer_accepted', 'pending')
  ) as v(email, job_title, designation, offered_ctc, billing_pct, joined_days_ago,
         invoice_number, payment_date, invoice_status, payment_status, status, joining_status)
  join public.candidates cand on cand.email = v.email::citext
  join public.job_requirements job on job.title = v.job_title
  left join public.candidate_job_pipeline p
    on p.candidate_id = cand.id and p.job_id = job.id;

  -- ---------------------------------------------------------------------
  -- KPI targets for the current month
  -- ---------------------------------------------------------------------
  insert into public.kpi_targets (staff_id, period, period_start, metric_key, target_value)
  select s.id, 'monthly', date_trunc('month', current_date)::date, v.metric_key, v.target
  from (values
    ('Amira Haddad',     'candidates_added', 20),
    ('Amira Haddad',     'submissions',      12),
    ('Amira Haddad',     'interviews',        8),
    ('Amira Haddad',     'placements',        3),
    ('Amira Haddad',     'revenue',      180000),
    ('Rashid Al Falasi', 'candidates_added', 25),
    ('Rashid Al Falasi', 'submissions',      15),
    ('Rashid Al Falasi', 'placements',        2),
    ('Rashid Al Falasi', 'revenue',      120000),
    ('Priya Nair',       'candidates_added', 25),
    ('Priya Nair',       'submissions',      15),
    ('Priya Nair',       'placements',        2),
    ('Priya Nair',       'revenue',      110000),
    ('Tomas Varga',      'candidates_added', 30),
    ('Tomas Varga',      'submissions',      18),
    ('Tomas Varga',      'placements',        2),
    ('Tomas Varga',      'revenue',       90000)
  ) as v(staff_name, metric_key, target)
  join public.staff s on s.full_name = v.staff_name
  on conflict (staff_id, period, period_start, metric_key) do nothing;

  -- ---------------------------------------------------------------------
  -- Tasks: a believable follow-up list, including a couple already overdue
  -- ---------------------------------------------------------------------
  insert into public.tasks
    (title, description, related_entity_type, related_entity_id, assigned_to_id,
     due_at, priority, status, created_by)
  select v.title, v.description, 'candidate', cand.id,
         cand.assigned_recruiter_id,
         now() + (v.due_in_days || ' days')::interval, v.priority, v.status, v_actor
  from (values
    ('Chase offer acceptance',        'Falcon Capital offer released - confirm signature.',        'omar.siddiqui@example.ae',   -2, 'urgent', 'overdue'),
    ('Collect DHA licence documents', 'Needed before the client will progress the shortlist.',     'grace.mwangi@example.ae',    -1, 'high',   'overdue'),
    ('Prep candidate for panel',      'Second round with the DIFC panel on Thursday.',             'elena.petrova@example.ae',    2, 'high',   'pending'),
    ('Counter-offer check-in',        'Two competing offers - hold weekly contact until joining.', 'rohan.desai@example.ae',      1, 'urgent', 'in_progress'),
    ('Site visit logistics',          'Arrange Jebel Ali gate pass for the final stage.',          'ahmed.khalifa@example.ae',    3, 'normal', 'pending'),
    ('Reference checks',              'Two professional references before the offer goes out.',    'james.whitfield@example.ae',  4, 'normal', 'pending'),
    ('Re-engage after hold',          'Client paused the role - revisit when it reopens.',         'nadia.hassan@example.ae',    10, 'low',    'pending'),
    ('Send ICU shortlist',            'Three profiles ready for the ICU mandate.',                 'sofia.haddad@example.ae',     1, 'high',   'pending')
  ) as v(title, description, email, due_in_days, priority, status)
  join public.candidates cand on cand.email = v.email::citext;

  -- ---------------------------------------------------------------------
  -- Business development
  -- ---------------------------------------------------------------------
  insert into public.bd_leads
    (company_name, contact_name, contact_email, contact_phone, industry, source,
     owner_id, stage, expected_value, next_follow_up_at, notes, created_by, created_at)
  select v.company, v.contact, v.email::citext, v.phone, v.industry, v.source,
         (select id from public.profiles where full_name = v.owner), v.stage,
         v.expected_value,
         case when v.follow_up_in_days is null then null
              else now() + (v.follow_up_in_days || ' days')::interval end,
         v.notes, v_actor, now() - (v.age_days || ' days')::interval
  from (values
    ('Azure Bay Resorts',    'Ivan Petrovic',   'ivan@azurebay.example.ae',   '+971-4-555-0601', 'Hospitality',   'linkedin',      'Tomas Varga',      'proposal_sent',     220000, 3,    'Proposal sent for a 12-role opening programme.', 24),
    ('Pearl Medical Centre', 'Dr. Anita Roy',   'anita@pearlmed.example.ae',  '+971-4-555-0602', 'Healthcare',    'referral',      'Priya Nair',        'negotiation',       180000, 2,    'Negotiating a 14% contingent rate.',             31),
    ('Horizon Islamic Bank', 'Salem Al Nuaimi', 'salem@horizonib.example.ae', '+971-2-555-0603', 'Banking & Finance','cold_outreach','Rashid Al Falasi','meeting_scheduled', 300000, 5,    'Intro meeting with the CHRO on Tuesday.',        12),
    ('Cobalt Industries',    'Ruth Mensah',     'ruth@cobaltind.example.ae',  '+971-4-555-0604', 'Manufacturing', 'event',         'Amira Haddad',      'contacted',         150000, 7,    'Met at the Gulf Manufacturing Summit.',          9),
    ('Skyline Interiors',    'Omar Zaid',       'omar@skylineint.example.ae', '+971-4-555-0605', 'Construction',  'website',       'Tomas Varga',       'new_lead',          95000,  4,    'Inbound enquiry via the website.',               3),
    ('Mirage Travel Group',  'Hana Al Amiri',   'hana@miragetravel.example.ae','+971-4-555-0606','Travel',        'linkedin',      'Priya Nair',        'nurture',           120000, 30,   'Revisit after their Q1 restructure.',            48),
    ('Vertex Advisory',      'Paul Brennan',    'paul@vertexadv.example.ae',  '+971-4-555-0607', 'Consulting',    'referral',      'Amira Haddad',      'lost',              140000, null, 'Went with an incumbent supplier.',               60)
  ) as v(company, contact, email, phone, industry, source, owner, stage,
         expected_value, follow_up_in_days, notes, age_days);

  insert into public.bd_activities (lead_id, author_id, activity_type, subject, body, occurred_at)
  select l.id, l.owner_id, v.activity_type, v.subject, v.body,
         now() - (v.days_ago || ' days')::interval
  from (values
    ('Azure Bay Resorts',    'meeting',       'Discovery call',        'Walked through the opening programme and headcount plan.', 10),
    ('Azure Bay Resorts',    'proposal_sent', 'Proposal sent',         'Sent the 12-role proposal at a 14% contingent rate.',       4),
    ('Pearl Medical Centre', 'call',          'Rate negotiation',      'They are pushing for 12%; held at 14% with a 90-day guarantee.', 2),
    ('Horizon Islamic Bank', 'email',         'Intro email',           'Introduced the desk and shared two recent banking placements.', 8),
    ('Cobalt Industries',    'note',          'Summit follow-up',      'Met at the Gulf Manufacturing Summit - send capability deck.',  6),
    ('Vertex Advisory',      'call',          'Outcome',               'Confirmed they renewed with their incumbent supplier.',        14)
  ) as v(company, activity_type, subject, body, days_ago)
  join public.bd_leads l on l.company_name = v.company;

  raise notice 'demo data: interviews, placements, tasks and BD created';
end$$;
