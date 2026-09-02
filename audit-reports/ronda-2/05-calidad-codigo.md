# Auditoría de Calidad de Código — Ronda 2

**Fecha:** 2026-09-01
**Commit base:** `a1f7e7f` (working tree sucio: 148 archivos modificados/borrados/sin trackear)
**Alcance:** `src/` (132 archivos `.ts`/`.tsx`, 13.080 líneas), `supabase/`, `test/`, configuración raíz.
**Modo:** solo lectura. No se modificó ni una línea de código, config ni tests.

---

## Resumen ejecutivo

El "strict mode" de este proyecto es **decorativo**. `npx tsc --noEmit` devuelve 0 errores, pero eso no es una propiedad del código: es el resultado de 105 directivas `@ts-expect-error` — casi todas con el mismo comentario copiado, `"fix inference"` — que ocultan **118 errores de tipo reales**. Lo medí: copié `src/` a un directorio aislado, removí las 105 directivas y volví a correr `tsc` (ver COD-01 para el procedimiento). El resultado no es un puñado de casos borde: son 44 `unknown` sin narrowing, 28 accesos a propiedades inexistentes, y **9 imports a módulos que no existen**.

Esos 9 imports rotos no son teoría. **`npm run build` falla.** El proyecto en su estado actual no compila y por lo tanto no se puede desplegar. Se hizo una migración de nombres `PascalCase` → `kebab-case` borrando y recreando archivos, se rompieron cuatro imports en el camino, y en lugar de arreglarlos se les puso `@ts-expect-error` encima. El error de compilación quedó tapado por la misma herramienta que debía detectarlo.

`npm run test` tampoco pasa: 3 de 26 tests fallan, y fallan porque `hoursUntilBooking()` produce `NaN` con el formato de hora que la base de datos realmente devuelve (`HH:MM:SS`). Eso significa que la política de cancelación y la ventana de reprogramación — dos reglas de negocio con consecuencias monetarias — están rotas en producción, y los tests lo estaban gritando.

`src/types/database.ts` está escrito a mano y le faltan 6 columnas que existen en las migraciones. `createAdminClient()` y `createPublicClient()` no están parametrizados con `<Database>`, así que todas las escrituras privilegiadas (webhook de Mercado Pago incluido) son `any`. Trece `as never` fuerzan updates que el tipo rechaza.

¿Es mantenible por alguien que no lo escribió? No. Un desarrollador nuevo que corra la secuencia de verificación que el propio `AGENTS.md` exige (`type-check` → `lint` → `test`) va a ver dos verdes y un rojo, y va a concluir que el problema es el test. La herramienta miente en dos de tres.

---

## Tablero de métricas reales

| Métrica | Valor | Comando exacto |
|:---|---:|:---|
| Errores `tsc --noEmit` (tal cual está) | **0** | `npx tsc --noEmit` (salida vacía, exit 0) |
| Errores `tsc --noEmit` (sin los 105 `@ts-expect-error`) | **118** | copia aislada de `src/` + `tsconfig.json`, script Python que borra las directivas, `npx tsc --noEmit -p tsconfig.json 2>&1 \| grep -cE 'error TS'` |
| **`npm run build`** | **FALLA (exit 1)** | `npm run build` → `Failed to compile` / 5 `Module not found` |
| Errores ESLint | **0** | `npm run lint` → `✔ No ESLint warnings or errors` |
| Warnings ESLint | **0** | idem (con 51 líneas `eslint-disable` en el código) |
| Tests | **3 fallan / 23 pasan (26 total, 5 archivos)** | `npm run test` → `Test Files 1 failed \| 4 passed (5)` `Tests 3 failed \| 23 passed (26)`, exit 1 |
| Tests de integración | **0 archivos** (directorio `test/integration/` vacío) | `ls -R test` |
| `any` explícitos | **8** (5 en `src`, 3 en `supabase/functions`) | `rg -n ':\s*any\b\|as any\|<any>\|any\[\]\|Array<any>\|Record<string,\s*any>\|Promise<any>' src supabase test` |
| `@ts-expect-error` | **105** en 34 archivos | `rg -c '@ts-expect-error' src supabase test \| awk -F: '{s+=$2} END{print s}'` |
| `@ts-ignore` | **0** | `rg -c '@ts-ignore' src supabase test` |
| `as unknown as` | **14** | `rg -n 'as unknown as' src supabase test` |
| `as never` | **13** | `rg -n 'as never' src \| wc -l` |
| `eslint-disable` (líneas) | **51** | `rg -c 'eslint-disable' src supabase test \| awk -F: '{s+=$2} END{print s}'` |
| Non-null assertions (`!`) | **10** | `rg -n --glob '*.ts' --glob '*.tsx' '[A-Za-z0-9_)\]]!\s*[.[),;:]' src \| grep -v '!=='` |
| `catch` (total) | **43** | `rg -c 'catch\s*[({]' src \| awk -F: '{s+=$2} END{print s}'` |
| `catch` que se tragan el error (sin re-lanzar ni loguear útilmente) | **4** | ver COD-08 |
| `.catch(console.error)` sobre operación crítica | **3** | `rg -n '\.catch\(console\.error\)\|\.catch\(e => console\.error' src` |
| `console.log` en producción | **5** | `rg -n 'console\.log' src` |
| Componentes `.tsx` > 150 líneas | **21 de 94** (22%) | `find src -name '*.tsx' -exec wc -l {} + \| sort -rn \| awk '$1>150'` |
| Archivos `.ts` > 150 líneas | **4** | `find src -name '*.ts' -exec wc -l {} + \| sort -rn \| awk '$1>150'` |
| Archivos que violan el naming | **2** | `src/hooks/useUser.ts`, `src/hooks/useGeolocation.ts` |
| Imports relativos (`../`) | **0** ✅ | `rg -c "from ['\"]\.\./" src` → 0 |
| Archivos huérfanos (0 consumidores) | **8** | ver COD-09 |
| Deps de runtime sin un solo import | **4** | ver COD-11 |
| Basura versionada en git | **0** ✅ | `git ls-files \| grep -E 'fix_stats.py\|^scratch/\|^scrape-test/\|tsbuildinfo\|DS_Store'` → vacío |
| Type-imports inline `import("@/types/…")` | **68** en 26 archivos | `rg -c 'import\("@/types/' src` |

---

## Convención declarada (`AGENTS.md`) vs. Realidad

| Convención | Cumple | Violaciones | Ejemplo |
|:---|:---:|---:|:---|
| Strict mode, **cero `any`** | **No** | 8 `any` + 105 `@ts-expect-error` que tapan 118 errores | `src/components/venue/availability-grid.tsx:28` `useState<any[]>([])` |
| Usar `unknown` + type guards | **Parcial** | Se declara `unknown` y después se accede sin guard, tapado con `@ts-expect-error` | `src/app/api/webhooks/mercadopago/route.ts:93-96` |
| `interface` para objetos, `type` para uniones | **Parcial** | 54 `interface` ✅, 2 `type X = {…}` | `src/app/(main)/page.tsx:16` `type PromoQueryType = {` |
| Archivos componente en `kebab-case.tsx` | **Sí** | 0 (migración completada en disco) | — |
| Archivos utilidad en `camelCase.ts` | **Parcial** | Convención ambigua: `src/lib/utils/dates.ts` es minúscula, `src/hooks/useUser.ts` es camelCase | — |
| Componente `PascalCase` = stem del archivo | **Sí** | 0 | `venue-card.tsx` → `VenueCard` ✅ |
| Hooks con prefijo `useCamelCase` | **Sí** (en disco) / **No** (en imports) | 2 imports a `@/hooks/use-user`, archivo real `useUser.ts` | `src/app/(auth)/login/page.tsx:7` |
| Constantes `UPPER_SNAKE_CASE` | **Sí** | 0 | `src/lib/utils/dates.ts:2` `export const TZ` |
| Columnas DB en `snake_case` | **Sí** | 0 | — |
| Imports con alias `@/` | **Sí** | 0 imports relativos con `../` | — |
| Orden de imports React→libs→lib→components→hooks→types→rel. | **Parcial** | Roto por los `// @ts-expect-error` intercalados y por 68 `import("@/types/…")` inline en lugar de un import arriba | `src/app/(auth)/login/page.tsx:1-13` (`Link` antes de `useEffect`, `Suspense` importado en línea 13 después de todo) |
| Named exports preferidos sobre default | **Parcial** | 3 default fuera de páginas | `src/components/home/hero-3d.tsx:16`, `src/components/map/venue-map-client.tsx:77`, `src/components/dashboard/venue/location-picker-map.tsx:61` |
| **Componentes < 150 líneas** | **No** | **21 de 94** (22%) | `src/components/chat/player-chat-modal.tsx` (363) |
| Early returns para guard clauses | **Sí** | Bien aplicado | `src/lib/booking/actions.ts:10,18,24` |
| **Nunca tragar errores en silencio** | **No** | 4 catch mudos + 3 `.catch(console.error)` sobre pagos/notificaciones | `src/components/booking/cancel-dialog.tsx:60-61` |
| Chequear `@/components/ui/` antes de crear primitivos | **No** | Se importan 2 primitivos que **nunca se crearon** | `src/components/search/advanced-filters-sheet.tsx:5,8` (`ui/switch`, `ui/slider` no existen) |
| Verification loop: type-check + lint + test en verde | **No** | `test` falla, `build` falla | ver COD-02, COD-03 |

### Componentes > 150 líneas (ordenados)

```
363 src/components/chat/player-chat-modal.tsx
283 src/components/dashboard/bookings/bookings-client.tsx
280 src/app/(main)/venue/[id]/page.tsx
280 src/app/(main)/page.tsx
275 src/components/search/search-filters.tsx
268 src/components/ui/dropdown-menu.tsx        (shadcn vendored)
247 src/components/booking/booking-wizard.tsx
240 src/components/dashboard/inbox/admin-chat-thread.tsx
234 src/components/ui/toast.tsx                (shadcn vendored)
222 src/components/dashboard/venue/venue-photos-form.tsx
221 src/components/venue/review-section.tsx
221 src/components/ui/calendar.tsx             (shadcn vendored)
201 src/components/ui/select.tsx               (shadcn vendored)
190 src/components/dashboard/venue/venue-forms.tsx
189 src/components/venue/availability-grid.tsx
181 src/app/(main)/bookings/page.tsx
177 src/components/dashboard/courts/offers-modal.tsx
173 src/components/layout/header.tsx
166 src/app/(main)/profile/page.tsx
162 src/components/map/venue-map-client.tsx
160 src/components/ui/dialog.tsx               (shadcn vendored)
```
Descontando los 6 primitivos de shadcn (vendored, no cuentan): **15 componentes propios** violan el límite.

---

## Tabla de hallazgos

| ID | Severidad | Título | Ubicación principal |
|:---|:---|:---|:---|
| COD-01 | **Crítica** | 105 `@ts-expect-error` ocultan 118 errores de tipo reales; el strict mode es decorativo | 34 archivos |
| COD-02 | **Crítica** | `npm run build` falla: 5 módulos no encontrados por una migración de nombres a medias | `src/app/(auth)/login/page.tsx:7` + 4 |
| COD-03 | **Crítica** | `hoursUntilBooking()` devuelve `NaN` con el formato real de la DB → política de cancelación y reprogramación rotas | `src/lib/utils/dates.ts:60` |
| COD-04 | **Crítica** | El webhook de MP escribe `updated_at`, columna que no existe en `bookings` | `src/app/api/webhooks/mercadopago/route.ts:62` |
| COD-05 | **Alta** | Clientes Supabase sin parametrizar `<Database>`: todas las escrituras privilegiadas son `any` | `src/lib/supabase/server.ts:38`, `public.ts:4` |
| COD-06 | **Alta** | `src/types/database.ts` a mano: 6 columnas faltantes, 2 nullability erróneas, 0 funciones RPC | `src/types/database.ts` |
| COD-07 | **Alta** | Bug de precedencia de operadores en 3 modales, enmascarado por `@ts-expect-error` (TS2358) | `src/components/dashboard/courts/pricing-modal.tsx:21` + 2 |
| COD-08 | **Alta** | Manejo de errores: 4 catch mudos, 3 `.catch(console.error)` sobre pagos, y un `catch` que puede volver a lanzar | `src/app/api/webhooks/mercadopago/route.ts:93-96` |
| COD-09 | **Alta** | Cero tests sobre server actions, rutas de API, webhook o flujo de reserva | `test/`, `src/**/*.test.ts` |
| COD-10 | **Media** | Cuatro implementaciones divergentes del cálculo de seña / ventana de cancelación | 6 ubicaciones |
| COD-11 | **Media** | Código muerto: 8 archivos huérfanos, `rescheduleBooking()` sin llamador, ruta `/mock-payment` borrada pero referenciada | `src/lib/supabase/queries.ts` + 7 |
| COD-12 | **Media** | 4 dependencias de runtime sin un solo import | `package.json` |
| COD-13 | **Media** | `credits-list.tsx` calcula el saldo con un criterio distinto al del backend | `src/components/profile/credits-list.tsx:19-28` |
| COD-14 | **Baja** | `eslint-disable` de reglas JSX en archivos `.ts` sin JSX (cargo cult) | 7 archivos |
| COD-15 | **Baja** | 15 componentes propios > 150 líneas | ver tabla arriba |

---

## Detalle por hallazgo

### COD-01 — Crítica — 105 `@ts-expect-error` ocultan 118 errores de tipo reales

**Ubicación:** 34 archivos. Los peores:

```
src/app/(main)/search/page.tsx                        17
src/app/(main)/venue/[id]/page.tsx                     9
src/lib/notifications/index.ts                         6
src/lib/booking/actions.ts                             6
src/components/search/advanced-filters-sheet.tsx       6
src/components/dashboard/inbox/admin-chat-thread.tsx   5
src/app/dashboard/schedule/page.tsx                    5
src/app/dashboard/courts/actions.ts                    5
```

**Fragmento** — `src/app/(main)/search/page.tsx:100-125` (17 directivas en un archivo, todas con el mismo comentario):

```tsx
      // @ts-expect-error fix inference
      ...
          // @ts-expect-error fix inference
          // @ts-expect-error fix inference
          // @ts-expect-error fix inference
```

**Procedimiento de medición** (no modifiqué el repo): copié `src/`, `tsconfig.json` y `next-env.d.ts` a un directorio aislado en scratchpad, enlacé `node_modules`, removí programáticamente las 105 líneas `@ts-expect-error` (comentarios `//` y bloques `{/* */}` en JSX) y corrí `npx tsc --noEmit -p tsconfig.json`.

**Resultado real — 118 errores, por código:**

| Código | Cantidad | Significado |
|:---|---:|:---|
| TS18046 | 44 | `'x' is of type 'unknown'` |
| TS2339 | 28 | Propiedad no existe en el tipo |
| TS2345 | 14 | Argumento no asignable |
| **TS2307** | **9** | **Cannot find module** ← esto es COD-02 |
| TS2571 | 7 | Object is of type 'unknown' |
| TS2322 | 5 | Type no asignable |
| TS7006 | 3 | Parámetro con `any` implícito |
| TS2358 | 3 | LHS de `instanceof` inválido ← esto es COD-07 |
| TS2353 | 2 | Propiedad desconocida en literal |
| TS18048 | 2 | Posiblemente `undefined` |
| TS2719 | 1 | Dos tipos con el mismo nombre, no relacionados |

**Por qué importa:** el comentario `"fix inference"` es una mentira en 118 casos. `@ts-expect-error` no arregla inferencia: le dice al compilador "acá hay un error, callate". Es el mecanismo más agresivo de TypeScript — suprime *cualquier* error en la línea siguiente, incluso uno que aparezca meses después. Los 3 `any` implícitos (TS7006) y los 9 módulos inexistentes (TS2307) no tienen absolutamente nada que ver con "inferencia": son código roto. La secuencia de verificación del `AGENTS.md` (`npm run type-check` → cero errores) da verde sobre un árbol que no compila.

**Remediación (no aplicada):** ninguna directiva `@ts-expect-error` debería sobrevivir sin una descripción concreta del error suprimido y un link al issue que lo destraba. Concretamente: los 9 TS2307 se arreglan corrigiendo el import (COD-02); los 44 TS18046 y 7 TS2571 se arreglan con un helper `getErrorMessage(e: unknown): string` en `src/lib/utils/` usado en cada `catch`; los 28 TS2339 desaparecen casi todos al tipar los clientes Supabase (COD-05) y completar `database.ts` (COD-06). Después de eso, agregar la regla `@typescript-eslint/ban-ts-comment` con `ts-expect-error: 'allow-with-description'` para que no vuelvan.

---

### COD-02 — Crítica — `npm run build` falla

**Salida real de `npm run build`** (exit 1):

```
   Creating an optimized production build ...
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

**Fragmento** — `src/app/(auth)/login/page.tsx:6-7`:

```tsx
// @ts-expect-error fix inference
import { useUser } from "@/hooks/use-user"
```

El archivo real es `src/hooks/useUser.ts`. `use-user` no existe bajo ninguna capitalización (el guion no es una diferencia de caso). Idéntico en `src/app/(main)/profile/page.tsx:5-6`.

Los otros tres son restos de la migración `PascalCase` → `kebab-case`: el `git status` muestra 40 archivos borrados en PascalCase y sus reemplazos kebab-case sin trackear. La migración se hizo borrando y recreando (no `git mv`), y cuatro imports se quedaron apuntando al nombre viejo:

| Import roto | Archivo real |
|:---|:---|
| `@/components/dashboard/bookings/BookingActions` (`bookings-client.tsx:6`) | `booking-actions.tsx` |
| `@/components/map/VenueMap` (`search-layout.tsx:6`) | `venue-map.tsx` |
| `@/components/search/VenueList` (`venue-map.tsx:2`, `venue-map-client.tsx:8`) | `venue-list.tsx` |
| `@/components/venue/VenueCard` (`venue-list.tsx:3`) | `venue-card.tsx` |

Y dos primitivos que jamás existieron — `src/components/search/advanced-filters-sheet.tsx:4-8`:

```tsx
// @ts-expect-error fix inference
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
// @ts-expect-error fix inference
import { Slider } from "@/components/ui/slider"
```

`ls src/components/ui/` no contiene ni `switch.tsx` ni `slider.tsx`. Esto es exactamente la convención de `AGENTS.md` "Always check `@/components/ui/` for existing shadcn/ui primitives before creating new base components" invertida: se importó sin chequear y sin crear.

**Por qué importa:** el proyecto **no se despliega**. Nadie corrió `npm run build` antes de dar el trabajo por terminado, porque `type-check` y `lint` daban verde. Los 9 TS2307 eran la señal, y estaban silenciados uno por uno con `@ts-expect-error`. El caso de `advanced-filters-sheet.tsx` no rompe el build únicamente porque el archivo es huérfano (nadie lo importa — COD-11); si alguien lo enchufa, suma dos errores más.

**Remediación (no aplicada):** corregir los 4 imports a los nombres kebab-case reales; decidir el nombre canónico del hook (`useUser.ts` o `use-user.ts`) y unificar `AGENTS.md` con la realidad; crear o eliminar `ui/switch` y `ui/slider`. Sumar `npm run build` a la secuencia de verificación del `AGENTS.md` — sin eso, `type-check` seguirá siendo una garantía falsa.

---

### COD-03 — Crítica — `hoursUntilBooking()` devuelve `NaN` con el formato que la DB realmente entrega

**Ubicación:** `src/lib/utils/dates.ts:59-63`

```ts
export function hoursUntilBooking(bookingDate: string, startTime: string): number {
  const bookingDateTime = new Date(`${bookingDate}T${startTime}:00-03:00`)
  const now = new Date()
  return (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
}
```

La función asume `startTime` en formato `HH:MM` y le concatena `:00` para los segundos. Pero la columna es `start_time TIME NOT NULL` (`supabase/migrations/001_initial_schema.sql:71`) y PostgREST serializa `TIME` como **`"HH:MM:SS"`**. Con el dato real la plantilla produce `2024-10-10T11:30:00:00-03:00` → `Invalid Date` → `NaN`.

**Evidencia — `npm run test` (exit 1):**

```
 ❯ src/lib/credits/manager.test.ts (5 tests | 3 failed)
   × should not allow cancellation with less than 1 hour notice
   × should give full credit (deposit 30%) with more than 6 hours notice
   × should allow reschedule with more than 2 hours notice

 Test Files  1 failed | 4 passed (5)
      Tests  3 failed | 23 passed (26)
```

Los tres fallos son el mismo `NaN`. `src/lib/credits/manager.test.ts:19` usa `start_time: "11:30:00"` — el formato correcto — y por eso rompe. Consecuencia real en `src/lib/credits/manager.ts:5-46`:

- `if (diffHours <= 1)` → `NaN <= 1` es `false` → **nunca bloquea la cancelación tardía**.
- `if (diffHours >= 6)` → `NaN >= 6` es `false` → **nunca otorga crédito**.
- Cae siempre en el `return` final: `refundType: 'forfeit'`, `creditAmount: 0`.

Y en `canReschedule` (`manager.ts:52`): `NaN >= 2` es `false` → **nadie puede reprogramar nunca**.

En el cliente, `src/components/booking/cancel-dialog.tsx:31`: `const canCancel = diffHours > 1` → `NaN > 1` es `false` → el diálogo de cancelación muestra permanentemente el estado "no podés cancelar".

**Por qué los tests de la propia utilidad pasan** — `src/lib/utils/dates.test.ts:62,67`:

```ts
const hours = hoursUntilBooking('2020-01-01', '09:00')   // HH:MM, no HH:MM:SS
const hours = hoursUntilBooking('2099-12-31', '23:00')
```

Las fixtures alimentan un formato que la base de datos nunca produce. El mismo supuesto está grabado en `src/lib/utils/validators.ts:9-11`: `TimeSchema = z.string().regex(/^\d{2}:\d{2}$/)`. Todo el código asume `HH:MM`; Postgres devuelve `HH:MM:SS`.

**Por qué importa:** esto es plata. Un usuario que cancela con 8 horas de anticipación pierde la seña en lugar de recibir crédito (regla de negocio de `AGENTS.md`: "Cancellation > 6h: User receives platform credit"). Un usuario que cancela 20 minutos antes del partido puede hacerlo, cuando la regla lo prohíbe. Y la reprogramación está muerta para todos. Ningún `try/catch` lo detecta porque `NaN` no lanza: se propaga silenciosamente a través de tres comparaciones y sale por el `return` de default.

**Remediación (no aplicada):** normalizar `startTime` dentro de la función (recortar a `HH:MM` o detectar si ya trae segundos) y — no negociable — agregar una guarda: si `Number.isNaN(bookingDateTime.getTime())`, lanzar en lugar de devolver `NaN`. Alinear `TimeSchema` en `validators.ts` con el formato real de la DB. Agregar la fixture `"HH:MM:SS"` a `dates.test.ts` para que la regresión quede cubierta donde vive el bug, no solo aguas abajo.

---

### COD-04 — Crítica — El webhook escribe una columna que no existe

**Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:58-66`

```ts
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

La tabla `bookings` **no tiene columna `updated_at`**. `supabase/migrations/001_initial_schema.sql:66-83` define: `id, user_id, court_id, booking_date, start_time, end_time, total_price, deposit_amount, deposit_method, payment_status, booking_status, source, mp_payment_id, created_at, cancelled_at`. Ninguna de las migraciones 002-020 la agrega:

```
$ rg -n 'updated_at' supabase/migrations/
001_initial_schema.sql:15   → profiles
001_initial_schema.sql:36   → venues
009_chat_schema.sql:11      → conversations
```

Tampoco hay trigger `handle_updated_at_bookings` (001:173-179 solo crea los de `profiles` y `venues`).

**Por qué importa:** PostgREST rechaza un `UPDATE` con una columna inexistente (`PGRST204`). La rama `if (error) { … throw error }` de la línea 68 se dispara, el `catch` general devuelve 500, y **Mercado Pago nunca recibe el 200**: la reserva queda en `pending`, el usuario pagó y su cancha no se confirma. MP reintenta y falla igual. Peor: el job `delete_abandoned_bookings` (`supabase/migrations/012`, `016`, `019`) borra las reservas `pending` a los pocos minutos — el usuario paga y su reserva se evapora.

TypeScript no lo detecta porque `createAdminClient()` devuelve un cliente sin tipar (COD-05). Si estuviera parametrizado con `<Database>`, `updated_at` sería un error de compilación en el literal del `.update()`.

`[NO CONFIRMADO]` No tengo acceso a la base real; es posible que se haya agregado `updated_at` a `bookings` manualmente desde el panel de Supabase sin migración. Si así fuera, el hallazgo se convierte en uno de deriva de esquema: la carpeta `migrations/` deja de describir la base, que es igual de grave para cualquiera que reconstruya el entorno.

**Remediación (no aplicada):** o se agrega `updated_at` a `bookings` con su migración y su trigger, o se quita esa línea del `.update()`. Y tipar `createAdminClient()` para que el compilador atrape el próximo.

---

### COD-05 — Alta — Clientes Supabase sin parametrizar: todas las escrituras privilegiadas son `any`

**Ubicación:** `src/lib/supabase/server.ts:33-48` y `src/lib/supabase/public.ts:1-8`

```ts
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.')
  }

  return createSupabaseClient(          // ← sin <Database>
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    …
```

```ts
export function createPublicClient() {
  return createClient(                  // ← sin <Database>
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Contraste con los dos que **sí** están bien: `src/lib/supabase/client.ts:5` (`createBrowserClient<Database>`) y `src/lib/supabase/server.ts:9` (`createServerClient<Database>`).

**Por qué importa:** sin el parámetro genérico, `supabase-js` cae al default `SupabaseClient<any, "public", any>`. Todo lo que sale de `.from().select()` es `any`, y todo lo que entra por `.insert()`/`.update()` se acepta sin verificar. `createAdminClient()` es precisamente el cliente que hace las escrituras que saltean RLS:

- `src/app/api/webhooks/mercadopago/route.ts:51` — confirmación de pagos (y por eso COD-04 pasó desapercibido).
- `src/lib/credits/manager.ts:60,108,166` — creación, bloqueo y consumo de créditos.
- `src/lib/booking/actions.ts:61` — reprogramación saltando el trigger de protección.

Es decir: el único código del proyecto que puede escribir sin restricciones es también el único que no tiene chequeo de tipos. El efecto es contaminante — el `any` se propaga por todo el árbol de llamadas, y de ahí salen buena parte de los 28 TS2339 y 44 TS18046 del COD-01.

El síntoma complementario está en los **13 `as never`**, que son el reverso exacto: en el cliente *tipado*, cuando el tipo no coincide con la realidad, se lo fuerza con el tipo bottom:

```
src/lib/credits/manager.ts:137   .update({ amount: remainingToApply, locked_for_booking_id: bookingId } as never)
src/lib/credits/manager.ts:155   .update({ locked_for_booking_id: bookingId } as never)
src/lib/credits/manager.ts:170   .update({ status: 'used', locked_for_booking_id: null } as never)
src/lib/booking/actions.ts:99    } as never)
src/app/actions/chat.ts:38,102,119,121
src/app/dashboard/venue/actions.ts:61,92
src/app/dashboard/bookings/actions.ts:13,30
src/app/api/booking/create-preference/route.ts:96
```

`as never` sobre un payload de `.update()` desactiva por completo la verificación de ese objeto: cualquier nombre de columna, cualquier tipo de valor. Es un `any` con peor reputación.

**Remediación (no aplicada):** parametrizar ambos con `<Database>`. Los `as never` van a empezar a fallar — y eso es el punto: cada uno señala una columna que falta en `database.ts` (COD-06). Una vez completado el tipo, se eliminan todos.

---

### COD-06 — Alta — `src/types/database.ts` está escrito a mano y no refleja las migraciones

**¿Generado o a mano?** A mano, sin ninguna duda. Un `supabase gen types typescript` produce siempre las claves `Views`, `Functions`, `Enums` y `CompositeTypes` dentro de `public`, un encabezado de versión, y alias `Tables<>`/`TablesInsert<>`. Este archivo (445 líneas) tiene solo `public.Tables` (`src/types/database.ts:9-11`), y en `Relationships` marca `isOneToOne: true` en claves foráneas que son claramente muchos-a-uno (`bookings_court_id_fkey` en `:202`, `courts_venue_id_fkey` en `:113`) — un generador nunca escribiría eso.

**Divergencias campo por campo contra `supabase/migrations/`:**

| Tabla | Divergencia | Migración | En `database.ts` |
|:---|:---|:---|:---|
| `bookings` | Falta `reminder_sent boolean DEFAULT false` | `003_add_reminder_sent.sql:2` | ausente |
| `bookings` | Falta `manual_client_name TEXT` | `005_add_manual_client_name.sql:2` | ausente |
| `bookings` | Falta `is_rescheduled BOOLEAN NOT NULL DEFAULT false` | `017_reschedule_loophole.sql:3` | ausente |
| `bookings` | `deposit_amount: number` — la DB lo hizo **nullable** | `004:10` `ALTER COLUMN deposit_amount DROP NOT NULL` | `:221` no nullable |
| `bookings` | `deposit_method: 'mercadopago'\|'transfer'\|'cash'` — la DB lo hizo **nullable** | `004:11` `DROP NOT NULL` | `:222` no nullable |
| `credits` | Falta `venue_id UUID NOT NULL` | `006:2,16` | ausente |
| `credits` | Falta `used_at TIMESTAMPTZ` | `004:14` | ausente |
| `credits` | Falta `locked_for_booking_id UUID` | `019:3` | ausente |
| `venues` | Falta `require_deposit BOOLEAN NOT NULL DEFAULT TRUE` | `007:3` | ausente |
| `venues` | Falta `deposit_percentage INTEGER NOT NULL DEFAULT 30` | `007:4` | ausente |
| `messages` | Falta `image_url TEXT` | `010:2` | ausente |
| — | **No existe la clave `Functions`** → 3 RPC sin tipar | `002` (`is_platform_admin`), `012`/`016`/`019` (`delete_abandoned_bookings`), `020` (`get_venue_availability`) | ausente |

**Los usos concretos que esto rompe:**

1. **`deposit_amount` declarado no-nullable pero nullable en la DB** — `src/lib/credits/manager.ts:31`:
   ```ts
   const depositAmount = booking.deposit_amount || 0;
   ```
   Alguien ya se topó con el `null` y puso un `|| 0` defensivo. Pero el tipo sigue mintiendo, así que el próximo consumidor no va a saberlo: `src/app/(main)/booking/[courtId]/success/page.tsx:93` hace aritmética directa sobre campos de booking sin ninguna guarda. Una nullability mal declarada en strict mode es un `TypeError` esperando su turno, y este es el turno.

2. **`credits.locked_for_booking_id` inexistente en el tipo** — obliga a los tres `as never` de `manager.ts:137,155,170`. Es la deuda de tipos convertida en deuda de seguridad: esos updates manejan el bloqueo de créditos, y nadie verifica que el payload sea correcto.

3. **`venues.require_deposit` / `deposit_percentage`** — parcheados a mano en `src/types/domain.ts:5-8`:
   ```ts
   export interface Venue extends VenueRow {
     require_deposit?: boolean
     deposit_percentage?: number
   }
   ```
   Declarados **opcionales** cuando en la DB son `NOT NULL DEFAULT`. Siempre vienen. El resultado es que todo consumidor tiene que inventar un default, y lo inventa distinto cada vez: `?? 30` en `booking/[courtId]/page.tsx:103` y `create-preference/route.ts:56`, `|| 30` en `success/page.tsx:93`, `?? 30` en `venue-forms.tsx:174`, `|| 30` en `dashboard/venue/actions.ts:78`, y `venue.require_deposit !== undefined ? … : …` en `venue-card.tsx:70`. Seis defaults duplicados por un `?` de más.

4. **Sin `Functions`** — `src/components/venue/availability-grid.tsx:41`:
   ```tsx
   // @ts-expect-error rpc not in types yet
   .rpc("get_venue_availability", { p_venue_id: venueId, p_date: dateStr })
   ```
   Al menos este comentario es honesto. Los otros 104 dicen "fix inference".

**Remediación (no aplicada):** generar el archivo con `npx supabase gen types typescript --local > src/types/database.ts` y agregar ese comando a un check de CI que falle si el archivo generado difiere del versionado. Mientras tanto, `domain.ts` no debería parchear con propiedades opcionales lo que la DB declara `NOT NULL`.

---

### COD-07 — Alta — Bug de precedencia de operadores en tres modales, enmascarado por `@ts-expect-error`

**Ubicación:** `src/components/dashboard/courts/pricing-modal.tsx:19-21`

```tsx
    } catch (error: unknown) {
      // @ts-expect-error fix inference
      alert("Error: " + error instanceof Error ? error.message : "Desconocido")
```

Idéntico en `src/components/dashboard/courts/court-form-modal.tsx:19-21` y `src/components/dashboard/schedule/manual-booking-modal.tsx:26-28`.

**El bug:** `+` tiene mayor precedencia que `instanceof`. La expresión se agrupa como:

```ts
(("Error: " + error) instanceof Error) ? error.message : "Desconocido"
```

`("Error: " + error)` es un `string`. Un `string` primitivo **nunca** es `instanceof Error`. La condición es constante `false`, así que el `alert` muestra siempre `"Desconocido"` — el prefijo `"Error: "` incluido se descarta, porque el ternario se comió toda la expresión.

**Esto es exactamente lo que TypeScript estaba reportando** (de los 118 del COD-01):

```
src/components/dashboard/courts/court-form-modal.tsx(20,13): error TS2358: The left-hand side of an 'instanceof' expression must be of type 'any', an object type or a type parameter.
src/components/dashboard/courts/pricing-modal.tsx(20,13):   error TS2358: …
src/components/dashboard/schedule/manual-booking-modal.tsx(27,13): error TS2358: …
```

El compilador detectó el bug de precedencia con precisión quirúrgica, y alguien le puso `@ts-expect-error fix inference` encima en los tres archivos.

**Por qué importa:** el admin de un complejo que no puede guardar una regla de precio, un formulario de cancha, o una reserva manual, recibe la palabra "Desconocido" y nada más. El mensaje real del error — permiso de RLS, violación de constraint, campo faltante — se descarta en el punto exacto donde iba a ser útil. Es imposible dar soporte a un usuario en esa situación.

La versión correcta existe en el mismo repo, a dos archivos de distancia — `src/components/dashboard/bookings/booking-actions.tsx:18`:

```tsx
      alert("Error: " + (error instanceof Error ? error.message : "Desconocido"))
```

Los paréntesis. Se copió el patrón tres veces y se perdieron.

**Remediación (no aplicada):** poner los paréntesis, borrar los tres `@ts-expect-error`. Y extraer el patrón a un `getErrorMessage(e: unknown): string` en `src/lib/utils/`, que además cubre los 44 TS18046 del COD-01 y los `e.message` sobre `unknown` de `player-chat-modal.tsx:198,222` y `admin-chat-thread.tsx:174,198`.

---

### COD-08 — Alta — Manejo de errores: catch mudos y errores tragados en el camino del pago

Clasificación de los 43 `catch` de `src/`:

| Categoría | Cantidad | Veredicto |
|:---|---:|:---|
| Loguean con `console.error` (sin re-lanzar) | 18 | aceptable en notificaciones, discutible en el resto |
| Muestran al usuario vía `toast` con el mensaje real | 9 | ✅ correcto |
| Muestran `alert` con mensaje genérico "Desconocido" | 7 | 3 de ellos rotos (COD-07) |
| Re-lanzan | 2 | ✅ correcto |
| **Mudos / tragados** | **4** | ✗ |
| Silencio intencional y documentado | 1 | ✅ (`server.ts:22`, comentado y justificado) |

**Los 4 mudos:**

`src/components/booking/cancel-dialog.tsx:60-61` — el peor:
```tsx
    } catch (error) {
      alert('Error de conexión')
    } finally {
```
La variable `error` se captura y se descarta. El usuario está cancelando una reserva con dinero de por medio; si algo falla, no queda registro en ningún lado. Y el `eslint-disable @typescript-eslint/no-unused-vars` de la línea 1 del archivo es lo que impide que ESLint reporte la variable sin usar.

`src/app/(auth)/login/page.tsx:43-45` y `:53-55` — `catch { setErrorMsg(...) }`, sin `console.error`. Un fallo de OAuth se convierte en un texto genérico y nada más. En un flujo de login, eso es indepurable.

`src/app/(main)/profile/page.tsx:64-67` — `catch { toast.add({ type: "error", … }) }`, mismo patrón.

**Los 3 `.catch(console.error)` sobre operaciones que importan:**

`src/app/api/webhooks/mercadopago/route.ts:76`:
```ts
        await consumeLockedCredits(bookingId).catch(console.error)
```
Si el consumo de créditos bloqueados falla, el webhook sigue y devuelve 200. Los créditos quedan bloqueados (`locked_for_booking_id` seteado, `status: 'available'`) para siempre: el usuario no los puede usar y nadie los libera. `AGENTS.md` dice "Never swallow errors silently"; esto es un error de contabilidad tragado con un log.

`src/app/api/webhooks/mercadopago/route.ts:85` y `src/app/actions/chat.ts:69` — mismo patrón sobre notificaciones. Ahí es defendible (no querés fallar un pago por un email), pero merece al menos una métrica, no un `console.error` en logs de Vercel.

**El `catch` que puede volver a lanzar** — `src/app/api/webhooks/mercadopago/route.ts:93-96`:
```ts
  } catch (error: unknown) {
    console.error('Webhook processing error:', error)
    // @ts-expect-error fix inference
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
```

Este es el `@ts-expect-error` que había que analizar. **Lo que tapa realmente:**
```
src/app/api/webhooks/mercadopago/route.ts(95,39): error TS18046: 'error' is of type 'unknown'.
```
Y lo que eso significa en runtime: el `try` de este handler abarca `payment.get({ id })` del SDK de Mercado Pago (línea 41), un `throw` propio (línea 47), y `throw error` con un objeto de error de PostgREST (línea 70). Ninguno de esos garantiza ser un `Error`:

- El error de PostgREST es un objeto plano `{ message, details, hint, code }` — `.message` existe, funciona por casualidad.
- El SDK de MP puede rechazar con un objeto de respuesta HTTP sin `.message` → el body sale `{"error": undefined}` → `{}`.
- Si algo lanza `null` o `undefined` (un `Promise.reject()` sin argumento en una dependencia), `error.message` lanza `TypeError: Cannot read properties of null` **dentro del catch**. Sin handler exterior, la función se cae y Next devuelve un 500 opaco: se pierden el `console.error` de la línea 94 y toda posibilidad de diagnóstico sobre un pago.

Además: el mensaje crudo del error se devuelve en el body de la respuesta HTTP. Ese endpoint lo consume Mercado Pago, pero es público — un mensaje de PostgREST puede filtrar nombres de columnas y detalles del esquema.

Nada de esto es "inferencia". Es un `unknown` que necesita un narrowing, y la directiva lo convirtió en un punto ciego en el camino crítico del cobro.

**Remediación (no aplicada):** `getErrorMessage(e: unknown)` con `e instanceof Error ? e.message : String(e)`; no devolver el mensaje crudo al cliente en el 500 (loguear completo, responder genérico); y para el `consumeLockedCredits`, o se maneja el fallo o se documenta por qué se ignora.

---

### COD-09 — Alta — Cero tests sobre lógica crítica

**Salida real de `npm run test`:** 5 archivos, 26 tests, 3 fallando.

| Archivo | Tests | Qué cubre |
|:---|---:|:---|
| `src/lib/utils.test.ts` | 4 | `cn()` — helper de Tailwind |
| `src/lib/utils/currency.test.ts` | 8 | `formatPrice`, `calculateDeposit`, `formatDepositLabel` |
| `src/lib/utils/dates.test.ts` | 9 | formateo de fechas y horas |
| `src/lib/notifications/templates.test.ts` | ~0-1 | plantillas de email |
| `src/lib/credits/manager.test.ts` | 5 (**3 fallan**) | política de cancelación y reprogramación |

**Lo que no tiene un solo test:**

- Las 6 server actions (`src/app/dashboard/{venue,bookings,schedule,courts}/actions.ts`, `src/app/actions/{booking,chat}.ts`): **0**
- Las 3 rutas de API (`api/booking/cancel`, `api/booking/create-preference`, `api/webhooks/mercadopago`): **0**
- El webhook de Mercado Pago — verificación de firma, idempotencia, confirmación de pago: **0**
- `verifyWebhookSignature` (`src/lib/mercadopago/helpers.ts:14`), criptografía en el borde de seguridad: **0**
- El flujo de reserva end-to-end: **0**
- `applyCredits` / `consumeLockedCredits` — partición y bloqueo de créditos, `src/lib/credits/manager.ts:106-172`: **0**
- Cualquier componente React: **0** (hay `@testing-library/react` y `jsdom` instalados y sin usar; `vitest.config.mjs:8` fija `environment: "node"`)
- `test/integration/` está **vacío**, pero `package.json:10` expone `"test:integration": "vitest run --dir test/integration"` — un comando que corre cero tests y sale con éxito.

**El número:** de las ~13.080 líneas de `src/`, los tests tocan 3 archivos de utilidades puras que suman **117 líneas** (`utils.ts` 6 + `currency.ts` 27 + `dates.ts` 63 + parte de `manager.ts`). Menos del **2%** del código, y **0%** de la lógica que mueve dinero. Y los tres únicos tests que sí apuntan a una regla de negocio real (COD-03) están en rojo y llevan tiempo así.

**Remediación (no aplicada):** priorizar por riesgo, no por facilidad. El webhook de MP (idempotencia + firma inválida + `external_reference` ausente) y `applyCredits` (partición de un crédito mayor al monto, expiración, concurrencia) son los dos que deberían tener tests antes que cualquier otra cosa. Y arreglar los 3 fallos, o borrar los tests — dejar un `npm run test` en rojo permanente entrena al equipo a ignorarlo.

---

### COD-10 — Media — Cuatro implementaciones divergentes del cálculo de seña

**Ubicaciones del cálculo de seña:**

| # | Ubicación | Fórmula |
|---|:---|:---|
| 1 | `src/lib/utils/currency.ts:17-19` | `Math.ceil((totalPrice * depositPercentage) / 100)` — parametrizado, testeado |
| 2 | `src/lib/mercadopago/helpers.ts:6-8` | `Math.ceil(totalPrice * 0.30)` — **misma función, mismo nombre, otra firma** |
| 3 | `src/lib/notifications/templates.ts:31-32` | `Math.ceil(booking.total_price * 0.3)` inline, dos veces |
| 4 | `src/components/booking/cancel-dialog.tsx:35` | `Math.ceil(booking.total_price * 0.3)` inline |
| 5 | `src/app/admin/page.tsx:24` | `curr.total_price * 0.3` inline, sin `Math.ceil` |
| 6 | `src/lib/credits/manager.ts:31` | `booking.deposit_amount \|\| 0` — el monto **realmente pagado** |

Dos funciones exportadas con el nombre `calculateDeposit` y firmas incompatibles:

```ts
// src/lib/utils/currency.ts:17
export function calculateDeposit(totalPrice: number, depositPercentage: number): number

// src/lib/mercadopago/helpers.ts:6
export function calculateDeposit(totalPrice: number): number
```

**Qué pasa cuando divergen:** desde `007_venue_deposit_settings.sql:4`, el porcentaje es **configurable por complejo** (`deposit_percentage INTEGER NOT NULL DEFAULT 30`). Los flujos que lo respetan son solo dos: `src/app/(main)/booking/[courtId]/page.tsx:103-104` y `src/app/api/booking/create-preference/route.ts:56-58`. Para un complejo configurado al 50%:

- El usuario paga el 50% correcto (flujo de reserva ✅).
- El email de confirmación (`templates.ts:31`) le dice que abonó el 30% y que le resta el 70%. **Cifras equivocadas en un comprobante.**
- El diálogo de cancelación (`cancel-dialog.tsx:35`) le promete crédito por el 30%.
- El backend (`manager.ts:31`) le acredita el `deposit_amount` real, el 50%. Promesa y ejecución no coinciden.
- El dashboard admin (`admin/page.tsx:24`) reporta ingresos calculados al 30%: **la métrica de facturación de la plataforma está mal**.

**Duplicación de la ventana de cancelación** — tres implementaciones del mismo cálculo horario:

| Ubicación | Implementación |
|:---|:---|
| `src/lib/utils/dates.ts:60` | `new Date(\`${d}T${t}:00-03:00\`)` — offset fijo, roto (COD-03) |
| `src/components/booking/reschedule-dialog.tsx:28-29` | `new Date(\`${d}T${t}\`)` inline — **hora local del navegador**, sin timezone |
| `src/lib/credits/manager.ts:6` y `:50` | consume `hoursUntilBooking` |

`reschedule-dialog.tsx:28` no usa el helper: parsea sin offset, así que interpreta la hora en la zona del navegador. Para un usuario en Argentina coincide con `-03:00`; para uno en España da 4-5 horas de diferencia y la ventana de 2 horas se calcula mal.

Y el umbral: `manager.ts:9` usa `diffHours <= 1` para bloquear, `cancel-dialog.tsx:31` usa `diffHours > 1` para habilitar. Coinciden hoy por casualidad; cualquiera que toque uno rompe el otro sin que nada avise.

**Formateo de moneda:** `formatPrice()` está en `src/lib/utils/currency.ts:5`, documentado y testeado, y tiene **cero consumidores en código de producción** (`rg '\bformatPrice\b' src --glob '!*.test.ts'` fuera de su módulo → 0). En su lugar hay **30+** `.toLocaleString('es-AR')` inline con un `$` a mano. Lo mismo con `formatBookingDate`, `todayArgentina`, `isPastDate` y `formatDepositLabel`: **0 usos** cada uno. Se escribió una capa de utilidades completa, con tests, y después se la ignoró.

**Remediación (no aplicada):** dejar una sola `calculateDeposit(totalPrice, percentage)`, borrar la de `helpers.ts`, y pasarle el `deposit_percentage` del venue a las plantillas de email, al diálogo de cancelación y al dashboard admin. Unificar la ventana horaria en `hoursUntilBooking` (arreglada) y borrar el cálculo inline de `reschedule-dialog.tsx`. Adoptar `formatPrice` en los 30+ sitios, o borrarlo junto con su test.

---

### COD-11 — Media — Código muerto y referencias a rutas borradas

**Archivos sin un solo consumidor** (verificado con `rg` sobre `src/`, incluyendo imports dinámicos):

| Archivo | Líneas | Comentario |
|:---|---:|:---|
| `src/lib/supabase/queries.ts` | 100 | **La única capa de acceso a datos correctamente tipada del proyecto.** 8 funciones con `SupabaseClient<Database>` y tipos de retorno de `domain.ts`. Cero llamadores. Mientras tanto, todos los componentes y páginas hacen consultas crudas con `@ts-expect-error` encima. |
| `src/lib/utils/validators.ts` | ~80 | Esquemas Zod para booking, cancelación, reprogramación, review. Cero llamadores. `zod` está en `dependencies` y este es su único import. |
| `src/components/search/advanced-filters-sheet.tsx` | ~130 | Huérfano — y por eso el build no explota con sus dos imports inexistentes (COD-02). |
| `src/components/dashboard/bookings/booking-slot-card.tsx` | ~55 | Huérfano, con 4 `@ts-expect-error` dentro. |
| `src/components/venue/venue-image.tsx` | — | Huérfano. |
| `src/lib/utils/geo.ts` | — | Huérfano. |
| `src/components/ui/separator.tsx` | — | Primitivo shadcn sin usar (aceptable). |
| `src/components/ui/skeleton.tsx` | — | Primitivo shadcn sin usar (aceptable). |

**Export sin llamador:** `rescheduleBooking()` en `src/lib/booking/actions.ts:59-105` (47 líneas: valida política, chequea disponibilidad del slot, actualiza con cliente admin para saltear el trigger). `rg 'rescheduleBooking' src` → solo la definición. El componente que debería usarla es un stub — `src/components/booking/reschedule-dialog.tsx:59-60`:

```tsx
              <p className="mb-4">Funcionalidad de reprogramación en desarrollo.</p>
              <p className="text-xs text-muted-foreground">Por ahora, por favor cancela la reserva …</p>
```

Se escribió el backend completo (incluido `017_reschedule_loophole.sql`, una migración entera con un trigger para el caso) y el frontend nunca se conectó. Peor: la reprogramación *sí* está prohibida de hecho por el `NaN` de COD-03, así que aunque se conectara, no funcionaría.

Nota aparte: `rescheduleBooking` (`actions.ts:94-99`) actualiza `booking_date` y `start_time` pero **no `end_time`**. Si se conectara tal cual, una reserva de 20:00-21:00 movida a las 22:00 quedaría como 22:00-21:00. Otro motivo para no dejar código muerto rondando: cuando alguien finalmente lo enchufe, va a asumir que está terminado.

**Ruta borrada todavía referenciada** — `src/lib/mercadopago/client.ts:26-27`:

```ts
      init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`,
      sandbox_init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`
```

`src/app/(main)/mock-payment/page.tsx` figura como borrado en `git status`. La rama que devuelve esas URLs se activa cuando `MERCADOPAGO_ACCESS_TOKEN` falta o empieza con `TEST-` (línea 22) — es decir, **en todo entorno de desarrollo y staging**. El flujo de pago de dev redirige a un 404.

`/upgrade` y `/api/bookings/cancel` (también borradas) no tienen referencias vivas: `rg 'mock-payment|/upgrade|api/bookings/cancel' src` devuelve solo las dos líneas de arriba. Bien por esas dos.

**Remediación (no aplicada):** decidir si `queries.ts` es la capa canónica (y migrar las consultas crudas hacia ella, lo que eliminaría de paso buena parte de los `@ts-expect-error`) o borrarlo. Lo mismo con `validators.ts` — que, dicho sea de paso, es la pieza que falta para validar los inputs de las server actions. Restaurar `/mock-payment` o quitar esa rama de mock.

---

### COD-12 — Media — Dependencias de runtime sin un solo import

`rg -l "from ['\"]<dep>" src` sobre cada entrada de `dependencies`:

| Dependencia | Archivos que la importan | Nota |
|:---|---:|:---|
| `shadcn` `^4.19.0` | **0** | Es la **CLI** de shadcn/ui. Está en `dependencies`, no en `devDependencies`. Se instala en cada build de producción sin razón. |
| `@splinetool/react-spline` `^4.1.0` | **0** | — |
| `@splinetool/runtime` `^2.0.6` | **0** | El runtime 3D de Spline; paquete pesado. `src/components/home/hero-3d.tsx` existe pero no lo importa. |
| `tw-animate-css` `^1.4.0` | **0** | Sin import en TS ni en `globals.css`. |
| `tailwindcss-animate` `^1.0.7` | **0** | `[NO CONFIRMADO]` podría estar referenciado desde la config de Tailwind v4 vía CSS; no lo encontré en `src/app/globals.css`. |
| `@vercel/functions` | 1 | ✅ usado vía `await import()` en `webhook/route.ts:79` y `booking/actions.ts` |

**Por qué importa:** `shadcn` como dependencia de runtime infla el `node_modules` de producción y el tiempo de build de cada deploy en Vercel. Los dos paquetes de Spline son de los más pesados del ecosistema React. En conjunto son varios MB instalados en cada build para código que no existe.

**Remediación (no aplicada):** mover `shadcn` a `devDependencies`; eliminar `@splinetool/*` y `tw-animate-css` (o conectar el `Hero3D` que evidentemente se planeó); verificar `tailwindcss-animate` contra la config de Tailwind v4 antes de tocarlo.

---

### COD-13 — Media — El saldo de créditos del perfil se calcula distinto que en el backend

**Cliente** — `src/components/profile/credits-list.tsx:19-28`:
```tsx
      const { data } = await supabase.from("credits")
        .select("*, bookings(courts(name, venues(name)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      
      if (data) {
        setCredits(data)
        const total = data
          .filter((c: import("@/types/domain").Credit) => c.status === 'available')
          .reduce((acc: number, curr: …Credit) => acc + curr.amount, 0)
```

**Backend** — `src/lib/credits/manager.ts:89-95`:
```ts
  const { data, error } = await supabase.from('credits')
    .select('*')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .eq('status', 'available')
    .is('locked_for_booking_id', null)
    .gt('expires_at', now)
```

El cliente filtra **solo** por `status === 'available'`. Le faltan dos criterios que el backend sí aplica:
- `expires_at > now` — los créditos vencen a los 90 días (`manager.ts:63`), pero nada actualiza `status` a `'expired'` al vencer salvo el cron `expire-credits`. Entre el vencimiento y la corrida del cron, el perfil muestra créditos muertos.
- `locked_for_booking_id IS NULL` — los créditos bloqueados para una reserva en curso se cuentan como disponibles.

El cliente tampoco filtra por `venue_id`, aunque los créditos son por complejo (`006_credits_venue_id.sql`): agrega el total global y después lo agrupa por nombre de venue en el render (`credits-list.tsx:56-67`), lo cual está bien para el desglose pero el número grande de arriba (`:49`) suma todo.

**Por qué importa:** el usuario ve "$5.000 en créditos", va a reservar y le aplican $2.000. Es un reclamo de soporte por cada usuario con créditos vencidos o bloqueados, y la explicación no está en ningún lado del código: hay que comparar dos consultas en dos archivos distintos para descubrir la diferencia.

**Remediación (no aplicada):** una sola función que devuelva el saldo disponible, consumida por ambos lados. `getAvailableCredits` ya existe en `manager.ts:85`; falta una variante sin `venueId` y que el componente la use en vez de hacer su propia consulta.

---

### COD-14 — Baja — `eslint-disable` de reglas JSX en archivos sin JSX

```
src/app/dashboard/venue/actions.ts:1      /* eslint-disable jsx-a11y/label-has-associated-control */
src/app/dashboard/bookings/actions.ts:1   /* eslint-disable jsx-a11y/label-has-associated-control */
src/app/dashboard/schedule/actions.ts:1   /* eslint-disable jsx-a11y/label-has-associated-control */
src/app/dashboard/courts/actions.ts:2     /* eslint-disable jsx-a11y/label-has-associated-control */
src/components/dashboard/metric-card.tsx:1
src/components/dashboard/schedule/schedule-navigation.tsx:1
src/app/dashboard/venue/page.tsx:1
```

Cuatro de esos son server actions puras sin una sola etiqueta JSX. `metric-card.tsx` tampoco tiene `<label>`. Es una directiva copiada de archivo en archivo sin verificar si aplica.

Peor, `src/components/dashboard/courts/offers-modal.tsx:1`:
```tsx
/* eslint-disable react-hooks/exhaustive-deps */
```
Deshabilitar `exhaustive-deps` para **todo el archivo** apaga la única red que tiene React contra los stale closures en las 177 líneas del componente. Si es un `useEffect` puntual el problema, la supresión debería ser puntual.

Y `src/app/actions/chat.ts:3`:
```ts
/* eslint-disable @typescript-eslint/ban-ts-comment */
```
Es decir: se apagó explícitamente la regla que reporta el abuso de `@ts-expect-error`.

**Por qué importa:** los "0 errores, 0 warnings" del `npm run lint` son el resultado de 51 líneas `eslint-disable`, no de código limpio. La métrica no mide lo que dice medir.

**Remediación (no aplicada):** borrar las supresiones que no aplican, convertir las de archivo completo en `eslint-disable-next-line` con justificación, y activar `@typescript-eslint/ban-ts-comment` en modo `allow-with-description` a nivel proyecto.

---

### COD-15 — Baja — 15 componentes propios superan las 150 líneas

Ver tabla en la sección de convenciones. Los tres peores:

- `src/components/chat/player-chat-modal.tsx` — **363 líneas**, 2,4× el límite. Contiene: suscripción realtime, subida de imágenes a Storage, envío de mensajes, marcado de leídos, y todo el render. Cuatro `@ts-expect-error` adentro.
- `src/components/dashboard/bookings/bookings-client.tsx` — **283 líneas**, con un import roto (COD-02).
- `src/app/(main)/venue/[id]/page.tsx` — **280 líneas** con **9** `@ts-expect-error`.

La correlación entre tamaño y `@ts-expect-error` no es casual: `search/page.tsx` concentra 17 directivas, `venue/[id]/page.tsx` 9. Los archivos grandes son donde la falta de tipos se vuelve inmanejable, porque nadie puede sostener el modelo mental completo sin ayuda del compilador.

**Remediación (no aplicada):** extraer la lógica de datos de `player-chat-modal` a un `useChatMessages(conversationId)`, y la subida de imágenes a `useImageUpload()`. Eso solo lo baja del límite.

---

## Falsos remediados

Elementos que figuran como resueltos o parecen resueltos, pero no lo están:

1. **"Migración PascalCase → kebab-case completada."** El `git status` muestra 40 archivos borrados en PascalCase y sus reemplazos kebab-case sin trackear, así que en disco está hecha. Pero **cuatro imports quedaron apuntando a los nombres viejos** y el build falla por eso (COD-02). La migración se declaró terminada sin correr `npm run build`.

2. **"Cero errores de TypeScript."** `npx tsc --noEmit` sale limpio. Son 118 errores suprimidos con 105 `@ts-expect-error` (COD-01). El proyecto no compila con webpack.

3. **"Cero errores y warnings de ESLint."** `npm run lint` sale limpio, con 51 líneas `eslint-disable` en el código — incluyendo `ban-ts-comment` apagada en `src/app/actions/chat.ts:3`, que es la regla que habría reportado el abuso del punto anterior (COD-14).

4. **`019_credit_locks.sql` — bloqueo de créditos.** La migración agrega `locked_for_booking_id` y el código en `manager.ts` la usa. Pero la columna nunca se agregó a `src/types/database.ts`, así que los tres updates que la escriben van con `as never` (COD-05/COD-06): sin verificación de tipos sobre el mecanismo que evita el doble gasto de créditos.

5. **`017_reschedule_loophole.sql` — cierre del bypass de reprogramación.** Migración completa con trigger de protección, más `rescheduleBooking()` en el backend. El frontend correspondiente es un cartel que dice "Funcionalidad de reprogramación en desarrollo" (`reschedule-dialog.tsx:59`). Se cerró un agujero en una funcionalidad que no está conectada, y que además está rota por el `NaN` de COD-03.

6. **`020_availability_rpc.sql` — RPC de disponibilidad.** La función existe en la DB y `availability-grid.tsx:42` la llama, pero `database.ts` no tiene clave `Functions`, así que la llamada va con `@ts-expect-error rpc not in types yet` (COD-06). Sin verificación sobre nombres ni tipos de los parámetros.

7. **`test/integration/` y `npm run test:integration`.** El script existe en `package.json:10` y el directorio está vacío. El comando sale con código 0. Es una suite de integración que reporta éxito sin ejecutar nada.

8. **`src/lib/utils/currency.ts` y `dates.ts` — "capa de utilidades compartida".** Escritas, documentadas con `@example`, con 17 tests. `formatPrice`, `formatBookingDate`, `todayArgentina`, `isPastDate` y `formatDepositLabel` tienen **cero consumidores** fuera de sus propios tests (COD-10). La centralización existe en el repositorio pero no en el código que corre.

---

## Código genuinamente bien escrito

Sin adornos, con ubicación:

1. **`src/lib/supabase/queries.ts` (100 líneas)** — la única capa de acceso a datos correctamente tipada: `SupabaseClient<Database>` como parámetro, tipos de retorno de `domain.ts`, `if (error) throw error` uniforme en las 8 funciones. Un senior la firma sin cambios. Y no la usa nadie (COD-11). Es la pieza que resolvía la mitad de los problemas de este informe.

2. **`src/lib/utils/validators.ts:1-80`** — esquemas Zod con primitivos compuestos (`UUIDSchema`, `DateSchema`, `TimeSchema`), mensajes de error en español, y tipos derivados con `z.infer`. Bien organizado con separadores de sección. Huérfano, y con el `TimeSchema` desalineado del formato real de la DB (COD-03), pero la estructura es correcta.

3. **`src/lib/utils/currency.ts` (27 líneas)** — tres funciones puras, cada una con JSDoc y `@example`, `calculateDeposit` correctamente parametrizada por porcentaje en vez de hardcodear el 30%, y 8 tests que la cubren. Es exactamente lo que `AGENTS.md` pide.

4. **`src/app/actions/booking.ts` (24 líneas)** — server action ejemplar: `"use server"` en la línea 1, guard clause temprana, el `.delete()` filtrado por `user_id` **y** `payment_status` (defensa en profundidad además de RLS), error logueado en el server y devuelto como resultado tipado en vez de excepción. Ningún `@ts-expect-error`, ningún `as`.

5. **`src/lib/mercadopago/helpers.ts:14-48`** — `verifyWebhookSignature` con `crypto.timingSafeEqual` (no `===`), guard clause para los tres inputs, y el manifiesto construido según la spec de MP. La única objeción es el `calculateDeposit` duplicado que comparte archivo (COD-10).

6. **`src/lib/supabase/server.ts:6-31`** — `createClient()` está bien: `createServerClient<Database>` parametrizado, y el `catch {}` de la línea 22 es el único silencio justificado del proyecto, con tres líneas de comentario explicando exactamente por qué. Así se traga un error a propósito. (La otra mitad del archivo, `createAdminClient`, es COD-05.)

7. **`src/components/dashboard/metric-card.tsx` (~35 líneas)** — componente de presentación puro: props tipadas con `interface`, sin `"use client"` innecesario, sin estado, named export, `LucideIcon` como tipo en lugar de `any`. Sobra el `eslint-disable` de la línea 1 (COD-14).

8. **`src/components/home/how-it-works.tsx`** — server component, datos declarativos arriba, render abajo, sin `"use client"`, sin dependencias. El único pero es el `key={index}` de la línea 36, y sobre una lista estática de 3 elementos eso es irrelevante.

---

## Límites de esta auditoría

- **Solo lectura, y solo el árbol de trabajo.** No modifiqué código, config ni tests. La única escritura fue este archivo. Los comandos que ejecuté (`tsc`, `eslint`, `vitest`, `next build`) escriben en `.next/` y `tsconfig.tsbuildinfo`, ambos ignorados por `.gitignore`.
- **La medición de los 118 errores ocultos** se hizo sobre una copia aislada de `src/` en scratchpad, con `node_modules` enlazado y el mismo `tsconfig.json`. No incluye `.next/types/**/*.ts` (los tipos generados por Next), así que podría haber errores adicionales de firma de páginas que no aparecen. El número es un piso, no un techo.
- **Sin acceso a la base de datos.** Toda la comparación entre `database.ts` y el esquema se hizo contra los archivos de `supabase/migrations/`. Si se aplicaron cambios manuales desde el panel de Supabase, mis conclusiones sobre columnas faltantes pueden estar corridas — lo marqué explícitamente en COD-04.
- **Sin ejecución en runtime.** El `NaN` de COD-03 está confirmado por los tests que fallan y por lectura del código; no verifiqué el comportamiento contra una instancia real de PostgREST. El formato `HH:MM:SS` para columnas `TIME` es el comportamiento documentado y por defecto.
- **`supabase/functions/` (Edge Functions Deno)** las revisé solo para el conteo de `any` (3 ocurrencias). No están cubiertas por el `tsconfig.json` del proyecto ni por `npm run test`, y no las audité a fondo.
- **La detección de archivos huérfanos** se basa en grep de referencias por nombre de archivo, incluyendo imports dinámicos. Puede tener falsos positivos si algo se resuelve por un patrón que no contemplé (barrel files, `require` dinámico con string armado). Verifiqué manualmente los 9 candidatos iniciales y descarté uno (`src/lib/notifications/index.ts`, importado dinámicamente en dos lugares).
- **Reportes previos en `audit-reports/`** los tomé como contexto, no como verdad. Toda métrica de este informe proviene de un comando que corrí en esta sesión y cuya salida está citada.
- **No audité:** seguridad/RLS (informe 01), arquitectura (02), reglas de negocio en profundidad (03), accesibilidad (04). Cuando toqué esos temas fue por su costo de mantenimiento o su impacto en la corrección del código, no como evaluación de esos dominios.

---

## Nitpicks (gusto, no defecto)

Preferencias estilísticas. Ninguna de estas es un defecto y ninguna justifica un cambio por sí sola.

1. **68 type-imports inline `import("@/types/domain").Booking`** en 26 archivos, en lugar de un `import type` arriba. Funciona, es correcto en TypeScript, y hace las firmas ilegibles: `src/lib/credits/manager.ts:5` es `export function calculateCancellationPolicy(booking: import("@/types/domain").Booking)`. Parece salida de un codemod más que decisión de diseño.

2. **`key={index}` en 4 listas** (`how-it-works.tsx:36`, `venue-gallery.tsx:105`, `review-section.tsx:199`, `venue-photos-form.tsx:177`). En tres de los cuatro casos la lista es estática o de solo lectura, así que es inocuo. En `venue-photos-form.tsx:177` la lista sí se reordena y borra, y ahí sí puede dar comportamiento raro al eliminar una foto del medio — ese es el único que me haría ruido en review.

3. **`"use client"` en 15 archivos sin interactividad aparente**, la mayoría primitivos de shadcn donde es el patrón esperado. El único propio que llama la atención es `src/components/search/venue-list.tsx`, que solo mapea y renderiza.

4. **3 default exports fuera de páginas** (`hero-3d.tsx:16`, `venue-map-client.tsx:77`, `location-picker-map.tsx:61`). Los tres se cargan con `next/dynamic`, que históricamente prefería default export. Es defendible, pero contradice la convención declarada sin dejar constancia.

5. **`src/components/ui/use-toast.ts` en `camelCase`** dentro de un directorio donde todo lo demás es kebab-case. Es el nombre canónico de shadcn/ui, así que no lo tocaría.

6. **`src/app/(main)/page.tsx:16,32`** usa `type PromoQueryType = {…}` donde `AGENTS.md` pide `interface` para shapes de objeto. Dos casos, ambos tipos locales de query.

7. **Los emojis en logs de servidor** (`webhook/route.ts:89`: `✅ [Webhook MP] …`). Se ven bien en la terminal, se ven mal en un agregador de logs. Cuestión de gusto hasta que alguien tenga que grepearlos.
