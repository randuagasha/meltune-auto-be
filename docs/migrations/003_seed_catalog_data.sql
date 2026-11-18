-- Migration 003: Seed initial services and products
-- Type: Additive (safe to re-run via ON CONFLICT DO NOTHING)
-- Apply via: Supabase SQL Editor or psql
-- Prerequisites: schema.sql + migration 001 + migration 002 must be applied first
--
-- Seeds the services and products catalog with the initial data
-- matching the mock fixtures so the live app starts with real data.

INSERT INTO services (id, name, category, description, price, estimated_duration_minutes, image_url, is_active)
VALUES
    ('srv_tuneup_adv', 'Advanced Engine Tune-Up & Calibration', 'maintenance',
     'Diagnostik komprehensif sistem injeksi, pembersihan throttle body, inspeksi busi, dan kalibrasi sensor ECU.',
     650000, 90, 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=800', TRUE),
    ('srv_oil_full_synth', 'Full Synthetic Fluid & Filter Service', 'maintenance',
     'Penggantian oli mesin full synthetic premium, filter oli OEM, gasket sumbatan, serta 24 poin cek keselamatan.',
     850000, 45, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800', TRUE),
    ('srv_brake_overhaul', 'Precision Brake System Overhaul', 'repair',
     'Pembersihan rotor & kaliper, penggantian kampas rem keramik OEM, flushing minyak rem DOT 4, dan bleeding rem vakum.',
     550000, 75, 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800', TRUE),
    ('srv_undercarriage', 'Suspension & Steering Laser Alignment', 'diagnostics',
     'Inspeksi tierod, balljoint, bushing, serta penyetelan sudut toe, camber, dan caster presisi komputasi digital.',
     450000, 60, 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800', TRUE),
    ('srv_ac_refresh', 'Climate System Purge & Anti-Bacterial Ozone', 'detailing',
     'Kuras freon kompresor, penggantian oli refrigeran PAG, pembersihan evaporator ultrasonik, dan sterilisasi kabin ozon.',
     500000, 60, 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800', TRUE),
    ('srv_dyno_check', 'ECU Scan & Electronic Fault Diagnostics', 'diagnostics',
     'Scanning protokol OBD-II mendalam, pembacaan parameter live engine, deteksi limp mode, dan reset DTC.',
     350000, 40, 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&q=80&w=800', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category, description, price, stock, image_url, is_available)
VALUES
    ('prd_motul_300v', 'Motul 300V Power 5W-40 (2L)', 'engine_oil',
     'Ester Core Technology untuk perlindungan termal maksimal mesin performa tinggi. Pengurangan friksi internal optimal.',
     680000, 18, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800', TRUE),
    ('prd_liquimoly_molygen', 'Liqui Moly Molygen New Generation 5W-30 (4L)', 'engine_oil',
     'Fluorescent green friction modifier berteknologi MFC (Molecular Friction Control) untuk efisiensi BBM dan keheningan katup.',
     890000, 14, 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=800', TRUE),
    ('prd_brembo_dot4', 'Brembo Premium Brake Fluid DOT 4 Low Viscosity (1L)', 'parts',
     'Titik didih basah tinggi (ERBP > 170°C) yang direkayasa khusus untuk kestabilan modul ABS dan ESP responsif.',
     175000, 32, 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800', TRUE),
    ('prd_meguiars_wash', 'Meguiar''s Gold Class Car Wash & Conditioner (1.89L)', 'car_care',
     'Formula busa kaya conditioner membersihkan kotoran jalanan tanpa melunturkan lapisan wax protektif cat bodi.',
     295000, 24, 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800', TRUE),
    ('prd_kn_cabin_filter', 'K&N Washable Cabin Air Filter (Universal Fit)', 'parts',
     'Media elektrostatis premium menangkap partikel debu, polutan micro-PM2.5, serta menyerap bau apek kabin.',
     650000, 9, 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&q=80&w=800', TRUE),
    ('prd_tire_gauge_digital', 'MELTUNE Digital Precision Tire Pressure Gauge (150 PSI)', 'accessories',
     'Sensor barometrik backlit digital dengan akurasi deviasi < 0.5 PSI. Pegangan ergonomis berfinishing anodized dark grey.',
     220000, 45, 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rewards (id, title, description, points_cost, stock, image_url, is_active)
VALUES
    ('rew_washer_fluid', 'Konsentrat Wiper Fluid Hydrophobic (250ml)',
     'Menolak tetesan air hujan pada kaca depan dan mencegah kerak air wiper.',
     75, 28, 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&q=80&w=800', TRUE),
    ('rew_microfiber_pack', 'Paket Microfiber Edgeless 500 GSM (3 Pcs)',
     'Serat ultra-halus untuk finishing detailing tanpa swirl mark dan daya serap tinggi.',
     120, 19, 'https://images.unsplash.com/photo-1600790142055-619df03207e6?auto=format&fit=crop&q=80&w=800', TRUE),
    ('rew_tire_gel', 'MELTUNE Satin Black Tire Dressing Gel (300ml)',
     'Kilap alami satin deep black tahan air, tidak mengotori fender mobil saat kecepatan tinggi.',
     180, 14, 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&q=80&w=800', TRUE),
    ('rew_oil_1l', 'Motul Synthetic Maintenance Engine Oil (1L)',
     'Oli top-up cadangan spesifikasi SAE 5W-30 SN/GF-5 dalam kemasan botol kedap.',
     300, 8, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800', TRUE)
ON CONFLICT (id) DO NOTHING;
