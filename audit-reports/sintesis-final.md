# 🏆 INFORME MAESTRO DE AUDITORÍA CONSOLIDADA: RESERVAYA (CANCHAPP)
**Documento:** Reporte Final de Síntesis y Reconciliación Transversal  
**Ruta del Archivo:** `audit-reports/sintesis-final.md`  
**Fecha de Publicación:** 29 de Agosto de 2026  
**Autor Líder:** Lead Auditor & Synthesis Specialist  
**Comité de Auditoría:**
1. Experto en Seguridad (Security Specialist) — *OWASP ASVS L2 / API Top 10*
2. Pesimista de Arquitectura (Architecture & Performance Specialist) — *Next.js 14 / Resiliencia Serverless*
3. Abogado del Diablo de Negocios (Business Logic Specialist) — *Integridad Transaccional / Modelos Financieros*
4. Defensor del Usuario (UX/UI & Accessibility Specialist) — *WCAG 2.2 AA / Mobile-First / CRO*
5. Purista de Código (Code Quality & Standards Specialist) — *Strict TypeScript / Clean Architecture*

---

## 1. Resumen Ejecutivo y Veredicto Final

Tras una auditoría integral, destructiva y coordinada sobre el 100% de la base de código de **ReservaYa** (abarcando esquemas y migraciones SQL en `supabase/migrations/`, funciones Edge en `supabase/functions/`, APIs y Server Actions en `src/app/`, librerías de infraestructura en `src/lib/`, componentes de interfaz en `src/components/`, hooks en `src/hooks/` y configuraciones en `next.config.mjs` y `tsconfig.json`), el Comité de Auditoría emite un veredicto terminante:

### 🚨 Veredicto del Comité: **RECHAZADO — NO APTO PARA SALIDA A PRODUCCIÓN (BLOQUEO CRÍTICO)**

La plataforma exhibe un diseño visual atractivo y una selección tecnológica moderna (Next.js 14 App Router, Supabase, Tailwind CSS, Mercado Pago), pero **adolece de fallas sistémicas críticas, vulnerabilidades de fraude financiero directo, brechas graves de autorización (RLS/RBAC), condiciones de carrera destructivas en el ciclo de vida de los pagos, violaciones severas de accesibilidad legal (WCAG 2.2 AA) y una degradación acelerada de la base de código sostenida en la evasión masiva del sistema de tipos de TypeScript (`as any`)**.

### Puntos Críticos de Impacto Inmediato:
1. **Fuga Financiera Directa y Reservas Gratuitas:** Los clientes pueden modificar el precio de la seña en el payload JSON hacia `/api/booking/create-preference` (ej. pagar $1 ARS por un turno de $30.000 ARS) o confirmar reservas arbitrariamente mediante `/mock-payment` y la política RLS permisiva en `public.bookings`.
2. **Pérdida Catastrófica de Reservas Pagadas ("La Tormenta Perfecta"):** En producción, el Webhook de Mercado Pago opera con cliente anónimo (`anon`) sin permisos RLS para actualizar reservas. Simultáneamente, el evento `beforeunload` en el cliente cancela reservas durante la redirección a Mercado Pago y el cron de `pg_cron` purga reservas pendientes cada 3 minutos, destruyendo los turnos de usuarios que abonaron legítimamente.
3. **Escalación Total a Administrador de Plataforma (`platform_admin`):** La política RLS en `profiles` carece de restricción de columnas, y la ruta pública `/upgrade` permite que cualquier usuario registrado se auto-convierta en administrador global con un solo clic.
4. **Destrucción de Saldos de Usuarios ("Credit Burn") y Elusión de Penalizaciones:** El gestor de créditos confisca el saldo remanente no utilizado en aplicaciones parciales. Además, un usuario puede reprogramar un turno a 3 horas del partido y luego cancelarlo, eludiendo la penalización de retención de seña (<6h) y obteniendo créditos indebidos.
5. **Colapso de Notificaciones en Serverless:** El despachador de emails y WhatsApp utiliza `setTimeout(..., 0)` desasistido, provocando la pérdida sistemática de confirmaciones por el congelamiento del runtime de Vercel/Lambda.
6. **Inoperabilidad en Producción por Desincronización de Esquema (`booking_status` vs `status`):** Debido al uso masivo de `as any`, la base de código ignoró el renombrado de la columna `booking_status` a `status`, provocando que todas las reservas en el panel de administración se muestren falsamente como 'No Show' y rompiendo el chat y las políticas RLS de reseñas.
7. **Incumplimiento Normativo WCAG 2.2 AA y Ergonomía Móvil Rota:** Ratios de contraste deficientes (2.29:1 frente al 4.5:1 exigido) en botones y títulos verdes sobre blanco, touch targets de 24-32px inferiores al mínimo de 44px, trampas gestuales en mapas Leaflet y 86+ supresiones de linter de accesibilidad.

---

## 2. Scorecard Global y Métricas Clave

### 2.1 Tabla de Madurez por Dimensión Evaluada

| Dimensión de Auditoría | Puntaje (0-100) | Nivel de Riesgo | Críticos | Altos | Medios | Bajos/Info | Estado |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Seguridad, Auth y Secretos** | **28 / 100** | 🔴 CRÍTICO | 6 | 5 | 4 | 3 | Bloqueo Inmediato |
| **2. Arquitectura, Concurrencia y Resiliencia** | **35 / 100** | 🔴 CRÍTICO | 6 | 5 | 4 | 0 | Inestable en Prod |
| **3. Lógica de Negocio e Integridad Financiera** | **30 / 100** | 🔴 CRÍTICO | 5 | 4 | 5 | 2 | Fuga de Fondos |
| **4. UX, Accesibilidad (WCAG 2.2 AA) y Mobile** | **46.6 / 100** | 🔴 NO CONFORME | 14 | 11 | 7 | 0 | Ilegal / Fricción |
| **5. Calidad de Código, Tipado y Estándares** | **35 / 100** | 🔴 DEUDA SEVERA | 5 | 4 | 4 | 2 | Falsedad de Tipos |
| **CONSOLIDADO PONDERADO** | **33.7 / 100** | 🚨 **CRÍTICO** | **36** | **29** | **22** | **7** | **RECHAZADO** |

```
PONDERACIÓN GLOBAL DE SALUD DEL PROYECTO: 33.7 / 100
[██████████░░░░░░░░░░░░░░░░░░░░] 33.7%
ESTADO: RECHAZADO PARA PRODUCCIÓN (Requiere remediación Fases 0 a 3)
```

### 2.2 Métricas Cuantitativas Relevantes
- **Total de Archivos TypeScript Auditados:** 116 archivos (`.ts` / `.tsx`).
- **Instancias de Evasión de Tipos `(supabase.from(...) as any)`:** 66 ocurrencias en 30 archivos.
- **Directivas `/* eslint-disable */` Detectadas:** 86 supresiones de reglas críticas.
- **Componentes que Superan el Límite de 150 Líneas:** 20 archivos (hasta 361 líneas en `PlayerChatModal.tsx`).
- **Archivos que Incumplen Convención `kebab-case.tsx`:** 35+ componentes en `src/components/`.
- **Cobertura de Pruebas Automatizadas (Unit / Integration):** **0.0%** (0 suites de prueba).
- **Llamadas Bloqueantes `alert()` en Flujos Principales:** 18+ invocaciones nativas.

---

## 3. Matriz Unificada de Vulnerabilidades Críticas y Altas

A continuación se consolida la totalidad de los hallazgos de Severidad **CRÍTICA** y **ALTA** identificados a lo largo de las 5 auditorías especializadas, ordenados por vector de impacto y trazabilidad de archivo/línea:

| ID Unificado | Dimensión | Severidad | Archivo y Líneas Afectadas | Impacto y Vector de Amenaza |
| :--- | :--- | :---: | :--- | :--- |
| **UNI-SEC-01** | Seguridad | **CRITICAL** | `supabase/migrations/002_rls_policies.sql:25-26`<br>`src/app/upgrade/page.tsx:16-20` | **Escalación Total a Admin:** RLS en `profiles` sin restricción de columnas + ruta `/upgrade` permiten auto-otorgarse rol `platform_admin`. |
| **UNI-SEC-02** | Seguridad / Negocio | **CRITICAL** | `src/app/(main)/mock-payment/page.tsx:22-31`<br>`supabase/migrations/002_rls_policies.sql:80-88` | **Bypass Total de Pago:** Server Action pública de test y RLS permisivo en `bookings` permiten a un jugador marcar su reserva como `paid`. |
| **UNI-SEC-03** | Seguridad / Arq | **CRITICAL** | `src/app/api/webhooks/mercadopago/route.ts:24-29, 48-63` | **Fallo y Bypass en Webhook MP:** Omisión de verificación HMAC si no hay secret + uso de cliente `anon` sin auth que falla bajo RLS. |
| **UNI-SEC-04** | Seguridad / Negocio | **CRITICAL** | `src/app/api/booking/create-preference/route.ts:15, 38` | **Inyección de Precio por Cliente:** Servidor confía en `price` del JSON. Se puede pagar $1 ARS por reservas de $30.000 ARS o $0 con seña omitida. |
| **UNI-SEC-05** | Seguridad / Finanzas | **CRITICAL** | `supabase/migrations/002_rls_policies.sql:112-113` | **Manipulación Arbitraria de Créditos:** RLS permite `UPDATE` a usuarios sobre sus créditos, posibilitando inflar saldo a millones de pesos. |
| **UNI-SEC-06** | Seguridad / PII | **CRITICAL** | `supabase/migrations/002_rls_policies.sql:22-23` | **Exposición Pública de PII:** `USING (true)` en `profiles` expone emails, teléfonos, roles y saldos de todos los usuarios a clientes anónimos. |
| **UNI-ARC-01** | Arquitectura / Concurrencia | **CRITICAL** | `src/app/(main)/booking/[courtId]/page.tsx:105-130` | **Efecto Secundario en HTTP GET:** Renderizado de página ejecuta `INSERT` en `bookings`, bloqueando turnos por simple navegación o prefetching. |
| **UNI-ARC-02** | Arquitectura / Pagos | **CRITICAL** | `src/components/booking/BookingWizard.tsx:32-42` | **Cancelación Destructiva en Redirección MP:** `beforeunload` dispara beacon a `/api/bookings/cancel` borrando la reserva mientras el usuario paga. |
| **UNI-ARC-03** | Arquitectura / DB | **CRITICAL** | `supabase/migrations/012_abandoned_bookings_cron.sql:8-13` | **Purga Letal de Reservas a los 3 Minutos:** `pg_cron` elimina reservas pendientes a los 180s. Si el usuario tarda 3.5 min en MP, pierde su turno. |
| **UNI-ARC-04** | Arquitectura / Serverless | **CRITICAL** | `src/lib/notifications/index.ts:20-50` | **Pérdida de Notificaciones en Serverless:** `setTimeout(..., 0)` se congela al responder la función en Vercel/Lambda, perdiendo emails y WhatsApps. |
| **UNI-NEG-01** | Lógica de Negocio | **CRITICAL** | `src/lib/credits/manager.ts:121-128` | **Destrucción de Saldo de Créditos ("Credit Burn"):** Uso parcial de créditos quema el 100% del cupón sin emitir saldo remanente (confiscación). |
| **UNI-NEG-02** | Lógica de Negocio | **CRITICAL** | `src/lib/booking/actions.ts:6-53, 55-98`<br>`src/lib/credits/manager.ts:41-51` | **Loophole de Reprogramación y Cancelación (<6h):** Usuario reprograma a fecha futura (>2h) y cancela de inmediato, eludiendo la retención de seña. |
| **UNI-COD-01** | Calidad / Tipado | **CRITICAL** | `src/components/dashboard/inbox/AdminChatThread.tsx:59`<br>`src/components/dashboard/bookings/BookingsClient.tsx:23, 176` | **Desincronización de Esquema `booking_status`:** Columna renombrada a `status` en DB pero referenciada como `booking_status`. Todo sale 'No Show'. |
| **UNI-COD-02** | Calidad / Tipado | **CRITICAL** | 30 archivos en `src/` (66 instancias) | **Evasión Masiva de Tipos `(supabase.from(...) as any)`:** Falso tipado estricto que oculta regresiones y errores de esquema en tiempo de ejecución. |
| **UNI-UX-01** | Accesibilidad / WCAG | **CRITICAL** | `src/app/(main)/mock-payment/page.tsx:58`<br>`src/app/(main)/booking/[courtId]/success/page.tsx:62` | **Contraste Ilegal (2.29:1 vs 4.5:1):** Texto blanco sobre verde `green-500` y títulos verdes sobre fondo claro violan WCAG 1.4.3 Nivel AA. |
| **UNI-UX-02** | Accesibilidad / Linters | **CRITICAL** | 8 archivos en `src/components/` | **Supresión Masiva de Linters de Accesibilidad:** `/* eslint-disable jsx-a11y/* */` oculta inputs huérfanos sin `<label htmlFor>` ni controles semánticos. |
| **UNI-UX-03** | Ergonomía Móvil | **CRITICAL** | `src/components/ui/button.tsx:24-35` | **Touch Targets Deficientes (<44px):** Variantes de botón por defecto con 32px y 24px de alto, provocando fallas táctiles en smartphones. |
| **UNI-UX-04** | Usabilidad / Formularios | **CRITICAL** | 18+ llamadas en `BookingWizard`, `CancelDialog`, `VenueForms` | **Uso Generalizado de `alert()` Nativo:** Cuadros de diálogo bloqueantes que degradan la UX, congelan hilos y no informan causas reales de error. |
| **UNI-SEC-07** | Seguridad / Inyección | **HIGH** | `src/lib/notifications/templates.ts:3-166`<br>`src/app/actions/chat.ts:62-71` | **Inyección HTML y Phishing en Emails:** Interpolación sin sanitizar en plantillas de correo de Resend permite ataques dirigidos. |
| **UNI-SEC-08** | Seguridad / Storage | **HIGH** | `supabase/migrations/010_chat_attachments_and_storage.sql:18-20, 31-33` | **Bucket `chat-images` Público y Upload Irrestricto:** Adjuntos privados expuestos a internet y subida no validada a `venue-photos`. |
| **UNI-SEC-09** | Seguridad / Inyección | **HIGH** | `src/app/(main)/search/page.tsx:55` | **Inyección PostgREST en Buscador:** Parámetro `q` interpolado en `.or()` permite inyectar sintaxis de filtrado y alterar consultas. |
| **UNI-SEC-10** | Seguridad / RBAC | **HIGH** | `src/app/dashboard/bookings/actions.ts:8-40` | **Falla de Autorización en Server Actions:** Acciones de dashboard no comprueban que el usuario sea el dueño del complejo (`owner_id`). |
| **UNI-SEC-11** | Seguridad / Serverless | **HIGH** | `supabase/functions/expire-credits/index.ts`<br>`supabase/functions/send-reminder/index.ts` | **Edge Functions Públicas sin Auth:** Endpoints serverless invocables por cualquier tercero sin token de autorización Bearer. |
| **UNI-ARC-07** | Arquitectura / Next.js | **HIGH** | Todo el árbol `src/app/**` | **Ausencia Total de Boundaries:** 0 archivos `loading.tsx`, `error.tsx` o `not-found.tsx` en todo el proyecto; fallos 500 no capturados. |
| **UNI-ARC-08** | Arquitectura / Perf | **HIGH** | `src/app/(main)/venue/[id]/page.tsx:21-68` | **Waterfalls de Red N+1:** 4 consultas secuenciales a Supabase por cada visualización de complejo agregando >320ms de latencia ociosa. |
| **UNI-ARC-09** | Arquitectura / DB | **HIGH** | `src/app/(main)/search/page.tsx:26-96`<br>`src/app/dashboard/bookings/page.tsx:22-26` | **Consultas Masivas sin Paginación y Filtros en Memoria JS:** Descarga de tablas enteras para filtrar con arrays de JavaScript en Serverless. |
| **UNI-ARC-10** | Arquitectura / Bundles | **HIGH** | `src/components/home/Hero3D.tsx:27-40`<br>`src/components/map/VenueMapClient.tsx:14-40` | **Bloat de Bundles y Fugas Web Vitals:** Múltiples librerías 3D Spline cargadas, timers de carga artificiales e íconos Leaflet hotlinkeados. |
| **UNI-ARC-11** | Arquitectura / Cache | **HIGH** | `src/app/dashboard/courts/actions.ts:43, 94`<br>`src/app/dashboard/venue/actions.ts:66` | **Invalidación Defectuosa de Cache:** Mutaciones en panel no invalidan `/venue/[id]` ni tags de cache, mostrando precios viejos por 1 hora. |
| **UNI-NEG-04** | Lógica de Negocio | **HIGH** | `src/lib/booking/actions.ts:88-93` | **Arbitraje Tarifario en Reprogramaciones:** Cambio de turno valle ($8.000) a horario prime ($25.000) no liquida la diferencia de tarifa. |
| **UNI-NEG-05** | Negocio / Timezones | **HIGH** | `src/lib/credits/manager.ts:6-8`<br>`src/app/(main)/bookings/page.tsx:42-50` | **Desincronización de Timezones (UTC vs ART UTC-3):** Diferencia horaria desvirtúa ventanas de cancelación de 6h y marca turnos como pasados. |
| **UNI-NEG-06** | Lógica de Negocio | **HIGH** | `src/app/api/booking/create-preference/route.ts:41-46` | **Consumo Prematuro de Créditos:** Créditos marcados como `used` antes de que el usuario pague en MP; si abandona, pierde su saldo. |
| **UNI-NEG-08** | Negocio / Disponibilidad | **HIGH** | `src/app/(main)/booking/[courtId]/page.tsx:103-130` | **Ataque DoS de Bloqueo de Canchas:** Script de peticiones GET bloquea todas las canchas de la ciudad sin costo financiero. |
| **UNI-NEG-09** | Lógica de Negocio | **HIGH** | `src/components/booking/BookingWizard.tsx:81-85`<br>`src/app/(main)/booking/[courtId]/success/page.tsx` | **Falsa Confirmación por Transferencia:** Pantalla de éxito promete reserva confirmada pero la BD la borra a los 3 minutos (Phantom Booking). |
| **UNI-COD-06** | Calidad / Estructura | **HIGH** | 20 archivos en `src/components/` y `src/app/` | **Componentes Monolíticos (>150 líneas):** Componentes de hasta 361 líneas mezclando UI, realtime, storage y lógica de negocio. |
| **UNI-COD-07** | Calidad / Convenciones | **HIGH** | 35+ componentes en `src/components/` | **Violación de Nombres `kebab-case.tsx`:** Uso generalizado de `PascalCase.tsx` violando las normas de convención del proyecto. |
| **UNI-COD-08** | Calidad / Testing | **HIGH** | `package.json` | **Ausencia Total de Infraestructura de Tests:** Cero pruebas automatizadas, scripts ausentes en `package.json` y cero cobertura. |
| **UNI-UX-15** | UX / CRO | **HIGH** | `src/components/booking/BookingWizard.tsx:150-245` | **Fricción Innecesaria en Funnel (2 Pasos Redundantes):** División artificial de resumen y pago que añade clics y abandono en checkout. |
| **UNI-UX-16** | UX / Mobile | **HIGH** | `src/app/(main)/venue/[id]/page.tsx` | **Ausencia de Sticky Booking CTA Bar en Mobile:** Usuario debe hacer scroll excesivo en celulares para encontrar el calendario. |
| **UNI-UX-19** | UX / Interacción | **HIGH** | `src/components/booking/RescheduleDialog.tsx:59-62` | **Callejón sin Salida en Reprogramación:** Modal muestra mensaje de "función en desarrollo" obligando a cancelar con pérdida de seña. |

---

## 4. Análisis Profundo de Vulnerabilidades Sistémicas y Transversales

Las fallas más peligrosas de ReservaYa no residen de forma aislada en un archivo, sino en la **intersección disfuncional de múltiples capas**: base de datos, políticas de seguridad RLS, runtime serverless, pasarelas de pago y estado del cliente en React. A continuación se desglosan los 5 escenarios sistémicos más críticos:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MAPA DE FALLAS SISTÉMICAS Y TRANSVERSALES                                                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. La "Tormenta Perfecta" de Mercado Pago (Webhook Anon + RLS + BeforeUnload Beacon + Cron 3 Minutos)   │
│ 2. Inyección y Manipulación de Precios en Preferencias de Pago con Bypass de Seña                        │
│ 3. Desincronización de Esquema (`booking_status` vs `status`) que rompe Dashboard, Chat y Reseñas       │
│ 4. Destrucción de Saldos de Crédito ("Credit Burn") y Vulnerabilidades de Arbitraje Tarifario            │
│ 5. Mutaciones con Efectos Secundarios en HTTP GET y Ataques DoS de Bloqueo de Canchas                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.1. Falla Sistémica 1: La "Tormenta Perfecta" en el Flujo de Pagos de Mercado Pago

Este fallo representa el colapso absoluto del modelo transaccional de la plataforma, donde confluyen cuatro errores independientes:

```
[ Usuario Navega a /booking/court-123 ]
       │ (HTTP GET)
       ▼
[ 1. Server Component: booking/[courtId]/page.tsx ] ──► (INSERT INTO bookings status: 'pending')
       │
       ▼ [ Renderiza BookingWizard.tsx ]
       │
       ▼ [ Usuario pulsa "Ir a Pagar" ] ──► Redirige a window.location.href = initPoint
       │
       ├───────────────────────────────────────────────┐
       │ (Navegación externa a Mercado Pago)           │ (Disparo de evento)
       ▼                                               ▼
[ 2. Checkout en Mercado Pago ]             [ 3. beforeunload -> sendBeacon('/api/bookings/cancel') ]
       │                                               │
       │ (Usuario completa 16 dígitos + 2FA: 3.5 min)  ▼
       │                                    [ DELETE FROM bookings (Reserva Borrada de DB) ]
       ▼                                               │
[ 4. MP Aprueba Transacción ]                          │
       │                                               ▼
       ▼                                    [ 5. pg_cron purga pending > 3 minutos ]
[ 6. Webhook MP -> /api/webhooks/mercadopago ]         │
       │                                               ▼
       ▼ (Usa createClient() anon -> auth.uid() es NULL)
[ 7. UPDATE bookings WHERE id = bookingId ] ──► 💥 FALLA POR RLS (0 filas afectadas o fila ya eliminada)
       │
       ▼
💥 RESULTADO CATASTRÓFICO: Usuario cobrado en tarjeta, reserva destruida, cancha libre para reventa.
```

#### Anatomía del Colapso:
1. **Borrado Prematuro en Redirección (`BookingWizard.tsx:32-42`):** Al navegar hacia la pasarela de Mercado Pago, el evento `beforeunload` dispara `navigator.sendBeacon('/api/bookings/cancel')`, eliminando de inmediato la reserva de la base de datos.
2. **Purga Automática por Cron (`012_abandoned_bookings_cron.sql:8-13`):** Si el usuario sobrevive al `beforeunload` pero tarda más de 180 segundos en validar su tarjeta o completar el 2FA bancario, el cron en PostgreSQL ejecuta un `DELETE` físico.
3. **Falla Silenciosa de RLS en Webhook (`webhooks/mercadopago/route.ts:48-56`):** Cuando Mercado Pago despacha el webhook de confirmación, la petición no posee cookies de usuario (`auth.uid() = NULL`). Como el código utiliza `createClient()` (cliente anónimo) en lugar de `createAdminClient()` (`service_role`), las políticas RLS en `002_rls_policies.sql:80-88` rechazan el `UPDATE`, impidiendo que la reserva pase a `confirmed` y `paid`.
4. **Impacto:** Pérdida financiera directa para el cliente, inconsistencia contable en el predio y generación de turnos fantasmas.

---

### 4.2. Falla Sistémica 2: Inyección de Precios en Preferencias y Bypass de Seña

Una brecha de validación cliente-servidor que permite a cualquier usuario adquirir reservas por centavos o eludir completamente la pasarela de pagos.

#### Cadena de Explotación:
1. En `src/components/booking/BookingWizard.tsx:62-67`, el cliente envía al backend un JSON con `{ price: booking.price, bookingId, courtId }`.
2. En `src/app/api/booking/create-preference/route.ts:14-38`, el servidor toma `const { price } = body` **sin contrastarlo contra las reglas de precios (`pricing_rules`) ni contra la reserva en la base de datos**.
3. Un usuario intercepta el request y envía `price: 1`.
4. El backend calcula `depositAmount = Math.ceil((1 * 30) / 100) = 1` ARS.
5. Mercado Pago genera un link de pago por $1 ARS. Al pagarlo, el webhook confirma el turno completo de $30.000 ARS.
6. **Bypass a $0:** Si el atacante envía `price: 0`, el backend evalúa `if (amountToPay === 0)` y ejecuta de inmediato `UPDATE bookings SET status = 'confirmed', payment_status = 'paid'`, confirmando el turno de forma instantánea sin pasar por Mercado Pago ni debitar créditos reales.

---

### 4.3. Falla Sistémica 3: Desincronización de Esquema (`booking_status` vs `status`)

Este defecto evidencia el riesgo fatal de silenciar el tipado con `as any` en toda la aplicación.

#### Mecánica del Error:
1. En la migración SQL `004_fix_schema_inconsistencies.sql:2`, la columna `booking_status` de la tabla `bookings` fue renombrada a `status`.
2. Como se utilizaron aserciones `(supabase.from(...) as any)` en lugar de tipos generados, TypeScript no detectó las referencias obsoletas.
3. **Colapso en Dashboard (`BookingsClient.tsx:23, 176-182`):** El componente evalúa `booking.booking_status`. Como la columna en DB es `status`, el valor devuelto es `undefined`. La evaluación por defecto cae en la última cláusula del ternario, provocando que **el 100% de las reservas de la plataforma se muestren falsamente como 'No Show'** en la interfaz del dueño de cancha.
4. **Colapso en Chat de Admin (`AdminChatThread.tsx:59`):** El componente consulta `.from('bookings').select(...).eq('booking_status', 'confirmed')`. PostgreSQL aborta la consulta arrojando `error: column "booking_status" does not exist`, rompiendo la bandeja de entrada del administrador.
5. **Colapso en Reseñas (`002_rls_policies.sql:99`):** La política RLS de reseñas evalúa `WHERE b.booking_status = 'completed'`, bloqueando la publicación de todas las reseñas legítimas con error de base de datos.

---

### 4.4. Falla Sistémica 4: Destrucción de Saldos de Crédito y Evasión de Retenciones

La implementación actual viola los derechos del consumidor y anula la protección de seña a los complejos deportivos.

#### Mecánica de los Defectos:
1. **Destrucción de Saldos Remanentes ("Credit Burn" en `src/lib/credits/manager.ts:121-128`):**
   - Un usuario con un crédito legítimo de $10.000 ARS reserva una cancha con seña de $3.000 ARS.
   - El sistema aplica los $3.000 ARS y **marca el registro completo de crédito de $10.000 como `status = 'used'`**.
   - Los $7.000 ARS restantes son confiscados y destruidos de manera irreversible.
2. **Consumo Prematuro e Irreversible (`create-preference/route.ts:41-46`):**
   - El sistema ejecuta `applyCredits()` en el momento de crear la preferencia de pago. Si el usuario cierra la ventana de Mercado Pago o su tarjeta es rechazada, sus créditos quedan marcados como `used` en una reserva que luego el cron borra.
3. **Loophole de Reprogramación y Cancelación Tardía (<6h):**
   - Regla de Negocio: Cancelar con <6h confisca la seña ($0 crédito). Reprogramar con >=2h es gratuito.
   - Un usuario a 3 horas del partido no puede cancelar con crédito. Ejecuta `rescheduleBooking()` para mover el partido a 30 días en el futuro (cumple >=2h).
   - Inmediatamente ejecuta `cancelBooking()` sobre el nuevo horario (cumple >6h holgadamente) y **obtiene el 100% de la seña en créditos de plataforma**, dejando la cancha vacía a 3 horas del partido sin compensación para el predio.

---

### 4.5. Falla Sistémica 5: Mutaciones Destructivas en HTTP GET y Ataques DoS

La violación de los estándares de arquitectura web expone a la plataforma a una parálisis operativa total.

#### Mecánica del DoS:
1. En Next.js App Router, `src/app/(main)/booking/[courtId]/page.tsx` es un Server Component que responde a peticiones `GET /booking/[courtId]?date=...&time=...`.
2. En las líneas 105-116, el componente ejecuta un `INSERT INTO bookings (status: 'pending')`.
3. En `src/components/venue/AvailabilityGrid.tsx`, la consulta considera ocupado cualquier slot donde `status != 'cancelled'`.
4. Cualquier bot, crawler de búsqueda o atacante con un script `curl` ejecutando peticiones GET automáticas en bucle puede **bloquear todas las canchas de todos los complejos de la ciudad en 5 segundos**, sin abonar seña y sin iniciar pagos reales.

---

## 5. Plan Maestro de Remediación Priorizado (Roadmap de 4 Fases)

Para subsanar de forma definitiva todos los hallazgos y preparar la plataforma para una salida a producción exitosa y robusta, se define el siguiente plan de trabajo estructurado en 4 fases secuenciales:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ROADMAP MAESTRO DE REMEDIACIÓN (4 FASES SECUENCIALES)                                            │
├──────────────────────┬──────────────────────┬──────────────────────┬─────────────────────────────┤
│ FASE 0 (Días 1-2)    │ FASE 1 (Días 3-4)    │ FASE 2 (Días 5-6)    │ FASE 3 (Días 7-8)           │
│ Bloqueantes de Seg.  │ Integridad y Pagos   │ WCAG 2.2 AA y UX     │ Tipado Estricto & Tests     │
│ y Pérdida Financiera │ Lógica Transaccional │ Ergonomía Móvil      │ Modularización (<150L)      │
└──────────────────────┴──────────────────────┴──────────────────────┴─────────────────────────────┘
```

---

### 🔴 Fase 0: Bloqueantes de Seguridad y Pérdida Financiera Inmediata (Días 1-2)
*Objetivo: Cerrar de inmediato los vectores de fraude financiero, escalación de privilegios y destrucción de datos.*

1. **[SEC-01 / NEG-15] Blindaje de Roles y Eliminación de `/upgrade`:**
   - Eliminar `src/app/upgrade/page.tsx`.
   - Desplegar trigger en PostgreSQL `BEFORE UPDATE ON public.profiles` que impida la modificación de las columnas `role` y `credit_balance` a usuarios sin permisos de `platform_admin`.
2. **[SEC-02] Eliminación de `/mock-payment` y Restricción RLS en `bookings`:**
   - Eliminar `src/app/(main)/mock-payment/page.tsx`.
   - Actualizar política RLS en `bookings` para que los usuarios normales **sólo** puedan actualizar su propia reserva a `status = 'cancelled'`.
3. **[SEC-04 / NEG-01] Blindaje de Precios en `/api/booking/create-preference`:**
   - Eliminar el parámetro `price` del payload del cliente.
   - Recalcular el precio y la seña en el servidor leyendo `total_price` de la reserva creada en base de datos.
4. **[SEC-05] Revocación de Permisos de UPDATE en `credits`:**
   - Revocar la política RLS que permite `UPDATE` a usuarios sobre la tabla `credits`. La gestión de saldo debe ser exclusiva de funciones `service_role`.
5. **[SEC-06] Protección de PII en `profiles`:**
   - Modificar política RLS de `profiles` para que `SELECT` completo sólo esté disponible para el propio usuario (`auth.uid() = id`) o administradores.
   - Crear vista pública segura `public_user_profiles` (exponiendo solo `id`, `full_name`, `avatar_url`) para chat y reseñas.
6. **[COD-02 / COD-05] Corrección Inmediata de Build y Desincronización de Esquema:**
   - Eliminar variable no usada `e` en `BookingWizard.tsx:33` (reparar `npm run lint`).
   - Corregir `booking_status` por `status` en `AdminChatThread.tsx:59` y `BookingsClient.tsx:23, 176`.
   - Corregir política RLS de reseñas en SQL (`b.status = 'completed'`).

---

### 🟠 Fase 1: Integridad Transaccional, Webhooks y Lógica de Negocio (Días 3-4)
*Objetivo: Estabilizar el ciclo de vida de las reservas, garantizar la persistencia de pagos y corregir las reglas de negocio.*

1. **[SEC-03 / ARC-05 / NEG-07] Reingeniería del Webhook de Mercado Pago:**
   - Hacer obligatoria la validación de firma HMAC con `MP_WEBHOOK_SECRET` usando `crypto.timingSafeEqual`.
   - Reemplazar `createClient()` por `createAdminClient()` (`service_role`) para que el webhook tenga permisos de escritura.
   - Validar idempotencia con `mp_payment_id` antes de procesar y despachar notificaciones.
2. **[ARC-01 / NEG-08] Eliminación de Mutaciones en HTTP GET:**
   - Eliminar el `INSERT` en `src/app/(main)/booking/[courtId]/page.tsx`.
   - Implementar Server Action `createBookingHold()` invocada exclusivamente al presionar "Continuar" o "Pagar".
3. **[ARC-02] Eliminación de Beacon Destructivo en `BookingWizard.tsx`:**
   - Remover el listener `beforeunload` y el endpoint `/api/bookings/cancel`. Unificar en `/api/booking/cancel`.
4. **[ARC-03] Ajuste de Ventana de Expiración en Cron Job:**
   - Modificar `012_abandoned_bookings_cron.sql` para extender la tolerancia de reservas pendientes de **3 a 15 minutos**.
5. **[ARC-04] Resiliencia de Notificaciones en Serverless:**
   - Eliminar `setTimeout(..., 0)` en `src/lib/notifications/index.ts`.
   - Asegurar que `notify()` retorne una promesa esperable e integrarla con `@vercel/functions` (`waitUntil`).
6. **[ARC-06 / NEG-02 / NEG-06] Reingeniería Transaccional del Gestor de Créditos:**
   - Implementar partición de créditos en usos parciales (preservar el saldo remanente con la fecha de expiración original).
   - Aplicar los créditos en estado temporal bloqueado y consumirlos definitivamente **únicamente** cuando el webhook confirme el pago.
7. **[NEG-03 / NEG-04] Cierre de Brechas de Arbitraje y Reprogramaciones:**
   - Marcar reservas reprogramadas dentro de la ventana de 6h como no cancelables con derecho a crédito (`non_refundable = true`).
   - Validar diferencial de precio en reprogramaciones a horarios prime y cobrar la diferencia de seña.
8. **[NEG-05 / ARC-13] Normalización Estricta de Timezones:**
   - Configurar timezone explícito `America/Argentina/Buenos_Aires` para todos los cálculos de fechas y ventanas de cancelación.

---

### 🟡 Fase 2: Conformidad WCAG 2.2 AA, UX Móvil y Eliminación de Fricción (Días 5-6)
*Objetivo: Alcanzar cumplimiento de accesibilidad universal AA, optimizar touch targets móviles y elevar la tasa de conversión.*

1. **[UX-01 / UX-02] Normalización de Contraste y Tokens de Diseño:**
   - Actualizar tokens de color en `src/app/globals.css`: definir verde accesible en light mode (`oklch(0.48 0.17 146)`) con contraste >= 4.6:1 y verde brillante en dark mode con texto de alto contraste (`#121212` sobre verde).
   - Reparar tokens de variables CSS en popups de Leaflet (reemplazar `hsl(var(--card))` por la sintaxis compatible con OKLCH).
2. **[UX-03] Aumento de Touch Targets en Primitivas Base (`button.tsx`):**
   - Configurar `min-h-[44px]` por defecto en móviles para botones y controles interactivos (`buttonVariants`).
3. **[UX-04 / UX-11] Erradicación de `alert()` y Conexión de Labels:**
   - Reemplazar todas las 18+ llamadas a `alert()` nativo por toasts accesibles de shadcn/ui (`toast.add()`).
   - Asociar programáticamente todos los `<label htmlFor="...">` con los `<input id="...">` y eliminar los comentarios `/* eslint-disable jsx-a11y/* */`.
4. **[UX-06 / UX-07 / UX-08] Accesibilidad Universal y Lectores de Pantalla:**
   - Agregar `aria-label` descriptivos en todos los botones de iconos (`Chevron`, `Trash`, `Paperclip`, `Send`).
   - Enriquecer celdas de horarios en `AvailabilityGrid` con etiquetas contextualmente completas ("Reservar Cancha 1, 20:00 hs, Viernes 30").
   - Incorporar "Skip Navigation Link" en `src/app/layout.tsx`.
   - Incorporar `aria-live="polite"` en filtros de búsqueda y chat en tiempo real.
5. **[UX-13] Desactivación de Scroll Trap en Mapas Móviles:**
   - Configurar `cooperativeGestureHandling` o requerir toque con dos dedos en `VenueMapClient.tsx` para evitar bloquear el scroll vertical.
6. **[UX-15 / UX-16] Optimización del Embudo de Conversión (CRO):**
   - Unificar el wizard de reserva (`BookingWizard.tsx`) en un solo paso claro con desglose financiero transparente.
   - Implementar `StickyBookingBar.tsx` fija en la parte inferior de la ficha de cancha en dispositivos móviles.
7. **[ARC-07] Implementación de Boundaries de App Router:**
   - Crear `loading.tsx` con skeletons shimmer, `error.tsx` con botón de reintento y `not-found.tsx` en todos los segmentos de ruta.

---

### 🔵 Fase 3: Tipado Estricto, Modularización e Infraestructura de Tests (Días 7-8)
*Objetivo: Erradicar la deuda técnica, garantizar mantenibilidad y blindar el sistema con pruebas automatizadas.*

1. **[COD-01 / COD-04] Modelado de Dominio Centralizado y Erradicación de `as any`:**
   - Crear definiciones de dominio en `src/types/` (`booking.ts`, `venue.ts`, `court.ts`, `chat.ts`, `review.ts`, `mercadopago.ts`).
   - Crear funciones tipadas en `src/lib/supabase/queries/` para encapsular las consultas PostgREST con relaciones complejas.
   - Reemplazar las 66 instancias de `(supabase.from(...) as any)` y los castings dobles `as unknown as`.
   - Eliminar las directivas `/* eslint-disable @typescript-eslint/no-explicit-any */` en los 38 archivos.
2. **[COD-06] Descomposición de Componentes Monolíticos (>150 líneas):**
   - Refactorizar los 20 componentes excedidos (ej. modularizar `PlayerChatModal.tsx` en 4 submódulos y `SearchFilters.tsx` en 3 submódulos).
3. **[COD-07] Normalización de Nombres a `kebab-case.tsx`:**
   - Renombrar los 35+ componentes en `src/components/` a `kebab-case.tsx` de acuerdo con las directrices de `AGENTS.md`.
4. **[COD-10 / COD-11] Limpieza de Imports, Utils y Branding:**
   - Normalizar los 10 imports relativos (`./...`) al alias absoluto `@/...`.
   - Modularizar `src/lib/utils/` (`geo.ts`, `currency.ts`, `dates.ts`, `validators.ts`).
   - Eliminar vestigios del branding anterior ("El Potrero", URLs obsoletas y User-Agents deprecados).
5. **[SEC-14] Validación en Fronteras con Zod:**
   - Instalar `zod` e implementar esquemas estrictos de validación en todas las Server Actions y API Route Handlers.
6. **[COD-08] Infraestructura de Pruebas Automatizadas:**
   - Configurar Vitest y `@testing-library/react`.
   - Añadir scripts en `package.json`: `"test": "vitest run"`, `"test:integration": "vitest run --dir test/integration"`.
   - Implementar suite de tests unitarios e integración para cálculo de señas, política de cancelación, consumo de créditos y verificación de webhooks.

---

## 6. Checklist de Aceptación Pre-Lanzamiento (Quality Gates)

Para autorizar el pase a producción comercial, la plataforma debe superar satisfactoriamente y sin excepciones cada una de las siguientes pruebas de verificación automatizadas y manuales:

| Verificación / Quality Gate | Comando / Método de Prueba | Criterio de Pase Obligatorio | Estado |
| :--- | :--- | :--- | :---: |
| **1. Verificación de Tipos TypeScript** | `npm run type-check` (`tsc --noEmit`) | **0 errores de compilación.** Strict mode habilitado, 0 usos de `any` en modelos. | [ ] |
| **2. Verificación Estática de Linter** | `npm run lint` (`next lint`) | **0 errores y 0 warnings.** 0 directivas `eslint-disable` en código de negocio. | [ ] |
| **3. Ejecución de Pruebas Unitarias** | `npm run test` (`vitest run`) | **100% pruebas aprobadas** sobre políticas de crédito, señas y webhooks. | [ ] |
| **4. Build de Producción** | `npm run build` | **Build exitoso** sin errores en SSR/SSG/ISR en ninguna ruta. | [ ] |
| **5. Bloqueo de Escalación de Privilegios** | Intento de `UPDATE profiles SET role = 'platform_admin'` | **Rechazo estricto** por trigger PostgreSQL o RLS para usuarios no superadmin. | [ ] |
| **6. Idempotencia y Firma de Webhook** | Request a `/api/webhooks/mercadopago` sin firma HMAC | **HTTP 401 / 403** (Rechazado). Solicitudes con firma válida procesadas con `service_role`. | [ ] |
| **7. Integridad de Precio en Preferencia** | Petición POST a `/api/booking/create-preference` con `price: 1` | Servidor ignora payload y cotiza la seña real registrada en base de datos. | [ ] |
| **8. Preservación de Crédito Remanente** | Uso de crédito de $10.000 para seña de $3.000 | Saldo restante queda en exactamente $7.000 disponible en billetera. | [ ] |
| **9. Conformidad de Contraste WCAG AA** | Auditoría Axe-core / Lighthouse Accessibility | **Score >= 95/100.** Ratios de contraste >= 4.5:1 en todos los textos y botones. | [ ] |
| **10. Touch Targets Móviles** | Inspección DOM de botones primarios | Todos los botones interactivos cumplen **mínimo 44×44px** en pantallas móviles. | [ ] |
| **11. Navegabilidad por Teclado** | Navegación completa con tecla `Tab` / `Shift+Tab` | Indicadores de foco visibles (`ring-2`), Skip Link funcional, 0 trampas de foco. | [ ] |
| **12. Modularidad y Nombres de Archivo** | Script de validación de estructura | **100% de archivos en `kebab-case.tsx`** y componentes con **< 150 líneas**. | [ ] |

---

## 7. Dictamen Final del Comité

El desarrollo de ReservaYa ha alcanzado una madurez visual sobresaliente, pero presenta una arquitectura transaccional frágil y de alto riesgo que no puede operar en un entorno comercial con dinero real.

La ejecución meticulosa del **Plan Maestro de Remediación (Fases 0 a 3)** transformará a ReservaYa en una plataforma altamente segura (estándar OWASP ASVS L2), financieramente blindada, transaccionalmente resiliente, completamente accesible bajo WCAG 2.2 AA y con una base de código limpia y mantenible a largo plazo.

---
*Informe consolidado y certificado por el Lead Auditor & Synthesis Specialist para el equipo de dirección e ingeniería de ReservaYa.*
