# 🏆 INFORME MAESTRO DE AUDITORÍA DELTA Y RESOLUCIÓN: RESERVAYA (CANCHAPP)

**Documento:** Reporte Definitivo de Verificación Delta, Reconciliación Transversal y Diagnóstico de Regresiones  
**Ruta del Archivo:** `audit-reports/06-reporte-resolucion.md`  
**Fecha de Publicación:** 01 de Septiembre de 2026  
**Tipo de Análisis:** Auditoría de Verificación Delta (Estado Inicial vs. Estado Actual)  
**Alcance Evaluado:** 100% de la Base de Código (`supabase/migrations/001..017`, `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/types/`, `supabase/functions/`, `configs`)  
**Autor Líder:** Master Delta Report Author & Synthesis Specialist  
**Comité de Auditores Especialistas:**
1. Security Delta Auditor (*OWASP ASVS L2 / CWE / Supabase Security*)
2. Architecture & Performance Delta Auditor (*Next.js 14 App Router / Serverless Resilience*)
3. Business Logic & Payments Delta Auditor (*Transaccionalidad Financiera / Mercado Pago / Créditos*)
4. UX, UI & Accessibility Specialist (*WCAG 2.2 AA / Ergonomía Táctil Móvil / CRO*)
5. Code Quality & TypeScript Specialist (*Strict TypeScript / Modularidad / Clean Code*)

---

## 1. Metadatos y Resumen Estadístico Global

| Métrica Global | Valor Cuantitativo | Porcentaje Relativo | Estado de Cumplimiento |
| :--- | :---: | :---: | :--- |
| **Total de Hallazgos Históricos Auditados** | **102 hallazgos** | 100.0% | Base comparativa consolidada |
| **✅ Hallazgos Totalmente Resueltos** | **4 hallazgos** | **3.92%** | *SEC-05, SEC-06, SEC-17, ARC-03* (con efectos colaterales) |
| **⚠️ Hallazgos Parcialmente Resueltos** | **14 hallazgos** | **13.73%** | Mitigados en BD pero vivos en UI/API o con evasión mutada |
| **❌ Hallazgos No Resueltos (Persistentes)** | **84 hallazgos** | **82.35%** | Vulnerabilidades y defectos estructurales intactos |
| **🚨 Nuevas Regresiones y Antipatrones Detectados** | **31 hallazgos** | — | Fallas críticas introducidas en migraciones 013-017 y refactors |
| **Puntaje de Madurez Global Ponderado** | **31.4 / 100** | 🔴 **CRÍTICO** | **RECHAZADO — NO APTO PARA SALIDA A PRODUCCIÓN** |

```
BALANCE GLOBAL DE RESOLUCIÓN DELTA:
[█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 3.92% RESUELTO (4/102)
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░] 13.73% PARCIAL (14/102)
[████████████████████████░░░░░░] 82.35% NO RESUELTO (84/102)
NUEVAS REGRESIONES CRÍTICAS DETECTADAS: 31
```

---

## 2. Resumen Ejecutivo y Diagnóstico Global

Tras contrastar de forma destructiva y exhaustiva el estado actual del repositorio frente a los reportes basales (`01-seguridad.md`, `02-arquitectura.md`, `03-negocio.md`, `04-ux-accesibilidad.md`, `05-calidad-codigo.md` y `sintesis-final.md`), el Comité de Auditoría concluye:

### 🚨 Veredicto Unánime: RECHAZADO — BLOQUEO CRÍTICO OPERATIVO, FINANCIERO Y DE SEGURIDAD

Si bien se desplegaron migraciones incrementales en PostgreSQL (`013_secure_profiles.sql` a `017_reschedule_loophole.sql`) y se ejecutaron refactorizaciones cosméticas (creación de archivos en `src/lib/utils/`, instalación de Vitest y renombrado físico de componentes a `kebab-case.tsx`), **la plataforma se encuentra en un estado de mayor fragilidad operativa que en la auditoría inicial**.

### El Fenómeno de la "Mitigación Asimétrica e Ilusoria":
La base de datos implementó triggers y revocaciones de permisos RLS para mitigar vulnerabilidades críticas de seguridad, pero **el código de la aplicación (Server Actions, API Routes y componentes React) no fue adaptado para coordinarse con dichas reglas**. Esto produjo una desincronización arquitectónica estructural que transformó brechas de seguridad en **callejones sin salida y errores de base de datos no controlados (deadlocks funcionales)**:

1. **Colapso del Flujo de Reprogramación (`NEW-SEC-02` / `NEW-ARC-01` / `NEW-BUS-02`):** La migración `017` bloqueó la mutación de fechas en `bookings` por parte de usuarios, asumiendo que se ejecutaría mediante `rescheduleBooking()` con permisos de servicio. Sin embargo, dicha Server Action sigue usando `createClient()` (cliente de sesión del jugador). Resultado: **el 100% de las reprogramaciones legítimas fallan con una excepción fatal de PostgreSQL**.
2. **Deadlock en Checkout con Créditos (`NEW-SEC-03` / `NEW-ARC-02` / `NEW-BUS-01`):** La migración `015` restringió el `UPDATE` de la tabla `credits` exclusivamente a administradores. Sin embargo, `applyCredits()` sigue utilizando `createClient()`. Al intentar pagar con créditos, la operación falla por RLS. Adicionalmente, si el crédito cubre el 100% del valor, `create-preference` intenta confirmar la reserva con `createClient()`, siendo bloqueado por el trigger de `014_secure_bookings.sql`. Resultado: **ningún usuario con saldo a favor puede reservar**.
3. **Persistencia de Rutas de Fraude y Bypass en Producción (`SEC-01`, `SEC-02`, `NEW-ARC-05`):** Las páginas `src/app/upgrade/page.tsx` (escalación a superadmin) y `src/app/(main)/mock-payment/page.tsx` (aprobación gratuita de reservas) **no fueron eliminadas** y permanecen accesibles en el árbol de rutas públicas de Next.js.
4. **Vulnerabilidad Financiera Activa en Mercado Pago (`SEC-04` / `NEG-01`):** El endpoint `/api/booking/create-preference` continúa confiando en el campo `price` enviado por el navegador, permitiendo pagar señas de $1 ARS por turnos de $30.000 ARS.
5. **Multiplicación por 500% de la Ventana de DoS de Canchas (`NEW-BUS-04`):** La migración `016` extendió la purga de reservas colgadas de 3 a 15 minutos. Como el Server Component de checkout (`booking/[courtId]/page.tsx:106-134`) sigue insertando reservas temporales ante peticiones HTTP GET (`ARC-01`), un script con 4 requests por hora puede inhabilitar comercialmente una cancha durante todo el día.
6. **Evasión Masiva de Tipos Mutada (`NEW-CQ-01`):** Las 66 instancias originales de `as any` se eliminaron, pero fueron sustituidas por **123 directivas `// @ts-expect-error fix inference`**, **14 dobles aserciones `as unknown as`** y **6 casts `as never`**, perpetuando la ceguera del compilador ante roturas de esquema.
7. **Riesgo Inmediato de Caída de Build en Linux/CI (`NEW-CQ-02`):** Se renombraron los archivos a `kebab-case.tsx` en disco, pero componentes clave siguen importándolos con rutas relativas en `PascalCase` (`./VenueList`, `./SearchFilters`), lo cual quiebra de inmediato la compilación en servidores Linux (Vercel, Docker).
8. **Incumplimiento Sistemático de Accesibilidad Universal (WCAG 2.2 AA):** 34 de los 36 hallazgos de accesibilidad siguen vigentes, con 18 directivas activas suprimiendo reglas a11y, ratios de contraste ilegales de 2.29:1 y touch targets táctiles de 24-32px.

---

## 3. Tablas Comparativas Explícitas por Dominio

---

### 3.1. Dominio 1: Seguridad, Autenticación y Autorización (SEC-01 a SEC-18)

| ID | Hallazgo Original (`01-seguridad.md`) | Severidad | Estado Delta | Archivo y Línea Verificada | Evidencia Técnica y Diagnóstico |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **SEC-01** | Escalación de privilegios en `profiles` y ruta `/upgrade` | **CRITICAL** | ⚠️ **Parcial** | `supabase/migrations/013_secure_profiles.sql:3-35`<br>`src/app/upgrade/page.tsx:1-38` | Trigger `tr_protect_profile_fields` frena cambios de rol en BD para usuarios estándar. Sin embargo, `src/app/upgrade/page.tsx` no fue borrada y sigue activa en producción. El trigger usa `IF auth.uid() IS NULL` (anti-patrón). |
| **SEC-02** | Bypass total de pago y confirmación forzada de reservas | **CRITICAL** | ⚠️ **Parcial** | `supabase/migrations/014_secure_bookings.sql:3-52`<br>`supabase/migrations/017_reschedule_loophole.sql:5-57`<br>`src/app/(main)/mock-payment/page.tsx:1-76` | Trigger `tr_protect_booking_fields` bloquea la mutación de `payment_status` por jugadores. No obstante, la página `/mock-payment` y la Server Action `approvePayment` siguen compiladas y activas. |
| **SEC-03** | Omisión de firma HMAC y fallo RLS en Webhook de Mercado Pago | **CRITICAL** | ❌ **No Resuelto** | `src/app/api/webhooks/mercadopago/route.ts:18-28, 47-63` | La validación de firma sigue condicionada (`if (secret && xSignature && xRequestId)`), el webhook sigue usando `createClient()` (anon, bloqueado por RLS) y no hay control de idempotencia. |
| **SEC-04** | Manipulación de precio de reserva por parte del cliente | **CRITICAL** | ❌ **No Resuelto** | `src/app/api/booking/create-preference/route.ts:14-18, 39-48` | El endpoint extrae `price` directamente del JSON del cliente sin validar contra `pricing_rules` ni contra el registro de la reserva en BD. |
| **SEC-05** | Modificación no autorizada de créditos y saldos vía RLS | **CRITICAL** | ✅ **Resuelto** *(con regresión)* | `supabase/migrations/015_close_phase_0.sql:3-7`<br>`src/lib/credits/manager.ts:123-125` | Se revocó la política `FOR UPDATE` para usuarios comunes en `credits`. La vulnerabilidad RLS está cerrada. *(Regresión: `applyCredits` falla en app por usar `createClient()`)*. |
| **SEC-06** | Exposición pública no autenticada de PII en `profiles` | **CRITICAL** | ✅ **Resuelto** *(con regresión)* | `supabase/migrations/015_close_phase_0.sql:9-18`<br>`src/app/(main)/venue/[id]/page.tsx:71` | Se revocó `USING (true)` y se restringió a `auth.uid() = id OR is_platform_admin()`. Creada vista `public_user_profiles`. *(Regresión: visitantes anónimos ven autores nulos en reseñas)*. |
| **SEC-07** | Inyección de HTML / Phishing en plantillas de correo Resend | **HIGH** | ❌ **No Resuelto** | `src/lib/notifications/templates.ts:24, 28, 67, 108, 151`<br>`src/app/actions/chat.ts:65-70` | No existe sanitización ni función `escapeHtml` en templates ni en el despacho de emails transaccionales del chat. |
| **SEC-08** | Bucket `chat-images` público y subida irrestricta en `venue-photos` | **HIGH** | ❌ **No Resuelto** | `supabase/migrations/010_chat_attachments_and_storage.sql:18-20, 31-33` | El bucket `chat-images` sigue siendo 100% público y `venue-photos` permite subida a cualquier autenticado sin comprobar propiedad del complejo. |
| **SEC-09** | Inyección de filtros PostgREST en buscador de canchas | **HIGH** | ❌ **No Resuelto** | `src/app/(main)/search/page.tsx:54-56` | El parámetro `q` se interpola directamente en `.or(...)` sin sanitizar delimitadores sintácticos de PostgREST (`()`, `,`, `.`). |
| **SEC-10** | Falla de autorización RBAC en Server Actions de reservas | **HIGH** | ⚠️ **Parcial** | `src/app/dashboard/bookings/actions.ts:7-40`<br>`supabase/migrations/017_reschedule_loophole.sql:27-39` | El trigger de BD mitiga la alteración de estado por jugadores, pero las Server Actions carecen de validación de rol y de propiedad de complejo (`owner_id`) en aplicación. |
| **SEC-11** | Edge Functions no autenticadas expuestas públicamente | **HIGH** | ❌ **No Resuelto** | `supabase/functions/expire-credits/index.ts:5-36`<br>`supabase/functions/send-reminder/index.ts:5-59` | Ambas funciones Edge Deno continúan aceptando peticiones directas sin exigir la cabecera `Authorization: Bearer <CRON_SECRET>`. |
| **SEC-12** | XSS en script JSON-LD incrustado | **MEDIUM** | ❌ **No Resuelto** | `src/app/(main)/venue/[id]/page.tsx:151-154` | Se serializa JSON-LD con `JSON.stringify(jsonLd)` directo sin escapar secuencias `</script>` ni caracteres `<`. |
| **SEC-13** | Redirección abierta en callback de autenticación OAuth | **MEDIUM** | ❌ **No Resuelto** | `src/app/(auth)/callback/route.ts:7, 14` | El parámetro `next` no se valida contra URLs relativas al protocolo (`//attacker.com`). |
| **SEC-14** | Ausencia de validación de esquema en tiempo de ejecución (Zod) | **MEDIUM** | ⚠️ **Parcial** | `package.json:40`<br>`src/lib/utils/validators.ts:1-76` | Se instaló `zod` y se creó `validators.ts`, pero ningún endpoint ni Server Action importa ni ejecuta los esquemas (código muerto). |
| **SEC-15** | Falta de headers de seguridad HTTP en `next.config.mjs` | **MEDIUM** | ❌ **No Resuelto** | `next.config.mjs:1-18` | `next.config.mjs` sigue sin definir la función `async headers()` (ausencia de HSTS, CSP, X-Frame-Options, etc.). |
| **SEC-16** | Timing attack en verificación HMAC de Mercado Pago | **LOW** | ❌ **No Resuelto** | `src/lib/mercadopago/helpers.ts:44` | Se compara el hash con el operador `digest === hash` en lugar de `crypto.timingSafeEqual`. |
| **SEC-17** | Inconsistencia de esquema en política RLS de reseñas | **LOW** | ✅ **Resuelto** | `supabase/migrations/015_close_phase_0.sql:20-30` | La política RLS fue recreada referenciando `b.status = 'completed'` en lugar de `booking_status`. |
| **SEC-18** | Uso de `getSession()` inseguro en cliente | **INFO** | ❌ **No Resuelto** | `src/hooks/useUser.ts:23` | El hook sigue utilizando `supabase.auth.getSession()` en lugar de `supabase.auth.getUser()`. |

---

### 3.2. Dominio 2: Arquitectura, Resiliencia y Rendimiento (ARC-01 a ARC-15)

| ID | Hallazgo Original (`02-arquitectura.md`) | Severidad | Estado Delta | Archivo y Línea Verificada | Evidencia Técnica y Diagnóstico |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **ARC-01** | Mutación en HTTP GET (`INSERT` en render de página) | **CRITICAL** | ❌ **No Resuelto** | `src/app/(main)/booking/[courtId]/page.tsx:106-134` | `BookingPage` continúa ejecutando `supabase.from("bookings").insert(...)` en el render GET del Server Component, bloqueando slots ante simples navegaciones. |
| **ARC-02** | `beforeunload` cancela reserva al redirigir a Mercado Pago | **CRITICAL** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:33-43`<br>`src/app/api/bookings/cancel/route.ts:20-26` | `booking-wizard.tsx` mantiene el listener `beforeunload` con `navigator.sendBeacon('/api/bookings/cancel')`, borrando reservas en DB al redirigir a MP. |
| **ARC-03** | Cron de pg_cron elimina reservas pendientes a los 3 minutos | **CRITICAL** | ✅ **Resuelto** | `supabase/migrations/016_extend_booking_cron.sql:1-13` | La migración 016 actualizó `public.delete_abandoned_bookings()` ampliando la tolerancia a `INTERVAL '15 minutes'`. |
| **ARC-04** | `setTimeout(..., 0)` en notificaciones se aborta por freeze serverless | **CRITICAL** | ❌ **No Resuelto** | `src/lib/notifications/index.ts:18-54`<br>`src/app/api/webhooks/mercadopago/route.ts:69-77` | `notify()` sigue ejecutando dentro de `setTimeout(..., 0)` sin retornar la promesa real, por lo que `waitUntil` en el webhook se resuelve inmediatamente en 0ms. |
| **ARC-05** | Webhook de MP usa cliente `anon` sin auth de cookies bajo RLS | **CRITICAL** | ❌ **No Resuelto** | `src/app/api/webhooks/mercadopago/route.ts:3, 47-58` | Aunque se creó `createAdminClient()`, la ruta del webhook sigue importando e invocando `createClient()` (rol `anon`), fallando el update bajo RLS. |
| **ARC-06** | Consumo de créditos quema el saldo remanente no utilizado | **CRITICAL** | ❌ **No Resuelto** | `src/lib/credits/manager.ts:121-128` | `applyCredits()` marca el cupón completo como `status = 'used'` sin fraccionar saldos ni emitir crédito remanente. |
| **ARC-07** | Ausencia Total de Boundaries (`loading.tsx`, `error.tsx`, `not-found.tsx`) | **HIGH** | ❌ **No Resuelto** | Todo el árbol `src/app/**` | Existen **0 archivos** `loading.tsx`, `error.tsx` y `not-found.tsx` en todos los segmentos de ruta de Next.js. |
| **ARC-08** | Cascadas de red (Waterfalls) y queries N+1 secuenciales | **HIGH** | ❌ **No Resuelto** | `src/app/(main)/venue/[id]/page.tsx:20-75`<br>`src/app/(main)/page.tsx:52, 91`<br>`src/app/admin/page.tsx:14, 15, 17` | `getVenueData` realiza 4 consultas `await` secuenciales. Las páginas Home y Admin ejecutan queries consecutivas sin `Promise.all()`. |
| **ARC-09** | Consultas masivas no paginadas y filtrado en memoria JS | **HIGH** | ❌ **No Resuelto** | `src/app/(main)/search/page.tsx:26-143`<br>`src/app/dashboard/bookings/page.tsx:22-26`<br>`src/app/admin/page.tsx:17-26` | No hay paginación `.range()`/`.limit()`. Filtros de superficie, tipo y precio se ejecutan con bucles `forEach` en la CPU del servidor. |
| **ARC-10** | Bloat de bundles cliente (3D Spline triple, Leaflet hotlinks) | **HIGH** | ❌ **No Resuelto** | `src/components/home/hero-3d.tsx:26-30`<br>`src/components/map/venue-map-client.tsx:15-41`<br>`src/components/layout/header.tsx:74-76` | `hero-3d.tsx` inyecta unpkg externo con `setTimeout(..., 2000)` ficticio; Leaflet hotlinkea imágenes de GitHub; Header cliente parpadea skeleton. |
| **ARC-11** | Inconsistencias de invalidación de cache (`revalidatePath` incompleto) | **HIGH** | ❌ **No Resuelto** | `src/app/dashboard/courts/actions.ts:45, 64, 98, 158`<br>`src/app/dashboard/venue/actions.ts:68, 99`<br>`src/app/dashboard/schedule/actions.ts:55` | Server Actions no invocan `revalidateTag('venues')` ni invalidan `/venue/[id]`, dejando la cache de 3600s desactualizada tras cambios de precios. |
| **ARC-12** | Idempotencia global hardcodeada (`idempotencyKey: 'abc'`) y sin timeouts | **MEDIUM** | ❌ **No Resuelto** | `src/lib/mercadopago/client.ts:6`<br>`src/lib/notifications/whatsapp.ts:40-52, 87-99` | `idempotencyKey: 'abc'` sigue fija en el singleton de MP. `fetch()` a WhatsApp Meta API carece de `AbortSignal.timeout()`. |
| **ARC-13** | Incompatibilidad de zona horaria UTC vs UTC-3 (Argentina) | **MEDIUM** | ❌ **No Resuelto** | `src/app/dashboard/page.tsx:52`<br>`src/app/(main)/bookings/page.tsx:41-45`<br>`src/lib/credits/manager.ts:5-7` | `new Date().toISOString()` sin timezone shift muestra 0 reservas pasadas las 21:00 ART; `manager.ts` compara horas locales con UTC. |
| **ARC-14** | RLS oculta reservas a anónimos falseando disponibilidad libre | **MEDIUM** | ❌ **No Resuelto** | `supabase/migrations/002_rls_policies.sql:67-75`<br>`src/components/venue/availability-grid.tsx:42-50` | `availability-grid.tsx` consulta `bookings` en el cliente. RLS devuelve 0 filas a usuarios anónimos o ajenos, mostrando todo "Libre". |
| **ARC-15** | Edge Function `send-reminder` marca enviado sin emitir notificaciones | **MEDIUM** | ❌ **No Resuelto** | `supabase/functions/send-reminder/index.ts:44-53` | El worker en Deno ejecuta `update({ reminder_sent: true })` omitiendo el envío real de correos o WhatsApps. |

---

### 3.3. Dominio 3: Lógica de Negocio, Finanzas y Pasarelas de Pago (NEG-01 a NEG-17)

| ID | Hallazgo Original (`03-negocio.md`) | Severidad | Estado Delta | Archivo y Línea Verificada | Evidencia Técnica y Diagnóstico |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **NEG-01** | Inyección de precio desde el cliente en `/api/booking/create-preference` | **CRITICAL** | ❌ **No Resuelto** | `src/app/api/booking/create-preference/route.ts:14, 40-41` | El servidor aún desestructura `price` desde `request.json()` sin validar contra la BD. Permite generar señas de $1 ARS. |
| **NEG-02** | Destrucción de saldo remanente en créditos ("Credit Burn") | **CRITICAL** | ❌ **No Resuelto** | `src/lib/credits/manager.ts:121-128` | Se mantiene el comentario MVP y la lógica que marca el crédito completo como `used` sin crear saldo remanente fraccionado. |
| **NEG-03** | Bucle de reprogramación y cancelación para eludir retención (<6h) | **CRITICAL** | ❌ **No Resuelto** | `src/lib/booking/actions.ts:59-103`<br>`src/lib/credits/manager.ts:4-38` | `rescheduleBooking` no asigna `is_rescheduled = true`, `calculateCancellationPolicy` no evalúa el flag, y el trigger `017` rompe la acción. |
| **NEG-04** | Arbitraje de precios en reprogramación a horarios pico | **HIGH** | ❌ **No Resuelto** | `src/lib/booking/actions.ts:78-98` | No se consultan las `pricing_rules` del nuevo horario ni se liquida el diferencial de tarifa de seña. |
| **NEG-05** | Desincronización de zonas horarias (UTC Vercel vs ART UTC-3) | **HIGH** | ❌ **No Resuelto** | `src/lib/credits/manager.ts:5-7, 41-43`<br>`src/components/booking/cancel-dialog.tsx:30-32` | Las funciones de negocio no utilizan `src/lib/utils/dates.ts` (`hoursUntilBooking`); siguen calculando fechas locales como UTC. |
| **NEG-06** | Consumo prematuro e irreversible de créditos antes de pagar en MP | **HIGH** | ❌ **No Resuelto** | `src/app/api/booking/create-preference/route.ts:43-48` | `applyCredits()` se invoca antes de enviar al usuario a la pasarela externa. Si no paga, los créditos se pierden. |
| **NEG-07** | Falla de RLS en Webhook de Mercado Pago y purga por cron | **CRITICAL** | ❌ **No Resuelto** | `src/app/api/webhooks/mercadopago/route.ts:47-63` | El Webhook sigue usando `createClient()` (cliente anónimo `auth.uid() = NULL`), fallando el `UPDATE` bajo RLS y eliminándose a los 15 min. |
| **NEG-08** | Bloqueo de turnos (Denial of Service) por peticiones GET | **HIGH** | ❌ **No Resuelto** | `src/app/(main)/booking/[courtId]/page.tsx:106-134` | El Server Component ejecuta `INSERT INTO bookings` en cada render HTTP GET, bloqueando slots sin intención de pago. |
| **NEG-09** | Confirmación ilusoria de pagos por "Transferencia" (Phantom Bookings) | **HIGH** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:83-86` | Redirige con toast a URL rota `/booking/court-id/success` sin actualizar BD; la reserva se borra por cron. |
| **NEG-10** | Inoperabilidad total del sistema de reseñas por falta de `booking_id` | **MEDIUM** | ❌ **No Resuelto** | `src/components/venue/review-section.tsx:55-61` | `ReviewSection` no envía `booking_id` en el `INSERT`. Viola la restricción `NOT NULL` y la política RLS de `015_close_phase_0.sql`. |
| **NEG-11** | Auto-reseñas falsas del administrador mediante reservas manuales | **MEDIUM** | ❌ **No Resuelto** | `src/app/dashboard/schedule/actions.ts:34-48` | Las reservas manuales siguen registrando `user_id = user.id` (dueño), y RLS no restringe reseñas de propietarios. |
| **NEG-12** | Violación de la regla de seña mínima del 30% en ajustes de complejo | **MEDIUM** | ❌ **No Resuelto** | `src/app/dashboard/venue/actions.ts:77-78` | El panel permite desactivar seña (`require_deposit: false`) y poner `deposit_percentage < 30`, violando `AGENTS.md`. |
| **NEG-13** | Saldo fantasma de créditos vencidos en interfaz de usuario | **MEDIUM** | ❌ **No Resuelto** | `src/components/profile/credits-list.tsx:24-27, 58-61` | No filtra `expires_at > NOW()` ni existe cron de expiración en PostgreSQL. |
| **NEG-14** | Precios promocionales no deterministas por solapamiento de reglas | **MEDIUM** | ❌ **No Resuelto** | `src/app/(main)/booking/[courtId]/page.tsx:50-70` | Falta cláusula `.order("is_promo_active", { ascending: false })` al seleccionar de `pricing_rules`. |
| **NEG-15** | Escalación pública de privilegios en `/upgrade` | **CRITICAL** | ⚠️ **Parcial** | `supabase/migrations/013_secure_profiles.sql:3-35`<br>`src/app/upgrade/page.tsx:1-38` | El trigger `013` frena la mutación en BD, pero la página `/upgrade` sigue desplegada y expuesta a usuarios. |
| **NEG-16** | Distorsión de métricas de facturación en Dashboard | **LOW** | ❌ **No Resuelto** | `src/app/dashboard/page.tsx:55-58` | Suma el 100% de `total_price` para reservas que solo cobraron 30% de seña o reservas manuales impagas. |
| **NEG-17** | Botones Fantasma en Administración y Reseñas (Dead UI) | **LOW** | ❌ **No Resuelto** | `src/app/admin/users/page.tsx:65-68`<br>`src/app/admin/moderation/page.tsx:51-56`<br>`src/app/dashboard/reviews/page.tsx:94-98`<br>`src/app/admin/venues/page.tsx:67-68` | Todos los botones de acción continúan sin manejadores de eventos ni Server Actions asociadas. |

---

### 3.4. Dominio 4: UX, UI, Responsividad y Accesibilidad WCAG 2.2 AA (UX-01 a UX-36)

| ID | Hallazgo Original (`04-ux-accesibilidad.md`) | Severidad | Estado Delta | Archivo y Línea Verificada | Evidencia Técnica y Diagnóstico |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **UX-01** | Botón primario de pago con contraste ilegal (2.29:1) | **CRITICAL** | ❌ **No Resuelto** | `src/app/(main)/mock-payment/page.tsx:58` | Mantiene `className="w-full bg-green-500 hover:bg-green-600 text-white h-12"`. Texto blanco sobre verde `green-500` arroja ratio 2.29:1 (mínimo AA 4.5:1). |
| **UX-02** | Título de confirmación con contraste 2.29:1 sobre fondo claro | **CRITICAL** | ❌ **No Resuelto** | `src/app/(main)/booking/[courtId]/success/page.tsx:63` | Mantiene `<h1 className="text-2xl font-black text-green-500 mb-2">` sobre contenedor `bg-green-500/10`. |
| **UX-03** | Badges hardcodeados de light mode en tema oscuro (`bg-green-100 text-green-800`) | **CRITICAL** | ❌ **No Resuelto** | `src/app/admin/page.tsx:102-105`<br>`src/app/dashboard/page.tsx:120-123`<br>`src/components/dashboard/bookings/bookings-client.tsx:178-181`<br>`src/components/booking/cancel-dialog.tsx:88,93,101` | Estados de reservas y avisos de cancelación continúan usando `bg-green-100 text-green-800`, `bg-red-100`, creando parches deslumbrantes en dark mode. |
| **UX-04** | Bug de tokens OKLCH dentro de `hsl()` en popups de Leaflet | **HIGH** | ❌ **No Resuelto** | `src/components/map/venue-map-client.tsx:151-155` | Persiste la declaración CSS inválida: `background-color: hsl(var(--card));`. El navegador la descarta y muestra popups blancos en dark mode. |
| **UX-05** | Tokens de color verde en globals.css con contraste insuficiente | **HIGH** | ⚠️ **Parcial** | `src/app/globals.css:104, 138` | En `.dark` se usa `--primary: oklch(0.65 0.17 146)` con foreground negro (alto contraste). En `:root` se usa `--primary: oklch(0.55 0.15 146)` con blanco (ratio ~3.1:1 < 4.5:1). |
| **UX-06** | Touch targets de botones < 44×44px en primitivas base | **CRITICAL** | ❌ **No Resuelto** | `src/components/ui/button.tsx:24-35`<br>`src/components/ui/input.tsx:12` | `size.default` sigue en `h-8` (32px), `xs` en `h-6` (24px), `sm` en `h-7` (28px). `Input` default sigue en `h-8` (32px). Ninguno cumple 44px en mobile. |
| **UX-07** | Avatar de usuario en Header con área táctil insuficiente (32×32px) | **HIGH** | ❌ **No Resuelto** | `src/components/layout/header.tsx:79-80` | `<Button variant="ghost" className="relative h-8 w-8 rounded-full">` con `<Avatar className="h-8 w-8">` sin padding expandido ni `aria-label`. |
| **UX-08** | Botón Hamburguesa con `px-0` y supresión de anillo de foco | **HIGH** | ❌ **No Resuelto** | `src/components/layout/header.tsx:131-137` | Sigue con `px-0` y `focus-visible:ring-0 focus-visible:ring-offset-0`. Inoperable con teclado e inaccesible visualmente. |
| **UX-09** | Botón destructivo Eliminar Foto de 28×28px (`h-7 w-7`) | **HIGH** | ❌ **No Resuelto** | `src/components/dashboard/venue/venue-photos-form.tsx:194-197` | `<Button type="button" variant="destructive" size="icon" className="h-7 w-7 rounded-full shadow-md">` (28×28px, viola WCAG 2.5.8). |
| **UX-10** | Botón Eliminar Oferta de 24×24px (`h-6 w-6`) | **HIGH** | ❌ **No Resuelto** | `src/components/dashboard/courts/offers-modal.tsx:120-125` | `<Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive">` (24×24px). |
| **UX-11** | Checkbox de términos en cancelación de 13×13px | **MEDIUM** | ❌ **No Resuelto** | `src/components/booking/cancel-dialog.tsx:112-118` | `<input type="checkbox" id="terms" checked={confirmChecked} className="mt-1" />` sin wrapper accesible de 44×44px. |
| **UX-12** | Compresión de selector de fechas en Buscador Hero en < 360px | **MEDIUM** | ❌ **No Resuelto** | `src/components/home/hero-search.tsx:88-115` | Mantiene fila flex única `md:max-w-[280px] lg:max-w-[320px] flex items-center bg-background/50 rounded-md p-1 gap-1` sin wrap, colapsando textos. |
| **UX-13** | Grilla de disponibilidad horaria sin indicador de scroll lateral | **MEDIUM** | ❌ **No Resuelto** | `src/components/venue/availability-grid.tsx:120` | Contenedor `overflow-x-auto` con tabla `min-w-[800px]` sin affordance ni sombras de gradiente lateral. |
| **UX-14** | Sidebar de administración vertical invasivo en mobile | **HIGH** | ❌ **No Resuelto** | `src/components/layout/sidebar.tsx:30`<br>`src/app/dashboard/layout.tsx:32-38`<br>`src/app/admin/layout.tsx:34-58` | `<aside className="w-full md:w-64">` renderiza `min-h-[calc(100vh-4rem)]` en mobile, empujando el contenido hacia abajo. |
| **UX-15** | Scroll trap y bloqueo gestual en mapas Leaflet móviles | **HIGH** | ❌ **No Resuelto** | `src/components/map/venue-map-client.tsx:86-90`<br>`src/components/dashboard/venue/location-picker-map.tsx:72` | `scrollWheelZoom={true}` y paneo con 1 dedo activo en smartphones, atrapando el scroll vertical. |
| **UX-16** | Ausencia de Sticky Booking CTA Bar en ficha de complejo móvil | **HIGH** | ❌ **No Resuelto** | `src/app/(main)/venue/[id]/page.tsx` | No se implementó `StickyBookingBar.tsx`. El usuario móvil debe hacer scroll por 8 secciones para reservar. |
| **UX-17** | Comentarios `eslint-disable jsx-a11y/*` para silenciar accesibilidad | **CRITICAL** | ❌ **No Resuelto** | 14 archivos en `src/components/` y `src/app/` (18 ocurrencias) | 18 directivas activas suprimiendo reglas de accesibilidad (`label-has-associated-control`, etc.). |
| **UX-18** | Opciones de pago en wizard con `div` sin rol ni foco | **HIGH** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:218-234` | `<div>` con `onClick={() => setPaymentMethod(...)}` sin `role="radio"`, `aria-checked`, ni `tabIndex={0}`. |
| **UX-19** | Formularios con etiquetas huérfanas sin `htmlFor`/`id` | **HIGH** | ❌ **No Resuelto** | `court-form-modal.tsx:40,45,54`<br>`pricing-modal.tsx:41`<br>`offers-modal.tsx:129,140`<br>`manual-booking-modal.tsx:47,57`<br>`venue-forms.tsx:36,40`<br>`search-filters.tsx:205,219` | Más de 20 campos interactivos carecen de asociación programática con su `<label>`. |
| **UX-20** | Botones iconográficos sin `aria-label` descriptivo | **MEDIUM** | ❌ **No Resuelto** | `promo-carousel.tsx:49,103`<br>`availability-grid.tsx:100,107`<br>`schedule-navigation.tsx:31,38`<br>`venue-gallery.tsx:76,84`<br>`player-chat-modal.tsx:334,354` | Todos los botones con íconos puros carecen de texto accesible para lectores de pantalla. |
| **UX-21** | Celdas de disponibilidad horaria descontextualizadas ("Libre") | **MEDIUM** | ❌ **No Resuelto** | `src/components/venue/availability-grid.tsx:163-169` | El botón de slot solo dice "Libre" sin especificar cancha, fecha ni horario en `aria-label`. |
| **UX-22** | Ausencia de Skip Navigation Link en Root Layout | **HIGH** | ❌ **No Resuelto** | `src/app/layout.tsx` | No existe `<a href="#main-content">` para saltear la cabecera con teclado. |
| **UX-23** | Elementos interactivos ocultos que reciben foco (`opacity-0`) | **MEDIUM** | ❌ **No Resuelto** | `src/components/home/promo-carousel.tsx:48,102`<br>`src/components/dashboard/venue/venue-photos-form.tsx:189` | Tienen `group-hover:opacity-100` pero carecen de `focus-within:opacity-100`. El usuario enfoca botones invisibles. |
| **UX-24** | Cabeceras de ordenamiento de tabla inoperables por teclado | **MEDIUM** | ❌ **No Resuelto** | `src/components/dashboard/bookings/bookings-client.tsx:144-158` | `<th onClick={() => handleSort(...)}>` no tiene `tabIndex={0}`, `aria-sort` ni listeners de Enter/Espacio. |
| **UX-25** | Ausencia de `role="status"` y `aria-live="polite"` en filtros y chat | **MEDIUM** | ❌ **No Resuelto** | `src/components/search/search-filters.tsx`<br>`src/components/chat/player-chat-modal.tsx:256`<br>`src/components/dashboard/inbox/admin-message-list.tsx:29` | Ni el contador de resultados ni los mensajes entrantes son anunciados a tecnologías asistivas. |
| **UX-26** | Precios tachados en ofertas no distinguidos para screen readers | **LOW** | ❌ **No Resuelto** | `src/components/home/promo-carousel.tsx:89-95` | Carece de prefijos `sr-only` ("Precio original:", "Precio con descuento:"). |
| **UX-27** | Uso de diálogos nativos `alert()` bloqueantes | **CRITICAL** | ⚠️ **Parcial** | 14 llamadas en `cancel-dialog.tsx`, `player-chat-modal.tsx`, `booking-actions.tsx`, `court-form-modal.tsx`, etc. | `booking-wizard.tsx` y `venue-forms.tsx` migraron a `toast()`, pero persisten 14 invocaciones activas a `alert()`. |
| **UX-28** | Falta de optimización de teclados móviles (`autoComplete`, `inputMode`) | **MEDIUM** | ❌ **No Resuelto** | `src/app/(main)/profile/page.tsx:118,127`<br>`src/components/home/hero-search.tsx:55`<br>`src/components/search/search-filters.tsx:102,222` | Faltan `autoComplete="name"`, `autoComplete="tel"`, `enterKeyHint="search"`, e `inputMode="numeric"`. |
| **UX-29** | Carga forzada y spinner artificial de 2s en Hero3D | **MEDIUM** | ❌ **No Resuelto** | `src/components/home/hero-3d.tsx:20-22` | Mantiene `setTimeout(() => setIsLoading(false), 2000)` desacoplado de WebGL. |
| **UX-30** | Ausencia de Skeleton Loaders y Route Boundaries | **HIGH** | ❌ **No Resuelto** | Totalidad del árbol `src/app/**` | Hay **0 archivos** `loading.tsx`, `error.tsx` o `not-found.tsx` en toda la aplicación. |
| **UX-31** | Duplicación de pasos en `BookingWizard` | **HIGH** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:116-248` | Sigue dividido en 2 pasos independientes, sumando clics superfluos antes del checkout. |
| **UX-32** | "Transferencia" simulada redirigiendo a ruta rota `court-id` | **HIGH** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:84-85` | Sigue ejecutando `router.push('/booking/court-id/success?...')` con el string literal `court-id`. |
| **UX-33** | Callejón sin salida en modal de Reprogramación | **HIGH** | ❌ **No Resuelto** | `src/components/booking/reschedule-dialog.tsx:58-62` | Sigue mostrando el mensaje: *"Funcionalidad de reprogramación en desarrollo. Por ahora cancela..."*. |
| **UX-34** | Ausencia de comprobante descargable y botón calendario | **MEDIUM** | ❌ **No Resuelto** | `src/app/(main)/booking/[courtId]/success/page.tsx:97-108` | No permite exportar comprobante ni agregar el evento a Google Calendar / `.ics`. |
| **UX-35** | Ausencia de feedback visual de estado vacío en búsqueda | **MEDIUM** | ❌ **No Resuelto** | `src/components/search/venue-list.tsx:40-48` | Muestra texto plano sin CTA para limpiar filtros o sugerir otras fechas. |
| **UX-36** | Inconsistencia de fuentes y jerarquía tipográfica | **LOW** | ❌ **No Resuelto** | `src/styles/` y `src/components/` | Coexisten clases con tracking y leading desalineados con el sistema de diseño de 8px. |

---

### 3.5. Dominio 5: Calidad de Código, TypeScript y Estándares (CQ-01 a CQ-16)

| ID | Hallazgo Original (`05-calidad-codigo.md`) | Severidad | Estado Delta | Archivo y Línea Verificada | Evidencia Técnica y Diagnóstico |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **CQ-01 (2.1)** | Patrón Sistémico `(supabase.from(...) as any)` | **CRITICAL** | ⚠️ **Parcial** *(Mutado)* | `src/app/(main)/booking/[courtId]/page.tsx:33, 110`<br>`src/app/actions/chat.ts:25, 38, 56`<br>`src/app/api/webhooks/mercadopago/route.ts:50, 72` | Se eliminó `as any`, pero se reemplazó por **123 directivas `@ts-expect-error`**, **14 casts `as unknown as`** y **6 casts `as never`**. `queries.ts` tiene 0 llamadas. |
| **CQ-02 (2.2)** | Bug Crítico `booking_status` vs `status` | **CRITICAL** | ❌ **No Resuelto** | `src/components/dashboard/inbox/admin-chat-thread.tsx:55`<br>`src/components/dashboard/bookings/bookings-client.tsx:25, 178-185` | `admin-chat-thread.tsx` hace `.eq('booking_status', 'confirmed')` fallando en BD. `bookings-client.tsx` evalúa `booking.booking_status` (undefined), mostrando todo 'No Show'. |
| **CQ-03 (2.3)** | Dobles Aserciones Inseguras `as unknown as` | **HIGH** | ❌ **No Resuelto** *(Regresión)* | `src/app/dashboard/bookings/page.tsx:16`<br>`src/app/dashboard/inbox/page.tsx:29, 46`<br>`src/lib/credits/manager.ts:111` | Los 3 casos originales se mantienen intactos y se multiplicaron a 14 instancias en total. |
| **CQ-04 (2.4)** | Ausencia de Tipos en `src/types/` y Duplicación | **MEDIUM** | ⚠️ **Parcial** | `src/types/domain.ts:1-52`<br>`src/components/venue/court-list.tsx:8`<br>`src/components/dashboard/schedule/manual-booking-modal.tsx:9` | Se creó `domain.ts`, pero los componentes continúan definiendo interfaces locales redundantes e incompatibles (`CourtItem` vs `Court`, `ReviewItem` con `reply`). |
| **CQ-05 (2.5)** | Pagos y Créditos sin Tipado Fuerte | **HIGH** | ❌ **No Resuelto** | `src/lib/mercadopago/client.ts:6`<br>`src/lib/credits/manager.ts:121-128` | Clave de idempotencia estática `'abc'` sigue fija en el singleton de MP. Gestor de créditos sigue destruyendo saldos remanentes bajo comentario MVP. |
| **CQ-06 (3.1)** | Nombres en `kebab-case.tsx` | **MEDIUM** | ⚠️ **Parcial** *(Riesgo CI)* | `src/components/search/search-layout.tsx:5, 7`<br>`src/components/dashboard/inbox/inbox-client.tsx:6, 8`<br>`src/components/venue/availability-grid.tsx:10` | Archivos renombrados en disco a kebab-case, pero archivos consumidores importan rutas relativas en PascalCase (`./VenueList`, `./SearchFilters`), rompiendo Linux/CI. |
| **CQ-07 (3.2)** | Estructura `src/lib/utils/` y Utilidades en Hooks | **MEDIUM** | ⚠️ **Parcial** | `src/lib/utils/geo.ts:9-42`<br>`src/hooks/useGeolocation.ts:62-72` | Se crearon `currency.ts`, `dates.ts`, `geo.ts`, `validators.ts`, pero `calculateDistance()` sigue embebida en `useGeolocation.ts` (código duplicado no usado). |
| **CQ-08 (3.3)** | Conflicto Rutas API `/api/booking/cancel` vs `/api/bookings/cancel` | **MEDIUM** | ❌ **No Resuelto** | `src/app/api/booking/cancel/route.ts:1-20`<br>`src/app/api/bookings/cancel/route.ts:1-33` | Ambos endpoints coexisten. La ruta en plural ejecuta un `DELETE` físico destructivo para beacons. |
| **CQ-09 (4.1)** | Componentes Monolíticos (>150 Líneas) | **HIGH** | ❌ **No Resuelto** | 20 archivos en `src/components/`, `src/app/`, `src/lib/` | Los mismos 20 archivos siguen excediendo el límite (ej. `player-chat-modal.tsx`: 363L, `bookings-client.tsx`: 283L, `page.tsx`: 280L). |
| **CQ-10 (5.1)** | Violaciones de Alias Absoluto `@/` | **LOW** | ❌ **No Resuelto** *(Regresión)* | 18 ocurrencias en `src/` | No se corrigieron los 10 imports relativos originales y se añadieron 8 nuevos imports relativos en componentes, tipos y tests. |
| **CQ-11 (5.2)** | Desorden en la Jerarquía de Importación | **LOW** | ❌ **No Resuelto** | `src/components/venue/review-section.tsx:3-12` | Se mantiene exactamente el desorden React → External → Components → Hooks → Lib. |
| **CQ-12 (6.1)** | Supresiones de ESLint (86+ Directivas) | **HIGH** | ⚠️ **Parcial** | 37 directivas en 31 archivos (`src/app/dashboard/bookings/actions.ts:1`, etc.) | Se redujeron supresiones de `any` cambiándolas por `@ts-expect-error`. Persisten reglas de accesibilidad pegadas en Server Actions sin JSX. |
| **CQ-13 (6.2)** | Error Bloqueante de Build/Lint (`BookingWizard.tsx:33`) | **HIGH** | ❌ **No Resuelto** | `src/components/booking/booking-wizard.tsx:34` | El parámetro `e: BeforeUnloadEvent` continúa declarado sin ser utilizado en el event listener. |
| **CQ-14 (6.3)** | Errores Silenciados y Falta de Feedback | **MEDIUM** | ⚠️ **Parcial** | `src/components/booking/booking-wizard.tsx:164-167`<br>8 archivos con `alert()` | Se usó `toast()` en `venue-forms.tsx`, pero `booking-wizard.tsx` sigue tragando errores de cancelación con `console.error`. Quedan 14 `alert()` activos. |
| **CQ-15 (6.4)** | Branding "El Potrero" y Atajos de "MVP" | **LOW** | ⚠️ **Parcial** | `src/components/layout/header.tsx:55`<br>`src/components/layout/footer.tsx:13, 38`<br>`src/lib/notifications/templates.ts:36, 155`<br>`package.json:2` | Sigue presente en Header, Footer, URLs de templates de correo, package.json y tests. Los atajos MVP (`23:59:00`, credit burn) persisten. |
| **CQ-16 (6.5)** | Infraestructura de Testing Inexistente | **HIGH** | ⚠️ **Parcial** | `package.json:10-11`<br>`vitest.config.mjs`<br>`src/lib/**/*.test.ts` (5 suites) | Se instaló Vitest y se crearon 5 suites unitarias para utils/credits. Sin embargo, `test/integration/` está vacío (0 tests) y no hay pruebas de componentes. |

---

## 4. Análisis Profundo del Desacoplamiento Arquitectónico (Migraciones vs. App)

### 4.1. Evolución del Esquema en Migraciones SQL (001 a 017)
Durante los ciclos recientes se incorporaron las siguientes migraciones en `supabase/migrations/`:
- `013_secure_profiles.sql`: Trigger `tr_protect_profile_fields` sobre `profiles` para bloquear cambios de `role` y `credit_balance`.
- `014_secure_bookings.sql`: Trigger `tr_protect_booking_fields` sobre `bookings` para impedir que jugadores modifiquen `payment_status` o cambien `status` a valores distintos de `'cancelled'`.
- `015_close_phase_0.sql`: Revocó la política `FOR UPDATE` en `credits` a usuarios normales (restringiéndola a `is_platform_admin()`), restringió `SELECT` en `profiles` a `auth.uid() = id OR is_platform_admin()`, creó la vista `public_user_profiles` y corrigió el RLS de reseñas a `b.status = 'completed'`.
- `016_extend_booking_cron.sql`: Redefinió `delete_abandoned_bookings()` ampliando el intervalo de purga de 3 minutos a 15 minutos.
- `017_reschedule_loophole.sql`: Actualizó `tr_protect_booking_fields` para bloquear modificaciones en `booking_date` y `start_time` por parte de usuarios comunes.

### 4.2. Diagnóstico Técnico del "Trigger Mismatch" (`createClient()` vs `createAdminClient()`)
El fallo estructural de las mitigaciones radica en la disparidad del contexto de autenticación:
1. **En la Base de Datos:** Los triggers (`013`, `014`, `017`) asumen que las operaciones legítimas del sistema se ejecutan con privilegios de `service_role` (donde `auth.uid() IS NULL`).
2. **En la Aplicación:** Las Server Actions (`src/lib/booking/actions.ts`, `src/lib/credits/manager.ts`, `src/app/api/booking/create-preference/route.ts`) fueron implementadas importando `createClient()` de `@/lib/supabase/server`.
3. **Mecánica del Bloqueo:** Cuando un usuario autenticado (`auth.uid() = 'usr_123'`) invoca `rescheduleBooking()`, `supabase.from('bookings').update(...)` envía el token JWT del usuario. PostgreSQL ejecuta el trigger `tr_protect_booking_fields`, evalúa `NEW.booking_date != OLD.booking_date`, detecta que `auth.uid()` no es null y lanza inmediatamente:
   ```sql
   RAISE EXCEPTION 'Unauthorized: Cannot reschedule directly. Use the rescheduleBooking action.';
   ```
4. La Server Action captura la excepción de PostgreSQL y retorna `{ success: false, error: "Error al reprogramar la reserva" }`, haciendo imposible la reprogramación de turnos.
5. El mismo conflicto ocurre en `applyCredits()`: al usar `createClient()`, la política RLS de la migración `015` rechaza el `UPDATE` sobre `public.credits`, abortando el checkout.
6. Y cuando una reserva es cubierta al 100% por créditos (`amountToPay === 0`), `create-preference/route.ts` intenta confirmar la reserva con `createClient()`, detonando el trigger de `014_secure_bookings.sql` con `'Unauthorized: Cannot modify payment status'`.

---

## 5. Sección Exhaustiva: Regresiones y Nuevos Problemas Detectados

A continuación se catalogan con máximo detalle técnico, citas de código y archivos las **31 nuevas fallas y regresiones**:

---

### 5.1. Nuevas Regresiones de Seguridad (`NEW-SEC-01` a `NEW-SEC-07`)

#### 🚨 [NEW-SEC-01] CRITICAL: Anti-Patrón de Verificación de Service Role en Triggers (`auth.uid() IS NULL`)
- **Ubicación:** `supabase/migrations/013_secure_profiles.sql:6-9`, `014_secure_bookings.sql:6-9`, `017_reschedule_loophole.sql:8-11`
- **Código Vulnerable:**
  ```sql
  -- Allow bypassing if it's the service_role (auth.uid() is null in service role)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  ```
- **Riesgo Técnico:** En PostgreSQL bajo Supabase, `auth.uid()` evalúa a `NULL` no solo para llamadas con `service_role_key`, sino **también para todas las solicitudes anónimas sin autenticar (`anon_key`)**. Si una tabla tiene una política RLS permisiva o deshabilitada temporalmente, un atacante anónimo elude todos los triggers de protección.
- **Remediación:** Validar el claim JWT explícito: `IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN RETURN NEW; END IF;`.

#### 🚨 [NEW-SEC-02] HIGH: Falla Bloqueante en Reprogramación por Conflicto Trigger / Server Action
- **Ubicación:** `supabase/migrations/017_reschedule_loophole.sql:46-50` vs `src/lib/booking/actions.ts:59-100`
- **Mecánica:** El trigger bloquea cambios de fecha/hora para usuarios comunes, pero la Server Action `rescheduleBooking()` usa `createClient()`. Toda reprogramación legítima falla con error 500 de base de datos.

#### 🚨 [NEW-SEC-03] HIGH: Colapso del Flujo de Pago con Créditos al 100% y Violación RLS
- **Ubicación:** `src/lib/credits/manager.ts:99, 123-125`, `src/app/api/booking/create-preference/route.ts:51-55`
- **Mecánica:** `applyCredits()` usa `createClient()` y es rechazado por RLS (`015_close_phase_0.sql`). Al cubrir el 100% con crédito (`amountToPay === 0`), `create-preference` intenta confirmar la reserva con `createClient()`, detonando el trigger `014` (`'Unauthorized: Cannot modify payment status'`).

#### 🚨 [NEW-SEC-04] HIGH: Ocultación Involuntaria de Autores de Reseñas a Usuarios Anónimos
- **Ubicación:** `src/app/(main)/venue/[id]/page.tsx:67-78`
- **Mecánica:** La migración `015` restringió `SELECT` sobre `profiles` para proteger PII. `page.tsx` sigue haciendo un join directo a `profiles` en vez de usar `public_user_profiles`. Los visitantes anónimos reciben `profiles: null`, mostrando reseñas huérfanas sin autor.

#### ⚠️ [NEW-SEC-05] MEDIUM: Fallo Silencioso de Cancelación por Ausencia de Política RLS `DELETE`
- **Ubicación:** `src/app/api/bookings/cancel/route.ts:20-26`, `src/app/actions/booking.ts:12-16`
- **Mecánica:** La tabla `public.bookings` carece de política `FOR DELETE` en `002_rls_policies.sql`. Las llamadas `.delete()` con cliente de usuario fallan silenciosamente afectando 0 filas.

#### ⚠️ [NEW-SEC-06] MEDIUM: Capa de Validación Zod (`validators.ts`) 100% Desconectada
- **Ubicación:** `src/lib/utils/validators.ts:1-76`
- **Mecánica:** Se crearon 6 esquemas Zod completos, pero **ningún archivo de la aplicación los importa**. La aplicación continúa recibiendo datos sin validar en tiempo de ejecución.

#### ℹ️ [NEW-SEC-07] LOW: Ausencia de Control de Roles RBAC en `middleware.ts`
- **Ubicación:** `src/middleware.ts:38`
- **Mecánica:** `middleware.ts` solo comprueba `!user` para rutas `/admin` y `/dashboard`, permitiendo que usuarios con rol `player` alcancen los layouts antes de ser redirigidos.

---

### 5.2. Nuevas Regresiones de Arquitectura & Performance (`NEW-ARC-01` a `NEW-ARC-05`)

#### 🚨 [NEW-ARC-01] CRITICAL: Excepción PostgreSQL en Server Action `rescheduleBooking`
- **Ubicación:** `src/lib/booking/actions.ts:59-102` vs `017_reschedule_loophole.sql:46-50`
- **Diagnóstico:** Desincronización fatal entre el trigger SQL y la Server Action por uso de `createClient()`.

#### 🚨 [NEW-ARC-02] HIGH: Fallo en Reservas Gratuitas o Cubiertas por Crédito por Trigger Mismatch
- **Ubicación:** `src/app/api/booking/create-preference/route.ts:51-60` vs `014_secure_bookings.sql:27-30`
- **Diagnóstico:** Intento de mutar `payment_status: 'paid'` desde cliente de usuario en `create-preference`.

#### ⚠️ [NEW-ARC-03] MEDIUM: Fuga y Acumulación de Canales Realtime en Evento Typing de Chat
- **Ubicación:** `src/components/chat/player-chat-modal.tsx:150-170`, `src/components/dashboard/inbox/admin-chat-thread.tsx:128-148`
- **Diagnóstico:** En `handleTyping`, cada pulsación de tecla (`onChange`) ejecuta `supabase.channel(...)` creando una nueva suscripción en memoria en lugar de reutilizar el canal activo del `useEffect`.

#### ⚠️ [NEW-ARC-04] MEDIUM: Desacoplamiento de Capa de Consultas Tipadas (`queries.ts` Dead Code)
- **Ubicación:** `src/lib/supabase/queries.ts:1-101`
- **Diagnóstico:** Módulo con 8 funciones tipadas con 0 llamadas en todo el proyecto. Todo el código sigue usando queries inline con `@ts-expect-error`.

#### ⚠️ [NEW-ARC-05] HIGH: Exposición de Rutas Backdoor y Desarrollo en Routing Tree de Producción
- **Ubicación:** `src/app/upgrade/page.tsx:1-38`, `src/app/(main)/mock-payment/page.tsx:1-76`
- **Diagnóstico:** Rutas de bypass compiladas y accesibles públicamente en producción.

---

### 5.3. Nuevas Regresiones de Lógica de Negocio & Pagos (`NEW-BUS-01` a `NEW-BUS-07`)

#### 🚨 [NEW-BUS-01] CRITICAL: Deadlock de Checkout con Créditos
- **Ubicación:** `src/lib/credits/manager.ts:99-128`, `src/app/api/booking/create-preference/route.ts:52-54`
- **Impacto:** Ningún usuario puede canjear créditos para abonar reservas.

#### 🚨 [NEW-BUS-02] CRITICAL: Colapso Total de Reprogramación de Turnos
- **Ubicación:** `src/lib/booking/actions.ts:59-103`, `017_reschedule_loophole.sql:46-54`
- **Impacto:** Funcionalidad de reprogramación rota en el 100% de los intentos.

#### 🚨 [NEW-BUS-03] HIGH: Inoperabilidad del Entorno Mock Payments en Staging
- **Ubicación:** `src/app/(main)/mock-payment/page.tsx:21-31`
- **Impacto:** `approvePayment()` arroja error 500 por el trigger de la migración 014.

#### 🚨 [NEW-BUS-04] HIGH: Multiplicación del Tiempo de Bloqueo DoS de Canchas a 15 Minutos
- **Ubicación:** `supabase/migrations/016_extend_booking_cron.sql:1-12`, `src/app/(main)/booking/[courtId]/page.tsx:106-134`
- **Impacto:** Un atacante con peticiones GET bloquea los slots durante 15 minutos (antes 3 minutos).

#### ⚠️ [NEW-BUS-05] MEDIUM: Ruta Rota Hardcodeada en Flujo de Transferencia
- **Ubicación:** `src/components/booking/booking-wizard.tsx:85`
- **Impacto:** Redirige a `/booking/court-id/success` (string literal `court-id`), provocando error 404.

#### ⚠️ [NEW-BUS-06] MEDIUM: Cálculo Hardcodeado de 30% en Cancelaciones y Generación Arbitraria de Fondos
- **Ubicación:** `src/lib/credits/manager.ts:21-22`, `src/components/booking/cancel-dialog.tsx:36`
- **Impacto:** Hardcodea `total_price * 0.3`. Si el predio exigía 50%, reembolsa de menos; si exigía 20%, genera saldo de la nada.

#### ⚠️ [NEW-BUS-07] MEDIUM: Bypass de Lógica de Cancelación vía Server Action de Dashboard
- **Ubicación:** `src/app/dashboard/bookings/actions.ts:7-22`
- **Impacto:** `updateBookingStatus(..., 'cancelled')` permite cancelar sin evaluar política de 6h ni liquidar créditos.

---

### 5.4. Nuevas Regresiones de UX & Accesibilidad (`NEW-UX-01` a `NEW-UX-06`)

#### 🚨 [NEW-UX-01] HIGH: Inconsistencia Crítica de Branding ("El Potrero" vs "ReservaYa")
- **Ubicación:** `src/components/layout/header.tsx:55`, `src/components/layout/footer.tsx:13, 38`, `src/components/search/search-layout.tsx:80`
- **Evidencia:** `<span className="inline-block font-bold text-primary">El Potrero</span>`. Destruye la credibilidad del servicio.

#### 🚨 [NEW-UX-02] HIGH: Disparadores Anidados e Inaccesibles en Galería (`VenueGallery.tsx`)
- **Ubicación:** `src/components/venue/venue-gallery.tsx:39-40, 105-130`
- **Evidencia:** `<div className="absolute inset-0 cursor-pointer">` no focuseable por teclado + múltiples modales `<Dialog>` duplicados en el `.map()`.

#### ⚠️ [NEW-UX-03] MEDIUM: Textarea de Chat Admin sin Etiqueta ni `aria-label`
- **Ubicación:** `src/components/dashboard/inbox/admin-input-bar.tsx:37-54`
- **Evidencia:** `<Textarea>` y botón de envío sin `<label>`, `id`, ni `aria-label`.

#### ⚠️ [NEW-UX-04] MEDIUM: Botones de Conmutación Móvil ("Lista" / "Mapa") con Altura de 28px
- **Ubicación:** `src/components/search/search-layout.tsx:37-55`
- **Evidencia:** `size="sm" className="h-7 text-xs px-3"` (28px de alto), provocando toques erróneos frecuentes en mobile.

#### ⚠️ [NEW-UX-05] MEDIUM: Ausencia de Spinner de Carga en Acción Destructiva de Cancelación
- **Ubicación:** `src/components/booking/cancel-dialog.tsx:134-136`
- **Evidencia:** Cambia el texto a "Cancelando..." sin deshabilitar elementos ni mostrar `<Loader2 className="animate-spin" />`.

#### ⚠️ [NEW-UX-06] MEDIUM: Saturación y Colapso en Filtros Móviles de Búsqueda
- **Ubicación:** `src/components/search/search-filters.tsx:96-186`
- **Evidencia:** 4 controles inline que en 360-390px se envuelven ocupando el 40% de la altura útil de pantalla.

---

### 5.5. Nuevas Regresiones de Calidad de Código & TypeScript (`NEW-CQ-01` a `NEW-CQ-06`)

#### 🚨 [NEW-CQ-01] CRITICAL: Proliferación de 123 Directivas `@ts-expect-error` en 39 Archivos
- **Ubicación:** 39 archivos en `src/app/`, `src/components/`, `src/lib/`
- **Top Afectados:** `search/page.tsx` (16), `venue/[id]/page.tsx` (9), `dashboard/courts/page.tsx` (6), `webhooks/mercadopago/route.ts` (4).
- **Impacto:** Mutación de la evasión de tipos: silencia errores de compilación y anula la protección de TypeScript.

#### 🚨 [NEW-CQ-02] CRITICAL: Ruptura de Imports Case-Sensitive en Linux/CI
- **Ubicación:** `src/components/search/search-layout.tsx:5, 7`, `src/components/dashboard/inbox/inbox-client.tsx:6, 8`, `src/components/dashboard/venue/venue-forms.tsx:11`, `src/components/venue/availability-grid.tsx:10`
- **Código:** `import { SearchVenueItem, VenueList } from "./VenueList"` (en disco es `venue-list.tsx`).
- **Impacto:** Fallo fatal inmediato de build en Vercel y Linux CI (`Module not found`).

#### 🚨 [NEW-CQ-03] HIGH: Bug de Precedencia de Operadores JS en Manejo de Errores con `alert()`
- **Ubicación:** `src/components/dashboard/courts/court-form-modal.tsx:21`, `pricing-modal.tsx:21`, `manual-booking-modal.tsx:28`
- **Código:** `alert("Error: " + error instanceof Error ? error.message : "Desconocido")`
- **Diagnóstico:** Por precedencia de operadores (`+` antes que `instanceof` y `? :`), la expresión evalúa `("Error: " + error) instanceof Error` -> `false`, retornando **siempre `"Desconocido"`** y ocultando el error real.

#### 🚨 [NEW-CQ-04] HIGH: Módulos de Infraestructura Huérfanos y Código Muerto
- **Ubicación:** `src/lib/supabase/queries.ts` (101L, 0 imports), `src/lib/utils/validators.ts` (76L, 0 imports), `src/lib/utils/geo.ts` (43L, 0 imports).
- **Diagnóstico:** Código creado pero no conectado; la app sigue con consultas inline no tipadas.

#### ⚠️ [NEW-CQ-05] MEDIUM: Branding Obsoleto Codificado y Exigido en Pruebas Unitarias
- **Ubicación:** `src/lib/notifications/templates.test.ts:8, 13`
- **Código:** `expect(html).toContain("El Potrero 5")`.

#### 🚨 [NEW-CQ-06] HIGH: Evasión de Tipos con `as never` en Mutaciones de Supabase
- **Ubicación:** `src/app/actions/chat.ts:38, 102, 119, 121`, `src/lib/credits/manager.ts:124`
- **Código:** `await supabase.from('conversations').update({ unread_user_count: 0 } as never)...`

---

## 6. Matriz de Riesgo y Evaluación de Estado de Producción Actualizada

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MATRIZ DE RIESGO DE PRODUCCIÓN POST-AUDITORÍA DELTA                                                    │
├────────────────────┬───────────┬───────────────────────────────────────────────────────────────────────┤
│ Dimensión          │ Nivel     │ Impacto Operativo y Financiero Directo                                │
├────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────┤
│ Riesgo Financiero  │ CRÍTICO   │ Inyección de precio ($1 ARS), credit burn, pérdida en webhooks MP.    │
│ Riesgo Operativo   │ CRÍTICO   │ Deadlocks en reprogramación y créditos; DoS de 15 min en canchas.      │
│ Riesgo Seguridad   │ CRÍTICO   │ Bypass en triggers (auth.uid() IS NULL), rutas /upgrade y /mock.      │
│ Riesgo UX / Legal  │ CRÍTICO   │ No conforme WCAG 2.2 AA (2.29:1), touch targets <44px, branding roto. │
│ Riesgo CI / Deploy │ CRÍTICO   │ Imports case-sensitive rotos en Linux; 123 @ts-expect-error.         │
└────────────────────┴───────────┴───────────────────────────────────────────────────────────────────────┘
```

---

## 7. Plan de Acción y Hoja de Ruta de Remediación Definitiva

Para alcanzar el estado comercialmente operativo y seguro, el equipo de ingeniería debe ejecutar rigurosamente el siguiente plan de trabajo priorizado:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HOJA DE RUTA DE REMEDIACIÓN DEFINITIVA (4 FASES PRIORIZADAS)                                     │
├──────────────────────┬──────────────────────┬──────────────────────┬─────────────────────────────┤
│ FASE 0 (Inmediata)   │ FASE 1 (Días 1-2)    │ FASE 2 (Días 3-4)    │ FASE 3 (Días 5-6)           │
│ Desbloqueo Crítico y │ Seguridad, Pagos e   │ Robustez de Negocio, │ Accesibilidad WCAG 2.2 AA,  │
│ Hotfixes de Build    │ Integridad Transacc. │ Resiliencia y Arq.   │ UX y Tipado Estricto        │
└──────────────────────┴──────────────────────┴──────────────────────┴─────────────────────────────┘
```

---

### 🔴 Fase 0: Desbloqueo Crítico y Hotfixes Inmediatos (Día 1)
*Objetivo: Desbloquear los deadlocks que impiden operar el sistema y corregir errores bloqueantes de build.*

1. **Corrección del Trigger Mismatch en Server Actions:**
   - En `src/lib/booking/actions.ts` (`rescheduleBooking`), verificar la sesión con `createClient()` y ejecutar el `UPDATE` con `createAdminClient()`.
   - En `src/lib/credits/manager.ts` (`applyCredits`), usar `createAdminClient()` para actualizar la tabla `credits`.
   - En `src/app/api/booking/create-preference/route.ts`, cuando `amountToPay === 0`, actualizar la reserva con `createAdminClient()`.
2. **Corrección de Triggers SQL (`auth.uid() IS NULL`):**
   - Reemplazar en migraciones `013`, `014` y `017` la condición `IF auth.uid() IS NULL` por `IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN RETURN NEW; END IF;`.
3. **Eliminación Física de Rutas Backdoor:**
   - Eliminar `src/app/upgrade/page.tsx` y `src/app/(main)/mock-payment/page.tsx`.
4. **Reparación de Imports Case-Sensitive Rotos (CI Linux Fix):**
   - Normalizar los imports en `search-layout.tsx`, `inbox-client.tsx`, `venue-forms.tsx` y `availability-grid.tsx` usando `@/components/...` en `kebab-case`.
5. **Corrección del Defecto de Esquema `booking_status` -> `status`:**
   - En `src/components/dashboard/inbox/admin-chat-thread.tsx:55`: `.eq('status', 'confirmed')`.
   - En `src/components/dashboard/bookings/bookings-client.tsx:25, 178-185`: tipar y evaluar `booking.status`.
6. **Reparación de Reseñas para Usuarios Anónimos:**
   - En `src/app/(main)/venue/[id]/page.tsx:67-78`, consultar la vista `public_user_profiles` en lugar de `profiles`.

---

### 🟠 Fase 1: Seguridad, Integridad Transaccional y Pagos (Días 2-3)
*Objetivo: Blindar el ciclo de pagos y erradicar vulnerabilidades financieras.*

1. **Blindaje de Preferencias de Mercado Pago:**
   - En `src/app/api/booking/create-preference/route.ts`, eliminar el parámetro `price` del request; consultar `total_price` y `deposit_percentage` en BD con `createAdminClient()`.
2. **Reingeniería del Webhook de Mercado Pago:**
   - En `src/app/api/webhooks/mercadopago/route.ts`, cambiar `createClient()` por `createAdminClient()`.
   - Exigir obligatoriamente `x-signature` y `MP_WEBHOOK_SECRET` con `crypto.timingSafeEqual()`.
   - Implementar control de idempotencia con `mp_payment_id`.
3. **Eliminación de Mutación en HTTP GET:**
   - Eliminar el `INSERT` en `src/app/(main)/booking/[courtId]/page.tsx`.
   - Crear el hold temporal exclusivamente mediante Server Action POST al hacer clic en "Continuar".
4. **Eliminación de Beacon Destructivo:**
   - Eliminar el listener `beforeunload` en `booking-wizard.tsx` y el endpoint `/api/bookings/cancel`.
5. **Reingeniería del Gestor de Créditos:**
   - En `src/lib/credits/manager.ts`, implementar partición de saldos: ante uso parcial, actualizar el registro actual y crear una nueva fila con el crédito remanente.
   - No marcar créditos como `used` antes de pagar; consumirlos definitivamente en el Webhook de MP.

---

### 🟡 Fase 2: Robustez de Negocio, Resiliencia y Arquitectura (Días 4-5)
*Objetivo: Estabilizar la resiliencia en serverless, alinear zonas horarias y optimizar la base de datos.*

1. **Resiliencia de Notificaciones en Serverless:**
   - Eliminar `setTimeout(..., 0)` en `src/lib/notifications/index.ts` y hacer que `notify()` retorne una promesa esperable compatible con `waitUntil`.
2. **Normalización de Timezones (America/Argentina/Buenos_Aires):**
   - Importar y aplicar `hoursUntilBooking()` de `src/lib/utils/dates.ts` en `manager.ts`, `cancel-dialog.tsx` y `dashboard/page.tsx`.
3. **Cierre de Brechas de Arbitraje y Bucle de Cancelación:**
   - En `rescheduleBooking()`, asignar `is_rescheduled = true`, validar tarifas de nuevo horario y cobrar diferencial.
   - En `calculateCancellationPolicy()`, si `is_rescheduled === true`, retener la seña (`forfeit`).
4. **Optimización de Consultas y Paginación:**
   - Crear función RPC `get_court_availability(court_id, date)` para no exponer `bookings` a clientes anónimos.
   - Implementar `.range()` y `.limit()` en `/search` y paneles de administración.
5. **Creación de Boundaries de App Router:**
   - Crear `loading.tsx` con skeletons shimmer, `error.tsx` con recuperación y `not-found.tsx` en `src/app/`.

---

### 🔵 Fase 3: Accesibilidad WCAG 2.2 AA, UX Móvil y Tipado Estricto (Días 6-7)
*Objetivo: Cumplir estándares legales de accesibilidad, ergonomía táctil y erradicar la deuda técnica.*

1. **Conformidad WCAG 2.2 AA y Tokens de Color:**
   - Corregir tokens de color en `globals.css`: verde accesible con contraste >= 4.5:1 en Light Mode.
   - Reparar tokens OKLCH en popups de Leaflet (`venue-map-client.tsx`).
   - Normalizar touch targets en `button.tsx` y controles a `min-h-[44px]` en mobile.
   - Reemplazar los 14 diálogos `alert()` restantes por `toast()`, corrigiendo el bug de precedencia de operadores.
   - Asociar todos los `<label htmlFor="...">` con sus campos y eliminar los 18 `eslint-disable jsx-a11y`.
   - Agregar `aria-label` descriptivos en todos los botones de iconos y Skip Link en `layout.tsx`.
   - Activar `cooperativeGestureHandling` en mapas Leaflet para evitar trampas de scroll táctil.
2. **Unificación de Marca y Funnel CRO:**
   - Reemplazar todas las menciones residuales de "El Potrero" por "ReservaYa" en Header, Footer, SearchLayout, package.json y templates.
   - Unificar `BookingWizard.tsx` en 1 solo paso CRO sin duplicación.
   - Implementar `StickyBookingBar.tsx` en `/venue/[id]`.
3. **Tipado Estricto y Conexión de Capa de Consultas:**
   - Conectar `src/lib/supabase/queries.ts` en todas las páginas y componentes, erradicando las 123 directivas `@ts-expect-error` y casts `as never` / `as unknown as`.
   - Conectar los esquemas de `src/lib/utils/validators.ts` en Server Actions y API Routes.
   - Modularizar los 20 componentes monolíticos que superan las 150 líneas.
4. **Infraestructura Completa de Pruebas:**
   - Desarrollar pruebas de integración en `test/integration/` y pruebas de componentes con `@testing-library/react`.

---

## 8. Quality Gates de Certificación Pre-Lanzamiento

| Quality Gate / Criterio | Comando de Validación | Condición de Pase Obligatoria |
| :--- | :--- | :--- |
| **1. Tipado TypeScript Estricto** | `npm run type-check` | **0 errores.** 0 `@ts-expect-error`, 0 `as any`, 0 `as never`. |
| **2. Higiene de Linter** | `npm run lint` | **0 errores y 0 warnings.** 0 directivas `eslint-disable`. |
| **3. Cobertura de Pruebas** | `npm run test` | **100% pruebas aprobadas** (unitarias, integración y reglas de negocio). |
| **4. Compilación de Producción** | `npm run build` | **Build exitoso** sin fallos de import ni rutas rotas. |
| **5. Bloqueo de Bypass de Pagos** | POST a `/api/booking/create-preference` con `price: 1` | El servidor cotiza la seña real de la base de datos. |
| **6. Operatividad de Reprogramación** | Ejecución de `rescheduleBooking()` | Actualización exitosa sin excepciones de trigger SQL. |
| **7. Operatividad de Créditos** | Ejecución de `applyCredits()` | Descuento correcto y persistencia del saldo remanente. |
| **8. Accesibilidad WCAG 2.2 AA** | Auditoría Axe-core / Lighthouse | **Score >= 95.** Contraste >= 4.5:1 y touch targets >= 44px. |

---

## 9. Veredicto Final y Conclusión del Comité

El análisis delta demuestra de manera incontestable que **los intentos aislados de blindaje a nivel de base de datos sin una reingeniería coordinada en la capa de aplicación resultaron contraproducentes**, introduciendo 31 nuevas regresiones críticas y paralizando los flujos de reprogramación y pagos con crédito.

La ejecución metódica de la **Hoja de Ruta de Remediación Definitiva (Fases 0 a 3)** es el único camino viable para transformar a ReservaYa en una plataforma comercialmente sólida, invulnerable al fraude, legalmente accesible y altamente rentable.

---
*Informe Maestro de Auditoría Delta finalizado, reconciliado y certificado por el Master Delta Report Author & Synthesis Specialist para ReservaYa.*
