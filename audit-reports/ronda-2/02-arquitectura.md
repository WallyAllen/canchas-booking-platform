# Auditoría de Arquitectura — Ronda 2

**Fecha:** 2026-09-01
**Commit base:** `a1f7e7f` ("Feat: Add pg_cron job to delete abandoned bookings after 3 minutes") — **working tree sucio (148 archivos)**
**Rol:** Pesimista de Arquitectura. Solo lectura. No se modificó ni una línea de código, SQL, config ni tests.
**Comandos ejecutados:** `npm run build`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `rg`, `git diff`, `du -sh`.

---

## Resumen ejecutivo pesimista

No hay "día del incidente" que valga: **el sistema no llega a producción porque no compila**. `npm run build` falla con 5 errores de módulo no encontrado, secuela directa del rename masivo PascalCase→kebab-case que está a medio hacer en el working tree. Eso es la puerta cerrada.

Si abrimos la puerta a la fuerza (arreglando los 5 imports), lo que hay detrás es peor y es silencioso. La función `hoursUntilBooking()` devuelve `NaN` con el formato `HH:MM:SS` que la base de datos realmente entrega, así que **toda la política de cancelación y reprogramación está inoperante en producción**: nadie recibe crédito nunca y cualquiera cancela cinco minutos antes del partido. Los tests lo detectan (3 de 26 fallan) y el equipo hizo el commit igual.

Después caen las piezas transaccionales. La migración `012` del working tree tiene un **error de sintaxis PL/pgSQL** (bloque `EXCEPTION` vacío), lo que significa que el cron probablemente nunca se agendó — y si sí se agendó, la `019` lo devolvió a una ventana de **3 minutos** que cobra la seña y borra la reserva del que tardó 3:01 en Mercado Pago. El webhook de MP hace check-then-update no atómico, así que dos notificaciones en paralelo mandan dos mails y consumen créditos dos veces. Y todas las preferencias de pago se crean con la misma `idempotencyKey: 'abc'`.

Lo único que evita el overbooking real es un índice único parcial en Postgres (`008`), que sí existe y sí funciona. Es la única capa de defensa transaccional del sistema, y protege exactamente un caso: mismo `court_id` + misma fecha + misma `start_time` exacta. Todo lo demás — solapamiento de duraciones, créditos, doble webhook, timeouts — está sin cubrir. **El orden de caída es: build → política de cancelación → cron/pagos huérfanos → créditos duplicados → base de datos bajo seq-scan.**

---

## Tabla de hallazgos

| ID | Severidad | Título | Archivo:línea |
| :-- | :-- | :-- | :-- |
| ARQ-01 | **CRÍTICO** | El build de producción falla: 5 imports rotos por rename a medias | `src/components/search/search-layout.tsx:7`, `src/components/map/venue-map.tsx:3` |
| ARQ-02 | **CRÍTICO** | `hoursUntilBooking()` devuelve `NaN`: política de cancelación inoperante | `src/lib/utils/dates.ts:60` |
| ARQ-03 | **CRÍTICO** | Migración 012 con error de sintaxis PL/pgSQL: el cron nunca se agenda | `supabase/migrations/012_abandoned_bookings_cron.sql:18-24` |
| ARQ-04 | **CRÍTICO** | Regresión de ventana del cron 15min→3min: pagos huérfanos | `supabase/migrations/019_credit_locks.sql:15,22` |
| ARQ-05 | **CRÍTICO** | Webhook MP: check-then-update no atómico ante entregas duplicadas | `src/app/api/webhooks/mercadopago/route.ts:53-66` |
| ARQ-06 | **CRÍTICO** | `idempotencyKey: 'abc'` global y compartida en el cliente de Mercado Pago | `src/lib/mercadopago/client.ts:6` |
| ARQ-07 | **CRÍTICO** | `applyCredits()` sin lock transaccional: la 019 no implementa lo que promete | `src/lib/credits/manager.ts:112-160` |
| ARQ-08 | ALTO | `end_time: "23:59:00"` hardcodeado: no existe protección real de solapamiento | `src/app/api/booking/create-preference/route.ts:74` |
| ARQ-09 | ALTO | La página de éxito afirma "pago procesado" sin leer `payment_status` | `src/app/(main)/booking/[courtId]/success/page.tsx:63-64` |
| ARQ-10 | ALTO | `/search` sin paginación: trae todo el catálogo y filtra en memoria de Node | `src/app/(main)/search/page.tsx:26-58` |
| ARQ-11 | ALTO | Dashboard trae el histórico completo de reservas para calcular 4 métricas | `src/app/dashboard/page.tsx:43-58` |
| ARQ-12 | ALTO | Caché de ficha de complejo con tag `'venues'` que nadie invalida jamás | `src/app/(main)/venue/[id]/page.tsx:16,82` |
| ARQ-13 | ALTO | Middleware ejecuta `auth.getUser()` en cada request, webhooks incluidos | `src/middleware.ts:31-33,58` |
| ARQ-14 | ALTO | `Header` cliente + `useUser`: 2 round-trips extra a Supabase por navegación | `src/components/layout/header.tsx:1`, `src/hooks/useUser.ts:23-32` |
| ARQ-15 | ALTO | Notificaciones bloqueantes sin timeout en el camino de cancelación | `src/lib/booking/actions.ts:46-54` |
| ARQ-16 | ALTO | El cliente de MP redirige a `/mock-payment`, página eliminada del repo | `src/lib/mercadopago/client.ts:22-28` |
| ARQ-17 | MEDIO | Pago por transferencia: reserva fantasma con URL literal `court-id` | `src/components/booking/booking-wizard.tsx:82` |
| ARQ-18 | MEDIO | `not-found.tsx` es Server Component con `onClick`: segundo bloqueador de build | `src/app/not-found.tsx:11` |
| ARQ-19 | MEDIO | 105 `@ts-expect-error` mantienen `tsc --noEmit` en verde mientras el build cae | `src/` (105 ocurrencias) |
| ARQ-20 | MEDIO | La regla de la seña vive en 6 lugares; el helper canónico no lo usa nadie | `src/lib/utils/currency.ts:17` |
| ARQ-21 | MEDIO | Tres caminos de cancelación con reglas distintas, uno de ellos `DELETE` | `src/app/actions/booking.ts:11-16` |
| ARQ-22 | MEDIO | Índices ausentes para el cron, la búsqueda y el lock de créditos | `supabase/migrations/011_performance_indexes.sql` |
| ARQ-23 | MEDIO | Sin paginación en inbox, admin/users, mensajes y reseñas | `src/lib/supabase/queries.ts:68-77`, `src/app/admin/users/page.tsx:14-16` |
| ARQ-24 | MEDIO | RPC `SECURITY DEFINER` sin `SET search_path` ni `REVOKE` | `supabase/migrations/020_availability_rpc.sql:3-17` |
| ARQ-25 | BAJO | `rescheduleBooking()` es código muerto; la migración 017 protege un fantasma | `src/lib/booking/actions.ts:59` |
| ARQ-26 | BAJO | Cero observabilidad: 40 `console.*`, ningún logger, ninguna dead-letter queue | `src/app/api/webhooks/mercadopago/route.ts:76,85` |
| ARQ-27 | BAJO | `next.config.mjs` sin `remotePatterns` de Supabase Storage: `next/image` rompe | `next.config.mjs:3-14` |
| ARQ-28 | BAJO | `gsap` en el bundle inicial de la landing; `test/integration/` vacío | `src/components/home/hero-search.tsx`, `test/integration/` |

**Conteo:** 7 CRÍTICOS · 9 ALTOS · 8 MEDIOS · 4 BAJOS = **28 hallazgos**.

---

## Detalle por hallazgo

### ARQ-01 — CRÍTICO — El build de producción falla

**Ubicación:** `src/components/search/search-layout.tsx:7`, `src/components/map/venue-map.tsx:3`, `src/components/map/venue-map-client.tsx:9`, `src/components/search/venue-list.tsx:4`, `src/components/dashboard/bookings/bookings-client.tsx:7`

```tsx
// src/components/search/search-layout.tsx:6-7
// @ts-expect-error fix inference
import { VenueMap } from "@/components/map/VenueMap"
```

```tsx
// src/components/map/venue-map.tsx:2-3
// @ts-expect-error fix inference
import { SearchVenueItem } from "@/components/search/VenueList"
```

En disco solo existen `src/components/map/venue-map.tsx` y `src/components/search/venue-list.tsx` (kebab-case). Los archivos PascalCase figuran como `D` (deleted) en `git status`.

**Salida real de `npm run build`:**

```
Failed to compile.

./src/app/(auth)/login/page.tsx
Module not found: Can't resolve '@/hooks/use-user'
./src/app/(main)/profile/page.tsx
Module not found: Can't resolve '@/hooks/use-user'
./src/components/dashboard/bookings/bookings-client.tsx
Module not found: Can't resolve '@/components/dashboard/bookings/BookingActions'
./src/components/search/search-layout.tsx
Module not found: Can't resolve '@/components/map/VenueMap'
./src/components/search/venue-list.tsx
Module not found: Can't resolve '@/components/venue/VenueCard'

> Build failed because of webpack errors
```

Nótese la asimetría: `login/page.tsx` y `profile/page.tsx` importan `@/hooks/use-user` cuando el archivo en disco es `src/hooks/useUser.ts` — o sea el rename fue en las dos direcciones y quedó inconsistente en ambas.

**Escenario de fallo concreto:** T=0, se hace `git push` a main. T=1, Vercel arranca el build en Linux (case-sensitive). T=2, webpack falla en los 5 módulos. T=3, el deploy se marca como fallido y **la versión anterior queda servida** — es decir, todo el trabajo de las 148 modificaciones (incluidas las migraciones de seguridad 013–020) nunca llega a producción, y nadie se entera de que el fix de seguridad no está desplegado.

**Impacto:** bloqueo total de despliegue. Además `tsc --noEmit` pasa limpio y `npm run lint` reporta "No ESLint warnings or errors", así que **ningún gate de CI local detecta esto**: solo lo detecta el build.

**Remediación descriptiva:** completar el rename en las 5 referencias restantes; agregar `npm run build` al pipeline de CI antes del merge; y considerar `forceConsistentCasingInFileNames: true` en `tsconfig.json` — hoy no está, y por eso `tsc` no ve el problema en macOS.

---

### ARQ-02 — CRÍTICO — `hoursUntilBooking()` devuelve `NaN`: política de cancelación inoperante

**Ubicación:** `src/lib/utils/dates.ts:59-63`, consumida en `src/lib/credits/manager.ts:6` y `:50`

```ts
// src/lib/utils/dates.ts:59-63
export function hoursUntilBooking(bookingDate: string, startTime: string): number {
  const bookingDateTime = new Date(`${bookingDate}T${startTime}:00-03:00`)
  const now = new Date()
  return (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
}
```

La columna `bookings.start_time` es de tipo `TIME` (`supabase/migrations/001_initial_schema.sql:71`) y PostgREST la serializa como `HH:MM:SS`. La función le concatena `:00` encima.

**Verificado ejecutando Node:**

```
con HH:MM:SS -> Invalid Date
con HH:MM    -> Thu Oct 10 2024 11:30:00 GMT-0300
hoursUntilBooking(HH:MM:SS) = NaN
```

Toda comparación con `NaN` es `false`, así que en `calculateCancellationPolicy` (`src/lib/credits/manager.ts:9` y `:19`) ambas guardas fallan y la ejecución cae siempre al `return` final:

```ts
// src/lib/credits/manager.ts:41-46
return {
  canCancel: true,
  refundType: 'forfeit',
  creditAmount: 0,
  reason: 'Cancelación con menos de 6hs de anticipación. Perdés la seña abonada.'
}
```

Y en `canReschedule` (`:52`) `NaN >= 2` es `false` → **nunca se puede reprogramar**.

**Escenario de fallo concreto:** T=0 (viernes 19:55), usuario A tiene turno a las 20:00 y decide no ir. T=1, cancela desde `/bookings`. T=2, `calculateCancellationPolicy` recibe `NaN`, no bloquea (la guarda de 1 hora no dispara) y devuelve `canCancel: true`. T=3, la reserva pasa a `cancelled` **cinco minutos antes del partido**, el índice único parcial libera el slot, y el complejo se queda con la cancha vacía en su horario más caro. Resultado inverso: usuario B cancela con 3 días de anticipación y recibe `refundType: 'forfeit'`, `creditAmount: 0` — pierde su seña sin motivo. La plataforma pierde dinero y confianza en las dos direcciones.

**Evidencia de que el equipo lo sabe y lo commiteó igual:** `npx vitest run` → **3 fallos de 26 tests**, dos de ellos exactamente sobre esto:

```
FAIL src/lib/credits/manager.test.ts > should not allow cancellation with less than 1 hour notice
  expected true to be false
FAIL src/lib/credits/manager.test.ts > should give full credit (deposit 30%) with more than 6 hours notice
  expected 'forfeit' to be 'credit'
FAIL src/lib/credits/manager.test.ts > should allow reschedule with more than 2 hours notice
  expected false to be true
```

Peor: el test `should forfeit deposit with less than 6 hours` **pasa** — pero pasa por la razón equivocada (`NaN` cae en la misma rama). Es un falso positivo que enmascara la severidad.

Y `src/lib/utils/dates.test.ts:62` prueba `hoursUntilBooking('2020-01-01', '09:00')` con formato `HH:MM`, que la aplicación nunca produce. La suite valida un contrato que el sistema real no usa.

**Impacto:** la regla de negocio central de retención de señas no existe. Cuantificable: cada cancelación tardía es una cancha vacía en prime-time, y cada cancelación temprana es un crédito que se debía y no se emitió.

**Remediación descriptiva:** normalizar el formato en un solo punto (aceptar `HH:MM` y `HH:MM:SS`), y hacer que los tests usen el formato que devuelve PostgREST, no el que resulta cómodo. Además, ninguna de estas funciones debería devolver un número sin validar: un `NaN` debería lanzar, no degradar silenciosamente a la rama más permisiva.

---

### ARQ-03 — CRÍTICO — Migración 012 con error de sintaxis PL/pgSQL

**Ubicación:** `supabase/migrations/012_abandoned_bookings_cron.sql:18-24` (introducido en el working tree; ver `git diff`)

```sql
DO $$
BEGIN
  PERFORM cron.unschedule('delete-abandoned-bookings');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar si el trabajo no existe
END $$;
```

PL/pgSQL exige **al menos una sentencia** en cada handler de `EXCEPTION`. Un comentario `--` no es una sentencia. Falta un `NULL;`. El bloque produce `syntax error at or near "END"`.

El `git diff` muestra que esto es un cambio del working tree; la versión commiteada era `SELECT cron.unschedule('delete-abandoned-bookings');` a secas, que también falla si el job no existe (`cron.unschedule` lanza `could not find valid entry for job`). **Ambas versiones rompen, por motivos distintos.**

**Escenario de fallo concreto:** T=0, se corre `supabase db push`. T=1, el archivo `012` aborta en el `DO` block. T=2, como es un único script, el `SELECT cron.schedule(...)` de la línea 26 **nunca se ejecuta**. T=3, la función `delete_abandoned_bookings()` existe en la base pero nadie la llama nunca. T=4, cada usuario que abandona el checkout deja una reserva `pending` que bloquea el slot **para siempre** — el índice único parcial de `008` cuenta las `pending` como ocupadas. En un mes, los horarios de 20:00 y 21:00 de los viernes están todos "ocupados" por reservas fantasma que nadie pagó.

Riesgo agregado, incluso si el cron sí corre: el `DELETE` masivo de `019:19-22` no maneja el `ON DELETE RESTRICT` de `credits.booking_id` (`001_initial_schema.sql:102`). Si una sola fila viola el RESTRICT, **la sentencia entera aborta**, la función falla, y `pg_cron` registra el error en `cron.job_run_details` donde nadie mira. Falla silenciosa por diseño.

**Impacto:** inventario de canchas que se degrada monótonamente. Nadie recibe una alerta porque no hay observabilidad sobre `pg_cron` (ver ARQ-26).

**[NO CONFIRMADO]** No pude verificar contra una base real si `pg_cron` está habilitado en el proyecto Supabase ni si el job `delete-abandoned-bookings` figura en `cron.job`. Solo audité el SQL.

**Remediación descriptiva:** agregar `NULL;` al handler; verificar el resultado con `SELECT * FROM cron.job` como paso explícito de despliegue; y mover el `DELETE` a un bucle acotado (`LIMIT`) con manejo de excepción por fila, de modo que una violación de FK no tumbe la corrida completa.

---

### ARQ-04 — CRÍTICO — Regresión de la ventana del cron (15min → 3min) y pagos huérfanos

**Ubicación:** `supabase/migrations/016_extend_booking_cron.sql:10` vs. `supabase/migrations/019_credit_locks.sql:15,22`

La `016` se titula literalmente *"Extend abandoned booking cron window from 3 to 15 minutes (ARC-03)"*:

```sql
-- 016_extend_booking_cron.sql:10
AND created_at < NOW() - INTERVAL '15 minutes';
```

La `019`, **posterior**, redefine la misma función y vuelve a 3 minutos, en dos lugares:

```sql
-- 019_credit_locks.sql:15 y :22
AND created_at < NOW() - INTERVAL '3 minutes';
```

Y el commit `a1f7e7f` — el HEAD actual — se llama "Add pg_cron job to delete abandoned bookings **after 3 minutes**". La regresión no es accidental en el mensaje: quedó consagrada en el título del commit.

**Escenario de fallo concreto (el más caro del sistema):**
- **T=0:00** — Usuario A pulsa "Ir a pagar". `create-preference` inserta la reserva `pending` (`route.ts:68-81`) y devuelve el `init_point` de Mercado Pago.
- **T=0:20** — A llega a MP. Elige "dinero en cuenta", no le alcanza, cambia a tarjeta.
- **T=1:40** — MP le pide validación por SMS. A busca el celular.
- **T=3:01** — El cron corre. La reserva de A cumple `payment_status='pending' AND status='pending' AND created_at < NOW() - 3 min`. **Se borra.** Los créditos que A tenía bloqueados se liberan por el `ON DELETE SET NULL` de `019:3`.
- **T=3:30** — A completa el pago. MP cobra. Plata real sale de la cuenta de A.
- **T=3:35** — Llega el webhook. `external_reference` apunta a un UUID que ya no existe. El `.update(...).select(...).single()` de `route.ts:58-66` devuelve error, se lanza (`:70`) y el handler responde **500**.
- **T=3:35 → T+24h** — MP reintenta el webhook con backoff. Cada reintento vuelve a fallar con 500. El pago queda huérfano: no hay reserva, no hay crédito, no hay reembolso automático, y no hay ninguna alerta.
- **T=20:00** — A se presenta en la cancha con el comprobante de MP. La cancha está ocupada por otro. El complejo no tiene registro de A.

**Impacto:** dinero cobrado sin contraprestación, sin trazabilidad y sin proceso de reembolso. En Argentina esto es un contracargo y un reclamo en Defensa del Consumidor. 3 minutos es una ventana absurda para un flujo que incluye 3D-Secure, validación por SMS y elección de medio de pago.

**Remediación descriptiva:** volver a 15 minutos como mínimo (mejor 30); dejar de **borrar** y pasar a un estado `expired` (para conservar la fila y poder reconciliar); y hacer que el webhook, ante `external_reference` inexistente, escriba en una tabla de pagos-sin-reserva y responda 200 para no ciclar reintentos, en vez de tirar 500 al vacío.

---

### ARQ-05 — CRÍTICO — Webhook de MP: check-then-update no atómico

**Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:53-66`

```ts
const { data: currentBooking } = await supabase.from('bookings').select('payment_status').eq('id', bookingId).single()
if (currentBooking && currentBooking.payment_status === 'paid') {
   return NextResponse.json({ success: true, message: 'Already paid' }, { status: 200 })
}

const { data: booking, error } = await supabase.from('bookings')
  .update({
    payment_status: 'paid',
    status: 'confirmed',
    updated_at: new Date().toISOString()
  })
  .eq('id', bookingId)
  .select('*, profiles(*), courts(*, venues(*))')
  .single()
```

El guard de idempotencia es un `SELECT` seguido de un `UPDATE` **sin condición sobre el estado previo**. Mercado Pago entrega webhooks *at-least-once* y en paralelo (típicamente un evento `payment.created` y uno `payment.updated` casi simultáneos).

**Escenario de fallo concreto:**
- **T=0ms** — Llegan dos invocaciones del webhook para el mismo `payment_id`, en dos instancias serverless distintas de Vercel (W1 y W2).
- **T=10ms** — W1 lee `payment_status = 'pending'`. Pasa el guard.
- **T=12ms** — W2 lee `payment_status = 'pending'`. **También pasa el guard** (W1 todavía no escribió).
- **T=40ms** — W1 hace el UPDATE. Éxito.
- **T=45ms** — W2 hace el UPDATE. **También éxito** — no hay `.eq('payment_status','pending')` que lo frene, y `updated_at` cambia igual.
- **T=50ms** — Ambos llaman `consumeLockedCredits(bookingId)` (`:76`) y ambos disparan `notify('booking_confirmed')` vía `waitUntil` (`:80-86`).
- **Resultado:** el usuario recibe **dos emails de confirmación y dos WhatsApps** por la misma reserva. Los créditos se marcan `used` dos veces (idempotente por casualidad, porque el segundo `UPDATE ... WHERE locked_for_booking_id = X` ya no matchea nada — pero eso es suerte, no diseño).

**Impacto:** duplicación de notificaciones (costo real en la Cloud API de WhatsApp, que cobra por conversación iniciada por el negocio) y pérdida de confianza del usuario. En el caso peor, si en el futuro se agrega cualquier efecto acumulativo al camino de confirmación (contador de reservas, comisión, cupón), se duplica el efecto financiero.

**Remediación descriptiva:** volver el UPDATE condicional y atómico — `.eq('id', bookingId).eq('payment_status', 'pending')` — y usar la cantidad de filas afectadas como señal de "yo gané la carrera": solo el ganador notifica. Alternativamente, un `INSERT ... ON CONFLICT DO NOTHING` en una tabla `processed_webhook_events(payment_id)` como llave de idempotencia real.

---

### ARQ-06 — CRÍTICO — `idempotencyKey: 'abc'` global en el cliente de Mercado Pago

**Ubicación:** `src/lib/mercadopago/client.ts:4-7`

```ts
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token',
  options: { timeout: 5000, idempotencyKey: 'abc' }
})
```

El cliente se instancia **una sola vez a nivel de módulo** y la clave de idempotencia es la cadena literal `'abc'` para *todas* las llamadas a la API de MP, de *todos* los usuarios, durante *toda* la vida del proceso. El SDK v3 la envía como header `X-Idempotency-Key` en los POST de creación de preferencia.

**Escenario de fallo concreto:** T=0, usuario A crea una preferencia por $4.500 (seña de su cancha). MP guarda la respuesta indexada por `X-Idempotency-Key: abc`. T=5s, usuario B, en la misma instancia serverless caliente, crea una preferencia por $9.000. MP recibe la **misma** clave de idempotencia y, dentro de su ventana de deduplicación, puede devolver la respuesta cacheada de A. T=6s, B es redirigido al `init_point` de A y **paga la seña de la reserva de A** — con el `external_reference` de A. El webhook confirma la reserva de A. B pagó y no tiene reserva.

**Impacto:** cruce de transacciones entre usuarios distintos. Es el peor tipo de bug: intermitente, dependiente de la ventana de deduplicación de MP y del reciclado de instancias de Vercel, e imposible de reproducir en test.

**[NO CONFIRMADO]** No pude verificar contra la API real la duración exacta de la ventana de deduplicación de MP ni si su servicio rechaza la clave por reuso con payload distinto. Lo que sí es indiscutible leyendo el código: la clave es constante y compartida, que es exactamente lo contrario de lo que una clave de idempotencia debe ser.

**Remediación descriptiva:** la clave debe ser única por operación — el `bookingId` es el candidato natural, ya que identifica la transacción de negocio. Y el cliente de MP no debería ser un singleton de módulo si lleva estado por request.

---

### ARQ-07 — CRÍTICO — `applyCredits()` sin lock transaccional

**Ubicación:** `src/lib/credits/manager.ts:106-163`. La migración `019` se titula *"Credit Locks for Transactional Integrity"*.

Lo que la `019` realmente hace (`supabase/migrations/019_credit_locks.sql:3`):

```sql
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS locked_for_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
```

Agrega **una columna**. No hay `SELECT ... FOR UPDATE`, no hay `SERIALIZABLE`, no hay advisory lock, no hay función transaccional. La lógica queda en TypeScript, repartida en un `SELECT` seguido de N `UPDATE` individuales sobre la red:

```ts
// src/lib/credits/manager.ts:112-119
const { data: credits, error } = await supabase.from('credits')
  .select('*')
  .eq('user_id', userId)
  .eq('venue_id', venueId)
  .eq('status', 'available')
  .is('locked_for_booking_id', null)
  .gt('expires_at', now)
  .order('expires_at', { ascending: true })
// ... líneas 128-160: for (const credit of typedCredits) { await adminSupabase...update(...) }
```

Entre el `SELECT` de la línea 112 y los `UPDATE` de las líneas 136/154 hay una ventana de red completa, sin ninguna garantía.

**Escenario de fallo concreto:** T=0, usuario A tiene un crédito de $5.000 y abre dos pestañas con dos canchas distintas del mismo complejo. T=1, pulsa "Ir a pagar" en ambas casi a la vez. T=2, request R1 lee el crédito de $5.000 como disponible y no bloqueado. T=3, request R2 lee **el mismo crédito**, también como disponible (R1 todavía no escribió). T=4, R1 hace `UPDATE credits SET locked_for_booking_id = B1`. T=5, R2 hace `UPDATE credits SET locked_for_booking_id = B2` — **pisa a R1**. T=6, ambos `create-preference` calcularon `amountToPay = 0` (crédito cubre la seña) y ambos confirman la reserva directo en `route.ts:94-102`. **Resultado: dos reservas confirmadas, un solo crédito de $5.000.** El complejo entrega dos canchas y cobra una.

Nótese que el índice único de `008` **no protege** acá: son dos canchas distintas, dos slots distintos. La única defensa posible era el lock que no existe.

**Impacto:** doble gasto de créditos, con amplificación proporcional a cuántas pestañas abra el usuario. El reporte de ronda 1 lo marcó como "✅ Resuelto | 019_credit_locks.sql" — ver la sección **Falsos remediados**.

**Remediación descriptiva:** mover toda la operación a una función PL/pgSQL única, invocada por RPC, que haga `SELECT ... FOR UPDATE` sobre las filas de `credits` del usuario antes de decidir el reparto. Postgres ya sabe hacer esto; el problema es que la lógica está fuera de la base.

---

### ARQ-08 — ALTO — `end_time: "23:59:00"` hardcodeado

**Ubicación:** `src/app/api/booking/create-preference/route.ts:74`, `src/app/dashboard/schedule/actions.ts:40`

```ts
// create-preference/route.ts:69-79
.insert({
  user_id: user.id,
  court_id: courtId,
  booking_date: date,
  start_time: `${time}:00`,
  end_time: "23:59:00",
  ...
```

```ts
// dashboard/schedule/actions.ts:40
end_time: "23:59:00", // MVP simplify
```

Toda reserva del sistema, sin excepción, dice terminar a las 23:59. La columna `courts.slot_duration_minutes` existe (`001_initial_schema.sql:48`) y nunca se lee.

Además, `rescheduleBooking` actualiza `start_time` pero **no** `end_time` (`src/lib/booking/actions.ts:94-100`), así que ni siquiera es consistente consigo mismo.

**Escenario de fallo concreto:** T=0, complejo configura una cancha F11 con `slot_duration_minutes = 90`. T=1, usuario A reserva a las 20:00 (ocupa realmente hasta 21:30). T=2, usuario B reserva a las 21:00. El índice único de `008` compara `(court_id, booking_date, start_time)` — `20:00` ≠ `21:00`, **no hay conflicto**, el insert pasa. T=3, dos equipos se presentan a las 21:00 en la misma cancha. Resultado: overbooking real que ninguna capa detecta.

**Impacto:** la protección de doble-booking solo cubre coincidencia exacta de hora de inicio. Cualquier duración distinta de 60 minutos, o cualquier grilla con slots de media hora, produce solapamiento silencioso. Como efecto secundario, todo cálculo o reporte que use `end_time` es basura.

**Remediación descriptiva:** derivar `end_time` de `start_time + slot_duration_minutes` y reemplazar el índice único por una constraint de exclusión GiST sobre un rango temporal (`EXCLUDE USING gist (court_id WITH =, booking_date WITH =, tsrange(start_time, end_time) WITH &&) WHERE (status <> 'cancelled')`). Postgres resuelve el solapamiento en la base; la aplicación no debería intentarlo.

---

### ARQ-09 — ALTO — La página de éxito afirma "pago procesado" sin verificar nada

**Ubicación:** `src/app/(main)/booking/[courtId]/success/page.tsx:63-64, 90-95`

```tsx
<h1 className="text-2xl font-black text-green-500 mb-2">¡Reserva Confirmada!</h1>
<p className="text-muted-foreground">Tu pago ha sido procesado exitosamente y la cancha ya es tuya.</p>
```

La página consulta la reserva (`:25-40`) pero **nunca lee `booking.payment_status` ni `booking.status`**. Renderiza el mensaje de éxito incondicionalmente. Y el monto de la seña se recalcula en el render en vez de leer `deposit_amount`:

```tsx
// :93
${Math.ceil(booking.total_price * ((booking.courts.venues.deposit_percentage || 30) / 100)).toLocaleString('es-AR')}
```

**Escenario de fallo concreto:** T=0, usuario paga en MP. T=1, MP hace el `auto_return` al `back_url` de éxito (`src/lib/mercadopago/client.ts:44`). T=2, la página carga y dice "¡Reserva Confirmada! Tu pago ha sido procesado exitosamente". T=3, el webhook todavía no llegó — o llegó y falló con 500 (ver ARQ-04) — así que en la base la reserva sigue en `pending`. T=6:00, el cron la borra. El usuario tiene una captura de pantalla que dice "confirmada" y una reserva que no existe.

Segundo escenario, sobre el monto: el usuario cubrió el 100% de la seña con créditos, `amountToPay = 0` y no pagó un peso (`create-preference/route.ts:94`). La página igual muestra "Seña abonada: $4.500". Es información financiera falsa mostrada al usuario.

**Impacto:** el usuario recibe confirmación de algo que la base de datos no confirma, y un monto que no pagó. Es la peor combinación posible para una disputa.

**Remediación descriptiva:** renderizar tres estados distintos según `payment_status` (`paid` → confirmada; `pending` → "estamos verificando tu pago" con polling; otro → error), y mostrar `booking.deposit_amount` menos los créditos aplicados en vez de recalcular.

---

### ARQ-10 — ALTO — `/search` sin paginación, filtrado en memoria

**Ubicación:** `src/app/(main)/search/page.tsx:5, 26-58, 64-130`

```ts
export const dynamic = 'force-dynamic'
// ...
let query = supabase
  .from("venues")
  .select(`id, name, address, city, avg_rating, review_count, photos, latitude, longitude, require_deposit,
    courts ( type, surface, pricing_rules ( price ) )`)
  .eq("is_active", true)
```

No hay `.limit()` ni `.range()` — verificado con `rg "\.limit\(|\.range\(" src`: los únicos límites del proyecto están en `page.tsx:70`, `page.tsx:111`, `dashboard/bookings/page.tsx:24`, `admin/page.tsx:19` y `admin-chat-thread.tsx:59`. `search/page.tsx` no está en la lista.

Los filtros de tipo, superficie y precio se aplican **después**, en JavaScript, iterando el resultado completo (`:68-129`). El filtro por texto usa `ilike` con comodín inicial (`:55`), que no puede usar índice B-tree y fuerza secuencial:

```ts
query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
```

**Escenario de fallo concreto:** con 50 complejos × 4 canchas × 7 reglas de precio = ~1.400 filas anidadas por request, serializadas a JSON, transferidas, parseadas y filtradas en Node. Con `force-dynamic` no hay caché: cada uno de los 500 usuarios del viernes ejecuta la consulta completa. A 200 complejos la carga se cuadruplica y el tiempo de render escala linealmente hasta chocar contra el timeout de la función serverless.

**Impacto:** la página de búsqueda — la de mayor tráfico después de la home — es la más cara del sistema y la que peor escala.

**Remediación descriptiva:** empujar los filtros a SQL (una vista materializada o RPC que precompute `min_price` y `court_types` por complejo), paginar con `.range()`, e instalar `pg_trgm` con un índice GIN para el `ilike`.

---

### ARQ-11 — ALTO — El dashboard trae el histórico completo para calcular 4 métricas

**Ubicación:** `src/app/dashboard/page.tsx:43-61`

```ts
const { data: bookingsData } = await supabase.from("bookings")
  .select("*, courts!inner(venue_id)")
  // @ts-expect-error fix inference
  .eq("courts.venue_id", venue.id)
  .order("created_at", { ascending: false })

const bookings = bookingsData || []
const today = new Date().toISOString().split('T')[0]
const todayBookings = bookings.filter((b) => b.booking_date === today && b.status !== 'cancelled')
const revenue = bookings
  .filter((b) => b.status === 'confirmed' || b.payment_status === 'paid')
  .reduce((acc, curr) => acc + (curr.total_price || 0), 0)
const recentBookings = bookings.slice(0, 5)
```

Sin `.limit()`, sin filtro de fecha. Se trae **cada reserva histórica del complejo** (`select("*")`, todas las columnas) para contar las de hoy, sumar un total y quedarse con 5.

**Escenario de fallo concreto:** un complejo con 3 años de operación y 4 canchas acumula ~15.000 reservas. Cada carga del dashboard (`force-dynamic`, sin caché) transfiere ~15.000 filas completas desde Postgres a la función serverless. El dueño refresca el dashboard cada 2 minutos un viernes a la noche para ver las reservas entrantes. Cada refresh son ~8 MB de JSON y varios segundos de latencia; el cold start de Vercel lo empeora.

**Impacto:** el panel se vuelve inutilizable justo para los complejos más exitosos — un castigo perfectamente invertido respecto al valor del cliente. Además `revenue` suma `total_price` y no `deposit_amount`, así que la métrica es incorrecta aparte de cara.

**Remediación descriptiva:** tres agregaciones SQL (`count` de hoy, `sum(deposit_amount)` filtrado por rango, y un `select ... limit 5`) en vez de una descarga completa. Postgres cuenta mejor que Node.

---

### ARQ-12 — ALTO — Caché con tag `'venues'` que nadie invalida

**Ubicación:** `src/app/(main)/venue/[id]/page.tsx:16, 81-83`

```ts
const getVenueData = unstable_cache(
  async (id: string) => { /* 4 queries */ },
  ['venue-profile'],
  { revalidate: 3600, tags: ['venues'] }
)
```

`rg "revalidateTag" src` → **cero resultados**. El tag `'venues'` es decorativo. Las server actions del dashboard solo revalidan rutas del propio dashboard:

```ts
// src/app/dashboard/venue/actions.ts:68,99
revalidatePath("/dashboard/venue")
// src/app/dashboard/courts/actions.ts:45,64,98,158
revalidatePath("/dashboard/courts")
```

Ninguna toca `/venue/[id]`, `/` (que cachea 1 hora vía `export const revalidate = 3600` en `(main)/page.tsx:14`) ni `/search`.

**Escenario de fallo concreto:** T=0 (viernes 18:00), el complejo detecta que le sobran turnos y activa una promo al 40% desde el dashboard. La action guarda y llama `revalidatePath("/dashboard/courts")`. T=1, el dueño ve el precio nuevo en su panel. T=2, un usuario entra a `/venue/[id]` y ve el precio viejo — la entrada de `unstable_cache` es válida hasta 60 minutos después. T=3, el usuario entra a la home y el carrusel de promos (`(main)/page.tsx:52-70`, cacheado 1h) ni siquiera muestra la oferta. T=19:00, la promo aparece. El horario que se quería llenar ya pasó.

Inverso y peor: si el complejo **desactiva** una cancha, la ficha pública sigue mostrándola y ofreciendo reservarla durante una hora.

**Impacto:** hasta 60 minutos de inconsistencia entre lo que el complejo cree que publicó y lo que el usuario ve. El mecanismo correcto ya está en el código (el tag existe); solo falta que alguien lo dispare.

**Aspecto positivo a destacar:** la disponibilidad **no** se cachea — `AvailabilityGrid` la consulta en vivo por RPC desde el cliente (`availability-grid.tsx:40-45`). Eso está bien resuelto y evita el peor escenario de todos (vender un turno ya vendido por caché obsoleta). Ver "Decisiones acertadas".

**Remediación descriptiva:** llamar `revalidateTag('venues')` desde todas las actions que muten `venues`, `courts` o `pricing_rules`, y usar tags por complejo (`venue-${id}`) para no invalidar el catálogo entero en cada edición.

---

### ARQ-13 — ALTO — El middleware ejecuta `auth.getUser()` en cada request

**Ubicación:** `src/middleware.ts:31-33, 49-59`

```ts
const { data: { user } } = await supabase.auth.getUser()
// ...
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

`supabase.auth.getUser()` es una **llamada de red al servidor de Auth de Supabase**, no una verificación local del JWT. El matcher excluye assets estáticos pero **no excluye `/api`**, así que también corre en `/api/webhooks/mercadopago` — donde no hay ni puede haber sesión de usuario.

**Escenario de fallo concreto:** viernes 20:00, 500 usuarios navegando. Cada navegación (home → search → venue → booking = 4 páginas) dispara 4 llamadas de middleware, cada una con un round-trip a Supabase Auth. Son 2.000 llamadas de auth en un pico de pocos minutos, sumadas a las queries de datos. Simultáneamente, cada webhook de MP paga ese round-trip antes de siquiera empezar a procesarse, añadiendo latencia al camino más crítico del sistema y acercándolo al timeout.

Si el servicio de Auth de Supabase se degrada, **se cae la navegación completa del sitio**, incluidas las páginas públicas que no necesitan sesión (home, search, ficha de complejo).

**Impacto:** el middleware es un punto único de fallo síncrono sobre el 100% del tráfico, incluido el que no necesita autenticación.

**Remediación descriptiva:** restringir el matcher a las rutas que realmente requieren sesión (`/dashboard/:path*`, `/admin/:path*`, `/bookings`, `/profile`, `/booking/:path*`) y excluir explícitamente `/api/webhooks`. Bonus: el middleware verifica `!user` pero no el rol, así que un `player` autenticado pasa el guard de `/admin` — la defensa real vuelve a estar solo en RLS.

---

### ARQ-14 — ALTO — `Header` cliente con `useUser`: 2 round-trips extra por navegación

**Ubicación:** `src/components/layout/header.tsx:1`, `src/app/(main)/layout.tsx:11`, `src/hooks/useUser.ts:23-32`

```tsx
// header.tsx:1
"use client"
// ...
const { user, profile, isLoading, signOut } = useUser()
```

```ts
// useUser.ts:23-32
const { data: { session } } = await supabase.auth.getSession()
if (session?.user) {
  if (mounted) setUser(session.user)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
```

El `Header` está en el layout del grupo `(main)`, o sea en **todas** las páginas públicas. Es Client Component, y al montar hace dos llamadas secuenciales: `getSession()` y luego `SELECT * FROM profiles`.

**Escenario de fallo concreto:** el middleware ya resolvió el usuario en el servidor (ARQ-13), el layout es un Server Component que podría pasarlo por props, y sin embargo el navegador vuelve a preguntarlo. Cada navegación del usuario cuesta: 1 `getUser` de middleware + 1 `getSession` de cliente + 1 `SELECT profiles` de cliente = **3 round-trips de auth por página**. Con 500 usuarios × 4 páginas, son ~6.000 requests a Supabase solo para saber quién es el usuario. Como efecto visible, el header muestra un skeleton en cada navegación aunque el servidor ya conocía la sesión.

**Impacto:** carga innecesaria sobre Supabase, y una capa completa del árbol (header, sheet, dropdown, avatar) enviada al cliente sin necesidad. De 132 archivos `.ts`/`.tsx` en `src/`, **59 llevan `'use client'`** (medido con `rg -l "^['\"]use client" src | wc -l`) — un 45% del árbol es cliente.

**Remediación descriptiva:** resolver la sesión en el layout (Server Component) y pasar `user`/`profile` como props a un header mayormente estático, dejando en cliente solo el menú desplegable.

---

### ARQ-15 — ALTO — Notificaciones bloqueantes sin timeout en la cancelación

**Ubicación:** `src/lib/booking/actions.ts:45-54`, `src/lib/notifications/index.ts:16-49`

```ts
// booking/actions.ts:45-54
// 5. Notificar
const { notify } = await import('@/lib/notifications')
await notify('booking_cancelled', { booking, user: booking.profiles, venue: booking.courts?.venues, creditAmount: policy.creditAmount || 0 })
```

En el webhook sí se usa `waitUntil` (`mercadopago/route.ts:80`), lo cual es correcto. En el camino de cancelación **no**: el `await` bloquea la respuesta HTTP hasta que Resend conteste. No hay `AbortController`, no hay timeout, no hay reintento. Y `notify` traga cualquier error:

```ts
// notifications/index.ts:47-49
} catch (error) {
  console.error(`Error in notification dispatcher for event ${event}:`, error)
}
```

**Escenario de fallo concreto:** T=0, Resend está degradado y sus requests cuelgan 30 segundos. T=1, usuario cancela desde el diálogo (`cancel-dialog.tsx:42` → `POST /api/booking/cancel`). T=2, la reserva **ya se canceló en la base** (`booking/actions.ts:29-37`) y el crédito ya se creó (`:42`). T=3, `notify` cuelga esperando a Resend. T=4 (10s en plan Hobby / 15s en Pro), la función serverless de Vercel es terminada por timeout. El cliente recibe un error 504. T=5, el usuario ve "error al cancelar" y vuelve a intentar. T=6, `cancelBooking` responde "La reserva ya está cancelada" (`:20`). El usuario cree que falló todo, cuando en realidad se ejecutó por completo.

**Impacto:** un proveedor de email lento tumba una operación de negocio ya consumada, y el usuario recibe información contradictoria. La notificación perdida no se recupera: `catch(console.error)` y `Promise.allSettled` (`notifications/index.ts:24`) garantizan que ningún fallo de email o WhatsApp deje rastro accionable.

**Remediación descriptiva:** aplicar el mismo `waitUntil` que ya se usa en el webhook, poner timeout explícito a las llamadas externas, y persistir los intentos fallidos en una tabla de outbox para reintento.

---

### ARQ-16 — ALTO — El cliente de MP redirige a `/mock-payment`, página eliminada

**Ubicación:** `src/lib/mercadopago/client.ts:22-29`

```ts
if (!process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
  console.log("Mocking Mercado Pago payment due to missing or TEST- token")
  return {
    id: "mock_preference_id_" + bookingId,
    init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`,
    ...
```

`git status` muestra `D src/app/(main)/mock-payment/page.tsx`. La página no existe.

**Escenario de fallo concreto:** T=0, se despliega staging con un token `TEST-` (que es exactamente lo que uno hace en staging). T=1, un tester pulsa "Ir a pagar". T=2, `create-preference` **inserta la reserva pending** correctamente. T=3, el navegador va a `/mock-payment?...` → **404**. T=4, la reserva queda pendiente bloqueando el slot hasta que el cron la limpie (si el cron corre — ver ARQ-03). Todo el flujo de pago es intestable en cualquier entorno que no tenga credenciales de producción reales.

**Impacto:** imposibilidad de probar el camino crítico end-to-end. Y una rama de mock viva en el código de producción, que se activa por una condición de entorno.

**Remediación descriptiva:** o se restaura la página de mock, o se elimina la rama por completo y se falla explícito cuando falta el token. Una rama de simulación que apunta a una ruta inexistente es lo peor de las dos opciones.

---

### ARQ-17 — MEDIO — Transferencia bancaria: reserva fantasma con URL literal

**Ubicación:** `src/components/booking/booking-wizard.tsx:79-83`

```tsx
} else {
  // Transferencia MVP
  toast({ title: 'Éxito', description: 'En esta versión Demo, la transferencia redirige al éxito directamente simulando aprobación manual.' })
  router.push(`/booking/court-id/success?booking_id=${(booking.id || '')}`)
}
```

`court-id` es un literal, no una interpolación. Y `booking.id` **siempre** es `undefined`: la página lo pasa así explícitamente (`src/app/(main)/booking/[courtId]/page.tsx:109` → `id: undefined`).

**Escenario de fallo concreto:** T=0, usuario elige "Transferencia" (opción visible y seleccionable en la UI, `:223-231`). T=1, ve un toast que dice literalmente "En esta versión Demo…". T=2, es redirigido a `/booking/court-id/success?booking_id=` → la success page no encuentra `booking_id` y hace `redirect("/search")` (`success/page.tsx:17-19`). T=3, **no se creó ninguna reserva**. El usuario acaba de vueltas en la búsqueda sin entender qué pasó.

El mismo defecto afecta al botón "Cancelar" del paso 1 (`:160`): `cancelPendingBooking(booking.id || '')` llama con string vacío, lo que produce un error de UUID inválido en el `DELETE`, silenciado por el `catch`.

**Impacto:** una vía de pago completamente muerta pero visible al usuario, y un mensaje interno de desarrollo ("versión Demo") expuesto en producción.

**Remediación descriptiva:** o se implementa el flujo de transferencia (crear reserva `pending` con `deposit_method: 'transfer'` y adjuntar comprobante), o se oculta la opción hasta que exista.

---

### ARQ-18 — MEDIO — `not-found.tsx` es Server Component con `onClick`

**Ubicación:** `src/app/not-found.tsx:1-15`

```tsx
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    // ...
      <Button onClick={() => window.location.href="/"}>
```

Sin `'use client'`. En Next 14 App Router, pasar un handler de evento desde un Server Component a un Client Component es un error de build ("Event handlers cannot be passed to Client Component props").

**Escenario de fallo concreto:** hoy este error está **enmascarado** por ARQ-01 — el build muere antes en la resolución de módulos. Cuando se arreglen los 5 imports, el build volverá a fallar por esto. Es un bloqueador en fila.

**Remediación descriptiva:** un `<Link href="/">` renderizado por el `Button` (el patrón `render={<Link/>}` ya se usa en el resto del código, p. ej. `dashboard/page.tsx:33-37`), sin `onClick` ni `'use client'`.

---

### ARQ-19 — MEDIO — 105 `@ts-expect-error` mantienen `tsc` en verde

**Ubicación:** `src/` — medido con `rg -n "@ts-expect-error" src | wc -l` → **105**; `rg -n "as never" src | wc -l` → **13**; `rg -n "eslint-disable" src | wc -l` → **51** directivas en **34** archivos.

Resultados de los gates:

| Comando | Resultado |
| :-- | :-- |
| `npx tsc --noEmit` | ✅ exit 0, sin errores |
| `npm run lint` | ✅ "No ESLint warnings or errors" |
| `npm run build` | ❌ **Failed to compile** |
| `npx vitest run` | ❌ **3 failed / 26 tests** |

El proyecto declara `"strict": true` en `tsconfig.json:6`. En la práctica, cada punto de fricción con el tipado se resolvió suprimiéndolo. El caso emblemático es `src/lib/booking/actions.ts:19-20`:

```ts
// @ts-expect-error fix inference
if (booking.status === 'cancelled') throw new Error("La reserva ya está cancelada")
```

**Impacto:** los dos gates que corren rápido y que el desarrollador mira (`tsc`, `lint`) dan verde mientras el sistema no compila y la lógica de cancelación está rota. La señal de calidad está invertida: **el verde es informativo de nada**. Esto es lo que permitió que ARQ-01 y ARQ-02 se commitearan.

**Remediación descriptiva:** generar los tipos de Supabase (`supabase gen types`) para que las queries con joins infieran bien y los `@ts-expect-error` sobren; prohibir nuevos supresores vía regla de lint; y agregar `npm run build` y `npm test` al pipeline obligatorio.

---

### ARQ-20 — MEDIO — La regla de la seña vive en 6 lugares

**Ubicación:** existe un helper canónico que **nadie usa**:

```ts
// src/lib/utils/currency.ts:17-19
export function calculateDeposit(totalPrice: number, depositPercentage: number): number {
  return Math.ceil((totalPrice * depositPercentage) / 100)
}
```

Las seis implementaciones vivas de la misma regla:

| # | Ubicación | Fragmento |
| :-- | :-- | :-- |
| 1 | `src/lib/utils/currency.ts:17` | helper canónico — **0 llamadores** |
| 2 | `src/lib/mercadopago/helpers.ts:6` | `Math.ceil(totalPrice * 0.30)` — **30% hardcodeado**, ignora `deposit_percentage` |
| 3 | `src/app/(main)/booking/[courtId]/page.tsx:104` | `requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0` |
| 4 | `src/app/api/booking/create-preference/route.ts:58` | idéntico al anterior, copiado |
| 5 | `src/app/(main)/booking/[courtId]/success/page.tsx:93` | `Math.ceil(booking.total_price * ((deposit_percentage \|\| 30) / 100))` — **ignora `deposit_amount` y los créditos** |
| 6 | `src/components/booking/booking-wizard.tsx:191` | *"debes abonar la seña (30%)"* — hardcodeado en el copy |

**Escenario de divergencia concreto:** T=0, un complejo configura `deposit_percentage = 50` (permitido por el constraint de `007_venue_deposit_settings.sql:4`). T=1, el usuario ve en el wizard el texto "la seña (30%)" (#6) junto al monto correcto del 50% (#3). T=2, paga el 50%. T=3, la página de éxito recalcula (#5) — coincide por casualidad, porque usa el mismo porcentaje. T=4, si el complejo cambia el porcentaje después, la página de éxito de reservas **pasadas** muestra un monto distinto del que se cobró, porque recalcula en vez de leer el `deposit_amount` histórico.

**Impacto:** cada cambio de la regla exige tocar 6 lugares y ninguno está testeado en conjunto. La existencia del helper sin llamadores (#1) indica que alguien intentó centralizarlo y no completó la migración.

**Remediación descriptiva:** una sola fuente — el helper — y que las vistas lean `deposit_amount` persistido en lugar de recalcular.

---

### ARQ-21 — MEDIO — Tres caminos de cancelación con reglas distintas

**Ubicación:**

| Camino | Archivo | Qué hace | Aplica política |
| :-- | :-- | :-- | :-- |
| A | `src/app/api/booking/cancel/route.ts:13` → `src/lib/booking/actions.ts:5` | `UPDATE status='cancelled'` + crédito + notificación | sí (rota, ver ARQ-02) |
| B | `src/app/actions/booking.ts:11-16` | **`DELETE`** de la fila | **no** |
| C | `src/app/dashboard/bookings/actions.ts:7-22` | `UPDATE status` arbitrario | **no** |

```ts
// src/app/actions/booking.ts:11-16 — camino B
const { error } = await supabase
  .from("bookings")
  .delete()
  .eq("id", bookingId)
  .eq("user_id", userData.user.id)
  .eq("payment_status", "pending")
```

La ruta `src/app/api/bookings/cancel/route.ts` (plural) figura como `D` en git status — se eliminó una cuarta variante, pero quedaron tres.

**Escenario de fallo concreto (camino B):** T=0, usuario paga en MP. T=1, MP lo devuelve al sitio; el webhook aún no llegó, así que `payment_status` sigue `'pending'`. T=2, el usuario, confundido, vuelve atrás y pulsa "Cancelar" en el wizard (`booking-wizard.tsx:156-166`). T=3, el `DELETE` de B matchea (`payment_status = 'pending'` ✓) y **borra la reserva pagada**. T=4, llega el webhook, no encuentra la fila, responde 500. Mismo pago huérfano que ARQ-04, por otro camino.

*(En la práctica este disparo hoy no ocurre porque `booking.id` es siempre `undefined` — ver ARQ-17 — pero el día que se arregle ese bug, la trampa se arma sola.)*

El camino C no verifica ownership del complejo: solo `auth.getUser()` (`dashboard/bookings/actions.ts:9-10`). La única defensa contra que un jugador llame `updatePaymentStatus(id, 'paid')` es el trigger `protect_booking_fields` de `018_fix_triggers_auth.sql:56-58`. La autorización vive exclusivamente en la base de datos; la capa de aplicación no la tiene.

**Impacto:** la misma operación de negocio con tres semánticas distintas y una sin ninguna regla. Ningún dueño claro.

**Remediación descriptiva:** un único servicio de cancelación con la política aplicada en un solo lugar, y borrar el camino de `DELETE`: una reserva pagada nunca debe desaparecer de la base.

---

### ARQ-22 — MEDIO — Índices ausentes para el cron, la búsqueda y el lock de créditos

**Ubicación:** `supabase/migrations/011_performance_indexes.sql` (completo, 15 líneas), contrastado con las queries reales.

Índices que existen y son correctos: `courts_venue_id_idx`, `pricing_rules_court_id_idx`, `conversations_venue_id_idx`, `conversations_user_id_idx`, `messages_conversation_id_idx`, `venues_owner_id_idx`, más `bookings_court_date_idx` y `bookings_user_id_idx` de la `001`.

Índices que faltan para consultas que sí corren:

| Query | Ubicación | Índice faltante |
| :-- | :-- | :-- |
| Cron: `WHERE payment_status='pending' AND status='pending' AND created_at < …` — **cada minuto** | `019_credit_locks.sql:19-22` | parcial sobre `(created_at) WHERE status='pending' AND payment_status='pending'` |
| Cron: `WHERE locked_for_booking_id IN (…)` — **cada minuto** | `019_credit_locks.sql:11` | `credits(locked_for_booking_id)` — la `019` añade la columna y **no** la indexa |
| Búsqueda: `name/city/address ILIKE '%q%'` | `search/page.tsx:55` | GIN con `pg_trgm` |
| Dashboard: `ORDER BY created_at DESC` sobre bookings del venue | `dashboard/page.tsx:47` | `bookings(created_at)` |
| Créditos: `status='available' AND locked_for_booking_id IS NULL AND expires_at > now` | `credits/manager.ts:89-95` | el existente `credits_user_status_idx` cubre parcialmente; falta `expires_at` |

Además, **ningún índice del proyecto se crea con `CONCURRENTLY`**. En una tabla `bookings` con volumen, un `CREATE INDEX` sin `CONCURRENTLY` toma un `SHARE` lock que bloquea todos los `INSERT` mientras dura — es decir, **el despliegue de una migración de índice congela las reservas**.

**Escenario de fallo concreto:** con 100.000 reservas históricas, el cron ejecuta cada 60 segundos un sequential scan completo de `bookings` (sin índice para su predicado) más otro sobre `credits`. Un viernes a las 20:00, con la base ya bajo presión por el dashboard (ARQ-11) y la búsqueda (ARQ-10), ese scan periódico compite por I/O con el camino de reserva. La latencia del `INSERT` de `create-preference` sube y algunos usuarios ven timeouts al pulsar "Ir a pagar".

**Remediación descriptiva:** índices parciales que matcheen exactamente los predicados del cron; índice sobre `credits.locked_for_booking_id`; `pg_trgm` + GIN para la búsqueda; y `CONCURRENTLY` en toda creación futura sobre tablas calientes.

---

### ARQ-23 — MEDIO — Sin paginación en inbox, admin/users, mensajes y reseñas

**Ubicación:** ninguna de estas consultas tiene `.limit()` ni `.range()`:

```ts
// src/lib/supabase/queries.ts:68-77 — todo el historial del chat, siempre
export async function getConversationMessages(supabase, conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, profiles(id, full_name, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
```

```ts
// src/app/admin/users/page.tsx:14-16 — todos los perfiles con todas sus columnas
const { data: users } = await supabase.from("profiles")
  .select("*")
  .order("created_at", { ascending: false })
```

También: `queries.ts:45-53` (`getUserBookings`), `queries.ts:80-89` (`getVenueReviews`), `dashboard/inbox/page.tsx:40-44` (conversaciones), `venue/[id]/page.tsx:67-74` (reseñas de la ficha pública).

**Escenario de fallo concreto:** una conversación de soporte activa acumula 800 mensajes. Cada vez que el admin abre ese hilo desde el inbox, se descargan los 800 con el perfil del remitente embebido en cada uno. El panel de `admin/users` descarga el padrón completo de usuarios con `select("*")` — email, teléfono, rol, saldo — en un solo payload, sin límite.

Detalle colateral en `admin/users/page.tsx:59`: `${profile.credits?.toLocaleString('es-AR') || 0}` — la columna `credits` no está en el `select`, así que la celda muestra siempre `0`.

**Remediación descriptiva:** paginación por cursor en mensajes (los últimos N + scroll infinito hacia arriba), `.range()` en los listados de admin, y proyecciones explícitas en vez de `select("*")` sobre tablas con PII.

---

### ARQ-24 — MEDIO — RPC `SECURITY DEFINER` sin `search_path`

**Ubicación:** `supabase/migrations/020_availability_rpc.sql:3-17`

```sql
CREATE OR REPLACE FUNCTION public.get_venue_availability(p_venue_id UUID, p_date DATE)
RETURNS TABLE (court_id UUID, start_time TIME) AS $$
BEGIN
  RETURN QUERY
  SELECT b.court_id, b.start_time
  FROM public.bookings b
  JOIN public.courts c ON b.court_id = c.id
  WHERE c.venue_id = p_venue_id AND b.booking_date = p_date AND b.status != 'cancelled';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Falta `SET search_path = public, pg_temp` y no hay `REVOKE EXECUTE ... FROM public` / `GRANT` explícito. El mismo patrón se repite en todas las funciones `SECURITY DEFINER` del proyecto: `002_rls_policies.sql:11-19`, `018_fix_triggers_auth.sql:4,31`, `019_credit_locks.sql:5`.

**Impacto:** una función `SECURITY DEFINER` sin `search_path` fijo puede ser inducida a resolver `bookings` o `courts` contra un esquema controlado por el llamador. En Supabase el riesgo práctico es acotado (los roles `anon`/`authenticated` no suelen poder crear esquemas), pero es una desviación de la práctica estándar que Postgres documenta explícitamente. Como diseño está bien: la función es la forma correcta de exponer disponibilidad sin filtrar datos de otras reservas.

**Remediación descriptiva:** añadir `SET search_path` a las cinco funciones y declarar los grants de forma explícita.

---

### ARQ-25 — BAJO — `rescheduleBooking()` es código muerto

**Ubicación:** `src/lib/booking/actions.ts:59-105`

`rg -n "rescheduleBooking" src` devuelve **una sola línea**: su propia definición. Nadie la importa. `src/components/booking/reschedule-dialog.tsx` existe pero no hace ningún `fetch` (verificado con `rg "fetch\(" src/components/booking/reschedule-dialog.tsx` → sin resultados).

Consecuencia arquitectónica: la migración `017_reschedule_loophole.sql` completa — la columna `is_rescheduled`, el trigger que bloquea el cambio directo de fechas (`:47-53`) — protege una funcionalidad que **ningún usuario puede invocar**. Y la rama de `calculateCancellationPolicy` que penaliza reservas reprogramadas (`credits/manager.ts:21-28`) es inalcanzable.

Además, si algún día se conecta, la función tiene un defecto propio: actualiza `start_time` pero no `end_time` (`:94-100`), y no reconsulta `pricing_rules` para el nuevo horario, permitiendo mover una reserva de horario valle a prime-time sin diferencia de precio.

**Remediación descriptiva:** conectar el diálogo o retirar la función. Migraciones que blindan código muerto son deuda que se paga en confusión.

---

### ARQ-26 — BAJO — Cero observabilidad

**Ubicación:** `rg -c "console\." src` → **40 archivos**; ningún logger estructurado, ninguna integración de errores, ninguna dead-letter queue.

Los puntos donde importa:

```ts
// src/app/api/webhooks/mercadopago/route.ts:76
await consumeLockedCredits(bookingId).catch(console.error)
// :85
}).catch(console.error)
// :89
console.log(`✅ [Webhook MP] Reserva ${bookingId} confirmada.`)
```

```ts
// src/app/actions/chat.ts:69
}).catch(e => console.error("Error sending email", e))
```

Si `consumeLockedCredits` falla, el crédito queda bloqueado para siempre en una reserva ya pagada (nunca pasa a `used`, nunca vuelve a `available`) y la única evidencia es una línea en los logs de Vercel que nadie lee. Lo mismo para todo fallo de notificación: `notifications/index.ts:47-49` y los cuatro `catch` de `email.ts` garantizan que ningún email perdido deje registro accionable.

`pg_cron` tampoco tiene monitoreo: sus errores van a `cron.job_run_details`, tabla que no consulta ningún código ni ninguna alerta.

**Remediación descriptiva:** logger estructurado con `booking_id` como campo de correlación, tabla de outbox para notificaciones con reintento, y una alerta sobre fallos del cron.

---

### ARQ-27 — BAJO — `next.config.mjs` sin `remotePatterns` de Supabase Storage

**Ubicación:** `next.config.mjs:3-14`

```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: 'placehold.co' },
  ],
},
```

Pero las fotos reales de los complejos se suben a Supabase Storage y se guarda su URL pública:

```ts
// src/components/dashboard/venue/venue-photos-form.tsx:42-44
const { data: { publicUrl } } = supabase.storage
  .from('venue-photos')
  .getPublicUrl(fileName)
```

Esas URLs viven en `<project-ref>.supabase.co`, host no declarado. Y se renderizan con `next/image` en `src/app/(main)/bookings/page.tsx:69-74`, `src/components/venue/venue-card.tsx`, `venue-gallery.tsx` y `dashboard/reviews/page.tsx`.

**Escenario de fallo concreto:** T=0, un complejo sube su primera foto real desde el dashboard. La subida funciona y la URL se guarda. T=1, cualquier usuario abre la búsqueda o la ficha: el optimizador de imágenes de Next rechaza el host y devuelve **400 `Invalid src prop … hostname is not configured`**. La tarjeta del complejo queda rota. Hoy no se ve porque los datos de prueba usan Unsplash y placehold.co.

El config tampoco tiene `optimizePackageImports`, que en este proyecto ayudaría con `lucide-react` y `date-fns` (26 MB en disco, importado en 6 componentes cliente).

---

### ARQ-28 — BAJO — `gsap` en el bundle inicial de la landing; `test/integration/` vacío

**Ubicación:** `src/components/home/hero-search.tsx`, `src/components/ui/stagger-grid.tsx`, `test/integration/`

El manejo de las librerías pesadas es **desigual**, y conviene ser justo:

| Librería | Peso en disco | Tratamiento | Veredicto |
| :-- | :-- | :-- | :-- |
| `@splinetool` (3D) | 34 MB | `dynamic(..., { ssr: false })` en `(main)/page.tsx:12`, dentro de `hidden lg:block` (`:121`), y cargado desde CDN con `<Script strategy="lazyOnload">` (`hero-3d.tsx:26-30`) | ✅ bien resuelto |
| `leaflet` + `react-leaflet` | 4 MB | `dynamic(..., { ssr: false })` con fallback en `map/venue-map.tsx:7-15` | ✅ bien resuelto |
| `react-day-picker` | 3.4 MB | solo en `ui/calendar.tsx`, no en la home | ✅ aceptable |
| `gsap` + `@gsap/react` | 6.3 MB | importado **estáticamente** en `hero-search.tsx` (`'use client'`), que la home renderiza directo (`(main)/page.tsx:141`) | ❌ en el bundle inicial |
| `date-fns` | 26 MB | importado en 6 componentes cliente, sin `optimizePackageImports` | ⚠️ depende del tree-shaking |

`hero-search.tsx` es el buscador del hero — el elemento de conversión principal — y arrastra GSAP consigo en la carga inicial de la landing.

**No pude medir el tamaño real de los bundles porque `npm run build` falla (ARQ-01).** Los pesos de la tabla son `du -sh node_modules/<pkg>`, que es tamaño en disco sin minificar ni tree-shakear, no tamaño de bundle. **[NO CONFIRMADO]** el impacto en KB transferidos.

Sobre testing, el número real: `npx vitest run` → **26 tests en 5 archivos, 3 fallando**. Los archivos son `src/lib/utils.test.ts` (1 test), `src/lib/utils/currency.test.ts` (13), `src/lib/utils/dates.test.ts` (10), `src/lib/credits/manager.test.ts` (5), `src/lib/notifications/templates.test.ts` (2). El directorio `test/integration/` **está vacío** (`ls -R test/` → solo `setup.ts` y un directorio `integration` sin contenido), pese a que `package.json:10` define el script `test:integration`.

**No existe un solo test que cubra:**
- doble reserva concurrente del mismo slot
- webhook de MP entregado dos veces
- webhook que llega después de que el cron borró la reserva
- aplicación concurrente del mismo crédito desde dos requests
- cualquier cosa que toque la base de datos

Los 26 tests que hay cubren funciones puras de formato de moneda, fechas y plantillas de email. **La red de seguridad no cubre ni una sola de las siete fallas críticas de este informe.** Peor aún: los 3 tests que sí encontraron un bug real (ARQ-02) están fallando en el working tree y se commiteó igual, lo que significa que la red existe y se está ignorando activamente.

---

## El día del incidente

**Viernes 20:00. Pico de la semana. 500 usuarios buscando cancha para el partido de las 21:00.**

**20:00** — Todo empieza bien, porque en realidad no empezó: el último deploy falló (**ARQ-01**) y producción sirve la versión anterior. Los fixes de seguridad de las migraciones 013–020 nunca se desplegaron. Nadie lo sabe: `tsc` y `lint` daban verde (**ARQ-19**).

*Supongamos que alguien arregló los cinco imports a las 19:00 y el deploy salió.*

**20:01** — 500 usuarios abren la home y `/search`. Cada navegación paga tres round-trips de auth: uno del middleware (**ARQ-13**) y dos del header cliente (**ARQ-14**). `/search` es `force-dynamic`, sin paginación, y trae el catálogo completo con canchas y reglas de precio anidadas para filtrarlo en Node (**ARQ-10**). La latencia p95 empieza a subir.

**20:03** — El cron corre, como cada minuto. Sequential scan completo de `bookings` y de `credits`, sin índices que sirvan a sus predicados (**ARQ-22**). Compite por I/O con las 500 búsquedas. Si el cron nunca se agendó por el error de sintaxis de la `012` (**ARQ-03**), en cambio lo que hay son cientos de reservas `pending` fantasma bloqueando los mejores horarios desde hace semanas.

**20:05** — Tres complejos, viendo turnos vacíos, activan promos desde el dashboard. Nadie las ve: la ficha de complejo está cacheada una hora con un tag que ningún código invalida (**ARQ-12**), y la home también. Las promos aparecerán a las 21:00, cuando el partido ya empezó.

**20:06** — Los dueños refrescan sus dashboards para ver las reservas entrantes. Cada refresh descarga el histórico completo de reservas de su complejo (**ARQ-11**). Cuatro complejos grandes × un refresh cada dos minutos = decenas de miles de filas cruzando la red, encima de la carga de búsqueda.

**20:08** — Usuario A pulsa "Ir a pagar" para la cancha 3 a las 21:00. Se crea la reserva `pending` con `end_time: "23:59:00"` (**ARQ-08**). Va a Mercado Pago. Tarjeta rechazada, cambia de medio, validación por SMS.

**20:11:01** — El cron borra la reserva de A. Habían pasado 3 minutos y un segundo (**ARQ-04**). El slot se libera.

**20:11:20** — Usuario B, que estaba mirando la grilla, ve la cancha 3 libre y la reserva. Su insert pasa sin conflicto.

**20:11:40** — A completa el pago. MP le cobra $4.500.

**20:11:45** — Llega el webhook de A. `external_reference` apunta a una fila que ya no existe. El `.single()` falla, se lanza, se responde **500**. MP reintentará durante 24 horas y fallará 24 horas. No hay dead-letter queue, no hay alerta: solo un `console.error` en los logs de Vercel (**ARQ-26**).

**20:11:46** — A ve la página de éxito: **"¡Reserva Confirmada! Tu pago ha sido procesado exitosamente y la cancha ya es tuya."** La página nunca miró `payment_status` (**ARQ-09**). A saca captura.

**20:12** — Usuario C paga correctamente y su webhook llega duplicado, como hace MP. Las dos invocaciones pasan el guard de idempotencia porque es un `SELECT` seguido de un `UPDATE` incondicional (**ARQ-05**). C recibe dos emails y dos WhatsApps.

**20:14** — Usuario D tiene $5.000 de crédito y dos pestañas abiertas de dos canchas del mismo complejo. Pulsa "Ir a pagar" en ambas. Ambos requests leen el mismo crédito como disponible (**ARQ-07**), ambos calculan `amountToPay = 0`, ambas reservas se confirman directo. Dos canchas entregadas, un crédito consumido.

**20:20** — Usuario E, que reservó para las 20:30 y no llega, cancela. La política de cancelación recibe `NaN` (**ARQ-02**) y no aplica la ventana de 1 hora: la cancelación pasa a diez minutos del partido. La cancha 5 queda vacía en el horario más caro de la semana. Usuario F, que canceló ayer con 48 horas de anticipación, no recibió su crédito por el mismo `NaN`, y escribe al inbox — que carga las conversaciones sin paginar (**ARQ-23**).

**21:00** — Usuario A llega a la cancha 3 con su captura de "Reserva Confirmada" y el comprobante de MP. Encuentra a B jugando. El encargado busca en el panel y no hay ninguna reserva a nombre de A: se borró a las 20:11:01.

**Nadie tiene un log estructurado, un dashboard de errores ni una alerta para reconstruir qué pasó.** El único registro es una línea `console.error` perdida entre miles, y un pago de $4.500 en la cuenta de Mercado Pago sin reserva asociada.

---

## Falsos remediados

Contrastando `audit-reports/06-reporte-resolucion-final.md` contra el código actual:

| ID previo | Se declaró | Realidad verificada |
| :-- | :-- | :-- |
| **UX-05** — "Import PascalCase en mapas (crash Vercel/Linux)" | ✅ Resuelto — *"`venue-map.tsx`, `location-picker.tsx` → kebab-case"* | ❌ **FALSO**. `venue-map.tsx:3` sigue importando `@/components/search/VenueList`. El archivo se renombró pero **sus imports no**. `npm run build` falla hoy con 5 errores de módulo (ARQ-01). El propio reporte se contradice: en la línea 87 anota `REG-ARC-02` diciendo lo contrario. |
| **ARC-06 / NEG-02** — "Créditos sin transaccionalidad" / "Doble gasto de créditos" | ✅ Resuelto — *"`019_credit_locks.sql` — bloqueo por `locked_for_booking_id`"* | ❌ **FALSO**. La `019` solo añade una columna (`:3`). No hay `FOR UPDATE`, ni transacción, ni advisory lock. `applyCredits` (`credits/manager.ts:112-160`) sigue siendo `SELECT` → N `UPDATE` sobre la red, con la ventana de carrera intacta (ARQ-07). El nombre del archivo es aspiracional. |
| **ARC-03** — "Cron purga reservas a los 3 minutos" | 🟡 Parcial — *"016 lo fijó a 15min pero 019 lo reintrodujo a 3min"* | ❌ **Es peor que parcial: es una regresión completa.** La `019:15` y `:22` fijan 3 minutos, y el mensaje del commit HEAD (`a1f7e7f`) lo consagra: *"delete abandoned bookings after 3 minutes"*. El estado actual es idéntico al del hallazgo original de ronda 1. Además la `012` del working tree ahora **no compila** (ARQ-03), lo que agrega un modo de fallo nuevo. |
| **ARC-14** — "Disponibilidad expuesta sin filtrar" | ✅ Resuelto — *"`020_availability_rpc.sql` con SECURITY DEFINER"* | 🟡 **Parcial**. La RPC efectivamente limita la proyección a `court_id` y `start_time`, y eso está bien. Pero es `SECURITY DEFINER` sin `SET search_path` ni grants explícitos (ARQ-24), lo que reintroduce una superficie distinta. |
| **NEG-06** — "Notificaciones sin `await` (Vercel las mata)" | ✅ Resuelto — *"removido `setTimeout(0)`"* | 🟡 **Parcial**. El webhook sí usa `waitUntil` correctamente (`mercadopago/route.ts:80`). Pero `cancelBooking` hace `await notify(...)` bloqueante y sin timeout (`booking/actions.ts:47`, ARQ-15): se cambió un modo de fallo (notificación perdida) por otro (timeout de la función tras la mutación ya aplicada). |
| **NEG-05** — "Arbitraje de señas (reprogramar + cancelar)" | ✅ Resuelto — *"`actions.ts` — `is_rescheduled: true` en update"* | 🟡 **Vacío de efecto.** El código existe pero `rescheduleBooking` **no tiene ni un solo llamador** en toda la base (ARQ-25). Se protegió un agujero al que nadie puede llegar. Y aunque se conectara, la penalización vive en la rama `diffHours >= 6` de `calculateCancellationPolicy`, que es inalcanzable por el `NaN` de ARQ-02. |
| **BUG-FIN-01** — "NaN en `hoursUntilBooking()`" | ❌ No Resuelto *(honesto)* | ✅ Confirmado como no resuelto, **pero la severidad está subestimada**. El reporte previo lo lista bajo "bugs financieros" en una fila de tabla. Es el defecto individual de mayor impacto del sistema: anula por completo la política de cancelación y reprogramación, y hay 3 tests fallando que lo prueban desde hace al menos un commit. Debería ser CRÍTICO-1, no una fila más. |
| **ARC-01** — "Mutación en HTTP GET: INSERT al cargar la página" | ✅ Resuelto | ✅ **Verdadero.** `booking/[courtId]/page.tsx` hoy solo lee; el `INSERT` vive en `POST /api/booking/create-preference:68`. Bien hecho. |
| **ARC-02** — "`beforeunload` beacon destructivo" | ✅ Resuelto | ✅ **Verdadero.** El listener se eliminó; en `booking-wizard.tsx:37-39` quedó solo el comentario huérfano. Bien hecho. |
| **ARC-05** — "Webhook MP sin admin client" | ✅ Resuelto | ✅ **Verdadero.** `mercadopago/route.ts:51` usa `createAdminClient()`. Bien hecho. |

---

## Decisiones arquitectónicas acertadas

Ocho, con evidencia. Son reales y hay que reconocerlas:

1. **El índice único parcial es una protección de doble-booking genuina a nivel de base de datos** — `supabase/migrations/008_fix_booking_constraint.sql:8-10`:
   ```sql
   CREATE UNIQUE INDEX bookings_no_double_booking_idx
   ON public.bookings (court_id, booking_date, start_time)
   WHERE status NOT IN ('cancelled');
   ```
   Es la decisión más importante y correcta de todo el proyecto. Ninguna carrera de aplicación puede producir dos reservas activas del mismo slot exacto: Postgres lo rechaza. El predicado parcial que excluye `cancelled` es exactamente lo que hay que hacer para permitir recontratar un slot liberado. Sin esto, con las carreras que hay en la capa de aplicación, el overbooking sería sistemático.

2. **La disponibilidad no se cachea nunca** — `src/components/venue/availability-grid.tsx:40-45` consulta la RPC en vivo desde el cliente, en un `useEffect` con `dateStr` como dependencia, mientras el resto de la ficha (`venue/[id]/page.tsx:16`) se cachea una hora. Es la separación correcta: los datos estables se cachean, el dato volátil que decide una venta no. Evitó el peor escenario posible, que era vender un turno ya vendido por caché obsoleta.

3. **La RPC acota la proyección de disponibilidad** — `supabase/migrations/020_availability_rpc.sql:5-6` devuelve exactamente `(court_id, start_time)` y nada más. Un cliente que necesita saber qué está ocupado no recibe `user_id`, ni precios, ni datos del que reservó. Diseño de mínimo privilegio bien aplicado.

4. **El `AvailabilityGrid` va dentro de un `Suspense` con fallback propio** — `src/app/(main)/venue/[id]/page.tsx:210-217`. La ficha del complejo (SEO, fotos, precios, reseñas) se pinta de inmediato y solo la grilla espera. Es el uso correcto de streaming: aislar la parte lenta sin bloquear el contenido indexable.

5. **`waitUntil` en el webhook** — `src/app/api/webhooks/mercadopago/route.ts:79-86`. Es la primitiva correcta para trabajo post-respuesta en Vercel, y demuestra que se entendió el modelo de ejecución serverless. El defecto es que no se aplicó también en `cancelBooking` (ARQ-15), no la decisión en sí.

6. **El precio se cotiza en el servidor, no se acepta del cliente** — `src/app/api/booking/create-preference/route.ts:34-49` consulta `pricing_rules` y descarta cualquier precio que viniera en el body; el `POST` solo acepta `{ title, courtId, date, time }` (`:15`). Cierra de raíz la inyección de precio, que era la fuga financiera número uno de la ronda 1.

7. **Vista segura para PII en las reseñas públicas** — `supabase/migrations/015_close_phase_0.sql:16-18` crea `public_user_profiles` con solo `id, full_name, avatar_url`, y `venue/[id]/page.tsx:71` la consume en vez de `profiles`. Es el patrón correcto: no relajar la RLS de la tabla sensible, exponer una vista con la proyección mínima.

8. **La migración 018 corrige un patrón de bypass con la verificación adecuada** — `supabase/migrations/018_fix_triggers_auth.sql:8, 35` reemplaza `auth.uid() IS NULL` (que un cliente anónimo también satisface) por `current_setting('request.jwt.claim.role', true) = 'service_role'`. Entender por qué el primer chequeo era inseguro y corregirlo en las dos funciones a la vez es trabajo de calidad.

**Mención honesta adicional:** los pesados 3D y de mapas están bien encapsulados con `next/dynamic` + `ssr: false` (`(main)/page.tsx:12`, `map/venue-map.tsx:7-15`), y el Spline se carga desde CDN con `strategy="lazyOnload"` dentro de un `hidden lg:block`. Eso es más disciplina de la que se ve habitualmente; el problema es GSAP, que quedó fuera del mismo tratamiento (ARQ-28).

---

## Límites de esta auditoría

- **No pude medir tamaños de bundle.** `npm run build` falla (ARQ-01), así que no hay output de Next con First Load JS por ruta. Los pesos que reporto son `du -sh node_modules/<pkg>` — tamaño en disco sin minificar ni tree-shakear — y **no** son equivalentes a KB transferidos al navegador. Marcado como `[NO CONFIRMADO]` donde corresponde.
- **No ejecuté nada contra una base de datos real.** No pude verificar si `pg_cron` está habilitado en el proyecto Supabase, si el job `delete-abandoned-bookings` figura en `cron.job`, ni qué migraciones se aplicaron efectivamente. Todo el análisis de SQL es lectura estática de los archivos en `supabase/migrations/`. Si el equipo aplicó parches manualmente por el SQL Editor de Supabase, el estado real de la base puede diferir de lo que dicen las migraciones.
- **No pude verificar planes de ejecución.** Sin acceso a la base no hay `EXPLAIN ANALYZE`, así que el análisis de índices (ARQ-22) se basa en contrastar los predicados de las queries del código con los índices declarados en las migraciones, no en costos medidos.
- **No verifiqué el comportamiento real de la API de Mercado Pago** respecto a la ventana de deduplicación del header `X-Idempotency-Key` (ARQ-06) ni sus políticas de reintento de webhooks. El escenario descrito es la consecuencia lógica de una clave constante compartida; su materialización exacta depende de la implementación de MP.
- **No hubo pruebas de carga ni de concurrencia.** Los escenarios temporales están derivados de la lectura del código (ausencia de locks, guards no atómicos, ventanas entre SELECT y UPDATE), no de reproducciones. La ausencia de la protección es verificable; la frecuencia con que se manifiesta bajo carga real, no.
- **No levanté servidores ni hice red**, según lo pedido. No hay verificación de runtime de rutas, timeouts reales de Vercel ni latencias observadas.
- **Superficie no auditada en profundidad:** el subsistema de chat (`009_chat_schema.sql`, `010_chat_attachments_and_storage.sql`, los canales Realtime de `player-chat-modal.tsx` e `inbox-client.tsx`) se revisó solo en lo referido a paginación y observabilidad; las fugas de canales Realtime señaladas como ARC-10 en la ronda 1 quedaron fuera de alcance. Tampoco audité `supabase/functions/` (Edge Functions) ni el flujo de autenticación OAuth.
- **Esta auditoría cubre el eje de arquitectura.** Hallazgos de seguridad (RLS, RBAC en el middleware, inyección de filtro PostgREST en `search/page.tsx:55`, JSON-LD sin escapar en `venue/[id]/page.tsx:153`), de accesibilidad y de UX se mencionan solo cuando tienen consecuencia arquitectónica directa; corresponden a los otros informes de esta ronda.
