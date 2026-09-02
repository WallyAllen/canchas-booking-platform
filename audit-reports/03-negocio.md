# Auditoría Crítica de Lógica de Negocio y Reglas Financieras (ReservaYa)
**Rol:** Abogado del Diablo de Negocios (Business Logic Specialist)  
**Fecha:** 29 de Agosto de 2026  
**Documento de Entrega:** `audit-reports/03-negocio.md`  
**Estado del Dictamen:** 🚨 **RECHAZADO / CRÍTICO (VULNERABILIDADES FINANCIERAS SEVERAS)**

---

## 1. Resumen Ejecutivo y Veredicto Forense

Tras una auditoría destructiva y exhaustiva línea por línea del código fuente (`src/`) y el esquema de base de datos (`supabase/migrations/`) de la plataforma **ReservaYa**, se concluye que el sistema presenta **fallas críticas de lógica de negocio, fugas financieras sistemáticas, vulnerabilidades de arbitraje de tarifas, destrucción de saldo de usuarios e inoperabilidad operativa**.

El sistema incumple preceptos fundamentales estipulados en `AGENTS.md` y contiene brechas arquitectónicas donde un usuario malintencionado puede:
1. **Alterar arbitrariamente el precio de la seña** desde el cliente (pagar $1 ARS por una reserva de $30.000 ARS).
2. **Eludir la política de cancelación tardía (<6h)** mediante un bucle de reprogramación infinita, recuperando el 100% de la seña en créditos para turnos no reembolsables.
3. **Apropiarse de turnos prime-time de alto valor** reprogramando turnos económicos sin pagar la diferencia de precio.
4. **Perder créditos legítimos** debido a que el sistema destruye el remanente de los créditos en usos parciales ("Credit Burn").
5. **Perder reservas pagadas legítimamente en Mercado Pago** porque el webhook de confirmación falla por RLS anónimo y el cron `delete_abandoned_bookings` borra la reserva a los 3 minutos de haber sido abonada.
6. **Bloquear todas las canchas de un competidor mediante ataques DoS** navegando con peticiones HTTP GET automatizadas que crean reservas pendientes.

---

## 2. Matriz de Riesgos y Pérdidas Financieras Estimadas

| ID | Hallazgo | Severidad | Impacto Financiero / Operativo | Facilidad de Explotación |
|:---|:---|:---:|:---|:---:|
| **NEG-01** | Inyección de precio desde el cliente en `/api/booking/create-preference` | **CRÍTICO** | Pérdida directa de ingresos por señas adulteradas ($1 ARS). | Trivial (Modificación payload JSON) |
| **NEG-02** | Destrucción de saldo remanente de créditos ("Credit Burn") | **CRÍTICO** | Apropiación indebida de fondos de usuarios, contingencia legal/defensa del consumidor. | Automático en cada uso parcial |
| **NEG-03** | Bucle de reprogramación y cancelación para eludir retención de seña (<6h) | **CRÍTICO** | 100% de elusión de penalización por cancelaciones tardías; canchas ociosas. | Trivial (Reprogramar a fecha lejana y cancelar) |
| **NEG-04** | Arbitraje de precios en reprogramación a horarios pico | **ALTO** | Pérdida del diferencial de tarifa entre turnos valle y turnos prime-time. | Trivial |
| **NEG-05** | Desincronización de zonas horarias (UTC Vercel vs ART UTC-3) | **ALTO** | Bloqueo o habilitación errónea de ventanas de 6h y 2h; turnos futuros marcados como "pasados". | Constante (Diferencia de 3 horas) |
| **NEG-06** | Consumo prematuro e irreversible de créditos antes de confirmar pago | **ALTO** | Destrucción de créditos si el checkout de Mercado Pago es cancelado o falla. | Automático en carritos abandonados |
| **NEG-07** | Falla de RLS en Webhook de Mercado Pago y purga por cron | **CRÍTICO** | Clientes pagan en MP pero su reserva es eliminada de la BD a los 3 min. | Constante en entorno de producción |
| **NEG-08** | Bloqueo de turnos (Denial of Service) por peticiones GET en `BookingPage` | **ALTO** | Cierre malicioso de disponibilidad de competidores sin pagar un centavo. | Trivial (Script de peticiones GET) |
| **NEG-09** | Confirmación ilusoria de pagos por "Transferencia" | **ALTO** | Jugadores concurren creyendo tener reserva; la BD la borra a los 3 min. | Trivial (Flujo UI normal) |
| **NEG-10** | Inoperabilidad absoluta del sistema de reseñas por `booking_id` ausente y RLS obsoleto | **MEDIO** | 0% de reseñas reales pueden publicarse; violación de AGENTS.md. | Total (Siempre falla en BD) |
| **NEG-11** | Auto-reseñas falsas del administrador mediante reservas manuales | **MEDIO** | Manipulación de reputación y distorsión de ratings en la plataforma. | Trivial |
| **NEG-12** | Violación de la regla de seña mínima del 30% en ajustes de complejo | **MEDIO** | Desprotección de complejos ante ausencias (no-shows). | Configuración en UI |
| **NEG-13** | Saldo fantasma de créditos vencidos en interfaz de usuario | **MEDIO** | Fricción con el usuario y reclamos de soporte por saldos caducos. | Visual |
| **NEG-14** | Precios promocionales no deterministas por solapamiento de reglas | **MEDIO** | Cobro errático de tarifa completa en horarios de descuento. | Aleatorio en base de datos |
| **NEG-15** | Escalación pública de privilegios en `/upgrade` y manipulación de perfiles | **CRÍTICO** | Cualquier usuario se asigna rol `platform_admin` o altera `credit_balance`. | Trivial |
| **NEG-16** | Distorsión de métricas de facturación en Dashboard de Complejo | **BAJO** | Reporte de ingresos inflado en 333% (toma total_price en vez de seña cobrada). | Métricas erróneas |

---

## 3. Hallazgos Detallados de Lógica de Negocio

---

### Hallazgo NEG-01: Inyección de Precio desde el Payload del Cliente (Fuga Financiera Directa)
* **Severidad:** **CRÍTICA**
* **Archivos Afectados:**
  - `src/app/api/booking/create-preference/route.ts` (Líneas 14–19, 38–39, 60–65)
  - `src/components/booking/BookingWizard.tsx` (Líneas 62–67)
* **Código Verificado:**
```typescript
// src/app/api/booking/create-preference/route.ts:14-19
const body = await request.json()
const { title, price, bookingId, courtId } = body

if (!title || !price || !bookingId || !courtId) {
  return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
}

// Línea 38-39: El servidor confía ciegamente en `price` enviado por el navegador
const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0
let amountToPay = depositAmount
```
* **Mecanismo de Explotación:**
  1. Un atacante inicia el flujo de reserva de una cancha cuyo valor real es `$24.000 ARS` (seña estipulada `$7.200 ARS`).
  2. Intercepta la petición `POST /api/booking/create-preference` mediante las herramientas de desarrollo del navegador o un script HTTP.
  3. Modifica el payload JSON: `{"price": 10, "bookingId": "...", "courtId": "...", "title": "..."}`.
  4. El endpoint calcula `depositAmount = Math.ceil((10 * 30) / 100) = 3` ARS.
  5. Mercado Pago genera un link de pago por `$3 ARS`.
  6. El atacante abona `$3 ARS`. Al recibir el webhook de aprobación, la reserva pasa a estado `confirmed` y `payment_status = 'paid'`, habiendo abonado centavos por una reserva premium.
* **Impacto Financiero:** Despojo sistemático de los ingresos por seña del complejo deportivo.
* **Solución de Negocio Requerida:**
  El endpoint **NUNCA** debe recibir `price` desde el cliente. Debe consultar la tabla `bookings` por `bookingId`, validar que `booking.user_id === user.id`, y utilizar exclusivamente `booking.total_price` y los datos de `venues.deposit_percentage` persistidos en la base de datos.

---

### Hallazgo NEG-02: Destrucción de Saldo Remanente en Créditos ("Credit Burn" / Apropiación Indebida)
* **Severidad:** **CRÍTICA**
* **Archivos Afectados:**
  - `src/lib/credits/manager.ts` (Líneas 99–131, especialmente 121–127)
* **Código Verificado:**
```typescript
// src/lib/credits/manager.ts:121-127
for (const credit of credits) {
  if (remainingToApply <= 0) break;

  // MVP: Consumimos el crédito completo. 
  // (Si un crédito es de $5000 y solo necesitás $3000, en este MVP se consume entero para simplificar)
  await (supabase.from('credits') as any)
    .update({ status: 'used', used_at: now })
    .eq('id', credit.id)
    
  remainingToApply -= credit.amount
}
```
* **Escenario de Falla Real:**
  1. Un usuario canceló con anticipación una reserva de `$20.000 ARS` y obtuvo un crédito legítimo de `$6.000 ARS`.
  2. Días después, reserva una cancha de `$10.000 ARS` cuya seña requerida es de `$3.000 ARS`.
  3. El sistema aplica el crédito de `$6.000 ARS`, cubre los `$3.000 ARS` y **quema la totalidad del registro de crédito**, marcándolo como `status: 'used'`.
  4. Los `$3.000 ARS` restantes del usuario son **destruidos de forma irreversible**.
* **Impacto Financiero y Legal:** Confiscación no consentida de fondos de usuarios. Violación de las leyes de Defensa del Consumidor (Ley 24.240 en Argentina) y generación de fraude contable.
* **Solución de Negocio Requerida:**
  Implementar consumo fraccionado o partición de saldo: Si un crédito de `$6.000` se utiliza parcialmente por `$3.000`, debe actualizarse el monto a `$3.000` o marcarse el original como usado y crearse una nueva fila de crédito remanente por `$3.000` con la fecha de expiración original heredada.

---

### Hallazgo NEG-03: Bucle de Reprogramación y Cancelación (Elusión de Política <6h)
* **Severidad:** **CRÍTICA**
* **Archivos Afectados:**
  - `src/lib/booking/actions.ts` (Líneas 6–53, 55–98)
  - `src/lib/credits/manager.ts` (Líneas 5–39, 41–51)
* **Código Verificado:**
```typescript
// src/lib/credits/manager.ts:41-51
export function canReschedule(booking: any) {
  const now = new Date()
  const bookingDate = new Date(`${booking.booking_date}T${booking.start_time}`)
  const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours >= 2) {
    return { allowed: true, reason: 'Reprogramación permitida.' }
  }
  return { allowed: false, reason: 'Reprogramación no permitida con menos de 2 horas de anticipación.' }
}
```
* **Mecanismo del Exploit (Loophole):**
  1. Un jugador tiene un partido hoy a las 20:00 hs (seña abonada: `$6.000 ARS`).
  2. A las 17:00 hs (faltando 3 horas para el inicio), decide que no asistirá.
  3. Si cancela directamente, aplica la regla de cancelación tardía (`diffHours < 6`), por lo que su seña es retenida (`refundType = 'forfeit'`, `$0` crédito).
  4. **El exploit:** El usuario ejecuta `rescheduleBooking(bookingId, '2026-09-30', '20:00:00')`. Dado que faltan 3 horas y la regla exige `diffHours >= 2`, la reprogramación es **aprobada gratuitamente**.
  5. Una vez que el turno está fechado para dentro de 30 días, el usuario ejecuta inmediatamente `cancelBooking(bookingId)`.
  6. La función de cancelación evalúa la nueva fecha (`diffHours >= 6` cumple con holgura) y le otorga **el 100% de la seña en créditos de plataforma**.
  7. El complejo se queda con la cancha vacía a 3 horas del partido sin percibir la indemnización de la seña.
* **Impacto Financiero:** Anulación total de la protección que la seña brinda a los predios frente a cancelaciones de último momento.
* **Solución de Negocio Requerida:**
  - Registrar en la tabla `bookings` una bandera `is_rescheduled BOOLEAN DEFAULT FALSE` o una columna `original_booking_date`.
  - Si una reserva fue reprogramada dentro de la ventana crítica (< 6 horas del turno original), la reserva debe quedar marcada como **no cancelable con derecho a crédito** (`non_refundable = TRUE`).
  - Limitar las reprogramaciones a 1 sola vez por reserva.

---

### Hallazgo NEG-04: Arbitraje de Tarifas y Evasión en Reprogramaciones a Horarios Prime
* **Severidad:** **ALTO**
* **Archivos Afectados:**
  - `src/lib/booking/actions.ts` (Líneas 88–93)
* **Código Verificado:**
```typescript
// src/lib/booking/actions.ts:88-93
const { error: updateError } = await (supabase.from("bookings") as any)
  .update({ 
    booking_date: newDate,
    start_time: newTime
  })
  .eq("id", bookingId)
```
* **Mecanismo de Explotación:**
  1. Un usuario reserva un turno económico en horario marginal (ej. Martes 10:00 AM, tarifa total `$8.000 ARS`, seña pagada `$2.400 ARS`).
  2. Luego invoca `rescheduleBooking` para mover el turno al Viernes 21:00 hs (tarifa prime-time de `$25.000 ARS`, seña normal `$7.500 ARS`).
  3. La acción del servidor solo actualiza `booking_date` y `start_time`. No recalcula el precio de acuerdo a las `pricing_rules` del nuevo horario ni exige el cobro del diferencial de seña.
  4. El usuario obtiene el turno de `$25.000 ARS` habiendo pagado solo `$2.400 ARS` de seña y adeudando en ventanilla solo `$5.600 ARS` (remanente de los $8.000 originales).
* **Impacto Financiero:** Fuga de `$17.000 ARS` por partido en perjuicio del dueño del predio.
* **Solución de Negocio Requerida:**
  La función `rescheduleBooking` debe consultar las `pricing_rules` de la cancha para el nuevo día y horario. Si el nuevo precio es mayor, debe liquidar la diferencia de seña requerida vía Mercado Pago antes de confirmar el cambio de horario. Si es menor, no debe emitir reembolsos automáticos o ajustar el saldo restante en cancha.

---

### Hallazgo NEG-05: Desincronización de Zonas Horarias (UTC vs ART UTC-3)
* **Severidad:** **ALTO**
* **Archivos Afectados:**
  - `src/lib/credits/manager.ts` (Líneas 6–8, 42–44)
  - `src/components/booking/CancelDialog.tsx` (Líneas 31–33)
  - `src/app/(main)/bookings/page.tsx` (Líneas 42–50)
* **Código Verificado:**
```typescript
// src/lib/credits/manager.ts:6-8
const now = new Date()
const bookingDate = new Date(`${booking.booking_date}T${booking.start_time}`)
const diffHours = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)
```
* **Análisis de la Falla:**
  1. En el entorno de ejecución en la nube (Vercel Node.js Serverless), la hora del sistema `now` se encuentra en **UTC (Tiempo Universal Coordinado)**.
  2. Las cadenas `"2026-08-30"` y `"20:00:00"` corresponden a la hora local de **La Plata, Argentina (UTC-3)**.
  3. `new Date("2026-08-30T20:00:00")` en Vercel se interpreta como las 20:00 UTC (las 17:00 en Argentina, 3 horas antes de lo real).
  4. **Consecuencia:**
     - Si un usuario en Argentina intenta cancelar un partido a las 13:00 ART para un juego a las 20:00 ART (7 horas antes):
       - En Argentina: `20 - 13 = 7 hs` (corresponde crédito > 6h).
       - En Vercel: `now` es 16:00 UTC, `bookingDate` es 20:00 UTC -> `diffHours = 4 hs`. El servidor rechaza el crédito y confisca la seña.
     - En `src/app/(main)/bookings/page.tsx`: A las 22:00 ART del día en curso, el servidor UTC está en las 01:00 UTC del día siguiente. Los partidos programados para las 23:00 ART son marcados erróneamente como "Pasados", inhabilitando los botones de gestión al usuario.
* **Solución de Negocio Requerida:**
  Normalizar todas las fechas explicitando la zona horaria de Argentina: `new Date(`${booking.booking_date}T${booking.start_time}-03:00`)` o utilizar librerías como `date-fns-tz` / `luxon` con la zona `America/Argentina/Buenos_Aires`.

---

### Hallazgo NEG-06: Consumo Prematuro e Irreversible de Créditos antes de Completar el Pago
* **Severidad:** **ALTO**
* **Archivos Afectados:**
  - `src/app/api/booking/create-preference/route.ts` (Líneas 41–46)
* **Código Verificado:**
```typescript
// src/app/api/booking/create-preference/route.ts:41-46
if (credits > 0 && amountToPay > 0) {
  amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
  
  // MVP: Consumimos los créditos ahora mismo. Si falla MP, el admin tendrá que devolverlos manualmente.
  await applyCredits(user.id, bookingId, venueId, Math.min(credits, depositAmount))
}
```
* **Mecanismo de Falla:**
  1. Un usuario con `$4.000 ARS` de crédito inicia una reserva con seña de `$7.000 ARS`.
  2. El endpoint `/api/booking/create-preference` aplica y consume los `$4.000 ARS` en base de datos inmediatamente, reduciendo el monto a pagar en Mercado Pago a `$3.000 ARS`.
  3. El usuario es redirigido a Mercado Pago, pero decide no pagar, cierra la ventana o su tarjeta es rechazada.
  4. La reserva queda en `status = 'pending'`. A los 3 minutos, el cron `delete_abandoned_bookings` elimina la reserva.
  5. **Resultado:** Los `$4.000 ARS` de créditos del usuario quedaron en `status = 'used'` vinculados a una reserva eliminada. El usuario perdió su saldo sin haber completado la reserva.
* **Solución de Negocio Requerida:**
  Los créditos no deben marcarse como `used` al crear la preferencia de pago. Deben quedar en estado `reserved` / `locked` con un timestamp de expiración temporal, o consumirse **únicamente** en el webhook cuando Mercado Pago certifique el pago exitoso del remanente (`paymentData.status === 'approved'`).

---

### Hallazgo NEG-07: Falla de RLS en Webhook de Mercado Pago y Purga Automática por Cron (Pérdida de Reservas Pagadas)
* **Severidad:** **CRÍTICA**
* **Archivos Afectados:**
  - `src/app/api/webhooks/mercadopago/route.ts` (Línea 48)
  - `supabase/migrations/002_rls_policies.sql` (Líneas 80–88)
  - `supabase/migrations/012_abandoned_bookings_cron.sql` (Líneas 8–13)
* **Código Verificado:**
```typescript
// src/app/api/webhooks/mercadopago/route.ts:48
// Actualizar en DB usando el client del servidor
const supabase = await createClient()

const { data: booking, error } = await (supabase.from('bookings') as any)
  .update({ 
    payment_status: 'paid',
    status: 'confirmed',
    updated_at: new Date().toISOString()
  })
  .eq('id', bookingId)
```
* **Mecanismo del Desastre Operativo:**
  1. El webhook de Mercado Pago es invocado por los servidores de MP (sin cookies de sesión de usuario).
  2. `createClient()` genera una instancia anónima de Supabase con `auth.uid() = NULL`.
  3. La política RLS de `bookings` exige:
     ```sql
     CREATE POLICY "Users can update their bookings..." ON public.bookings
     FOR UPDATE USING (user_id = auth.uid() OR ...);
     ```
  4. Como `auth.uid()` es nulo, el comando `UPDATE` es denegado o afecta a `0` filas.
  5. La reserva permanece en la base de datos con `payment_status = 'pending'` y `status = 'pending'`.
  6. El cron de la base de datos corre cada minuto:
     ```sql
     DELETE FROM public.bookings
     WHERE payment_status = 'pending' 
       AND status = 'pending'
       AND created_at < NOW() - INTERVAL '3 minutes';
     ```
  7. A los 3 minutos de que el usuario pagó en Mercado Pago, el cron **borra físicamente la reserva de la base de datos**.
  8. Cuando el usuario y sus amigos llegan al predio, no figuran en el sistema y la cancha pudo haber sido vendida a otra persona.
* **Impacto Financiero y Operativo:** Cobro efectivo realizado al cliente sin contraprestación de servicio. Quejas graves, reclamos de contracargos bancarios (chargebacks) y desprestigio terminal de la plataforma.
* **Solución Requerida:**
  El webhook debe utilizar `createAdminClient()` (usando `SUPABASE_SERVICE_ROLE_KEY`) para actualizar el estado del booking eludiendo RLS, y almacenar el `mp_payment_id` para garantizar idempotencia.

---

### Hallazgo NEG-08: Bloqueo Malicioso de Canchas (Denial of Service) mediante Peticiones HTTP GET
* **Severidad:** **ALTO**
* **Archivos Afectados:**
  - `src/app/(main)/booking/[courtId]/page.tsx` (Líneas 103–130)
  - `src/components/venue/AvailabilityGrid.tsx` (Líneas 44–46, 143–145)
* **Código Verificado:**
```typescript
// src/app/(main)/booking/[courtId]/page.tsx:103-118
if (!booking) {
  // 5. Generar un Booking temporal (Pending) para poder crear la preferencia de pago
  const { data: newBooking, error: insertError } = await (supabase.from("bookings") as any)
    .insert({
      user_id: user.id,
      court_id: court.id,
      booking_date: date,
      start_time: `${timeStr}:00`,
      end_time: "23:59:00",
      total_price: price,
      payment_status: "pending",
      status: "pending"
    })
```
* **Mecanismo de Explotación:**
  1. En el App Router de Next.js, `BookingPage` es una Server Page que se ejecuta en cada petición `GET /booking/[courtId]?date=YYYY-MM-DD&time=HH:MM`.
  2. Cada vez que alguien entra a la URL, el servidor ejecuta un `INSERT` en la tabla `bookings` con estado `pending`.
  3. En `AvailabilityGrid.tsx`, la consulta busca todos los bookings donde `status != 'cancelled'`. Como la reserva recién insertada está en `pending`, el slot aparece inmediatamente como **"Ocupado"** para todos los demás usuarios del mundo.
  4. Un atacante o competidor puede ejecutar un script simple:
     ```bash
     for h in $(seq 14 23); do curl -b "cookies" "https://reservaya.com/booking/$COURT_ID?date=2026-08-30&time=${h}:00"; done
     ```
  5. En 2 segundos, todas las canchas de todos los complejos quedan bloqueadas en estado "Ocupado". Si el script se repite cada 2.5 minutos, **la plataforma queda 100% paralizada comercialmente sin costo alguno para el atacante**.
* **Solución de Negocio Requerida:**
  Las peticiones `GET` de navegación jamás deben mutar el estado de la base de datos. La reserva temporal sólo debe crearse mediante una Server Action o petición `POST` explícita cuando el usuario hace clic en "Ir a Pagar" o "Continuar", con un bloqueo atómico transaccional (`SELECT FOR UPDATE`).

---

### Hallazgo NEG-09: Falsa Confirmación de Pagos por "Transferencia" (Phantom Bookings)
* **Severidad:** **ALTO**
* **Archivos Afectados:**
  - `src/components/booking/BookingWizard.tsx` (Líneas 81–85)
  - `src/app/(main)/booking/[courtId]/success/page.tsx` (Líneas 57–65)
* **Código Verificado:**
```typescript
// src/components/booking/BookingWizard.tsx:81-85
} else {
  // Transferencia MVP
  alert('En esta versión Demo, la transferencia redirige al éxito directamente simulando aprobación manual.')
  router.push(`/booking/court-id/success?booking_id=${booking.id}`)
}
```
* **Escenario de Falla:**
  1. El usuario selecciona "Transferencia Bancaria" y es redirigido a `/booking/[courtId]/success?booking_id=...`.
  2. La pantalla de éxito muestra con un tilde verde gigante: *"¡Reserva Confirmada! Tu pago ha sido procesado exitosamente y la cancha ya es tuya"*.
  3. Sin embargo, en la base de datos la reserva nunca cambió de estado: sigue en `status: 'pending'`, `payment_status: 'pending'` y `deposit_method` es nulo o inválido.
  4. Al cabo de 3 minutos, el cron `delete_abandoned_bookings` destruye la reserva de la base de datos.
  5. El usuario realizó la transferencia bancaria al CBU del predio, pero el turno quedó libre en la web y otro usuario lo reserva y paga por Mercado Pago. Dos equipos se presentan al mismo tiempo a jugar el mismo partido (conflicto físico en el predio).
* **Solución de Negocio Requerida:**
  Si se permite transferencia, la reserva debe pasar a un estado explícito `status: 'pending_transfer_approval'` (con una ventana de gracia de 2 horas para subir comprobante, no 3 minutos), y la pantalla de éxito debe indicar claramente *"Reserva Pendiente de Aprobación - Envía tu comprobante"*.

---

### Hallazgo NEG-10: Inoperabilidad Total del Sistema de Reseñas (Gating Roto y Discrepancia de Esquema)
* **Severidad:** **MEDIO**
* **Archivos Afectados:**
  - `src/components/venue/ReviewSection.tsx` (Líneas 56–61)
  - `supabase/migrations/001_initial_schema.sql` (Línea 90)
  - `supabase/migrations/002_rls_policies.sql` (Líneas 94–101)
  - `supabase/migrations/004_fix_schema_inconsistencies.sql` (Línea 2)
* **Código Verificado:**
```typescript
// src/components/venue/ReviewSection.tsx:56-61
const supabase = createClient()
const { error } = await (supabase.from('reviews') as any).insert({
  venue_id: venueId,
  user_id: user.id,
  rating,
  comment: comment.trim() || null
})
```
* **Causas del Colapso:**
  1. **Omisión de columna obligatoria:** La tabla `reviews` define `booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id)`. `ReviewSection.tsx` jamás envía `booking_id`, provocando que Postgres aborte la inserción con violación de `NOT NULL constraint`.
  2. **RLS hace referencia a columna inexistente:** En `002_rls_policies.sql`, la política exige `b.booking_status = 'completed'`. En `004_fix_schema_inconsistencies.sql`, la columna fue renombrada a `status`. La política RLS arroja error fatal `column b.booking_status does not exist`.
  3. **Ausencia de automatización de estado `completed`:** No existe ningún cron job ni trigger que pase las reservas pasadas a `completed`. Las reservas confirmadas quedan en `confirmed` para siempre, haciendo imposible que un usuario califique como jugador verificado.
* **Solución de Negocio Requerida:**
  1. Modificar la interfaz de usuario para que el jugador seleccione a partir de qué reserva completada está opinando (`booking_id`).
  2. Actualizar la política RLS en una nueva migración SQL para validar contra `b.status = 'completed'`.
  3. Implementar un cron `SELECT public.mark_completed_bookings();` que corra cada hora y marque como `completed` los turnos cuya fecha y hora de fin ya transcurrieron.

---

### Hallazgo NEG-11: Inyección de Auto-Reseñas Falsas mediante Reservas Manuales
* **Severidad:** **MEDIO**
* **Archivos Afectados:**
  - `src/app/dashboard/schedule/actions.ts` (Líneas 33–47)
* **Código Verificado:**
```typescript
// src/app/dashboard/schedule/actions.ts:33-47
// Insertar la reserva usando el ID del admin como `user_id` (ya que es obligatoria en schema actual)
const { error } = await (supabase.from("bookings") as any).insert({
  user_id: user.id,
  court_id: courtId,
  booking_date: date,
  start_time: time,
  end_time: "23:59:00",
  total_price: price,
  deposit_amount: 0,
  deposit_method: "cash",
  payment_status: "pending",
  status: "confirmed",
  source: "manual",
  manual_client_name: clientName
})
```
* **Mecanismo de Manipulación:**
  1. Cuando un administrador de cancha carga una reserva telefónica de un cliente manual, el sistema le asigna `user_id = user.id` (el propio dueño del complejo).
  2. Desde el panel, el dueño marca esa reserva manual como `completed`.
  3. El dueño del predio ahora califica formalmente en la base de datos como un usuario que completó un partido en su propio complejo.
  4. Puede emitir múltiples reseñas de 5 estrellas con comentarios inflados, alterando fraudulentamente el `avg_rating` y `review_count` del predio en los listados de búsqueda.
* **Solución de Negocio Requerida:**
  Permitir `user_id NULL` para reservas manuales (con `source = 'manual'`), o restringir en la política RLS de `reviews` que `reviews.user_id != venues.owner_id`.

---

### Hallazgo NEG-12: Incumplimiento del Mandato de Seña Mínima del 30% en Ajustes de Complejo
* **Severidad:** **MEDIO**
* **Archivos Afectados:**
  - `src/app/dashboard/venue/actions.ts` (Líneas 75–90)
  - `supabase/migrations/007_venue_deposit_settings.sql` (Líneas 2–4)
* **Código Verificado:**
```sql
-- supabase/migrations/007_venue_deposit_settings.sql:2-4
ALTER TABLE public.venues 
ADD COLUMN require_deposit BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN deposit_percentage INTEGER NOT NULL DEFAULT 30 CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100);
```
* **Conflicto Normativo:**
  `AGENTS.md` prescribe explícitamente:
  > *"Seña (deposit): 30% minimum of total price, always paid digitally (Mercado Pago)."*
  
  Sin embargo, la migración 007 y `updateVenuePaymentSettings` permiten que un complejo desactive `require_deposit = false` o establezca un porcentaje del `0%` o `10%`.
* **Impacto Operativo:** Debilita el modelo de negocio central de ReservaYa (garantía de asistencia y comisión sobre pagos digitales).
* **Solución Requerida:**
  Establecer un `CHECK (deposit_percentage >= 30 AND deposit_percentage <= 100)` y validar en el servidor que `require_deposit` sea siempre `true` para reservas en línea.

---

### Hallazgo NEG-13: Saldo Fantasma de Créditos Vencidos en la Interfaz de Usuario
* **Severidad:** **MEDIO**
* **Archivos Afectados:**
  - `src/components/profile/CreditsList.tsx` (Líneas 26–28)
  - `src/lib/credits/manager.ts` (Línea 88)
* **Código Verificado:**
```typescript
// src/components/profile/CreditsList.tsx:26-28
const total = data
  .filter((c: any) => c.status === 'available')
  .reduce((acc: number, curr: any) => acc + curr.amount, 0)
setAvailableCredits(total)
```
* **Análisis de la Falla:**
  1. `CreditsList.tsx` suma todos los créditos donde `status === 'available'`.
  2. No valida `expires_at > new Date().toISOString()`.
  3. No existe ningún proceso en background que cambie el estado de los créditos a `'expired'` luego de los 90 días.
  4. Por lo tanto, créditos generados hace 1 año siguen figurando como saldo disponible en la billetera del perfil del jugador.
  5. Cuando el jugador va al checkout, el backend (`getAvailableCredits`) sí filtra por fecha y no le descuenta nada. El usuario experimenta frustración al ver que la web le prometía saldo que luego no se aplica.
* **Solución Requerida:**
  1. Filtrar `new Date(c.expires_at) > new Date()` en `CreditsList.tsx`.
  2. Implementar un cron diario en pg_cron: `UPDATE credits SET status = 'expired' WHERE status = 'available' AND expires_at < NOW();`.

---

### Hallazgo NEG-14: Precios Promocionales No Deterministas por Solapamiento de Reglas
* **Severidad:** **MEDIO**
* **Archivos Afectados:**
  - `src/app/dashboard/courts/actions.ts` (Líneas 121–144)
  - `src/app/(main)/booking/[courtId]/page.tsx` (Líneas 49–68)
* **Código Verificado:**
```typescript
// src/app/(main)/booking/[courtId]/page.tsx:49-61
const { data: rules } = await (supabase.from("pricing_rules") as any)
  .select("*")
  .eq("court_id", court.id)
  .eq("day_of_week", dayOfWeek)
  .lte("start_time", `${timeStr}:00`)
  .gte("end_time", `${timeStr}:00`)

if (rules && rules.length > 0) {
  const rule = rules[0] // <-- NO HAY ORDER BY
  if (rule.is_promo_active && rule.promo_price) {
    price = rule.promo_price
  } else {
    price = rule.price
  }
}
```
* **Análisis:**
  `saveOffers` crea una regla base para todo el día (00:00 a 23:59) y una regla específica para la franja horaria en oferta. Ambas reglas satisfacen la consulta SQL para ese horario. Al no haber cláusula `ORDER BY is_promo_active DESC`, Postgres devuelve las filas según el orden físico del heap en disco.
  En momentos aleatorios, el usuario recibe el precio regular en lugar de la promoción publicada.
* **Solución Requerida:**
  Agregar `.order("is_promo_active", { ascending: false })` a la consulta de `pricing_rules`.

---

### Hallazgo NEG-15: Escalación Pública de Privilegios y Alteración de Balances (`/upgrade`)
* **Severidad:** **CRÍTICA**
* **Archivos Afectados:**
  - `src/app/upgrade/page.tsx` (Líneas 16–23)
  - `supabase/migrations/002_rls_policies.sql` (Líneas 25–26)
* **Código Verificado:**
```typescript
// src/app/upgrade/page.tsx:16-20
const { error } = await supabase
  .from('profiles')
  .update({ role: 'platform_admin' })
  .eq('id', user.id)
```
```sql
-- supabase/migrations/002_rls_policies.sql:25-26
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);
```
* **Impacto:** Cualquier usuario registrado puede navegar a `/upgrade` o ejecutar desde consola `supabase.from('profiles').update({ role: 'platform_admin', credit_balance: 9999999 })`. Al ser `platform_admin`, obtiene acceso irrestricto a todas las canchas, reservas y configuraciones financieras de toda la plataforma.
* **Solución Requerida:**
  1. Eliminar la ruta `/upgrade`.
  2. Reemplazar la política RLS en `profiles` por un trigger `BEFORE UPDATE` que impida a usuarios no-superadmin modificar sus columnas `role` y `credit_balance`.

---

### Hallazgo NEG-16: Distorsión de Métricas Financieras en el Panel de Canchas
* **Severidad:** **BAJO / MÉTRICAS**
* **Archivos Afectados:**
  - `src/app/dashboard/page.tsx` (Líneas 55–57)
* **Código Verificado:**
```typescript
// src/app/dashboard/page.tsx:55-57
const revenue = bookings
  .filter((b: any) => b.status === 'confirmed' || b.payment_status === 'paid')
  .reduce((acc: number, curr: any) => acc + (curr.total_price || 0), 0)
```
* **Impacto:**
  El cálculo suma el 100% de `total_price` para reservas que solo pagaron el 30% de seña en la plataforma, inflando artificialmente el flujo de fondos real recaudado. Para reservas canceladas con seña retenida (`status = 'cancelled'`, `payment_status = 'paid'`), la fórmula las ignora si `status !== 'confirmed'`, no contabilizando los ingresos retenidos por cancelaciones tardías.

---

### Hallazgo NEG-17: Botones Fantasma en Administración y Gestión de Reseñas (Dead UI)
* **Severidad:** **BAJO / OPERACIONAL**
* **Archivos Afectados:**
  - `src/app/admin/users/page.tsx` (Líneas 67–70)
  - `src/app/admin/moderation/page.tsx` (Líneas 52–57)
  - `src/app/dashboard/reviews/page.tsx` (Línea 94)
* **Detalle:**
  Los botones "Hacer Venue Admin", "Ban", "Aprobar", "Eliminar" y "Responder" carecen de manejadores `onClick`, `formAction` o llamadas a Server Actions. Son componentes visuales estáticos sin lógica de negocio implementada.

---

## 4. Recomendaciones Sistémicas de Arquitectura de Negocio

1. **Desacoplar la Creación de Reservas de las Peticiones HTTP GET:**
   - La reserva temporal de un slot debe ocurrir exclusivamente como respuesta a una acción explícita del usuario (`POST /api/bookings/hold`).
   - Implementar un bloqueo distribuido o bloqueo de base de datos con TTL estricto (10 minutos) que se libere automáticamente si no se inicia el pago.

2. **Crear una Máquina de Estados Estricta para Bookings y Pagos:**
   - Estados de Reserva: `draft` -> `pending_payment` -> `confirmed` -> `completed` / `cancelled` / `no_show`.
   - Estados de Pago: `unpaid` -> `deposit_paid` -> `fully_paid` -> `refunded` -> `forfeited`.
   - Prohibir transiciones de estado arbitrarias sin validación de reglas de negocio previas.

3. **Contabilidad de Créditos de Doble Entrada:**
   - Crear una tabla `credit_transactions (id, user_id, venue_id, booking_id, amount, type: 'issued'|'used'|'expired', balance_after, created_at)`.
   - Cada aplicación de crédito descuenta exactamente el importe necesario y genera un registro de auditoría, eliminando la destrucción del remanente.

4. **Blindaje de Webhooks:**
   - Usar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en los endpoints de webhook de pasarelas de pago.
   - Validar idempotencia con `mp_payment_id` antes de procesar cualquier evento de confirmación.

5. **Alineación Estricta de Timezones:**
   - Toda la aritmética de fechas para políticas de cancelación (6h) y reprogramación (2h) debe ejecutarse contra un objeto de zona horaria explícito `America/Argentina/Buenos_Aires`.

---

## 5. Plan de Pruebas de Verificación y Mitigación

Para dar por solventada esta auditoría en etapas posteriores, el equipo de desarrollo debe implementar una suite de pruebas de integración con los siguientes casos de prueba automatizados:

- [ ] **Test NEG-T01:** Intento de envío de `price: 1` a `/api/booking/create-preference` -> El servidor debe rechazar la petición o cobrar el monto real según la base de datos.
- [ ] **Test NEG-T02:** Usuario con `$10.000` de crédito paga una seña de `$4.000` -> Su saldo restante debe ser exactamente `$6.000` con la fecha de expiración original intacta.
- [ ] **Test NEG-T03:** Intento de reprogramación a 3 horas del partido y posterior cancelación -> El sistema no debe otorgar créditos por la cancelación tardía diferida.
- [ ] **Test NEG-T04:** Reprogramación de turno de `$10.000` a turno de `$25.000` -> El sistema debe exigir el pago de la diferencia de seña (`$4.500`) antes de confirmar.
- [ ] **Test NEG-T05:** Simulación de webhook de Mercado Pago `approved` con cliente anónimo -> La reserva debe actualizarse a `confirmed` y `paid` exitosamente sin errores de RLS.
- [ ] **Test NEG-T06:** Envío de reseña sin `booking_id` o de un turno no completado -> Rechazo estricto a nivel RLS y mensaje de validación claro en frontend.

---
**Firma del Auditor:**  
*Abogado del Diablo de Negocios — Equipo de Auditoría Crítica ReservaYa*
