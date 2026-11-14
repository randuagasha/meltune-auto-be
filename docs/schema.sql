-- ==============================================================================
-- TORSI Automotive Workshop - Supabase PostgreSQL Schema & RLS Policies
-- Single physical workshop operational data model
-- ==============================================================================

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('customer', 'mechanic', 'superadmin');
CREATE TYPE vehicle_transmission AS ENUM ('manual', 'automatic', 'cvt');
CREATE TYPE vehicle_fuel AS ENUM ('petrol', 'diesel', 'hybrid', 'electric');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'ready_for_pickup', 'shipped', 'completed', 'cancelled');
CREATE TYPE shipping_method AS ENUM ('workshop_pickup', 'express_courier');
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved');

-- 2. USER PROFILES (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for auto-profile creation on auth.users sign-up (Always defaults to 'customer')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Pelanggan TORSI'),
        NEW.raw_user_meta_data->>'phone',
        'customer'
    );
    INSERT INTO public.loyalty_accounts (user_id, points, current_streak, longest_streak)
    VALUES (NEW.id, 50, 1, 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. VEHICLES
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT NOT NULL,
    license_plate TEXT NOT NULL,
    transmission vehicle_transmission NOT NULL DEFAULT 'automatic',
    fuel_type vehicle_fuel NOT NULL DEFAULT 'petrol',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SERVICES CATALOG
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    estimated_duration_minutes INT NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BOOKINGS
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    total_price NUMERIC(12, 2) NOT NULL,
    total_duration_minutes INT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time_slot TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    photo_urls TEXT[] DEFAULT '{}',
    status booking_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    mechanic_notes TEXT,
    assigned_mechanic_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_services (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    price_at_booking NUMERIC(12, 2) NOT NULL,
    PRIMARY KEY (booking_id, service_id)
);

-- 6. PRODUCTS & ORDERS
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL,
    shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    shipping_method shipping_method NOT NULL DEFAULT 'workshop_pickup',
    shipping_address TEXT,
    payment_method TEXT NOT NULL DEFAULT 'qris',
    status order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit_price NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- 7. LOYALTY & REWARDS
CREATE TABLE loyalty_accounts (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    points INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_check_in_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    points_awarded INT NOT NULL,
    streak_count INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, check_in_date)
);

CREATE TABLE rewards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    points_cost INT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE reward_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
    redemption_code TEXT UNIQUE NOT NULL,
    points_spent INT NOT NULL,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CUSTOMER SUPPORT
CREATE TABLE support_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    vehicle_model TEXT,
    status support_status NOT NULL DEFAULT 'open',
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Helper to fetch current profile role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: Users can read own profile; Staff/Superadmin can read all; only Superadmin can update roles
CREATE POLICY "Profiles read own" ON profiles FOR SELECT USING (auth.uid() = id OR auth.user_role() IN ('mechanic', 'superadmin'));
CREATE POLICY "Profiles update own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Vehicles: Customer reads/writes own vehicles; Staff/Admin reads all
CREATE POLICY "Vehicles customer access" ON vehicles FOR ALL USING (auth.uid() = user_id OR auth.user_role() IN ('mechanic', 'superadmin'));

-- Services & Products: Everyone reads active items; Superadmin manages
CREATE POLICY "Public read services" ON services FOR SELECT USING (is_active = TRUE OR auth.user_role() = 'superadmin');
CREATE POLICY "Superadmin manage services" ON services FOR ALL USING (auth.user_role() = 'superadmin');
CREATE POLICY "Public read products" ON products FOR SELECT USING (is_available = TRUE OR auth.user_role() = 'superadmin');
CREATE POLICY "Superadmin manage products" ON products FOR ALL USING (auth.user_role() = 'superadmin');

-- Bookings: Customers read/insert own; Mechanics & Superadmin read/update all
CREATE POLICY "Bookings customer read" ON bookings FOR SELECT USING (auth.uid() = user_id OR auth.user_role() IN ('mechanic', 'superadmin'));
CREATE POLICY "Bookings customer insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings staff update" ON bookings FOR UPDATE USING (auth.user_role() IN ('mechanic', 'superadmin'));

-- Loyalty & Rewards: Customers read own; Redemptions customer creates
CREATE POLICY "Loyalty read own" ON loyalty_accounts FOR SELECT USING (auth.uid() = user_id OR auth.user_role() = 'superadmin');
CREATE POLICY "Redemptions read own" ON reward_redemptions FOR SELECT USING (auth.uid() = user_id OR auth.user_role() = 'superadmin');
CREATE POLICY "Public read rewards" ON rewards FOR SELECT USING (is_active = TRUE OR auth.user_role() = 'superadmin');

-- Support Threads: Customer reads own; Mechanics & Superadmin read/participate
CREATE POLICY "Threads customer and staff" ON support_threads FOR ALL USING (auth.uid() = customer_id OR auth.user_role() IN ('mechanic', 'superadmin'));
CREATE POLICY "Messages participants" ON support_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM support_threads t
        WHERE t.id = support_messages.thread_id
        AND (t.customer_id = auth.uid() OR auth.user_role() IN ('mechanic', 'superadmin'))
    )
);
