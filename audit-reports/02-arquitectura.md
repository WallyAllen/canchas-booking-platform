# Informe de Auditoría de Arquitectura, Rendimiento y Resiliencia
**Proyecto:** ReservaYa (El Potrero)  
**Rol:** Pesimista de Arquitectura (Architecture & Performance Specialist)  
**Fecha:** 29 de Agosto de 2026  
**Objetivo:** Evaluación destructiva, línea por línea, de la arquitectura del App Router de Next.js 14, límites cliente/servidor, patrones de fetching y caching, concurrencia de reservas, resiliencia ante dependencias de terceros y escalabilidad de base de datos en Supabase.

---

## 1. Resumen Ejecutivo y Diagnóstico Global

El análisis exhaustivo del código fuente revela que, si bien el proyecto adoptó el stack moderno de **Next.js 14 (App Router) + Supabase + Tailwind CSS**, presenta **fallas estructurales críticas** que comprometen la estabilidad en producción, la integridad de los datos, la experiencia de usuario y la viabilidad financiera de la plataforma.

### Puntos Críticos Detectados:
1. **Mutación con Efectos Secundarios en HTTP GET**: Al ingresar a la URL de reserva (`/booking/[courtId]`), un Server Component ejecuta un `INSERT` en la base de datos creando una reserva `pending` que bloquea inmediatamente el turno para otros usuarios y rompe la idempotencia de HTTP.
2. **Condición de Carrera Destructiva en Checkout con `beforeunload`**: Un listener en `BookingWizard.tsx` dispara un beacon a `/api/bookings/cancel` al abandonar la página, eliminando la reserva de la base de datos en el instante exacto en que el usuario es redirigido a Mercado Pago para abonar.
3. **Cron de Limpieza de Reservas con Umbral Letal (3 Minutos)**: Una tarea en `pg_cron` borra reservas pendientes con más de 3 minutos de antigüedad, provocando que usuarios que tardan más de 3 minutos en completar el formulario de pago en Mercado Pago pierdan su turno mientras su tarjeta de crédito es cobrada.
4. **Colapso de Notificaciones en Serverless (`setTimeout` desasistido)**: El despachador de notificaciones utiliza `setTimeout(..., 0)` no esperado. En el runtime serverless de Vercel/Next.js, el freeze del contenedor al retornar la respuesta mata los procesos en background, impidiendo el envío de emails y WhatsApps de confirmación y cancelación.
5. **Fallo de RLS en Webhooks de Mercado Pago**: El endpoint `/api/webhooks/mercadopago` utiliza un cliente Supabase basado en cookies y clave anónima (`anon`), careciendo de sesión de usuario en la invocación de MP y fallando en actualizar el estado de la reserva por políticas de RLS.
6. **Consumo Destructivo de Créditos**: Cuando un usuario aplica créditos de cancelación por un monto menor al saldo total de su cupón, el sistema marca el cupón completo como `used`, confiscando el saldo restante del usuario.
7. **Ausencia Total de Error Boundaries y Loading Skeletons**: No existe un solo archivo `loading.tsx`, `error.tsx` o `not-found.tsx` en todo el proyecto.
8. **Waterfalls Severos y Consultas No Paginadas en Memoria**: Múltiples `await` secuenciales en componentes de servidor y descarga indiscriminada de todas las reservas históricas y complejos para filtrado con bucles de JavaScript.

---

## 2. Matriz de Hallazgos por Severidad

| ID | Área | Hallazgo | Severidad | Archivos Afectados |
| :--- | :--- | :--- | :--- | :--- |
| **ARC-01** | Estado / Concurrencia | Mutación en HTTP GET (`INSERT` en render de página) | **CRÍTICA** | `src/app/(main)/booking/[courtId]/page.tsx:105-130` |
| **ARC-02** | Resiliencia / Pagos | `beforeunload` cancela reserva al redirigir a Mercado Pago | **CRÍTICA** | `src/components/booking/BookingWizard.tsx:32-42` |
| **ARC-03** | Ciclo de Vida DB | Cron de pg_cron elimina reservas pendientes a los 3 minutos | **CRÍTICA** | `supabase/migrations/012_abandoned_bookings_cron.sql:8-13` |
| **ARC-04** | Resiliencia / Serverless | `setTimeout(..., 0)` en notificaciones se aborta por freeze de contenedor | **CRÍTICA** | `src/lib/notifications/index.ts:20-50` |
| **ARC-05** | Seguridad / Integración | Webhook de MP usa cliente `anon` sin auth de cookies bajo RLS | **CRÍTICA** | `src/app/api/webhooks/mercadopago/route.ts:48-63` |
| **ARC-06** | Lógica de Negocio / Estado | Consumo de créditos quema el saldo remanente no utilizado | **CRÍTICA** | `src/lib/credits/manager.ts:121-128` |
| **ARC-07** | Arquitectura App Router | Ausencia de `loading.tsx`, `error.tsx` y `not-found.tsx` | **ALTA** | `src/app/**` |
| **ARC-08** | Caching / Performance | Waterfalls secuenciales de red y queries N+1 no optimizadas | **ALTA** | `src/app/(main)/venue/[id]/page.tsx`, `src/app/(main)/page.tsx` |
| **ARC-09** | Escalabilidad / DB | Consultas no paginadas con filtrado y ordenamiento en memoria JS | **ALTA** | `src/app/(main)/search/page.tsx`, `src/app/dashboard/bookings/page.tsx` |
| **ARC-10** | Performance / Bundles | Bloat de bundles cliente (`@splinetool`, Leaflet sin CDN local, GSAP) | **ALTA** | `src/components/home/Hero3D.tsx`, `src/components/map/VenueMapClient.tsx` |
| **ARC-11** | Caching / Invalidación | Inconsistencias de revalidación (`revalidatePath` incompleto) | **ALTA** | `src/app/dashboard/courts/actions.ts`, `src/app/dashboard/venue/actions.ts` |
| **ARC-12** | Resiliencia / 3rd Party | Idempotencia global hardcodeada (`idempotencyKey: 'abc'`) y falta de timeouts | **MEDIA** | `src/lib/mercadopago/client.ts:6`, `src/lib/notifications/whatsapp.ts` |
| **ARC-13** | Timezones / Concurrencia | Incompatibilidad de zona horaria UTC vs UTC-3 (Argentina) | **MEDIA** | `src/app/dashboard/page.tsx:52`, `src/app/(main)/bookings/page.tsx:43-45` |
| **ARC-14** | Seguridad / RLS | RLS oculta reservas a usuarios anónimos falseando disponibilidad libre | **MEDIA** | `supabase/migrations/002_rls_policies.sql:67-75` |
| **ARC-15** | Integridad / Edge | Edge Function `send-reminder` marca enviado sin emitir notificaciones | **MEDIA** | `supabase/functions/send-reminder/index.ts:45-53` |

---

## 3. Análisis Destructivo Línea por Línea

---

### 3.1. Límites Servidor vs Cliente y Estructura App Router

#### Hallazgo ARC-07: Ausencia Total de Boundaries (`loading.tsx`, `error.tsx`, `not-found.tsx`)
- **Archivos Inspeccionados**: Todo el árbol `src/app/`
- **Diagnóstico**: La estructura del proyecto no implementa ningún boundary declarativo de React Suspense ni de captura de errores de Next.js 14.

```
src/app/
├── (auth)/
├── (main)/          ❌ Sin loading.tsx, error.tsx, not-found.tsx
├── admin/           ❌ Sin loading.tsx, error.tsx
├── dashboard/       ❌ Sin loading.tsx, error.tsx
├── layout.tsx       ❌ Sin loading.tsx ni global error.tsx
```

- **Impacto Arquitectónico**:
  1. **Caída Catastrófica (Unhandled Exception)**: Cualquier fallo de red con Supabase o Mercado Pago en un Server Component provoca que Next.js renderice la pantalla de error genérica 500 o una página en blanco sin estilos, destruyendo la sesión del usuario.
  2. **Violación de Métricas Web (INP / LCP)**: Las transiciones de ruta entre páginas dinámicas bloquean la navegación hasta que finalizan todas las consultas asíncronas en el servidor, sin proveer retroalimentación visual inmediata.

---

#### Hallazgo ARC-10: Bloat de Bundles de Cliente y Fugas de Rendimiento en Core Web Vitals
- **Archivos Inspeccionados**:
  - `src/components/home/Hero3D.tsx:27-40`
  - `src/components/map/VenueMapClient.tsx:14-40`
  - `src/components/layout/Header.tsx:28-32`

- **Código Verificado (`src/components/home/Hero3D.tsx:27-40`)**:
```tsx
27:       <Script 
28:         type="module" 
29:         src="https://unpkg.com/@splinetool/viewer@1.9.72/build/spline-viewer.js" 
30:         strategy="lazyOnload"
31:       />
32:       {isLoading && (
33:         <div className="absolute inset-0 flex items-center justify-center">
34:           <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
35:         </div>
36:       )}
37:       <div className="w-[120%] h-[120%] -ml-[10%] -mt-[5%]">
38:         <spline-viewer url="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
39:       </div>
```

- **Vulnerabilidad de Arquitectura**:
  1. **Doble Carga de Librerías 3D**: `package.json` incluye `"@splinetool/react-spline": "^4.1.0"` y `"@splinetool/runtime": "^2.0.6"`, pero `Hero3D.tsx` inyecta una tercera copia externa sin SRI desde unpkg (`@splinetool/viewer@1.9.72`).
  2. **Timer Falso para Estado de Carga**: Líneas 20-23 ejecutan un `setTimeout(() => setIsLoading(false), 2000)` desacoplado del evento real de carga del asset 3D (`scene.splinecode`, ~4-8MB de binario WebGL). En redes móviles 3G/4G, el spinner desaparece dejando un hueco negro durante segundos.
  3. **Hotlinking de Íconos en Leaflet**: En `VenueMapClient.tsx`, los íconos de los marcadores se descargan en tiempo de ejecución desde `https://raw.githubusercontent.com/...` y `https://unpkg.com/...`. Si GitHub rate-limita o el CDN tiene latencia, el mapa queda sin marcadores.
  4. **Parpadeo y CLS en Header (`src/components/layout/Header.tsx`)**: Al estar marcado con `"use client"` y consumir `useUser()`, el header renderiza en el cliente un skeleton pulsante (`<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />`) antes de resolver la sesión, a pesar de que el middleware y los layouts del servidor ya conocen la cookie de autenticación.

---

### 3.2. Obtención de Datos, Caching y Consultas N+1

#### Hallazgo ARC-08: Cascadas de Red (Network Waterfalls) en Server Components
- **Archivos Inspeccionados**:
  - `src/app/(main)/venue/[id]/page.tsx:21-68`
  - `src/app/(main)/page.tsx:52-111`
  - `src/app/admin/page.tsx:15-21`

- **Código Verificado (`src/app/(main)/venue/[id]/page.tsx:21-68`)**:
```typescript
21:     // 1. Fetch Venue data
22:     const { data: venue, error: venueError } = await (supabase.from("venues") as any)
23:       .select("*")
24:       .eq("id", id)
25:       .eq("is_active", true)
26:       .single()
27: 
28:     if (venueError || !venue) return null
29: 
30:     // 2. Fetch Courts
31:     const { data: courtsData } = await supabase
32:       .from("courts")
33:       .select("*")
34:       .eq("venue_id", venue.id)
35:       .eq("is_active", true)
...
42:       const { data: rulesData } = await supabase
43:         .from("pricing_rules")
44:         .select("*, courts(name)")
45:         .in("court_id", courts.map(c => c.id))
...
60:     const { data: reviewsData } = await supabase
61:       .from("reviews")
62:       .select(`...`)
63:       .eq("venue_id", venue.id)
```

- **Diagnóstico**:
  - `getVenueData` realiza **4 llamadas HTTP secuenciales** a Supabase:
    1. Espera respuesta del complejo (`venues`).
    2. Luego solicita canchas (`courts`).
    3. Luego solicita reglas de precio (`pricing_rules`).
    4. Luego solicita opiniones (`reviews`).
  - **Sobrecarga de Latencia**: Si cada query a Supabase toma 80ms, el Server Component acumula más de 320ms de latencia ociosa antes de generar el primer byte (TTFB).
  - **Solución Óptima**: Reemplazar la cascada por una única consulta relacional en PostgREST:
    ```typescript
    const { data: venue } = await supabase
      .from("venues")
      .select(`
        *,
        courts (*, pricing_rules (*)),
        reviews (*, profiles (full_name, avatar_url))
      `)
      .eq("id", id)
      .eq("is_active", true)
      .single();
    ```

---

#### Hallazgo ARC-09: Descarga Masiva No Paginada y Filtrado en Memoria JavaScript
- **Archivos Inspeccionados**:
  - `src/app/(main)/search/page.tsx:26-112`
  - `src/app/dashboard/bookings/page.tsx:22-26`
  - `src/app/admin/page.tsx:18-20`

- **Código Verificado (`src/app/(main)/search/page.tsx:26-96`)**:
```typescript
26:   let query = supabase
27:     .from("venues")
28:     .select(`
29:       id, name, address, city, avg_rating, review_count, photos, latitude, longitude, require_deposit,
30:       courts (type, surface, pricing_rules (price))
31:     `)
32:     .eq("is_active", true)
...
54:   if (q) {
55:     query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
56:   }
57: 
58:   const { data: venuesData, error } = await query
...
68:     venuesData.forEach((venue: any) => {
...
89:       const hasMatchingType = !type || typesSet.has(type)
90:       const hasMatchingSurface = !surface || surfacesSet.has(surface)
91:       const hasMatchingPrice = (!minPrice || venueMaxPrice >= minPrice) && (maxPrice === Infinity || venueMinPrice <= maxPrice)
```

- **Impacto Arquitectónico**:
  1. **Falta de Paginación en Base de Datos**: No se aplican cláusulas `.range()` ni `.limit()`. Cuando la plataforma cuente con cientos de complejos y miles de reservas, cada búsqueda o apertura de panel descargará el conjunto completo de datos en la memoria de la función Serverless.
  2. **Filtrado en CPU de Node.js**: Los filtros de superficie, tipo de cancha (`F5`, `F7`) y rango de precios se calculan iterando arrays en memoria de JavaScript, anulando la capacidad de indexación del motor PostgreSQL.
  3. **Escaneo Secuencial en ILIKE con Comodín Inicial**: `ilike.%${q}%` anula el uso de índices B-tree en PostgreSQL, forzando un Sequential Scan sobre toda la tabla `venues`.

---

### 3.3. Gestión de Estado, Concurrencia de Reservas e Invalidación de Cache

#### Hallazgo ARC-01: Efecto Secundario Destructivo en HTTP GET (`INSERT` en Render de Página)
- **Archivo Inspeccionado**: `src/app/(main)/booking/[courtId]/page.tsx:103-130`
- **Código Verificado**:
```typescript
103:   if (!booking) {
104:     // 5. Generar un Booking temporal (Pending) para poder crear la preferencia de pago
105:     const { data: newBooking, error: insertError } = await (supabase.from("bookings") as any)
106:       .insert({
107:         user_id: user.id,
108:         court_id: court.id,
109:         booking_date: date,
110:         start_time: `${timeStr}:00`,
111:         end_time: "23:59:00", // En MVP es de 1h pero simplificamos
112:         total_price: price,
113:         payment_status: "pending",
114:         status: "pending"
115:       })
116:       .select()
117:       .single()
```

- **Peligro Crítico**:
  - En la arquitectura web, los métodos HTTP GET deben ser **idempotentes y libres de efectos secundarios**.
  - Si un usuario simplemente abre el enlace, si Next.js pre-fetchea la ruta con `<Link prefetch>`, o si un crawler indexa la URL, se inserta una fila en `bookings` con estado `pending`.
  - La verificación de disponibilidad en la línea 82 considera ocupado el slot para cualquier otro usuario, bloqueando el turno a terceros aunque la persona que abrió el link nunca haya intentado pagar.

---

#### Hallazgo ARC-02: Condición de Carrera en `BookingWizard.tsx` (`beforeunload` Beacon)
- **Archivo Inspeccionado**: `src/components/booking/BookingWizard.tsx:32-42`
- **Código Verificado**:
```typescript
32:   useEffect(() => {
33:     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
34:       // Intentar limpiar de forma sincrónica con beacon
35:       navigator.sendBeacon(`/api/bookings/cancel`, JSON.stringify({ bookingId: booking.id }))
36:     }
37: 
38:     window.addEventListener('beforeunload', handleBeforeUnload)
39:     return () => {
40:       window.removeEventListener('beforeunload', handleBeforeUnload)
41:     }
42:   }, [booking.id])
```

- **Falla de Flujo (Breakage Fatal)**:
  - Cuando el usuario hace clic en "Ir a pagar" y es redirigido a la pasarela externa de Mercado Pago (`window.location.href = data.initPoint`), el navegador dispara el evento `beforeunload`.
  - El handler ejecuta de inmediato `navigator.sendBeacon('/api/bookings/cancel')`, el cual borra el registro de la reserva de la base de datos **mientras el usuario está pagando en Mercado Pago**.
  - Cuando Mercado Pago aprueba la transacción y envía el Webhook a `/api/webhooks/mercadopago`, la reserva ya no existe en la base de datos.

---

#### Hallazgo ARC-03: Cron de Limpieza con Ventana de 3 Minutos (`pg_cron`)
- **Archivo Inspeccionado**: `supabase/migrations/012_abandoned_bookings_cron.sql:8-14`
- **Código Verificado**:
```sql
8:   -- Borrar reservas que quedaron colgadas en el flujo de pago por más de 3 minutos
9:   DELETE FROM public.bookings
10:   WHERE payment_status = 'pending' 
11:     AND status = 'pending'
12:     AND created_at < NOW() - INTERVAL '3 minutes';
```

- **Impacto en Negocio y Pérdida de Fondos**:
  - El proceso de checkout estándar en Mercado Pago (ingreso de tarjeta de 16 dígitos, fecha, código de seguridad y validación 3D Secure / 2FA bancaria por SMS/App) demora entre 2 y 5 minutos.
  - Al correr cada 60 segundos y purgar reservas de más de 3 minutos, cualquier usuario que demore 181 segundos es cobrado en Mercado Pago pero su reserva es borrada de la base de datos de ReservaYa, generando dinero cobrado sin turno asignado (inconsistencia contable y queja de usuario).

---

#### Hallazgo ARC-06: Consumo Destructivo de Créditos (Confiscación de Saldo)
- **Archivo Inspeccionado**: `src/lib/credits/manager.ts:121-128`
- **Código Verificado**:
```typescript
121:     // MVP: Consumimos el crédito completo. 
122:     // (Si un crédito es de $5000 y solo necesitás $3000, en este MVP se consume entero para simplificar)
123:     await (supabase.from('credits') as any)
124:       .update({ status: 'used', used_at: now })
125:       .eq('id', credit.id)
126:       
127:     remainingToApply -= credit.amount
```

- **Falla de Integridad Financiera**:
  - Si un usuario tiene un crédito de $10.000 ARS generado por una cancelación previa y reserva un turno con seña de $3.000 ARS, el código marca el crédito completo de $10.000 como `used`.
  - El sistema no fracciona el saldo ni crea un crédito remanente por los $7.000 de diferencia, provocando una pérdida patrimonial no autorizada para el usuario.

---

#### Hallazgo ARC-11: Invalidación de Cache Defectuosa (`revalidatePath` Incompleto)
- **Archivos Inspeccionados**:
  - `src/app/dashboard/courts/actions.ts:43, 61, 94, 153`
  - `src/app/dashboard/venue/actions.ts:66, 96`
  - `src/app/dashboard/bookings/actions.ts:21-22, 38-39`

- **Código Verificado (`src/app/dashboard/courts/actions.ts:94`)**:
```typescript
94:   revalidatePath("/dashboard/courts")
```

- **Diagnóstico**:
  - Cuando un administrador modifica precios, desactiva una cancha o crea ofertas promocionales, los Server Actions únicamente invalidan `/dashboard/courts`.
  - La página pública del complejo `/venue/[id]` está cacheada con `unstable_cache` y un TTL de 1 hora (`revalidate: 3600`).
  - Como el Server Action **nunca invalida `/venue/[id]` ni la tag `venues`**, los jugadores continúan viendo durante 60 minutos precios antiguos o canchas dadas de baja, provocando inconsistencias y errores al intentar reservar.

---

### 3.4. Resiliencia, Dependencias Externas y Manejo de Latencia

#### Hallazgo ARC-04: Ejecución en Background Fallida por Freeze del Contenedor Serverless
- **Archivo Inspeccionado**: `src/lib/notifications/index.ts:19-50`
- **Código Verificado**:
```typescript
19:   // Ejecutamos de forma asíncrona pero sin hacer await para que no bloquee el frontend o los webhooks
20:   setTimeout(async () => {
21:     try {
22:       switch (event) {
23:         case 'welcome':
24:           await sendWelcomeEmail(data.user)
...
29:             sendBookingConfirmation(data.booking, data.user, data.venue),
30:             sendWhatsAppBookingConfirmation(data.user.phone, data.booking, data.venue)
```

- **Falla Arquitectónica Crítica en Serverless**:
  - En entornos como Vercel y AWS Lambda, el ciclo de vida del contenedor se congela inmediatamente después de que la función HTTP retorna su respuesta.
  - Los timers lanzados con `setTimeout(..., 0)` que no devuelven una promesa esperada son congelados o abortados en el medio de la ejecución de red de Resend o WhatsApp.
  - Esto provoca que los correos y mensajes de WhatsApp se pierdan de manera intermitente.
  - Además, en `src/app/api/webhooks/mercadopago/route.ts:69`, se intentó utilizar `waitUntil(notify(...))`, pero dado que `notify()` contiene un `setTimeout` interno y retorna `Promise<void>` de forma sincrónica, `waitUntil` se resuelve de inmediato antes de que el callback del timer se ejecute.

---

#### Hallazgo ARC-05: Webhook de Mercado Pago Falla por RLS con Cliente Anónimo
- **Archivo Inspeccionado**: `src/app/api/webhooks/mercadopago/route.ts:48-63`
- **Código Verificado**:
```typescript
48:       // Actualizar en DB usando el client del servidor
49:       const supabase = await createClient()
50:       
51:       const { data: booking, error } = await (supabase.from('bookings') as any)
52:         .update({ 
53:           payment_status: 'paid',
54:           status: 'confirmed',
55:           updated_at: new Date().toISOString()
56:         })
57:         .eq('id', bookingId)
```

- **Diagnóstico**:
  - `createClient()` de `@/lib/supabase/server` inicializa `@supabase/ssr` leyendo cookies del request.
  - Las notificaciones entrantes de los servidores de Mercado Pago no contienen cookies de sesión de ningún usuario.
  - Por lo tanto, el cliente Supabase opera con el rol `anon`.
  - La política de RLS de `bookings` (`002_rls_policies.sql:80-88`) exige `user_id = auth.uid() OR owner_id = auth.uid()`.
  - El `update` retorna 0 filas afectadas o error de permisos, impidiendo que el webhook marque la reserva como `confirmed` y `paid`. Para procesos del sistema / webhooks externos, es obligatorio utilizar `createAdminClient()` (`service_role`).

---

#### Hallazgo ARC-12: Clave de Idempotencia Estática en Mercado Pago y Ausencia de Timeouts
- **Archivos Inspeccionados**:
  - `src/lib/mercadopago/client.ts:4-7`
  - `src/lib/notifications/whatsapp.ts:41-50`

- **Código Verificado (`src/lib/mercadopago/client.ts:4-7`)**:
```typescript
4: const client = new MercadoPagoConfig({ 
5:   accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token',
6:   options: { timeout: 5000, idempotencyKey: 'abc' }
7: })
```

- **Falla**:
  - Definir `idempotencyKey: 'abc'` de forma estática en la instancia global del cliente provoca que múltiples transacciones concurrentes de distintos usuarios compartan la misma clave de idempotencia, pudiendo generar respuestas cacheadas incorrectas en la API de Mercado Pago.
  - En `whatsapp.ts`, las llamadas a `fetch(API_URL, ...)` carecen de `AbortSignal.timeout()`. Ante una degradación de servicio de Meta Graph API, la función serverless queda colgada consumiendo recursos.

---

### 3.5. Escalabilidad, Conexiones a Base de Datos y Políticas RLS

#### Hallazgo ARC-14: Política de RLS Impide Visualizar Disponibilidad a Usuarios Anónimos
- **Archivos Inspeccionados**:
  - `supabase/migrations/002_rls_policies.sql:67-75`
  - `src/components/venue/AvailabilityGrid.tsx:40-48`

- **Código Verificado (`supabase/migrations/002_rls_policies.sql:67-75`)**:
```sql
67: CREATE POLICY "Users can view their own bookings and venue owners can view their venue bookings" ON public.bookings
68: FOR SELECT USING (
69:     user_id = auth.uid() OR
70:     EXISTS (
71:         SELECT 1 FROM public.courts c
72:         JOIN public.venues v ON c.venue_id = v.id
73:         WHERE c.id = court_id AND v.owner_id = auth.uid()
74:     ) OR public.is_platform_admin()
75: );
```

- **Falla Lógica**:
  - `AvailabilityGrid.tsx` consulta en el cliente `bookings` para pintar qué turnos están ocupados (`Ocupado`) y cuáles libres (`Libre`).
  - Para cualquier visitante no autenticado (`auth.uid() IS NULL`) o cualquier jugador que no sea el dueño del turno, la política RLS devuelve `0` filas de reservas.
  - Como resultado, el calendario muestra **todos los horarios como "Libre"**, incluso si la cancha está 100% ocupada ese día.

---

#### Hallazgo ARC-13: Inconsistencias de Timezone (UTC vs America/Argentina/Buenos_Aires)
- **Archivos Inspeccionados**:
  - `src/app/dashboard/page.tsx:52`
  - `src/app/(main)/bookings/page.tsx:42-46`

- **Código Verificado (`src/app/dashboard/page.tsx:52`)**:
```typescript
52:   const today = new Date().toISOString().split('T')[0]
53:   const todayBookings = bookings.filter((b: any) => b.booking_date === today && b.status !== 'cancelled')
```

- **Falla**:
  - `new Date().toISOString()` utiliza la hora UTC del servidor.
  - En Argentina (UTC-3), a las 21:01 hs locales, la hora UTC ya es 00:01 hs del día siguiente.
  - A partir de las 21:00 hs de cada noche, el dashboard muestra `0` reservas para el día en curso porque filtra contra la fecha de mañana.

---

## 4. Diagrama Comparativo de Arquitectura

### 4.1. Flujo Actual (Vulnerable y Concurrente)

```
[ Usuario Navega a /booking/court-123 ]
       │ (HTTP GET)
       ▼
[ Server Component: booking/[courtId]/page.tsx ]
       │  ⚠️ Mutación en GET
       ▼
[ Supabase DB: INSERT INTO bookings (status: 'pending') ] ──► (Bloquea a otros usuarios)
       │
       ▼
[ Renderiza BookingWizard.tsx ]
       │
       ▼ [ Usuario hace clic en "Ir a Pagar" ]
       │
       ├───────────────────────────────────────────────┐
       │ (Navegación externa a MP)                     │ (Disparo de evento)
       ▼                                               ▼
[ Redirección a Mercado Pago Checkout ]     [ beforeunload -> sendBeacon ]
       │                                               │
       │ (Usuario ingresa tarjeta)                     ▼
       │                                    [ DELETE FROM bookings (Cancelado) ]
       ▼                                               │
[ MP Aprueba Pago tras 3.5 min ]                       │
       │                                               ▼
       ▼                                    [ Cron pg_cron elimina > 3 min ]
[ Webhook MP -> /api/webhooks/mercadopago ]
       │  ⚠️ Usa createClient() (anon role)
       ▼
[ Supabase: UPDATE bookings (Falla por RLS o Fila Inexistente) ]
       │
       ▼
💥 RESULTADO: Usuario cobrado, reserva borrada, slots desincronizados.
```

---

### 4.2. Flujo Objetivo (Robusto, Transaccional y Seguro)

```
[ Usuario Navega a /booking/court-123 ]
       │ (HTTP GET - Idempotente, Solo Lectura)
       ▼
[ Server Component: Renderiza Formulario / Resumen ]
       │
       ▼ [ Usuario hace clic en "Confirmar y Pagar" ] (Form Action / Server Action)
       │
       ▼
[ Server Action: createBookingSession() ]
       │ 1. Valida disponibilidad y crea reserva pending con expires_at (15 min)
       │ 2. Aplica créditos de forma transaccional (RPC con saldo remanente)
       │ 3. Genera Preferencia en MP con Idempotency Key única (UUID)
       │
       ▼
[ Redirección a Mercado Pago Checkout ] (Sin beforeunload beacon destructivo)
       │
       ▼ [ Usuario Paga en MP ]
       │
       ▼
[ Webhook MP -> /api/webhooks/mercadopago ]
       │ 1. Valida firma HMAC x-signature
       │ 2. Usa createAdminClient() (Service Role)
       │ 3. Ejecuta RPC transaccional: confirm_booking_payment(booking_id, payment_id)
       │ 4. revalidateTag(`venue-${venueId}`) y revalidatePath('/bookings')
       │ 5. Despacha notificaciones con waitUntil() y retries asíncronos
       │
       ▼
✅ RESULTADO: Transacción atómica, datos consistentes y notificación garantizada.
```

---

## 5. Plan de Refactorización y Pasos de Acción Inmediatos

### Fase 1: Correcciones Críticas de Integridad y Resiliencia (Inmediatas)
1. **Eliminar el `INSERT` en HTTP GET**:
   - Mover la creación del booking a una Server Action que se invoque únicamente cuando el usuario presiona "Ir a pagar" o "Confirmar reserva".
2. **Remover el listener `beforeunload` en `BookingWizard.tsx`**:
   - Eliminar el `sendBeacon` a `/api/bookings/cancel`.
3. **Ajustar el Cron de Expiración (`012_abandoned_bookings_cron.sql`)**:
   - Aumentar el tiempo de gracia de reservas pendientes de **3 minutos a 15 minutos** (`INTERVAL '15 minutes'`).
4. **Corregir el Webhook de Mercado Pago**:
   - Cambiar `createClient()` por `createAdminClient()` en `src/app/api/webhooks/mercadopago/route.ts` para que el worker tenga permisos de escritura bajo RLS.
5. **Arreglar la Función de Notificaciones (`src/lib/notifications/index.ts`)**:
   - Eliminar el `setTimeout(..., 0)` y hacer que `notify()` devuelva una promesa real compatible con `waitUntil()`.
6. **Corregir el Consumo de Créditos (`src/lib/credits/manager.ts`)**:
   - Modificar `applyCredits` para que, en caso de consumo parcial, actualice el registro existente o genere un nuevo registro con el crédito remanente.

### Fase 2: Optimización de App Router, Caching y Rendimiento
1. **Crear Boundaries Estándar**:
   - Implementar `loading.tsx` con skeletons shimmer en `src/app/`, `src/app/(main)/`, `src/app/dashboard/` y `src/app/(main)/venue/[id]/`.
   - Implementar `error.tsx` con botón de reintento (`reset()`) en cada nivel de ruta.
   - Implementar `not-found.tsx` personalizado para canchas o complejos inexistentes.
2. **Eliminar Waterfalls Secuenciales**:
   - En `src/app/(main)/venue/[id]/page.tsx`, consolidar las consultas en un único `select` relacional de Supabase.
   - En `src/app/(main)/page.tsx` y `src/app/admin/page.tsx`, ejecutar consultas independientes con `Promise.all()`.
3. **Optimizar `unstable_cache` y Tags de Invalidación**:
   - Cambiar la clave de cache de `getVenueData` a `['venue-profile', id]` y agregar tag específica `venue-${id}`.
   - Asegurar que todas las Server Actions en `dashboard/courts/actions.ts` y `dashboard/venue/actions.ts` llamen a `revalidateTag(`venue-${venueId}`)`.

### Fase 3: Base de Datos, RLS y Escalabilidad
1. **Crear Vista / RPC Pública para Disponibilidad**:
   - Crear una función PostgreSQL segura (`SECURITY DEFINER`) `get_court_availability(p_venue_id UUID, p_date DATE)` que retorne únicamente los slots ocupados (sin exponer PII de clientes como nombres, emails o teléfonos).
2. **Manejo Centralizado de Zonas Horarias**:
   - Utilizar funciones con soporte explícito para `America/Argentina/Buenos_Aires` (ej. vía `date-fns-tz`) para evitar desfasajes en los cálculos de reservas y métricas diarias a partir de las 21:00 hs.
3. **Paginación en Endpoints Críticos**:
   - Implementar paginación mediante `.range(offset, offset + limit)` en `/search`, `/dashboard/bookings` y `/admin/users`.

---

## 6. Conclusión de la Auditoría

La arquitectura actual de ReservaYa cuenta con una selección de tecnologías sólida (Next.js 14, Supabase, Tailwind), pero **adolece de antipatrones severos en el manejo del ciclo de vida de las reservas, la gestión de estado asíncrono en serverless y los límites de seguridad de RLS**. 

La aplicación no debe desplegarse a producción comercial sin antes resolver los hallazgos críticos **ARC-01 a ARC-06**, los cuales causan pérdidas de pagos, cancelaciones accidentales de turnos y fallas en el envío de notificaciones. La implementación del plan de refactorización detallado garantizará una plataforma de alto rendimiento, escalable y resiliente.
