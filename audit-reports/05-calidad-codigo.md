# Informe de Auditoría de Calidad de Código, Tipado y Estándares de Ingeniería

**Proyecto:** ReservaYa (CanchApp)  
**Rol:** Purista de Código (Code Quality & Standards Specialist)  
**Fecha de Ejecución:** 29 de Agosto de 2026  
**Normativa Base:** `AGENTS.md`, `.cursor/rules/nextjs.mdc`, `tsconfig.json`, `package.json`, `.eslintrc.json`  
**Estado General de la Base de Código:** ⚠️ **CRÍTICO — Deuda Técnica Severa y Supresiones Masivas de Tipado**

---

## 1. Resumen Ejecutivo y Cuadro de Mando de Calidad

Se ha realizado una auditoría exhaustiva, línea por línea, de los 116 archivos TypeScript (`.ts` y `.tsx`) que componen el frontend y backend de **ReservaYa**. Si bien el proyecto cuenta con una interfaz moderna y un diseño visual atractivo, el análisis estático y dinámico revela una **ilusión de seguridad de tipos y conformidad**: la base de código sobrevive a la compilación inicial debido a la supresión sistemática y masiva de reglas de TypeScript y ESLint (`/* eslint-disable @typescript-eslint/no-explicit-any */`), sumado a más de **66 instancias de `(supabase.from(...) as any)`**.

Esta evasión de tipos ha generado defectos lógicos en producción, incluyendo **desfases entre el esquema de base de datos y el cliente** (por ejemplo, el uso de `booking_status` cuando la columna real en PostgreSQL fue renombrada a `status`), provocando que las reservas en el panel de administración se evalúen como *undefined* y caigan en estados erróneos.

### Cuadro de Mando de Calidad (Scorecard)

| Dimensión | Calificación | Estado | Hallazgos Principales |
| :--- | :---: | :---: | :--- |
| **TypeScript Strictness & Safety** | **F** (32/100) | 🚨 Crítico | 66+ usos de `as any`, 3 dobles aserciones `as unknown as`, 0 modelos de dominio en `src/types/` (solo un archivo `database.ts` manual e ignorado). |
| **Modularidad y Tamaño (<150 líneas)** | **D** (48/100) | ⚠️ Deficiente | 20 archivos de aplicación superan las 150 líneas (alcanzando hasta 361 líneas en `PlayerChatModal.tsx`), componentes monolíticos con lógica de negocio y llamadas de red embebidas. |
| **Convenciones de Nombres y Estructura** | **F** (35/100) | 🚨 Crítico | 35+ componentes usan `PascalCase.tsx` en vez de `kebab-case.tsx`. Utilidades matemáticas embebidas en custom hooks. Inexistencia del directorio `src/lib/utils/` modular. |
| **Arquitectura de Módulos e Imports** | **C-** (62/100) | ⚠️ Advertencia | 10 violaciones de imports relativos (`./...`), desorden en la agrupación de imports (librerías externas importadas después de componentes internos). |
| **Manejo de Errores e Higiene** | **D** (40/100) | 🚨 Crítico | 86+ directivas `eslint-disable`. `npm run lint` falla por error de variable no usada (`BookingWizard.tsx:33`). 43+ `console.error`/`console.log` sin estructurar. Errores tragados silenciosamente. Vestigios de branding ("El Potrero"). |
| **Infraestructura de Testing** | **F** (0/100) | 🚨 Inexistente | 0 pruebas unitarias, 0 pruebas de integración. `package.json` carece de scripts `test` y `test:integration`. |

---

## 2. Área 1: TypeScript Strictness & Type Safety

### 2.1. El Patrón Sistémico `(supabase.from(...) as any)`

La regla estricta de `AGENTS.md` ("*Strict mode enabled. Zero `any` types. Use `unknown` + type guards when type is uncertain*") es violentada de manera generalizada en toda la aplicación. En lugar de modelar los tipos de retorno de las consultas PostgREST con relaciones anidadas (ej. `.select('*, courts(*, venues(*))')`), el equipo recurrió a forzar el cliente con `as any`.

**Estadística de Violaciones:**
- Total de archivos afectados por `as any`: **30 archivos**.
- Total de ocurrencias directas de `(supabase.from(...) as any)`: **66 instancias**.

#### Casos de Código Críticos Verificados:

1. **`src/app/(main)/booking/[courtId]/page.tsx` (Líneas 30, 49, 74, 105):**
```tsx
// ❌ Código actual: Cuatro aserciones 'as any' en un solo flujo de reserva
const { data: court, error: courtError } = await (supabase.from("courts") as any)
  .select("*, venues(*)")
  .eq("id", params.courtId)
  .single()

const { data: rules } = await (supabase.from("pricing_rules") as any)
  .select("*")
  .eq("court_id", court.id)
  .eq("day_of_week", dayOfWeek)

const { data: existingBookings } = await (supabase.from("bookings") as any)
  .select("start_time, end_time")
  .eq("court_id", court.id)

const { data: newBooking, error: insertError } = await (supabase.from("bookings") as any)
  .insert({ ... })
```

2. **`src/app/actions/chat.ts` (Líneas 26, 33, 57, 87, 98, 106, 119, 121):**
```tsx
// ❌ Código actual: Destrucción de tipos en Server Actions
const conversation = conversationData as any
const { error: insertError } = await (supabase.from("messages") as any).insert({ ... })
const owner = ownerData as any
await (supabase.from('conversations') as any).update({ unread_user_count: 0 }).eq('id', conversationId)
```

3. **`src/app/api/webhooks/mercadopago/route.ts` (Línea 50):**
```tsx
// ❌ Código actual: Actualización crítica de pagos sin tipar
const { data: booking, error } = await (supabase.from('bookings') as any)
  .update({ payment_status: 'paid', status: 'confirmed', updated_at: new Date().toISOString() })
  .eq('id', bookingId)
```

---

### 2.2. Defecto Crítico en Producción Causado por `as any`: Desincronización `booking_status` vs `status`

El peligro de eludir el sistema de tipos de TypeScript se evidencia en el siguiente error en tiempo de ejecución:

1. En la migración SQL `supabase/migrations/004_fix_schema_inconsistencies.sql` (Línea 2):
   ```sql
   ALTER TABLE public.bookings RENAME COLUMN booking_status TO status;
   ```
2. La definición en `src/types/database.ts` (Línea 188) se actualizó correctamente a:
   ```ts
   status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
   ```
3. Sin embargo, debido al uso de `as any`, TypeScript no pudo advertir que los componentes continuaban consultando el campo obsoleto `booking_status`:
   - **`src/components/dashboard/inbox/AdminChatThread.tsx` (Línea 59):**
     ```tsx
     // ❌ ERROR POSTGRESQL EN RUNTIME: Columna inexistente en base de datos
     .from('bookings')
     .select('id, booking_date, start_time, courts!inner(name, venue_id)')
     .eq('user_id', conversation.user_id!)
     .eq('courts.venue_id', venueId)
     .eq('booking_status', 'confirmed') // <- La columna real es 'status'
     ```
   - **`src/components/dashboard/bookings/BookingsClient.tsx` (Líneas 23, 176, 180-182):**
     ```tsx
     export interface Booking {
       booking_status: string // <- Inexistente
     }
     // En el render: booking.booking_status es siempre undefined
     {booking.booking_status === 'confirmed' ? 'Confirmada' : 
      booking.booking_status === 'cancelled' ? 'Cancelada' : 
      booking.booking_status === 'completed' ? 'Completada' : 'No Show'}
     ```
     **Impacto:** Como `booking.booking_status` es `undefined`, **todas las reservas de la plataforma se muestran falsamente como 'No Show' en la tabla del panel de administración**.

---

### 2.3. Dobles Aserciones Inseguras (`as unknown as ...`)

En tres puntos neurálgicos, los desarrolladores emplearon dobles aserciones `as unknown as` para forzar la compatibilidad de tipos en lugar de definir interfaces de consulta:

1. **`src/app/dashboard/bookings/page.tsx` (Línea 16):**
   ```tsx
   // ❌ Evasión de tipos mediante doble casting
   const venues = venuesData as unknown as Array<{ courts: Array<{ id: string; name: string }> }>
   ```
2. **`src/app/dashboard/inbox/page.tsx` (Línea 29):**
   ```tsx
   const venue = venueData as unknown as { id: string }
   ```
3. **`src/app/dashboard/inbox/page.tsx` (Línea 46):**
   ```tsx
   // ❌ Cast monstruoso inline en Server Component
   const conversations = conversationsData as unknown as Array<Record<string, unknown> & { 
     id: string; 
     profiles?: { avatar_url?: string; full_name?: string }; 
     last_message_at?: string; 
     status?: string; 
     unread_venue_count: number; 
     created_at?: string 
   }>
   ```

---

### 2.4. Ausencia de Definiciones de Dominio en `src/types/` y Duplicación de Interfaces

`AGENTS.md` estipula: "*Export types from `src/types/` and co-locate component-specific types.*"

**Diagnóstico del Directorio `src/types/`:**
Actualmente contiene **únicamente un archivo (`database.ts`)**. No existen definiciones centralizadas para las entidades del dominio ni para las respuestas de integración. Como resultado, las interfaces se reinventan de manera inconsistente en múltiples componentes:

| Interfaz Repetida | Archivos donde se declara localmente | Inconsistencias Detectadas |
| :--- | :--- | :--- |
| **`Message`** | `src/components/chat/PlayerChatModal.tsx:20`<br>`src/components/dashboard/inbox/AdminChatThread.tsx:14` | Tipado duplicado idéntico sin reutilización. |
| **`Court` / `CourtItem`** | `src/components/dashboard/bookings/BookingsClient.tsx:29`<br>`src/components/dashboard/schedule/ManualBookingModal.tsx:10`<br>`src/components/venue/CourtList.tsx:8` | En un archivo se llama `Court` con 2 propiedades, en otro `CourtItem` con 6 propiedades. |
| **`Booking`** | `src/components/dashboard/bookings/BookingsClient.tsx:16`<br>`src/components/booking/BookingWizard.tsx:12` | Diferentes convenciones (camelCase vs snake_case) para representar la misma entidad. |
| **`ReviewItem`** | `src/components/venue/ReviewSection.tsx:15` | En `ReviewSection` usa `reply: string \| null`, pero en la base de datos la columna es `venue_response`. |

---

### 2.5. Integración de Mercado Pago y Pagos sin Tipado Fuerte

En `src/lib/mercadopago/client.ts`:
1. **Clave de Idempotencia Estática (Riesgo Financiero):**
   ```tsx
   // ❌ Línea 6: IdempotencyKey estática 'abc' compartida entre todas las transacciones
   const client = new MercadoPagoConfig({ 
     accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token',
     options: { timeout: 5000, idempotencyKey: 'abc' }
   })
   ```
2. **Parámetros de función en `src/lib/credits/manager.ts` (Líneas 5, 41, 96):**
   ```tsx
   // ❌ Funciones de cálculo financiero con tipado 'any'
   export function calculateCancellationPolicy(booking: any) { ... }
   export function canReschedule(booking: any) { ... }
   credits.reduce((acc: number, curr: any) => acc + curr.amount, 0)
   ```

---

## 3. Área 2: Convenciones de Nombres y Organización de Archivos

### 3.1. Incumplimiento de `kebab-case.tsx` para Componentes

La regla de `AGENTS.md` ("*Files: `kebab-case.tsx` for components, `camelCase.ts` for utilities. Components: `PascalCase` — must match the filename stem*") es violada en **más de 35 archivos de componentes** en `src/components/`.

Solo los primitivos de `src/components/ui/` respetan `kebab-case.tsx`. Todo el resto del proyecto utiliza `PascalCase.tsx`.

#### Inventario Completo de Archivos con Nombre Incorrecto:

```
src/components/booking/BookingWizard.tsx         -> src/components/booking/booking-wizard.tsx
src/components/booking/CancelDialog.tsx          -> src/components/booking/cancel-dialog.tsx
src/components/booking/RescheduleDialog.tsx      -> src/components/booking/reschedule-dialog.tsx
src/components/chat/PlayerChatModal.tsx          -> src/components/chat/player-chat-modal.tsx
src/components/dashboard/MetricCard.tsx          -> src/components/dashboard/metric-card.tsx
src/components/dashboard/bookings/BookingActions.tsx -> src/components/dashboard/bookings/booking-actions.tsx
src/components/dashboard/bookings/BookingsClient.tsx -> src/components/dashboard/bookings/bookings-client.tsx
src/components/dashboard/courts/CourtFormModal.tsx   -> src/components/dashboard/courts/court-form-modal.tsx
src/components/dashboard/courts/OffersModal.tsx      -> src/components/dashboard/courts/offers-modal.tsx
src/components/dashboard/courts/PricingModal.tsx     -> src/components/dashboard/courts/pricing-modal.tsx
src/components/dashboard/inbox/AdminChatThread.tsx   -> src/components/dashboard/inbox/admin-chat-thread.tsx
src/components/dashboard/inbox/ConversationList.tsx  -> src/components/dashboard/inbox/conversation-list.tsx
src/components/dashboard/inbox/InboxClient.tsx       -> src/components/dashboard/inbox/inbox-client.tsx
src/components/dashboard/schedule/ManualBookingModal.tsx -> src/components/dashboard/schedule/manual-booking-modal.tsx
src/components/dashboard/schedule/ScheduleNavigation.tsx -> src/components/dashboard/schedule/schedule-navigation.tsx
src/components/dashboard/venue/LocationPicker.tsx    -> src/components/dashboard/venue/location-picker.tsx
src/components/dashboard/venue/LocationPickerMap.tsx -> src/components/dashboard/venue/location-picker-map.tsx
src/components/dashboard/venue/VenueForms.tsx        -> src/components/dashboard/venue/venue-forms.tsx
src/components/dashboard/venue/VenuePhotosForm.tsx   -> src/components/dashboard/venue/venue-photos-form.tsx
src/components/home/Hero3D.tsx                  -> src/components/home/hero-3d.tsx
src/components/home/HeroSearch.tsx              -> src/components/home/hero-search.tsx
src/components/home/HowItWorks.tsx              -> src/components/home/how-it-works.tsx
src/components/home/PromoCarousel.tsx           -> src/components/home/promo-carousel.tsx
src/components/layout/ConditionalFooter.tsx     -> src/components/layout/conditional-footer.tsx
src/components/layout/Footer.tsx                -> src/components/layout/footer.tsx
src/components/layout/Header.tsx                -> src/components/layout/header.tsx
src/components/layout/Sidebar.tsx               -> src/components/layout/sidebar.tsx
src/components/map/VenueMap.tsx                 -> src/components/map/venue-map.tsx
src/components/map/VenueMapClient.tsx           -> src/components/map/venue-map-client.tsx
src/components/profile/CreditsList.tsx          -> src/components/profile/credits-list.tsx
src/components/search/SearchFilters.tsx         -> src/components/search/search-filters.tsx
src/components/search/SearchLayout.tsx          -> src/components/search/search-layout.tsx
src/components/search/VenueList.tsx             -> src/components/search/venue-list.tsx
src/components/venue/AvailabilityGrid.tsx       -> src/components/venue/availability-grid.tsx
src/components/venue/CourtList.tsx              -> src/components/venue/court-list.tsx
src/components/venue/PricingTable.tsx           -> src/components/venue/pricing-table.tsx
src/components/venue/ReviewSection.tsx          -> src/components/venue/review-section.tsx
src/components/venue/VenueCard.tsx              -> src/components/venue/venue-card.tsx
src/components/venue/VenueGallery.tsx           -> src/components/venue/venue-gallery.tsx
src/components/venue/VenueImage.tsx             -> src/components/venue/venue-image.tsx
```

---

### 3.2. Estructura de Utilidades y Ubicación Errónea de Funciones

1. **Inexistencia de `src/lib/utils/` modular:**  
   `AGENTS.md` define: `src/lib/utils/ # General utilities (cn, formatters, validators)`.  
   Actualmente solo existe un archivo `src/lib/utils.ts` con 7 líneas que únicamente contiene `cn()`. Los formateadores de moneda, fechas y validadores están duplicados como funciones inline en componentes.
2. **Función Utilitaria Embebida en Custom Hook:**  
   En `src/hooks/useGeolocation.ts` (Línea 62), se exporta la función matemática pura de cálculo de distancia Haversine:
   ```ts
   export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
   ```
   **Corrección requerida:** Debe trasladarse a `src/lib/utils/geo.ts`.

---

### 3.3. Conflicto de Rutas API Duplicadas: `/api/booking/cancel` vs `/api/bookings/cancel`

Existe una grave inconsistencia semántica y de enrutamiento:
- **`src/app/api/booking/cancel/route.ts` (Singular):** Recibe `{ bookingId }`, ejecuta la Server Action `cancelBooking()` aplicando reglas de negocio de 6 horas y generación de créditos.
- **`src/app/api/bookings/cancel/route.ts` (Plural):** Recibe `{ bookingId }` mediante `navigator.sendBeacon`, y **elimina físicamente (`.delete()`)** la reserva de la base de datos si el estado es pendiente.

Esta duplicidad confunde al desarrollador y rompe las convenciones RESTful estándar del proyecto.

---

## 4. Área 3: Tamaño de Componentes y Modularidad (<150 Líneas)

### 4.1. Tabla de Auditoría de Líneas de Código por Componente

La regla estipulada en `AGENTS.md` y `.cursor/rules/nextjs.mdc` es tajante: **"< 150 lines per component. Extract sub-components, hooks, and types when growing."**

A continuación se detalla el censo completo de los archivos de interfaz y su estado respecto al límite:

| Archivo / Componente | Líneas Totales | Estado | Diagnóstico y Responsabilidades Mezcladas |
| :--- | :---: | :---: | :--- |
| `src/components/chat/PlayerChatModal.tsx` | **361** | 🚨 Excedido (+211) | Maneja estado de modal, realtime channel Supabase, indicador de typing, subida de fotos a storage y renderizado de mensajes. |
| `src/components/dashboard/inbox/AdminChatThread.tsx` | **341** | 🚨 Excedido (+191) | Mezcla historial de mensajes, polling/realtime, preview de última reserva del cliente, subida de archivos y marcado de lectura. |
| `src/components/dashboard/bookings/BookingsClient.tsx` | **282** | 🚨 Excedido (+132) | Contiene vista lista, vista grilla, ordenamiento multidimensional, selector de fecha y acciones sobre reservas. |
| `src/app/(main)/page.tsx` | **281** | 🚨 Excedido (+131) | Server component con consultas complejas, mapeo inline, sección de estadísticas hardcodeadas y banners estáticos. |
| `src/components/search/SearchFilters.tsx` | **276** | 🚨 Excedido (+126) | 10 estados independientes de React para filtros rápidos, mobile sheet, sincronización de query params en URL. |
| `src/app/(main)/venue/[id]/page.tsx` | **273** | 🚨 Excedido (+123) | Fetching con ISR cacheado, generación de metadata OpenGraph y estructura visual completa de la página de complejo. |
| `src/components/booking/BookingWizard.tsx` | **249** | 🚨 Excedido (+99) | Wizard de 3 pasos (resumen, método de pago, confirmación), manejo de `sendBeacon` y redirección a Mercado Pago. |
| `src/components/dashboard/venue/VenuePhotosForm.tsx` | **223** | 🚨 Excedido (+73) | Subida de imágenes a Supabase Storage, validación de URLs, preview y actualización de tabla `venues`. |
| `src/components/venue/ReviewSection.tsx` | **221** | 🚨 Excedido (+71) | Cálculo de distribución de estrellas, formulario modal para nueva reseña y lista de comentarios con respuestas. |
| `src/components/dashboard/venue/VenueForms.tsx` | **191** | 🚨 Excedido (+41) | Contiene 3 componentes exportados distintos en un solo archivo (`VenueProfileForm`, `VenueLocationForm`, `VenueDepositForm`). |
| `src/components/venue/AvailabilityGrid.tsx` | **190** | 🚨 Excedido (+40) | Lógica de cálculo de slots de tiempo, selector de fecha local, consulta de reservas activas y grilla de horarios. |
| `src/app/(main)/bookings/page.tsx` | **182** | 🚨 Excedido (+32) | Lista de reservas del usuario con tabs para activas y pasadas, diálogos de cancelación y reprogramación. |
| `src/components/dashboard/courts/OffersModal.tsx` | **175** | 🚨 Excedido (+25) | Modal de ofertas con carga de reglas de precios, creación dinámica de filas y cálculo de porcentajes. |
| `src/components/layout/Header.tsx` | **174** | 🚨 Excedido (+24) | Header responsive que incluye navegación desktop, drawer mobile en Sheet y DropdownMenu de usuario. |
| `src/app/(main)/profile/page.tsx` | **166** | 🚨 Excedido (+16) | Vista de perfil con edición de nombre/teléfono, historial de créditos y cierre de sesión. |
| `src/lib/notifications/templates.ts` | **166** | 🚨 Excedido (+16) | 4 plantillas HTML extensas embebidas en un único archivo. |
| `src/components/map/VenueMapClient.tsx` | **161** | 🚨 Excedido (+11) | Inicialización imperativa de Leaflet, marcadores personalizados y popup cards. |
| `src/app/dashboard/courts/actions.ts` | **154** | 🚨 Excedido (+4) | Múltiples server actions con lógica compleja de recreación de reglas de precios. |
| `src/app/(main)/booking/[courtId]/page.tsx` | **153** | 🚨 Excedido (+3) | Comprobación de autenticación, validación de horarios, cálculo de seña e inserción temporal. |
| `src/app/(auth)/login/page.tsx` | **151** | 🚨 Excedido (+1) | Manejo de OAuth con Google/Facebook, estados de carga y redirecciones. |
| `src/components/dashboard/schedule/ManualBookingModal.tsx` | 145 | ✅ Conforme | En el límite permitido. |
| `src/components/home/PromoCarousel.tsx` | 140 | ✅ Conforme | Carrusel de turnos en oferta. |
| `src/components/dashboard/courts/CourtFormModal.tsx` | 125 | ✅ Conforme | Formulario de creación/edición de cancha. |
| `src/components/venue/VenueCard.tsx` | 120 | ✅ Conforme | Card de complejo en listas de búsqueda y home. |
| `src/components/booking/RescheduleDialog.tsx` | 115 | ✅ Conforme | Diálogo de selección de nueva fecha y hora. |
| `src/components/venue/VenueGallery.tsx` | 105 | ✅ Conforme | Galería interactiva con visor modal. |
| `src/components/booking/CancelDialog.tsx` | 95 | ✅ Conforme | Modal de confirmación de cancelación. |

*(Nota: Primitivos base de `@/components/ui/` como `dropdown-menu.tsx` [268], `toast.tsx` [234], `calendar.tsx` [221], `select.tsx` [201] y `dialog.tsx` [160] provienen del scaffolding de shadcn/ui con Radix UI, por lo que su extensión es estándar, pero deben ser mantenidos sin modificaciones manuales destructivas).*

---

### 4.2. Plan de Descomposición Modular para Componentes Monolíticos

#### 1. Descomposición de `PlayerChatModal.tsx` (361 líneas -> 4 submódulos):
- **`src/hooks/use-player-chat.ts` (~80 líneas):** Maneja suscripción a canal de Supabase Realtime, presencia, typing status y carga de mensajes.
- **`src/components/chat/chat-messages-list.tsx` (~60 líneas):** Renderizado del feed de mensajes con separadores de fecha y burbujas de avatar.
- **`src/components/chat/chat-input-bar.tsx` (~45 líneas):** Input de texto, botón de adjuntos y acción de envío.
- **`src/components/chat/player-chat-modal.tsx` (~40 líneas):** Shell del diálogo simplificado.

#### 2. Descomposición de `SearchFilters.tsx` (276 líneas -> 3 submódulos):
- **`src/hooks/use-search-filters.ts` (~70 líneas):** Sincronización bidireccional con `useSearchParams` y `useRouter`.
- **`src/components/search/quick-filter-bar.tsx` (~60 líneas):** Inputs de búsqueda rápida por texto, fecha y hora.
- **`src/components/search/advanced-filter-sheet.tsx` (~70 líneas):** Sheet móvil con sliders de precio, tipo de suelo y rating mínimo.

#### 3. Descomposición de `VenueForms.tsx` (191 líneas con 3 componentes exportados):
- Dividir en 3 archivos independientes:
  - `src/components/dashboard/venue/venue-profile-form.tsx` (~60 líneas)
  - `src/components/dashboard/venue/venue-location-form.tsx` (~65 líneas)
  - `src/components/dashboard/venue/venue-deposit-form.tsx` (~60 líneas)

---

## 5. Área 4: Orden de Imports y Alias de Rutas

### 5.1. Violaciones a la Regla de Alias Absoluto `@/`

Se detectaron **10 instancias de imports relativos** (`./...`) en lugar del alias `@/` obligatorio según `AGENTS.md`:

```tsx
// ❌ Violaciones de imports relativos detectadas:
1. src/components/dashboard/inbox/InboxClient.tsx:5
   import { ConversationList } from "./ConversationList"
2. src/components/dashboard/inbox/InboxClient.tsx:6
   import { AdminChatThread } from "./AdminChatThread"
3. src/components/dashboard/venue/VenueForms.tsx:10
   import { LocationPicker } from "./LocationPicker"
4. src/components/layout/ConditionalFooter.tsx:4
   import { Footer } from "./Footer"
5. src/components/search/SearchLayout.tsx:4
   import { SearchVenueItem, VenueList } from "./VenueList"
6. src/components/search/SearchLayout.tsx:5
   import { SearchFilters } from "./SearchFilters"
7. src/components/venue/AvailabilityGrid.tsx:9
   import { CourtItem } from "./CourtList"
8. src/lib/notifications/email.ts:9
   import { ... } from './templates'
9. src/lib/notifications/index.ts:8
   import { ... } from './email'
10. src/lib/notifications/index.ts:12
    import { ... } from './whatsapp'
```

---

### 5.2. Desorden en la Jerarquía de Importación

`AGENTS.md` establece la jerarquía:  
`React/Next → external libs → @/lib → @/components → @/hooks → @/types → relative`

**Ejemplo de Violación en `src/components/venue/ReviewSection.tsx` (Líneas 4-14):**
```tsx
// ❌ Orden desordenado actual:
import { useState } from "react"                      // 1. React
import { Star, MessageSquare } from "lucide-react"    // 2. Lib externa
import { Progress } from "@/components/ui/progress"   // 3. Componentes
import { useUser } from "@/hooks/useUser"             // 4. Hooks (antes de lib)
import { createClient } from "@/lib/supabase/client"  // 5. Lib (después de components y hooks!)
import { toast } from "@/components/ui/toast"         // 6. Componentes (otra vez!)
```

**Orden Normalizado Requerido:**
```tsx
// ✅ Orden conforme a AGENTS.md:
import { useState } from "react"
import { Star, MessageSquare } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/hooks/useUser"
import type { ReviewItem } from "@/types/review"
```

---

## 6. Área 5: Manejo de Errores e Higiene del Código

### 6.1. Auditoría de Supresiones de ESLint (86+ Directivas)

Se detectó una práctica sistemática de "silenciar" el linter mediante directivas en la cabecera de los archivos para permitir código inseguro:

| Regla de ESLint Silenciada | Cantidad de Archivos | Justificación Real / Causa Raíz |
| :--- | :---: | :--- |
| `@typescript-eslint/no-explicit-any` | **38 archivos** | Evitar crear interfaces de consulta PostgREST y tipos de Mercado Pago. |
| `jsx-a11y/label-has-associated-control` | **22 archivos** | Uso de etiquetas `<label>` sin asociar mediante `htmlFor` ni envolviendo `<input>`. Se pegó por error incluso en Server Actions sin JSX (`actions.ts`). |
| `@typescript-eslint/no-unused-vars` | **12 archivos** | Variables importadas o parámetros de error `catch (error)` que nunca se utilizan. |
| `jsx-a11y/click-events-have-key-events` | **6 archivos** | Elementos `<div>` con manejadores `onClick` sin atributos `role="button"` ni `onKeyDown`. |
| `@next/next/no-img-element` | **4 archivos** | Uso de etiquetas HTML nativas `<img>` en lugar del componente optimizado `next/image`. |

---

### 6.2. Error Bloqueante de Build / Lint Detectado

Al ejecutar `npm run lint`, el linter arroja el siguiente error fatal en CI:

```
./src/components/booking/BookingWizard.tsx
33:33  Error: 'e' is defined but never used.  @typescript-eslint/no-unused-vars
```

**Ubicación (`src/components/booking/BookingWizard.tsx:33`):**
```tsx
// ❌ Error: Parámetro 'e' no utilizado en el manejador beforeunload
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    navigator.sendBeacon(`/api/bookings/cancel`, JSON.stringify({ bookingId: booking.id }))
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [booking.id])
```

---

### 6.3. Errores Silenciados y Falta de Feedback al Usuario

1. **`src/components/booking/BookingWizard.tsx` (Líneas 160-166):**
   ```tsx
   // ❌ Import dinámico en un onClick que traga el error y navega hacia atrás
   onClick={async () => {
     setLoading(true)
     try {
       const { cancelPendingBooking } = await import('@/app/actions/booking')
       await cancelPendingBooking(booking.id)
     } catch (e) {
       console.error(e) // Silenciado sin notificar al usuario
     }
     router.back() // Deja al usuario sin saber si la reserva fue liberada
   }}
   ```
2. **`src/components/dashboard/venue/VenueForms.tsx` (Líneas 20, 22):**
   ```tsx
   // ❌ Uso de alert() nativo del navegador en lugar del sistema de Toast
   try {
     await updateVenueProfile(new FormData(e.currentTarget))
     alert("Perfil actualizado correctamente")
   } catch (error: any) {
     alert("Error: " + error.message)
   }
   ```

---

### 6.4. Deuda de Branding y Atajos de "MVP" en Código de Producción

1. **Vestigios del Nombre Anterior ("El Potrero"):**
   - `src/components/layout/Header.tsx:55`: `<span className="inline-block font-bold text-primary">El Potrero</span>`
   - `src/app/admin/page.tsx:33`: `Métricas en tiempo real de toda la plataforma El Potrero.`
   - `src/lib/notifications/templates.ts:23`: `<div class="logo">El Potrero</div>`
   - `src/lib/notifications/templates.ts:37`: `<a href="https://elpotrero.vercel.app/bookings" ...>` (URL obsoleta)
   - `src/app/dashboard/venue/actions.ts:30`: `headers: { 'User-Agent': 'El Potrero MVP' }`

2. **Atajos Críticos Marcados como "MVP":**
   - `src/app/(main)/booking/[courtId]/page.tsx:111`: `end_time: "23:59:00", // En MVP es de 1h pero simplificamos` -> Asigna las 23:59 hs a todas las reservas en lugar de calcular la duración real del turno.
   - `src/lib/credits/manager.ts:121-122`:  
     `// MVP: Consumimos el crédito completo. (Si un crédito es de $5000 y solo necesitás $3000, en este MVP se consume entero para simplificar)` -> **Confiscación ilegal del saldo remanente del usuario.**

---

## 7. Modelos de Refactorización y Código Limpio

A continuación se presentan los ejemplos de refactorización según las pautas de ingeniería de `AGENTS.md` y `.cursor/rules/nextjs.mdc`.

### 7.1. Definición de Tipos de Dominio Fuertes (`src/types/booking.ts`)

```typescript
// ✅ src/types/booking.ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'credited'
export type DepositMethod = 'mercadopago' | 'transfer' | 'cash'

export interface BookingCourtDetails {
  id: string
  name: string
  venue_id: string
  venues?: {
    id: string
    name: string
    address?: string
    city?: string
  }
}

export interface BookingUserProfile {
  full_name: string | null
  email: string
  phone: string | null
}

export interface BookingWithDetails {
  id: string
  user_id: string
  court_id: string
  booking_date: string
  start_time: string
  end_time: string
  total_price: number
  deposit_amount: number
  deposit_method: DepositMethod
  payment_status: PaymentStatus
  status: BookingStatus
  created_at: string
  cancelled_at: string | null
  courts?: BookingCourtDetails
  profiles?: BookingUserProfile
}
```

---

### 7.2. Refactorización Limpia de Consulta Supabase sin `as any`

```typescript
// ✅ src/lib/supabase/queries/bookings.ts
import { createClient } from '@/lib/supabase/server'
import type { BookingWithDetails } from '@/types/booking'

export async function getVenueBookings(courtIds: string[]): Promise<BookingWithDetails[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      court_id,
      booking_date,
      start_time,
      end_time,
      total_price,
      deposit_amount,
      deposit_method,
      payment_status,
      status,
      created_at,
      cancelled_at,
      courts (
        id,
        name,
        venue_id,
        venues ( id, name, address, city )
      ),
      profiles (
        full_name,
        email,
        phone
      )
    `)
    .in('court_id', courtIds)
    .order('booking_date', { ascending: false })

  if (error) {
    throw new Error(`Error al consultar reservas: ${error.message}`)
  }

  return (data as unknown) as BookingWithDetails[]
}
```

---

### 7.3. Refactorización del Componente `BookingWizard` (Modular y Tipado)

```tsx
// ✅ src/components/booking/booking-wizard.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { cancelPendingBooking } from '@/app/actions/booking'
import type { BookingSummary } from '@/types/booking'

interface BookingWizardProps {
  readonly booking: BookingSummary
}

export function BookingWizard({ booking }: BookingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  // Liberación de reserva limpia mediante beacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        '/api/booking/cancel-pending',
        JSON.stringify({ bookingId: booking.id })
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [booking.id])

  const handleCancel = useCallback(async () => {
    setIsProcessing(true)
    const result = await cancelPendingBooking(booking.id)
    setIsProcessing(false)

    if (!result.success) {
      toast.add({
        type: 'error',
        title: 'Error al cancelar',
        description: result.error ?? 'No se pudo cancelar el turno pendiente.',
      })
      return
    }

    router.back()
  }, [booking.id, router])

  return (
    <Card className="max-w-xl mx-auto shadow-lg">
      <CardContent className="p-6 space-y-6">
        {/* Renderizado de pasos modulares */}
        <div className="flex justify-between items-center text-sm font-medium">
          <span className={step === 1 ? 'text-primary font-bold' : 'text-muted-foreground'}>
            1. Resumen del Turno
          </span>
          <span className={step === 2 ? 'text-primary font-bold' : 'text-muted-foreground'}>
            2. Confirmación y Seña
          </span>
        </div>

        {/* Sub-componentes según el paso */}
        <div className="flex gap-4 pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            {isProcessing ? 'Cancelando...' : 'Cancelar'}
          </Button>
          <Button
            className="w-full"
            onClick={() => setStep(2)}
            disabled={isProcessing}
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 8. Plan Integral de Remediación y Hoja de Ruta

```
===================================================================================
FASE 1: RESOLUCIÓN INMEDIATA DE BLOQUEOS (Día 1)
-----------------------------------------------------------------------------------
[ ] 1.1. Corregir error de lint en `src/components/booking/BookingWizard.tsx` (remover 'e').
[ ] 1.2. Corregir el bug crítico `booking_status` -> `status` en:
         - `src/components/dashboard/inbox/AdminChatThread.tsx:59`
         - `src/components/dashboard/bookings/BookingsClient.tsx:23,176,180`
[ ] 1.3. Unificar endpoint duplicado de cancelación en `/api/booking/cancel` y eliminar `/api/bookings/cancel`.
[ ] 1.4. Actualizar branding de "El Potrero" a "ReservaYa" en todos los archivos visuales y correos.

===================================================================================
FASE 2: MODELADO DE DOMINIO Y TIPADO ESTRICTO (Días 2-3)
-----------------------------------------------------------------------------------
[ ] 2.1. Crear directorio de dominio en `src/types/`:
         - `src/types/booking.ts`
         - `src/types/venue.ts`
         - `src/types/chat.ts`
         - `src/types/mercadopago.ts`
         - `src/types/review.ts`
[ ] 2.2. Eliminar todas las 66 instancias de `(supabase.from(...) as any)` mediante funciones
         de consulta tipadas en `src/lib/supabase/queries/`.
[ ] 2.3. Eliminar los castings dobles `as unknown as` en el Dashboard.
[ ] 2.4. Remover directivas `/* eslint-disable @typescript-eslint/no-explicit-any */` de los 38 archivos.

===================================================================================
FASE 3: MODULARIZACIÓN Y RENOMBRADO DE COMPONENTES (Días 4-5)
-----------------------------------------------------------------------------------
[ ] 3.1. Renombrar los 35+ componentes a `kebab-case.tsx` cumpliendo con AGENTS.md.
[ ] 3.2. Descomponer los 12 componentes que superan las 150 líneas extrayendo:
         - Custom hooks (`src/hooks/use-*.ts`)
         - Sub-componentes co-localizados
[ ] 3.3. Reemplazar todos los `alert()` nativos por `toast()` de shadcn/ui.
[ ] 3.4. Normalizar todos los imports relativos (`./...`) a `@/...`.
[ ] 3.5. Estructurar `src/lib/utils/` (`geo.ts`, `currency.ts`, `dates.ts`, `validators.ts`).

===================================================================================
FASE 4: INFRAESTRUCTURA DE TESTING Y VERIFICACIÓN CONTINUA (Día 6)
-----------------------------------------------------------------------------------
[ ] 4.1. Instalar Vitest y `@testing-library/react`.
[ ] 4.2. Añadir scripts en `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
[ ] 4.3. Implementar suite de pruebas unitarias para `src/lib/credits/manager.ts`, `src/lib/mercadopago/helpers.ts`.
[ ] 4.4. Activar verificación en pre-commit: `npm run type-check && npm run lint && npm run test`.
===================================================================================
```

---

## 9. Conclusión del Especialista

El proyecto ReservaYa posee una arquitectura base sólida sobre Next.js 14 App Router y Supabase, pero adolece de una **degradación acelerada en los estándares de calidad de código provocada por atajos de desarrollo ("MVP shortcuts") y el silenciamiento artificial de advertencias del compilador**. 

El impacto más crítico no es cosmético: ha introducido bugs reales en producción como la visualización errónea de reservas en el panel de complejos y el consumo indebido de créditos de jugadores. Siguiendo el plan de remediación en 4 fases aquí presentado, el proyecto alcanzará el nivel de robustez, mantenibilidad y calidad que exige una plataforma de misión crítica orientada a miles de transacciones deportivas en tiempo real.

