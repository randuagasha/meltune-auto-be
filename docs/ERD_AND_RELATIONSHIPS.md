# TORSI Database Entity & Relationship Documentation

This document describes the Supabase PostgreSQL database architecture and entity relationships for the **TORSI** platform.

## Architecture Highlights
- Single source of truth: PostgreSQL managed by Supabase.
- Authentication: Handled via `auth.users` with automated profile synchronization via PostgreSQL triggers.
- Multi-role RBAC: `customer`, `mechanic`, `superadmin`.
- Row-Level Security (RLS): Enforced on all tables with helper function `auth.user_role()`.

---

## Entity Relationship Overview

```
auth.users (1) ─────── (1) profiles
                           │
      ┌────────────────────┼────────────────────┬────────────────────┐
      │ (1:N)              │ (1:N)              │ (1:1)              │ (1:N)
      ▼                    ▼                    ▼                    ▼
   vehicles             bookings         loyalty_accounts     support_threads
      │                    │                    │                    │
      │ (1:N)              │ (M:N)              │ (1:N)              │ (1:N)
      ▼                    ▼                    ▼                    ▼
   bookings ───<   booking_services   daily_checkins        support_messages
                           │                    │
                           ▼                    ▼
                        services       reward_redemptions
                                                │
                                                ▼
                                             rewards
```

---

## Tables Specification

### 1. `profiles`
Extends `auth.users` with automotive business attributes and RBAC role.
- `id` (UUID, PK) -> References `auth.users(id)`
- `full_name` (TEXT) -> Customer or staff name
- `phone` (TEXT) -> WhatsApp contact number
- `role` (ENUM: `customer`, `mechanic`, `superadmin`)
- `avatar_url` (TEXT)
- `is_active` (BOOLEAN)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 2. `vehicles`
Customer registered vehicles.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> profiles.id)
- `brand` (TEXT) -> e.g. Honda, Toyota, Mazda
- `model` (TEXT) -> e.g. Civic Turbo, Fortuner VRZ
- `year` (INT) -> e.g. 2021
- `license_plate` (TEXT) -> e.g. B 1045 TRS
- `transmission` (ENUM: `manual`, `automatic`, `cvt`)
- `fuel_type` (ENUM: `petrol`, `diesel`, `hybrid`, `electric`)
- `notes` (TEXT)

### 3. `services`
Curated automotive workshop services catalog.
- `id` (TEXT, PK) -> e.g. `srv_tuneup_adv`
- `name` (TEXT) -> Service title
- `category` (TEXT) -> maintenance, diagnostics, repair, detailing, performance
- `description` (TEXT)
- `price` (NUMERIC)
- `estimated_duration_minutes` (INT)
- `image_url` (TEXT)
- `is_active` (BOOLEAN)

### 4. `bookings` & `booking_services`
Central booking entities for workshop workbays.
- `id` (UUID, PK)
- `booking_reference` (TEXT, UNIQUE) -> e.g. `TRS-202611-0081`
- `user_id` (UUID, FK -> profiles.id)
- `vehicle_id` (UUID, FK -> vehicles.id)
- `total_price` (NUMERIC)
- `total_duration_minutes` (INT)
- `scheduled_date` (DATE)
- `scheduled_time_slot` (TEXT) -> e.g. `09:00 - 11:30`
- `problem_description` (TEXT)
- `photo_urls` (TEXT[]) -> Supabase storage bucket URLs
- `status` (ENUM: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`)
- `rejection_reason` (TEXT)
- `mechanic_notes` (TEXT)
- `assigned_mechanic_id` (UUID, FK -> profiles.id)

### 5. `products`, `orders`, `order_items`
Direct store transactions for OEM parts and maintenance fluids.
- `products`: ID, name, category, description, price, stock, image_url, is_available.
- `orders`: ID, order_number (`TRS-ORD-XXXX`), user_id, subtotal, shipping_fee, total_amount, shipping_method, payment_method, status.
- `order_items`: ID, order_id, product_id, unit_price, quantity.

### 6. `loyalty_accounts`, `daily_checkins`, `rewards`, `reward_redemptions`
Customer retention and daily streak system.
- `loyalty_accounts`: points balance, current streak, longest streak, last check in date.
- `daily_checkins`: unique per user per calendar date, logs streak progression and bonus calculation.
- `rewards`: affordable maintenance goods (washer fluid, microfiber pack, tire dressing gel, 1L top-up oil).
- `reward_redemptions`: generated unique voucher code (`TRS-RWD-XXXX`), points deduction log.

### 7. `support_threads` & `support_messages`
Real-time customer-to-mechanic diagnostic consultation threads.
- `support_threads`: customer_id, subject, vehicle_model, status (`open`, `in_progress`, `resolved`), last_activity.
- `support_messages`: thread_id, sender_id, content, created_at.

---

## Supabase Storage Buckets
1. `vehicle-problems`: Customer uploaded photos of engine bays, dashboards, leaks.
2. `product-catalog`: Product high-res photos.
3. `service-illustrations`: Workshop service photos.
