-- Create test users in auth.users
-- Password is 'password123' for all users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'player@elpotrero.ar', crypt('password123', gen_salt('bf')), NOW(), '{"full_name": "Juan Jugador"}', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@laredonda.com', crypt('password123', gen_salt('bf')), NOW(), '{"full_name": "Carlos Admin"}', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform@elpotrero.ar', crypt('password123', gen_salt('bf')), NOW(), '{"full_name": "Admin Plataforma"}', NOW(), NOW());

-- Update profiles with roles (profiles were created by trigger)
UPDATE public.profiles SET role = 'player' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'venue_admin' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET role = 'platform_admin' WHERE id = '00000000-0000-0000-0000-000000000003';

-- 5 Venues
INSERT INTO public.venues (id, owner_id, name, description, address, city, latitude, longitude, phone, amenities, photos, opening_hours)
VALUES 
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'La Redonda Fútbol', 'El mejor predio de la ciudad.', 'Calle 13 e/ 63 y 64', 'La Plata', -34.9205, -57.9536, '2214445555', '{"Parrilla", "Estacionamiento", "Buffet"}', '{"https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=800&auto=format&fit=crop"}', '{"0": {"open": "10:00", "close": "23:00"}, "1": {"open": "10:00", "close": "23:00"}, "2": {"open": "10:00", "close": "23:00"}, "3": {"open": "10:00", "close": "23:00"}, "4": {"open": "10:00", "close": "23:00"}, "5": {"open": "10:00", "close": "23:00"}, "6": {"open": "10:00", "close": "23:00"}}'),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'Complejo Maradona', 'Canchas sintéticas nuevas.', 'Calle 7 e/ 50 y 51', 'La Plata', -34.9110, -57.9480, '2214446666', '{"Vestuarios", "Duchas"}', '{"https://placehold.co/800x400/e4e4e7/000000?text=Complejo+Maradona"}', '{"0": {"open": "09:00", "close": "00:00"}, "1": {"open": "09:00", "close": "00:00"}, "2": {"open": "09:00", "close": "00:00"}, "3": {"open": "09:00", "close": "00:00"}, "4": {"open": "09:00", "close": "00:00"}, "5": {"open": "09:00", "close": "00:00"}, "6": {"open": "09:00", "close": "00:00"}}'),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000002', 'El Gol de Todos', 'Canchas techadas para días de lluvia.', 'Calle 25 e/ 72 y 73', 'La Plata', -34.9340, -57.9620, '2214447777', '{"Techado", "Buffet"}', '{"https://placehold.co/800x400/e4e4e7/000000?text=El+Gol+de+Todos"}', '{"0": {"open": "14:00", "close": "00:00"}, "1": {"open": "14:00", "close": "00:00"}, "2": {"open": "14:00", "close": "00:00"}, "3": {"open": "14:00", "close": "00:00"}, "4": {"open": "14:00", "close": "00:00"}, "5": {"open": "14:00", "close": "00:00"}, "6": {"open": "14:00", "close": "00:00"}}'),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000002', 'Canchas del Bosque', 'Disfrutá al aire libre.', 'Av. Iraola y 50', 'La Plata', -34.9180, -57.9390, '2214448888', '{"Aire Libre", "Parrilla"}', '{"https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=800&auto=format&fit=crop"}', '{"0": {"open": "08:00", "close": "22:00"}, "1": {"open": "08:00", "close": "22:00"}, "2": {"open": "08:00", "close": "22:00"}, "3": {"open": "08:00", "close": "22:00"}, "4": {"open": "08:00", "close": "22:00"}, "5": {"open": "08:00", "close": "22:00"}, "6": {"open": "08:00", "close": "22:00"}}'),
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000002', 'La Bombonerita F5', 'El templo del F5.', 'Calle 19 e/ 57 y 58', 'La Plata', -34.9255, -57.9545, '2214449999', '{"Estacionamiento"}', '{"https://placehold.co/800x400/e4e4e7/000000?text=La+Bombonerita"}', '{"0": {"open": "12:00", "close": "23:00"}, "1": {"open": "12:00", "close": "23:00"}, "2": {"open": "12:00", "close": "23:00"}, "3": {"open": "12:00", "close": "23:00"}, "4": {"open": "12:00", "close": "23:00"}, "5": {"open": "12:00", "close": "23:00"}, "6": {"open": "12:00", "close": "23:00"}}');

-- Courts
INSERT INTO public.courts (id, venue_id, name, type, surface, has_lighting, is_covered, slot_duration_minutes)
VALUES
    ('aaaa1111-aaaa-1111-aaaa-1111aaaa1111', '11111111-1111-1111-1111-111111111111', 'Cancha 1', 'F5', 'sintetico', true, false, 60),
    ('aaaa2222-aaaa-2222-aaaa-2222aaaa2222', '11111111-1111-1111-1111-111111111111', 'Cancha 2', 'F7', 'sintetico', true, false, 60),
    ('bbbb1111-bbbb-1111-bbbb-1111bbbb1111', '22222222-2222-2222-2222-222222222222', 'Principal', 'F5', 'sintetico', true, true, 60),
    ('bbbb2222-bbbb-2222-bbbb-2222bbbb2222', '22222222-2222-2222-2222-222222222222', 'Secundaria', 'F5', 'sintetico', true, true, 60),
    ('cccc1111-cccc-1111-cccc-1111cccc1111', '33333333-3333-3333-3333-333333333333', 'Techada 1', 'F5', 'sintetico', true, true, 60),
    ('cccc2222-cccc-2222-cccc-2222cccc2222', '33333333-3333-3333-3333-333333333333', 'Techada 2', 'F5', 'sintetico', true, true, 60),
    ('dddd1111-dddd-1111-dddd-1111dddd1111', '44444444-4444-4444-4444-444444444444', 'Cesped 1', 'F8', 'natural', true, false, 90),
    ('dddd2222-dddd-2222-dddd-2222dddd2222', '44444444-4444-4444-4444-444444444444', 'Cesped 2', 'F11', 'natural', false, false, 90),
    ('eeee1111-eeee-1111-eeee-1111eeee1111', '55555555-5555-5555-5555-555555555555', 'Cancha Azul', 'F5', 'hormigon', true, false, 60),
    ('eeee2222-eeee-2222-eeee-2222eeee2222', '55555555-5555-5555-5555-555555555555', 'Cancha Roja', 'F5', 'sintetico', true, false, 60);

-- Pricing Rules (Just a few examples to populate the table)
INSERT INTO public.pricing_rules (court_id, day_of_week, start_time, end_time, price, promo_price, is_promo_active)
VALUES
    ('aaaa1111-aaaa-1111-aaaa-1111aaaa1111', 1, '18:00:00', '23:00:00', 15000.00, NULL, false),
    ('aaaa1111-aaaa-1111-aaaa-1111aaaa1111', 1, '10:00:00', '18:00:00', 12000.00, 10000.00, true),
    ('aaaa2222-aaaa-2222-aaaa-2222aaaa2222', 5, '18:00:00', '23:00:00', 18000.00, NULL, false),
    ('bbbb1111-bbbb-1111-bbbb-1111bbbb1111', 0, '18:00:00', '23:00:00', 20000.00, NULL, false);

-- Bookings (10 examples)
INSERT INTO public.bookings (id, user_id, court_id, booking_date, start_time, end_time, total_price, deposit_amount, deposit_method, payment_status, status)
VALUES
    ('ffff1111-ffff-1111-ffff-1111ffff1111', '00000000-0000-0000-0000-000000000001', 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111', CURRENT_DATE, '19:00:00', '20:00:00', 15000.00, 4500.00, 'mercadopago', 'paid', 'completed'),
    ('ffff2222-ffff-2222-ffff-2222ffff2222', '00000000-0000-0000-0000-000000000001', 'aaaa1111-aaaa-1111-aaaa-1111aaaa1111', CURRENT_DATE - INTERVAL '1 day', '20:00:00', '21:00:00', 15000.00, 4500.00, 'mercadopago', 'paid', 'completed'),
    ('ffff3333-ffff-3333-ffff-3333ffff3333', '00000000-0000-0000-0000-000000000001', 'aaaa2222-aaaa-2222-aaaa-2222aaaa2222', CURRENT_DATE + INTERVAL '1 day', '21:00:00', '22:00:00', 18000.00, 5400.00, 'mercadopago', 'pending', 'confirmed'),
    ('ffff4444-ffff-4444-ffff-4444ffff4444', '00000000-0000-0000-0000-000000000001', 'bbbb1111-bbbb-1111-bbbb-1111bbbb1111', CURRENT_DATE + INTERVAL '2 days', '19:00:00', '20:00:00', 20000.00, 6000.00, 'transfer', 'pending', 'confirmed'),
    ('ffff5555-ffff-5555-ffff-5555ffff5555', '00000000-0000-0000-0000-000000000001', 'bbbb2222-bbbb-2222-bbbb-2222bbbb2222', CURRENT_DATE - INTERVAL '5 days', '18:00:00', '19:00:00', 20000.00, 6000.00, 'cash', 'paid', 'completed'),
    ('ffff6666-ffff-6666-ffff-6666ffff6666', '00000000-0000-0000-0000-000000000001', 'cccc1111-cccc-1111-cccc-1111cccc1111', CURRENT_DATE - INTERVAL '7 days', '20:00:00', '21:00:00', 18000.00, 5400.00, 'mercadopago', 'paid', 'completed'),
    ('ffff7777-ffff-7777-ffff-7777ffff7777', '00000000-0000-0000-0000-000000000001', 'cccc2222-cccc-2222-cccc-2222cccc2222', CURRENT_DATE + INTERVAL '3 days', '22:00:00', '23:00:00', 18000.00, 5400.00, 'mercadopago', 'refunded', 'cancelled'),
    ('ffff8888-ffff-8888-ffff-8888ffff8888', '00000000-0000-0000-0000-000000000001', 'dddd1111-dddd-1111-dddd-1111dddd1111', CURRENT_DATE + INTERVAL '4 days', '16:00:00', '17:30:00', 25000.00, 7500.00, 'mercadopago', 'credited', 'cancelled'),
    ('ffff9999-ffff-9999-ffff-9999ffff9999', '00000000-0000-0000-0000-000000000001', 'eeee1111-eeee-1111-eeee-1111eeee1111', CURRENT_DATE - INTERVAL '2 days', '14:00:00', '15:00:00', 10000.00, 3000.00, 'cash', 'paid', 'no_show'),
    ('ffff0000-ffff-0000-ffff-0000ffff0000', '00000000-0000-0000-0000-000000000001', 'eeee2222-eeee-2222-eeee-2222eeee2222', CURRENT_DATE - INTERVAL '10 days', '21:00:00', '22:00:00', 15000.00, 4500.00, 'mercadopago', 'paid', 'completed');

-- Reviews (5 examples)
INSERT INTO public.reviews (user_id, venue_id, booking_id, rating, comment, venue_response)
VALUES
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ffff1111-ffff-1111-ffff-1111ffff1111', 5, 'Excelente estado de la cancha.', '¡Gracias Juan, te esperamos de nuevo!'),
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ffff2222-ffff-2222-ffff-2222ffff2222', 4, 'Muy buena atención en el buffet.', NULL),
    ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'ffff5555-ffff-5555-ffff-5555ffff5555', 3, 'La iluminación podría ser mejor.', 'Tomamos nota para mejorar los focos.'),
    ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'ffff6666-ffff-6666-ffff-6666ffff6666', 5, 'Ideal para días de lluvia, no resbala nada.', NULL),
    ('00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'ffff0000-ffff-0000-ffff-0000ffff0000', 4, 'Cancha prolija y buen precio.', '¡Gracias!');

-- Credits
INSERT INTO public.credits (user_id, booking_id, amount, status, expires_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'ffff8888-ffff-8888-ffff-8888ffff8888', 7500.00, 'available', CURRENT_DATE + INTERVAL '90 days');
