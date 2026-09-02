# 🛡️ Reporte de Auditoría de Seguridad: ReservaYa (El Potrero)

**Proyecto:** ReservaYa / El Potrero Booking Platform  
**Fecha de Auditoría:** 29 de Agosto de 2026  
**Auditor Especialista:** Experto en Seguridad (Security Specialist)  
**Marco Normativo de Evaluación:** OWASP ASVS Level 2, OWASP API Security Top 10, CWE / SANS Top 25, Supabase Security Best Practices  
**Estado General de Seguridad:** **CRÍTICO (ALTO RIESGO)**  

---

## 1. Resumen Ejecutivo y Postura de Seguridad

Se ha llevado a cabo una auditoría destructiva, exhaustiva y línea por línea del 100% de la base de código de ReservaYa, abarcando migraciones de base de datos (`supabase/migrations/`), funciones Edge (`supabase/functions/`), clientes Supabase y middleware (`src/lib/supabase/`, `src/middleware.ts`), integración con Mercado Pago (`src/lib/mercadopago/`, `src/app/api/webhooks/`), Server Actions (`src/app/actions/`, `src/app/dashboard/**/actions.ts`), API Route Handlers (`src/app/api/`), y componentes cliente/servidor (`src/app/`, `src/components/`).

### Calificación Global de Riesgo
- **Puntuación de Seguridad:** `28 / 100` (Nivel de madurez de seguridad: Inadecuado para producción)
- **Vulnerabilidades Críticas:** 6
- **Vulnerabilidades Altas:** 5
- **Vulnerabilidades Medias:** 4
- **Vulnerabilidades Bajas / Info:** 3

### Principales Vectores de Compromiso Inmediato
1. **Escalación Total de Privilegios a `platform_admin`:** La política RLS en la tabla `profiles` permite que cualquier usuario autenticado modifique arbitrariamente su propio registro de perfil (`UPDATE USING (auth.uid() = id)`) sin restricción de columnas. Sumado a esto, existe una ruta pública activa (`/upgrade`) que permite auto-asignarse el rol `platform_admin` con un solo clic.
2. **Bypass Completo de Pasarela de Pago (Reservas Gratuitas):** 
   - La ruta de producción `/mock-payment` expone un Server Action público (`approvePayment`) que actualiza cualquier reserva a `status = 'confirmed'` y `payment_status = 'paid'` sin validación de autenticación ni pago real.
   - Las políticas RLS de `bookings` permiten al usuario creador (`user_id = auth.uid()`) actualizar libremente cualquier columna del registro de su reserva, pudiendo marcarla como `paid` directamente desde el cliente.
   - El endpoint `/api/booking/create-preference` confía en el campo `price` enviado directamente en el cuerpo JSON del cliente sin contrastarlo contra las reglas de precios (`pricing_rules`).
3. **Bypass y Fallo Estructural de Webhook de Mercado Pago:**
   - La verificación de firma HMAC en `/api/webhooks/mercadopago` se salta silenciosamente si la variable de entorno `MP_WEBHOOK_SECRET` no está configurada o si el atacante simplemente omite el header `x-signature`.
   - La comparación de firmas es susceptible a ataques de canal lateral de temporización (*timing attacks*).
   - El webhook invoca `createClient()` (cliente anónimo sin sesión) para actualizar `bookings`, lo cual es bloqueado por las políticas RLS actuales (la confirmación automática de pagos legítimos fallará en producción).
4. **Manipulación Arbitraria de Saldos y Créditos:** Las políticas RLS en la tabla `credits` permiten que un usuario ejecute `UPDATE` sobre sus propios registros de crédito sin restricciones de columnas, pudiendo inflar su monto o reactivar créditos vencidos.
5. **Inyecciones HTML y PostgREST Filter Injection:**
   - Inyección de HTML / Phishing en todas las plantillas de correo transaccionales enviadas vía Resend (`src/lib/notifications/templates.ts`).
   - XSS basado en JSON-LD en la página de complejo (`src/app/(main)/venue/[id]/page.tsx`).
   - Inyección de filtros PostgREST en el buscador (`src/app/(main)/search/page.tsx`).
6. **Exposición Pública de PII y Archivos Privados:**
   - La política RLS de `profiles` permite a cualquier usuario anónimo leer todos los emails, teléfonos y balances de créditos de todos los usuarios registrados.
   - El bucket de almacenamiento `chat-images` es 100% público, permitiendo la enumeración no autorizada de imágenes privadas enviadas en los chats.

---

## 2. Matriz Consolidada de Hallazgos

| ID | Título de la Vulnerabilidad | Categoría | Severidad | CWE / OWASP | Ubicación Principal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Escalación de privilegios horizontal y vertical en tabla `profiles` | RBAC / RLS | **CRITICAL** | CWE-284 / OWASP A01:2021 | `supabase/migrations/002_rls_policies.sql:25-26`, `src/app/upgrade/page.tsx:16-20` |
| **SEC-02** | Bypass total de pago y confirmación forzada de reservas | Pagos / Authz | **CRITICAL** | CWE-639 / OWASP API1:2023 | `src/app/(main)/mock-payment/page.tsx:22-31`, `supabase/migrations/002_rls_policies.sql:80-88` |
| **SEC-03** | Omisión de verificación de firma y fallo RLS en webhook Mercado Pago | Pagos / Webhooks | **CRITICAL** | CWE-347 / OWASP API8:2023 | `src/app/api/webhooks/mercadopago/route.ts:24-29, 48-63` |
| **SEC-04** | Manipulación de precio de reserva por parte del cliente | Lógica Financiera | **CRITICAL** | CWE-20 / OWASP API3:2023 | `src/app/api/booking/create-preference/route.ts:15, 38` |
| **SEC-05** | Modificación no autorizada de créditos y saldos vía RLS | RLS / Integridad | **CRITICAL** | CWE-862 / OWASP A01:2021 | `supabase/migrations/002_rls_policies.sql:112-113` |
| **SEC-06** | Exposición pública no autenticada de PII de usuarios en `profiles` | Fuga de Datos | **CRITICAL** | CWE-200 / OWASP API3:2023 | `supabase/migrations/002_rls_policies.sql:22-23` |
| **SEC-07** | Inyección de HTML / Phishing en plantillas de correo Resend | Inyección / XSS | **HIGH** | CWE-79 / CWE-80 | `src/lib/notifications/templates.ts:3-166`, `src/app/actions/chat.ts:62-71` |
| **SEC-08** | Bucket de imágenes de chat 100% público e inserción irrestricta en venue-photos | Storage / Authz | **HIGH** | CWE-732 / OWASP A01:2021 | `supabase/migrations/010_chat_attachments_and_storage.sql:18-20, 31-33` |
| **SEC-09** | Inyección de filtros PostgREST en búsqueda de canchas | Inyección | **HIGH** | CWE-943 / OWASP A03:2021 | `src/app/(main)/search/page.tsx:55` |
| **SEC-10** | Falla de autorización RBAC en Server Actions de gestión de reservas | RBAC / Authz | **HIGH** | CWE-862 / OWASP API5:2023 | `src/app/dashboard/bookings/actions.ts:8-40` |
| **SEC-11** | Edge Functions no autenticadas expuestas a invocación pública | Serverless Auth | **HIGH** | CWE-306 / OWASP API2:2023 | `supabase/functions/expire-credits/index.ts`, `supabase/functions/send-reminder/index.ts` |
| **SEC-12** | XSS en script JSON-LD incrustado | XSS / DOM | **MEDIUM** | CWE-79 / OWASP A03:2021 | `src/app/(main)/venue/[id]/page.tsx:143-146` |
| **SEC-13** | Redirección abierta en callback de autenticación OAuth | Open Redirect | **MEDIUM** | CWE-601 / OWASP A01:2021 | `src/app/(auth)/callback/route.ts:7, 14` |
| **SEC-14** | Ausencia total de validación de esquema en tiempo de ejecución (Zod) | Validación | **MEDIUM** | ASVS V5.1 / CWE-20 | Toda la capa `src/app/actions/`, `src/app/api/` |
| **SEC-15** | Falta de headers de seguridad HTTP en configuración de Next.js | Configuración | **MEDIUM** | CWE-693 / OWASP A05:2021 | `next.config.mjs:1-18` |
| **SEC-16** | Vulnerabilidad de canal lateral (Timing Attack) en comparación HMAC | Criptografía | **LOW** | CWE-208 | `src/lib/mercadopago/helpers.ts:44` |
| **SEC-17** | Inconsistencia de esquema en política RLS de reseñas | Integridad DB | **LOW** | CWE-754 | `supabase/migrations/002_rls_policies.sql:99` |
| **SEC-18** | Uso de `getSession()` inseguro en cliente | Auth / Sesiones | **INFO** | ASVS V2.1 | `src/hooks/useUser.ts:23` |

---

## 3. Análisis Detallado de Hallazgos

---

### [SEC-01] CRITICAL: Escalación de Privilegios Horizontal y Vertical en Tabla `profiles`

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H — Score: 8.8)
- **CWE:** CWE-284 (Improper Access Control) / CWE-269 (Improper Privilege Management)
- **Archivos y Líneas Afectadas:**
  - `supabase/migrations/002_rls_policies.sql`, Líneas 25-26
  - `src/app/upgrade/page.tsx`, Líneas 16-20

#### Evidencia del Código
En `supabase/migrations/002_rls_policies.sql`:
```sql
25: CREATE POLICY "Users can update their own profile" ON public.profiles
26: FOR UPDATE USING (auth.uid() = id);
```

En `src/app/upgrade/page.tsx`:
```typescript
12:   const makeAdmin = async () => {
13:     const { data: { user } } = await supabase.auth.getUser()
14:     if (!user) return setMsg("Debes iniciar sesión primero")
15:     
16:     const { error } = await supabase
17:       .from('profiles')
18:       .update({ role: 'platform_admin' })
19:       .eq('id', user.id)
20: 
21:     if (error) setMsg("Error: " + error.message)
22:     else setMsg("¡Listo! Eres platform_admin. Ve a /dashboard o /admin.")
23:   }
```

#### Vector de Ataque y Mecánica
1. La política RLS define `FOR UPDATE USING (auth.uid() = id)` sin una cláusula `WITH CHECK` que restrinja las columnas editables, ni permisos a nivel de columna (*Column-Level Security* / `REVOKE UPDATE (role, credit_balance) ON profiles`).
2. Cualquier usuario registrado con rol básico `player` puede ejecutar directamente en la consola del navegador o mediante un script:
   ```javascript
   await supabase.from('profiles').update({ role: 'platform_admin', credit_balance: 999999 }).eq('id', myUserId);
   ```
3. Existe una página pública enrutada en producción (`/upgrade`) que expone una interfaz gráfica directa para auto-otorgarse permisos de `platform_admin`.

#### Impacto
Compromiso total de la confidencialidad, integridad y disponibilidad del sistema. Un atacante se convierte en Administrador Global de la plataforma, accediendo a `/admin`, métricas de todos los complejos, base de datos de usuarios y capacidad de suspender complejos o jugadores.

#### Remediación y Código Corregido
1. Eliminar por completo el archivo `src/app/upgrade/page.tsx`.
2. Modificar la migración RLS o crear una nueva migración que bloquee la modificación de `role` y `credit_balance` por parte de usuarios comunes, utilizando un trigger `BEFORE UPDATE` o restringiendo columnas:

```sql
-- Migration: Fix profiles RLS and immutable columns
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Only service_role or platform_admin can change role and credit_balance
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.credit_balance IS DISTINCT FROM NEW.credit_balance) THEN
        IF NOT public.is_platform_admin() THEN
            RAISE EXCEPTION 'No está autorizado a modificar roles o balance de créditos.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_profile_field_protection
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_system_fields();
```

---

### [SEC-02] CRITICAL: Bypass Total de Pago y Confirmación Forzada de Reservas

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H — Score: 8.6)
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key) / CWE-285 (Improper Authorization)
- **Archivos y Líneas Afectadas:**
  - `src/app/(main)/mock-payment/page.tsx`, Líneas 22-31
  - `supabase/migrations/002_rls_policies.sql`, Líneas 80-88

#### Evidencia del Código
En `src/app/(main)/mock-payment/page.tsx`:
```typescript
22:   async function approvePayment() {
23:     "use server"
24:     const supabase = await createClient()
25:     
26:     await (supabase.from("bookings") as any)
27:       .update({ status: 'confirmed', payment_status: 'paid' })
28:       .eq('id', booking_id as string)
29:       
30:     redirect(`/booking/${court_id}/success?booking_id=${booking_id}`)
31:   }
```

En `supabase/migrations/002_rls_policies.sql`:
```sql
80: CREATE POLICY "Users can update their bookings (e.g. cancel) or venue owners can update" ON public.bookings
81: FOR UPDATE USING (
82:     user_id = auth.uid() OR
83:     EXISTS (
84:         SELECT 1 FROM public.courts c
85:         JOIN public.venues v ON c.venue_id = v.id
86:         WHERE c.id = court_id AND v.owner_id = auth.uid()
87:     ) OR public.is_platform_admin()
88: );
```

#### Vector de Ataque y Mecánica
1. Un usuario crea una reserva en estado `pending`.
2. El atacante navega a `/mock-payment?booking_id=<ID>&court_id=<COURT_ID>&price=15000` y pulsa "Simular Pago Aprobado", o ejecuta la Server Action invocando `approvePayment`.
3. El Server Action ejecuta un `UPDATE` sin verificar autenticación, roles ni firmas de pasarelas.
4. Además, como la política RLS en `public.bookings` permite `FOR UPDATE USING (user_id = auth.uid())`, cualquier jugador puede directamente emitir un `UPDATE` desde el cliente:
   ```javascript
   await supabase.from('bookings').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', myBookingId);
   ```
   RLS lo valida exitosamente porque el usuario es dueño de la reserva.

#### Impacto
Pérdida económica directa para los complejos deportivos. Los usuarios pueden reservar turnos de forma 100% gratuita, bloqueando la disponibilidad para clientes legítimos.

#### Remediación y Código Corregido
1. Eliminar la ruta `/mock-payment` en entornos que no sean puramente de pruebas locales, y proteger el Server Action de pruebas.
2. Restringir la política RLS de `bookings` para que los usuarios normales **sólo** puedan modificar el estado a `cancelled` (o realizar todas las transacciones de pago exclusivamente a través de funciones backend con `service_role`):

```sql
DROP POLICY IF EXISTS "Users can update their bookings (e.g. cancel) or venue owners can update" ON public.bookings;

-- Users can ONLY update status to cancelled on their own bookings
CREATE POLICY "Users can cancel their own bookings" ON public.bookings
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid() AND 
    status = 'cancelled' AND 
    payment_status = (SELECT payment_status FROM public.bookings WHERE id = id)
);

-- Venue owners can update their court bookings
CREATE POLICY "Venue owners can manage their bookings" ON public.bookings
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.courts c
        JOIN public.venues v ON c.venue_id = v.id
        WHERE c.id = court_id AND v.owner_id = auth.uid()
    ) OR public.is_platform_admin()
);
```

---

### [SEC-03] CRITICAL: Omisión de Verificación de Firma y Fallo RLS en Webhook Mercado Pago

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H — Score: 8.6)
- **CWE:** CWE-347 (Improper Verification of Cryptographic Signature) / CWE-287
- **Archivos y Líneas Afectadas:**
  - `src/app/api/webhooks/mercadopago/route.ts`, Líneas 22-29, 48-63

#### Evidencia del Código
En `src/app/api/webhooks/mercadopago/route.ts`:
```typescript
22:     const secret = process.env.MP_WEBHOOK_SECRET
23: 
24:     if (secret && xSignature && xRequestId) {
25:       const isValid = verifyWebhookSignature(xSignature, xRequestId, id, secret)
26:       if (!isValid) {
27:         return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
28:       }
29:     }
...
48:       const supabase = await createClient()
49:       
50:       const { data: booking, error } = await (supabase.from('bookings') as any)
51:         .update({ 
52:           payment_status: 'paid',
53:           status: 'confirmed',
54:           updated_at: new Date().toISOString()
55:         })
56:         .eq('id', bookingId)
```

#### Vector de Ataque y Mecánica
1. **Falso Positivo de Seguridad en Firma:** Si `MP_WEBHOOK_SECRET` no está cargado en el entorno de despliegue, o si el atacante envía un request sin el encabezado `x-signature`, la condición `if (secret && xSignature && xRequestId)` evalúa a `false`. El código saltea la verificación y procede a consultar la API de Mercado Pago con el ID provisto.
2. **Replay / ID Forgery:** Un atacante puede suministrar el ID de un pago de prueba o de una transacción previa aprobada en otra cuenta de Mercado Pago y enviar el `external_reference` de su reserva para confirmarla.
3. **Falla Silenciosa de RLS en Webhook Real:** El endpoint instancia `createClient()` de `@/lib/supabase/server`. Como la petición proviene de los servidores de Mercado Pago, no existen cookies de sesión (`auth.uid() = NULL`). La consulta `UPDATE bookings SET payment_status = 'paid'` es rechazada silenciosamente por las políticas RLS (afectando 0 filas), impidiendo que las reservas pagadas legítimamente se confirmen.
4. **Falta de Idempotencia:** No se comprueba si la reserva ya estaba en estado `paid`. Webhooks duplicados disparan múltiples notificaciones por email y WhatsApp.

#### Remediación y Código Corregido
1. Forzar la verificación estricta de firma como paso mandatorio: rechazar si no hay secret configurado o falta `x-signature`.
2. Utilizar `createAdminClient()` (Service Role) exclusivamente para el webhook.
3. Validar idempotencia antes de disparar notificaciones.

```typescript
// src/app/api/webhooks/mercadopago/route.ts
import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/mercadopago/helpers'
import { createAdminClient } from '@/lib/supabase/server'
import { Payment, MercadoPagoConfig } from 'mercadopago'

export async function POST(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const topic = searchParams.get('topic') || searchParams.get('type')
    const id = searchParams.get('data.id') || searchParams.get('id')
    
    if (topic !== 'payment' || !id) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const secret = process.env.MP_WEBHOOK_SECRET
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')

    if (!secret || !xSignature || !xRequestId) {
      console.error('Missing webhook security headers or secret')
      return NextResponse.json({ error: 'Firma requerida no provista' }, { status: 401 })
    }

    const isValid = verifyWebhookSignature(xSignature, xRequestId, id, secret)
    if (!isValid) {
      return NextResponse.json({ error: 'Firma criptográfica inválida' }, { status: 403 })
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })
    const payment = new Payment(client)
    const paymentData = await payment.get({ id })
    
    if (paymentData.status === 'approved') {
      const bookingId = paymentData.external_reference
      if (!bookingId) throw new Error('external_reference ausente')

      const supabase = createAdminClient() // Service Role
      
      // Idempotency check
      const { data: existing } = await supabase
        .from('bookings')
        .select('payment_status')
        .eq('id', bookingId)
        .single()

      if (existing?.payment_status === 'paid') {
        return NextResponse.json({ message: 'Reserva ya procesada' }, { status: 200 })
      }

      const { data: booking, error } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed',
          mp_payment_id: String(id),
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select('*, profiles(*), courts(*, venues(*))')
        .single()

      if (error) throw error

      if (booking) {
        const { notify } = await import('@/lib/notifications')
        const { waitUntil } = await import('@vercel/functions')
        waitUntil(
          notify('booking_confirmed', { 
            booking, 
            user: booking.profiles, 
            venue: booking.courts?.venues 
          }).catch(console.error)
        )
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
```

---

### [SEC-04] CRITICAL: Manipulación de Precio de Reserva por Parte del Cliente

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score: 6.5)
- **CWE:** CWE-20 (Improper Input Validation) / CWE-602 (Client-Side Enforcement of Server-Side Security)
- **Archivos y Líneas Afectadas:**
  - `src/app/api/booking/create-preference/route.ts`, Líneas 14-20, 38-46

#### Evidencia del Código
En `src/app/api/booking/create-preference/route.ts`:
```typescript
14:     const body = await request.json()
15:     const { title, price, bookingId, courtId } = body
...
38:     const depositAmount = requireDeposit ? Math.ceil((price * depositPercentage) / 100) : 0
39:     let amountToPay = depositAmount
40: 
41:     if (credits > 0 && amountToPay > 0) {
42:       amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
...
49:     if (amountToPay === 0) {
50:       await (supabase.from('bookings') as any)
51:         .update({ status: 'confirmed', payment_status: 'paid' })
52:         .eq('id', bookingId)
```

#### Vector de Ataque y Mecánica
1. El endpoint recibe `price` directamente en el payload JSON enviado por el cliente.
2. Un atacante intercepta la petición o envía directamente un request POST a `/api/booking/create-preference` con:
   ```json
   {
     "title": "Reserva",
     "price": 0,
     "bookingId": "uuid-de-reserva",
     "courtId": "uuid-cancha"
   }
   ```
3. El cálculo `depositAmount = Math.ceil((0 * 30) / 100)` resulta en `0`.
4. El bloque `if (amountToPay === 0)` se ejecuta, marcando la reserva como `status: 'confirmed'` y `payment_status: 'paid'` en la base de datos sin abonar absolutamente nada y sin aplicar créditos reales.

#### Impacto
Fraude financiero total en la generación de reservas de canchas.

#### Remediación y Código Corregido
El precio **nunca** debe ser provisto por el cliente. Debe ser recalculado en el servidor consultando `pricing_rules` o leyendo el `total_price` inmutable registrado en el `bookingId` perteneciente a `user.id`:

```typescript
// Validar reserva y obtener precio real desde la base de datos
const { data: booking, error: bookingErr } = await supabase
  .from('bookings')
  .select('id, total_price, court_id, user_id, status')
  .eq('id', bookingId)
  .eq('user_id', user.id)
  .single()

if (bookingErr || !booking) {
  return NextResponse.json({ error: 'Reserva no encontrada o no autorizada' }, { status: 404 })
}

const verifiedPrice = booking.total_price
const depositAmount = requireDeposit ? Math.ceil((verifiedPrice * depositPercentage) / 100) : 0
```

---

### [SEC-05] CRITICAL: Modificación No Autorizada de Créditos y Saldos vía RLS

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score: 6.5)
- **CWE:** CWE-862 (Missing Authorization) / CWE-284
- **Archivos y Líneas Afectadas:**
  - `supabase/migrations/002_rls_policies.sql`, Líneas 112-113

#### Evidencia del Código
```sql
112: CREATE POLICY "Users can update their own credits (usage)" ON public.credits
113: FOR UPDATE USING (user_id = auth.uid() OR public.is_platform_admin());
```

#### Vector de Ataque y Mecánica
1. La tabla `credits` almacena el saldo a favor generado por cancelaciones anticipadas (`amount`, `status`, `expires_at`).
2. La política RLS permite que cualquier usuario autenticado actualice sus propios registros (`user_id = auth.uid()`).
3. No existe un `WITH CHECK` ni restricción de columnas. Un usuario puede ejecutar:
   ```javascript
   await supabase
     .from('credits')
     .update({ amount: 500000.00, status: 'available', expires_at: '2099-12-31T00:00:00Z' })
     .eq('user_id', myUserId);
   ```
4. Con este saldo adulterado, el usuario puede reservar cualquier cancha en el complejo utilizando créditos ilegítimos.

#### Impacto
Fraude financiero y suplantación de pasarela de pagos mediante la creación artificial de crédito en la plataforma.

#### Remediación y Código Corregido
Los créditos son registros inmutables administrados exclusivamente por el sistema (*ledger* transaccional). Los usuarios **nunca** deben tener permisos de `UPDATE` ni `INSERT` sobre la tabla `credits`. La gestión debe ejecutarse mediante funciones de backend utilizando el cliente administrativo (`service_role`):

```sql
DROP POLICY IF EXISTS "Users can update their own credits (usage)" ON public.credits;

-- Revoke UPDATE from regular authenticated users
-- Only platform_admin or service_role can update credits
CREATE POLICY "Admins can update credits" ON public.credits
FOR UPDATE USING (public.is_platform_admin());
```

---

### [SEC-06] CRITICAL: Exposición Pública No Autenticada de PII de Usuarios en `profiles`

- **Severidad:** CRITICAL (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.5)
- **CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor) / CWE-359
- **Archivos y Líneas Afectadas:**
  - `supabase/migrations/002_rls_policies.sql`, Líneas 22-23

#### Evidencia del Código
```sql
22: CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
23: FOR SELECT USING (true);
```

#### Vector de Ataque y Mecánica
1. La política `USING (true)` permite a cualquier cliente no autenticado con la clave pública `NEXT_PUBLIC_SUPABASE_ANON_KEY` realizar:
   ```javascript
   const { data } = await supabase.from('profiles').select('id, email, phone, full_name, credit_balance, role');
   ```
2. Esto expone la totalidad del padrón de usuarios de la plataforma: direcciones de correo electrónico, números de teléfono personal (WhatsApp), balance financiero y roles administrativos.

#### Impacto
Violación grave de privacidad y normativas de protección de datos personales (Ley 25.326 Argentina / GDPR). Facilita ataques dirigidos de phishing, spear-phishing y acoso a usuarios y administradores.

#### Remediación y Código Corregido
Restringir la lectura de datos sensibles para que los usuarios sólo puedan ver su propio perfil completo, mientras que los datos públicos de otros usuarios (nombre y avatar en reseñas) se expongan mediante una vista segura (*Security Definer View*) o columnas restringidas:

```sql
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Users can read their own full profile; Admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id OR public.is_platform_admin());

-- Create a secure public view for reviews/chat display
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT id, full_name, avatar_url
FROM public.profiles;
```

---

### [SEC-07] HIGH: Inyección de HTML / Phishing en Plantillas de Correo Resend

- **Severidad:** HIGH (CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:N — Score: 7.3)
- **CWE:** CWE-79 (Cross-Site Scripting) / CWE-80 (Improper Neutralization of Script-Related HTML Tags in a Web Page)
- **Archivos y Líneas Afectadas:**
  - `src/lib/notifications/templates.ts`, Líneas 25, 29, 67, 109
  - `src/app/actions/chat.ts`, Líneas 66-70

#### Evidencia del Código
En `src/app/actions/chat.ts`:
```typescript
66:           subject: `¡Nueva consulta en ${conversation.venues.name}!`,
67:           html: `<p>Tienes un nuevo mensaje de un jugador.</p>
68:                  <p><strong>Mensaje:</strong> "${content}"</p>
69:                  <br/>
70:                  <p>Responde rápido para asegurar tu reserva desde el panel de ReservaYa.</p>`
```

En `src/lib/notifications/templates.ts`:
```typescript
25:       <p>Hola ${user.full_name || 'jugador'}, tu partido en ${venue.name} ha sido confirmado con éxito.</p>
...
29:       <div class="detail-item"><span class="detail-label">📍 Predio:</span> ${venue.name} (${venue.address})</div>
```

#### Vector de Ataque y Mecánica
1. Un atacante se registra y configura su `full_name` con una carga HTML maliciosa:
   `<a href="https://phishing-reservaya.com/login" style="font-size:24px;color:red;">Haga clic aquí para validar su cuenta</a>`.
   O un usuario envía un mensaje de chat con etiquetas HTML y enlaces falsificados.
2. Cuando se dispara la notificación automática vía Resend, el contenido se concatena directamente en la plantilla HTML sin escapar caracteres especiales (`<`, `>`, `&`, `"`, `'`).
3. El cliente de correo del destinatario (dueño del complejo o jugador) renderiza el HTML, permitiendo phishing avanzado, suplantación de identidad y secuestro de clics (*Clickjacking* en email).

#### Remediación y Código Corregido
Implementar una función de escape de entidades HTML antes de interpolar variables en las plantillas:

```typescript
function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```
Aplicar `escapeHtml(content)`, `escapeHtml(user.full_name)`, `escapeHtml(venue.name)`, etc. en todas las plantillas.

---

### [SEC-08] HIGH: Bucket de Imágenes de Chat Público e Inserción Irrestricta en `venue-photos`

- **Severidad:** HIGH (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N — Score: 7.5)
- **CWE:** CWE-732 (Incorrect Permission Assignment for Critical Resource)
- **Archivos y Líneas Afectadas:**
  - `supabase/migrations/010_chat_attachments_and_storage.sql`, Líneas 18-20, 31-33

#### Evidencia del Código
```sql
18: CREATE POLICY "Anyone can view chat images"
19: ON storage.objects FOR SELECT TO public
20: USING (bucket_id = 'chat-images');
...
31: CREATE POLICY "Authenticated users can upload venue photos"
32: ON storage.objects FOR INSERT TO authenticated
33: WITH CHECK (bucket_id = 'venue-photos');
```

#### Vector de Ataque y Mecánica
1. `chat-images` fue creado como bucket público (`public: true`) y con una política de selección abierta a `public`. Cualquier comprobante de pago privado, foto personal o documento adjunto en conversaciones privadas puede ser visto por cualquier tercero que conozca o enumere la URL.
2. `venue-photos` permite la subida a cualquier usuario autenticado (`TO authenticated`) sin validar si el usuario es `venue_admin` o si la carpeta coincide con un complejo que le pertenece. Un jugador común puede saturar el almacenamiento o sobreescribir imágenes de otros complejos.

#### Remediación y Código Corregido
1. Convertir `chat-images` a bucket privado (`public: false`) y servir imágenes mediante URLs firmadas temporales (`createSignedUrl`), con política de selección restringida a los participantes de la conversación.
2. Restringir la subida a `venue-photos` verificando la titularidad del complejo:

```sql
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload venue photos" ON storage.objects;

-- Venue photos: only venue owners can upload to their own folder
CREATE POLICY "Venue owners can upload venue photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'venue-photos' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.venues WHERE owner_id = auth.uid()
    )
);
```

---

### [SEC-09] HIGH: Inyección de Filtros PostgREST en Búsqueda de Canchas

- **Severidad:** HIGH (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.5)
- **CWE:** CWE-943 (Improper Neutralization of Special Elements in Data Query Logic)
- **Archivos y Líneas Afectadas:**
  - `src/app/(main)/search/page.tsx`, Línea 55

#### Evidencia del Código
```typescript
54:   if (q) {
55:     query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
56:   }
```

#### Vector de Ataque y Mecánica
El parámetro `q` proveniente de la URL (`searchParams.q`) se interpola directamente en el método `.or(...)` del query builder de Supabase/PostgREST.
PostgREST interpreta comas (`,`), puntos (`.`) y paréntesis (`()`) como delimitadores de sintaxis de filtrado lógico. Un atacante puede estructurar entradas como:
`q=test),is_active.is.false,(name.ilike.%`
para alterar la estructura lógica de la consulta y consultar complejos inactivos, o manipular los árboles sintácticos de la consulta.

#### Remediación y Código Corregido
Sanitizar la cadena `q` eliminando caracteres de control de sintaxis de PostgREST antes de construir la expresión:

```typescript
const sanitizedQ = q.replace(/[,.()]/g, '')
if (sanitizedQ) {
  query = query.or(`name.ilike.%${sanitizedQ}%,city.ilike.%${sanitizedQ}%,address.ilike.%${sanitizedQ}%`)
}
```

---

### [SEC-10] HIGH: Falla de Autorización RBAC en Server Actions de Gestión de Reservas

- **Severidad:** HIGH (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — Score: 6.5)
- **CWE:** CWE-862 (Missing Authorization) / CWE-285
- **Archivos y Líneas Afectadas:**
  - `src/app/dashboard/bookings/actions.ts`, Líneas 8-40

#### Evidencia del Código
```typescript
8: export async function updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show') {
9:   const supabase = await createClient()
10:   const { data: { user } } = await supabase.auth.getUser()
11:   if (!user) throw new Error("No autenticado")
12: 
13:   const { error } = await (supabase.from("bookings") as any)
14:     .update({ status: status })
15:     .eq("id", bookingId)
```

#### Vector de Ataque y Mecánica
1. La función comprueba únicamente que `user` no sea nulo.
2. No se verifica que el usuario posea el rol `venue_admin` ni que sea el propietario de la cancha a la que pertenece la reserva (`court.venue.owner_id === user.id`).
3. Debido a que la política RLS en `bookings` permite `FOR UPDATE USING (user_id = auth.uid())`, cualquier jugador autenticado puede invocar esta Server Action con el `bookingId` de su propia reserva y cambiar su estado a `completed` o `confirmed`, o con `updatePaymentStatus(bookingId, 'paid')` marcarla como pagada.

#### Remediación y Código Corregido
Realizar validación explícita de propiedad y rol antes de ejecutar mutaciones:

```typescript
export async function updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Verify that user is venue_admin or owner of the venue
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, courts!inner(venues!inner(owner_id))")
    .eq("id", bookingId)
    .single()

  if (fetchError || !booking || (booking.courts as any)?.venues?.owner_id !== user.id) {
    throw new Error("No autorizado para modificar esta reserva.")
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard/bookings")
  revalidatePath("/dashboard/schedule")
}
```

---

### [SEC-11] HIGH: Edge Functions No Autenticadas Expuestas a Invocación Pública

- **Severidad:** HIGH (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H — Score: 7.5)
- **CWE:** CWE-306 (Missing Authentication for Critical Function)
- **Archivos y Líneas Afectadas:**
  - `supabase/functions/expire-credits/index.ts`, Líneas 5-36
  - `supabase/functions/send-reminder/index.ts`, Líneas 5-59

#### Evidencia del Código
En `supabase/functions/expire-credits/index.ts`:
```typescript
5: serve(async (req) => {
6:   try {
7:     const supabaseClient = createClient(
8:       Deno.env.get("SUPABASE_URL") ?? "",
9:       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
10:     )
...
14:     const { data, error } = await supabaseClient
15:       .from("credits")
16:       .update({ status: 'expired' })
```

#### Vector de Ataque y Mecánica
Ninguna de las dos Edge Functions valida cabeceras de autorización (`Authorization: Bearer <CRON_SECRET>`). Cualquier actor malicioso que descubra la URL de la Edge Function en Supabase puede invocarla repetidamente mediante GET o POST, causando denegación de servicio, llamadas masivas y actualizaciones continuas de la base de datos sin autorización.

#### Remediación y Código Corregido
Añadir validación de token de autorización de servicio al inicio del handler:

```typescript
const authHeader = req.headers.get('Authorization')
const expectedSecret = Deno.env.get('FUNCTION_SECRET')
if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}
```

---

### [SEC-12] MEDIUM: XSS en Script JSON-LD Incrustado

- **Severidad:** MEDIUM (CVSS:3.1/AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N — Score: 4.8)
- **CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)
- **Archivos y Líneas Afectadas:**
  - `src/app/(main)/venue/[id]/page.tsx`, Líneas 143-146

#### Evidencia del Código
```tsx
143:       <script
144:         type="application/ld+json"
145:         dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
146:       />
```

#### Vector de Ataque y Mecánica
`JSON.stringify()` no escapa la secuencia `</script>`. Si un administrador de complejo malicioso o comprometido guarda en el nombre o descripción del predio un texto como:
`Cancha El 10</script><script>alert(document.cookie)</script>`
el parser del navegador cerrará inmediatamente la etiqueta `<script type="application/ld+json">` al encontrar `</script>` y ejecutará el script siguiente, logrando Cross-Site Scripting persistente (Stored XSS).

#### Remediación y Código Corregido
Escapar los caracteres `<` en la salida serializada de JSON:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ 
    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') 
  }}
/>
```

---

### [SEC-13] MEDIUM: Redirección Abierta en Callback de Autenticación OAuth

- **Severidad:** MEDIUM (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N — Score: 6.1)
- **CWE:** CWE-601 (URL Redirection to Untrusted Site)
- **Archivos y Líneas Afectadas:**
  - `src/app/(auth)/callback/route.ts`, Líneas 7, 14

#### Evidencia del Código
```typescript
7:   const next = searchParams.get('next') ?? '/'
...
14:       return NextResponse.redirect(`${origin}${next}`)
```

#### Vector de Ataque y Mecánica
Si un atacante construye un enlace de login OAuth enviando `next=//attacker.com`, la concatenación `${origin}${next}` produce una URL que en ciertos navegadores y contextos se interpreta como una URL relativa al protocolo hacia `attacker.com`. Un atacante puede inducir a la víctima a autenticarse legítimamente en ReservaYa y luego ser redirigido inadvertidamente al sitio falso del atacante.

#### Remediación y Código Corregido
Validar que `next` sea una ruta relativa estricta que comience con `/` y no con `//` ni contenga esquemas de protocolo:

```typescript
const nextParam = searchParams.get('next') ?? '/'
const safeNext = (nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('\\')) 
  ? nextParam 
  : '/'
return NextResponse.redirect(`${origin}${safeNext}`)
```

---

### [SEC-14] MEDIUM: Ausencia Total de Validación de Esquema en Tiempo de Ejecución (Zod)

- **Severidad:** MEDIUM (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L — Score: 5.3)
- **CWE:** CWE-20 (Improper Input Validation) / OWASP ASVS V5.1
- **Archivos y Líneas Afectadas:**
  - `package.json`
  - Todas las Server Actions y API Routes (`src/app/actions/`, `src/app/api/`)

#### Evidencia
`package.json` carece de la dependencia `zod`. Ninguna Server Action ni endpoint de API valida los tipos, formatos, longitudes máximas o rangos numéricos de los datos de entrada (por ejemplo, `UUID`, números negativos en precios, fechas inválidas o inyecciones de payloads excesivos).

#### Remediación
Instalar `zod` e incorporar esquemas de validación estrictos en cada frontera de entrada (*Input Boundaries*), tal como lo exige el estándar `.cursor/rules/security.mdc`.

---

### [SEC-15] MEDIUM: Falta de Headers de Seguridad HTTP en Configuración de Next.js

- **Severidad:** MEDIUM (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N — Score: 4.8)
- **CWE:** CWE-693 (Protection Mechanism Failure)
- **Archivos y Líneas Afectadas:**
  - `next.config.mjs`, Líneas 1-18

#### Evidencia
`next.config.mjs` no configura ningún header de seguridad HTTP (HSTS, X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, Referrer-Policy, Permissions-Policy).

#### Remediación
Agregar la sección `headers()` en `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.supabase.co' }
    ],
  },
};

export default nextConfig;
```

---

### [SEC-16] LOW: Vulnerabilidad de Canal Lateral (Timing Attack) en Comparación HMAC

- **Severidad:** LOW (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N — Score: 3.7)
- **CWE:** CWE-208 (Observable Timing Discrepancy)
- **Archivos y Líneas Afectadas:**
  - `src/lib/mercadopago/helpers.ts`, Línea 44

#### Evidencia del Código
```typescript
44:     return digest === hash
```

#### Vector de Ataque y Mecánica
El operador `===` realiza una comparación de cadenas que se detiene en el primer carácter no coincidente, filtrando información sobre el prefijo correcto de la firma a través del tiempo de respuesta.

#### Remediación y Código Corregido
Reemplazar por `crypto.timingSafeEqual`:

```typescript
const digestBuf = Buffer.from(digest, 'hex')
const hashBuf = Buffer.from(hash, 'hex')
if (digestBuf.length !== hashBuf.length) return false
return crypto.timingSafeEqual(digestBuf, hashBuf)
```

---

### [SEC-17] LOW: Inconsistencia de Esquema en Política RLS de Reseñas

- **Severidad:** LOW (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L — Score: 3.1)
- **CWE:** CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **Archivos y Líneas Afectadas:**
  - `supabase/migrations/002_rls_policies.sql`, Línea 99
  - `supabase/migrations/004_fix_schema_inconsistencies.sql`, Línea 2

#### Evidencia
En la migración `004_fix_schema_inconsistencies.sql`, la columna `booking_status` fue renombrada a `status`. Sin embargo, la política RLS en `002_rls_policies.sql` evalúa `WHERE b.booking_status = 'completed'`. Esto produce un error en tiempo de ejecución de PostgreSQL (`column b.booking_status does not exist`), impidiendo que los usuarios publiquen reseñas legítimas.

#### Remediación
Actualizar la política RLS para que referencie la columna `b.status = 'completed'`.

---

### [SEC-18] INFO: Uso de `getSession()` Inseguro en Cliente

- **Severidad:** INFO
- **Archivos y Líneas Afectadas:**
  - `src/hooks/useUser.ts`, Línea 23

#### Evidencia
`useUser` invoca `supabase.auth.getSession()`. De acuerdo con las guías oficiales de seguridad de Supabase y el estándar de ReservaYa, `getSession()` no garantiza que el token JWT sea válido en el servidor de autenticación; se debe emplear `supabase.auth.getUser()`.

---

## 4. Plan de Remediación Priorizado (Roadmap de Seguridad)

### Fase 1: Remediaciones Críticas Inmediatas (Bloqueantes para Producción)
1. **[SEC-01]** Eliminar `src/app/upgrade/page.tsx` y desplegar un trigger en PostgreSQL que impida a los usuarios modificar `role` y `credit_balance`.
2. **[SEC-02]** Desactivar `/mock-payment` y restringir la política RLS de `bookings` para impedir que los usuarios actualicen `payment_status` y `status` arbitrariamente.
3. **[SEC-03]** Modificar `/api/webhooks/mercadopago` para usar `createAdminClient()` (Service Role), hacer mandatoria la verificación de firma y validar idempotencia.
4. **[SEC-04]** Calcular el precio del depósito en `/api/booking/create-preference` leyendo exclusivamente los datos de la reserva en base de datos.
5. **[SEC-05]** Revocar permisos de `UPDATE` a usuarios autenticados en la tabla `credits`.
6. **[SEC-06]** Restringir la política RLS de `profiles` para que solo el propio usuario o un administrador global puedan leer su registro completo.

### Fase 2: Robustecimiento y Hardening (Prioridad Alta)
7. **[SEC-07]** Implementar `escapeHtml()` en todos los templates de email de Resend y en la acción de chat.
8. **[SEC-08]** Configurar `chat-images` como privado con URLs firmadas y restringir `venue-photos` a dueños de complejos.
9. **[SEC-09]** Sanitizar el parámetro `q` en `src/app/(main)/search/page.tsx`.
10. **[SEC-10]** Añadir comprobación de rol y titularidad de complejo en `src/app/dashboard/bookings/actions.ts`.
11. **[SEC-11]** Proteger las Edge Functions con cabeceras `Authorization: Bearer <SECRET>`.

### Fase 3: Higiene de Código y Headers (Prioridad Media)
12. **[SEC-12]** Sanitizar scripts JSON-LD con `.replace(/</g, '\\u003c')`.
13. **[SEC-13]** Sanitizar el parámetro `next` en `/callback` para evitar Open Redirects.
14. **[SEC-14]** Instalar `zod` y aplicar esquemas en Server Actions y API Routes.
15. **[SEC-15]** Configurar headers de seguridad HTTP en `next.config.mjs`.
16. **[SEC-16]** Utilizar `crypto.timingSafeEqual` en `verifyWebhookSignature`.
17. **[SEC-17]** Corregir la columna `status` en la política RLS de `reviews`.

---

## 5. Dictamen y Conclusión de Seguridad

El estado actual del proyecto presenta **vulnerabilidades críticas estructurales** en el control de acceso a nivel de base de datos (Supabase RLS), el flujo transaccional de pagos (Mercado Pago) y la validación de roles y privilegios (RBAC). 

Bajo estas condiciones, la plataforma **NO es segura para procesar transacciones financieras reales ni para almacenar datos personales de usuarios**. La implementación estricta de las correcciones detalladas en este reporte elevará la postura de seguridad de ReservaYa al estándar OWASP ASVS Level 2, garantizando la integridad financiera de los complejos deportivos y la protección de los datos de los jugadores.

---
*Reporte elaborado por el Experto en Seguridad (Security Specialist) para el equipo de desarrollo de ReservaYa.*
