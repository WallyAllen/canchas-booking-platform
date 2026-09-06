-- Migration 034: rate limiting con ventana fija, respaldado en Postgres
--
-- El repo no tenía ningún límite de tasa (SEC-10). El endpoint que más duele es
-- create-preference: cada llamada crea una reserva 'pending', y una reserva
-- pending ocupa el turno hasta que el cron la limpia. Un script podría reservar
-- todas las canchas de todos los complejos y dejarlas bloqueadas 15 minutos,
-- indefinidamente, sin pagar un peso.
--
-- Por qué en la base y no en memoria: la app corre en funciones serverless. Un
-- contador en memoria vive por instancia, y con N instancias el límite real es
-- N veces el configurado — o directamente cero, si cada request cae en una
-- instancia fría. El estado compartido tiene que estar fuera del proceso, y
-- Postgres ya está acá. Un Redis sería más rápido, pero suma un servicio y
-- credenciales nuevas para un volumen que no lo justifica.
--
-- Ventana fija y no sliding window: es una sola fila y un solo UPSERT atómico.
-- El peor caso de una ventana fija es admitir hasta 2x el límite en el cruce de
-- dos ventanas. Para frenar abuso automatizado eso alcanza; no estamos haciendo
-- facturación por consumo.

CREATE TABLE IF NOT EXISTS public.rate_limits (
    -- Formato: '<accion>:<identidad>', p.ej. 'create-preference:user:<uuid>'
    -- o 'create-preference:ip:<ip>' para quien no está autenticado.
    key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count INT NOT NULL DEFAULT 0
);

-- Sin policies a propósito: RLS es default-deny, así que ningún cliente con la
-- anon key puede leer ni escribir esta tabla. Solo la toca el service_role, que
-- saltea RLS. Que un usuario pueda leer sus propios contadores no aporta nada y
-- que pueda escribirlos anularía el mecanismo entero.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

/**
 * Registra un intento y dice si se pasó del límite.
 *
 * Todo ocurre en un único UPSERT para que sea atómico: dos requests simultáneas
 * del mismo usuario no pueden leer el mismo contador y escribir ambas un +1
 * sobre el mismo valor. `ON CONFLICT DO UPDATE` serializa a nivel de fila.
 *
 * Devuelve `allowed=false` recién cuando el contador SUPERA el límite, así que
 * p_limit intentos pasan y el siguiente no.
 */
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_limit INT,
    p_window_seconds INT
)
RETURNS TABLE (allowed BOOLEAN, remaining INT, retry_after INT) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_window INTERVAL := make_interval(secs => p_window_seconds);
    v_count INT;
    v_start TIMESTAMPTZ;
BEGIN
    INSERT INTO public.rate_limits AS rl (key, window_start, count)
    VALUES (p_key, v_now, 1)
    ON CONFLICT (key) DO UPDATE
        SET count = CASE
                WHEN rl.window_start < v_now - v_window THEN 1
                ELSE rl.count + 1
            END,
            window_start = CASE
                WHEN rl.window_start < v_now - v_window THEN v_now
                ELSE rl.window_start
            END
    RETURNING rl.count, rl.window_start INTO v_count, v_start;

    RETURN QUERY SELECT
        v_count <= p_limit,
        GREATEST(0, p_limit - v_count),
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_start + v_window - v_now)))::INT);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

/**
 * Borra contadores que ya no le sirven a nadie.
 *
 * Sin esto la tabla crece con una fila por cada identidad que haya pegado
 * alguna vez. Una hora es holgado: la ventana más larga que usamos es de
 * minutos, así que nada vivo se pierde.
 */
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-rate-limits');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar si el trabajo no existe
END $$;

SELECT cron.schedule(
  'cleanup-rate-limits',
  '17 * * * *',
  'SELECT public.cleanup_rate_limits();'
);
