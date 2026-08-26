-- 1. Renombrar booking_status a status
ALTER TABLE public.bookings RENAME COLUMN booking_status TO status;

-- 2. Modificar el constraint de status para permitir 'pending'
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));

-- 3. Modificar deposit_amount y deposit_method para que permitan nulos
-- (ya que al crear la reserva en estado "pending" aún no se pagó la seña)
ALTER TABLE public.bookings ALTER COLUMN deposit_amount DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN deposit_method DROP NOT NULL;

-- 4. Agregar columna used_at a credits
ALTER TABLE public.credits ADD COLUMN used_at TIMESTAMPTZ;
