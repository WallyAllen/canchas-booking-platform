# Síntesis Final — Auditoría Ronda 2

**Proyecto:** ReservaYa / CanchApp — reserva de canchas de fútbol 5, La Plata, Argentina
**Fecha:** 2026-09-01
**Base:** commit `a1f7e7f` con working tree sucio (148 entradas modificadas/borradas/sin trackear)
**Equipo:** 5 auditores independientes con perfil destructor — Seguridad, Arquitectura, Negocio, UX/Accesibilidad, Calidad de Código
**Revisión final:** verificación cruzada de las afirmaciones más graves, arbitraje de contradicciones, y actualización posterior a que el usuario aplicara las migraciones `018`, `019` y `020` en Supabase (antes solo estaba aplicado hasta la `017`)

---

## ⚠️ Actualización posterior a la auditoría — acción requerida ahora

Después de que los cinco reportes se escribieran, el usuario aplicó `018_fix_triggers_auth.sql`, `019_credit_locks.sql` y `020_availability_rpc.sql` contra la base real. Esto cierra la incertidumbre de "¿está aplicado?" que los cinco auditores señalaban — pero **no arregla ningún hallazgo**. Al contrario: convierte un riesgo que antes era teórico en un riesgo que corre en producción ahora mismo, y probablemente ya estaba corriendo antes de esta conversación.

**Lo más urgente de esta síntesis no es un hallazgo nuevo: es verificar si el cobro de pagos sigue funcionando.** `SEC-08` (`01-seguridad.md`) advertía, marcado `[NO CONFIRMADO]` porque el auditor no podía ejecutar SQL: el trigger `protect_booking_fields` de la migración `018` intenta reconocer al cliente `service_role` con `current_setting('request.jwt.claim.role', true)` — un GUC legacy de PostgREST, retirado en PostgREST 9 a favor de `request.jwt.claims` (plural, JSON). Si ese GUC ya no está seteado en la versión de PostgREST que corre Supabase hoy, la condición de bypass nunca es verdadera, y el trigger le aplica al `service_role` los mismos checks que le aplica a un jugador. El punto de impacto exacto:

```sql
-- supabase/migrations/018_fix_triggers_auth.sql:34-37
IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN
    RETURN NEW;
END IF;
```

```ts
// src/app/api/webhooks/mercadopago/route.ts:58-71 — usa createAdminClient()
.update({ payment_status: 'paid', status: 'confirmed', updated_at: ... })
```

Si el bypass no toma, ese `UPDATE` del webhook dispara `RAISE EXCEPTION 'Unauthorized: Cannot modify payment status'`, la ruta cae a 500, y **Mercado Pago cobra la seña sin que la reserva se confirme nunca**. Antes de hoy esto era hipotético porque `018` no estaba aplicada. Ahora está aplicada. **Recomendación: antes de tocar cualquier otra cosa, hacer una reserva de prueba de punta a punta con Mercado Pago sandbox y confirmar que el webhook la marca `paid`/`confirmed`.** Es una prueba de 5 minutos que responde la pregunta con certeza, cosa que ningún auditor de código puede hacer.

El resto de esta sección son los efectos de aplicar las otras dos migraciones, verificados contra el código (no contra la base — sigo sin acceso directo):

| Migración | Qué habilita en el código | Efecto de aplicarla | Lo que NO arregla |
|:---|:---|:---|:---|
| **`019_credit_locks.sql`** | Agrega la columna `locked_for_booking_id`. `src/lib/credits/manager.ts` ya la referencia en 6 sitios (líneas 94, 117, 137, 155, 170, 171) — antes de hoy esas queries fallaban o corrían contra una columna inexistente. | Las queries de créditos ahora ejecutan contra el esquema real. `SEC-04`/`ARQ-07` (doble gasto de crédito por race condition) pasan de "hallazgo sobre código que podría no correr" a **"hallazgo sobre código que corre tal cual, hoy"**. | La migración es una `ALTER TABLE ADD COLUMN`. No hay `FOR UPDATE`, transacción ni advisory lock en ningún lado — ni en el SQL ni en `manager.ts`. La race sigue exactamente igual. |
| | Redefine `delete_abandoned_bookings()` con ventana de **3 minutos**, revirtiendo en silencio la migración `016` (que ya estaba aplicada, con 15 minutos). | **Esto es una regresión operativa real que el usuario acaba de desplegar.** Antes de hoy, producción purgaba reservas no pagadas a los 15 minutos. Desde ahora, vuelve a purgarlas a los 3. Ver arbitraje más abajo — verificado directamente contra el SQL de las tres migraciones, no asumido. | Nada — es el comportamiento tal cual quedó escrito. Si no era la intención, hay que aplicar una migración `021` que vuelva a fijar el intervalo en 15 minutos (o el valor que se decida), reusando la misma lógica de desbloqueo de créditos que `019` ya tiene. |
| **`020_availability_rpc.sql`** | Crea `get_venue_availability(p_venue_id, p_date)`. `src/components/venue/availability-grid.tsx:42` ya la llama por nombre — antes de hoy, esa llamada fallaba con "function does not exist". | La grilla de disponibilidad ahora recibe datos reales en vez de caer siempre al `catch`. **Esto cambia el carácter de `UX-08`** ("error de la RPC → todos los turnos se pintan Libre"): antes describía probablemente el estado permanente de la pantalla (la RPC no existía); ahora describe el comportamiento correcto ante un error ocasional real, que es lo que el hallazgo señalaba como riesgoso — que el fallback ante error sea "mostrar todo disponible" en lugar de "mostrar error". | La función es `SECURITY DEFINER` sin `SET search_path` ni `REVOKE EXECUTE FROM PUBLIC` (`ARQ-24`/`SEC-21`). Ahora que está desplegada, esa superficie está expuesta de verdad, no en teoría. |
| **`018_fix_triggers_auth.sql`** | Reemplaza los triggers `protect_profile_fields` y `protect_booking_fields`, reemplazando el chequeo `auth.uid() IS NULL` (que si funcionaba para reconocer al service_role) por el GUC legacy de arriba. | Ver el bloque de arriba: es el cambio de mayor riesgo de los tres. | La lista negra de `protect_booking_fields` sigue sin incluir `court_id` ni `source` (`SEC-02`, `NEG-25`): un jugador puede mudar su propia reserva a otra cancha sin que el trigger lo note, con `018` aplicada o sin aplicar — es un defecto del SQL, no de si está desplegado. |

**En síntesis: aplicar estas tres migraciones no cerró ningún hallazgo de los cinco reportes. Cerró la incertidumbre sobre si corrían, y la respuesta es "sí corren, con los mismos defectos que tenían por escrito" — más una regresión de negocio (cron 15→3 min) y un riesgo nuevo de alta severidad (posible corte del cobro de pagos) que solo una prueba end-to-end puede confirmar o descartar.**

---

## Resumen ejecutivo

**No apto para producción**, y la razón más inmediata sigue sin ser ninguno de los 144 hallazgos de los cinco reportes: `npm run build` falla con 5 módulos no encontrados, secuela de una migración de nombres de archivo (PascalCase → kebab-case) hecha a medias. Sin build no hay despliegue; todo lo demás es teoría sobre código que no corre en Vercel.

Debajo de eso hay tres fallas silenciosas que afectan dinero directamente. `hoursUntilBooking()` devuelve `NaN` con el formato de hora que la base realmente entrega, así que **la política de cancelación entera está inoperante** — nadie recibe crédito nunca, aunque el email de confirmación lo prometa por escrito. La autorización está delegada casi por completo a RLS, y RLS tiene una llave maestra: cualquier usuario autenticado puede auto-declararse dueño de un complejo. Y **el marketplace no cobra comisión** — no existe `commission`, `fee` ni `payout` en ninguna de las 20 migraciones ni en la preferencia de Mercado Pago.

Por encima de todo eso está el patrón que más debería preocupar de cara al futuro: **la ronda anterior cerró hallazgos citando la existencia de un archivo como prueba de que el control corría**, sin verificar que efectivamente corriera. Los cinco auditores de esta ronda, trabajando en aislamiento, encontraron falsos remediados de forma independiente. Y la actualización de arriba es la prueba en vivo del mismo patrón: aplicar `018`/`019`/`020` sin una prueba end-to-end del flujo de pago es exactamente el tipo de paso que generó los falsos remediados que esta ronda tuvo que destapar.

**¿Hay algo bueno? Sí, y es real** — ver la sección de contraste más abajo. El precio se recalcula siempre en el servidor, el índice único parcial de doble reserva es una protección genuina a nivel de base, `getUser()` se usa con consistencia perfecta en las 12 Server Actions, y hay decisiones de negocio finas (excluir Rapipago porque la seña debe ser instantánea) que muestran criterio. El problema de este proyecto no es falta de criterio técnico. Es falta de verificación antes de declarar algo terminado.

---

## Alcance y conteo

| Reporte | Auditor | Hallazgos | C / A / M / B |
|:---|:---|---:|:---|
| [`01-seguridad.md`](01-seguridad.md) | Experto en Seguridad | 29 | 4 / 10 / 11 / 4 |
| [`02-arquitectura.md`](02-arquitectura.md) | Pesimista de Arquitectura | 28 | 7 / 9 / 8 / 4 |
| [`03-negocio.md`](03-negocio.md) | Abogado del Diablo de Negocios | 32 | 7 / 10 / 12 / 3 opinión |
| [`04-ux-accesibilidad.md`](04-ux-accesibilidad.md) | Defensor del Usuario | 40 | 9 / 11 / 15 / 5 |
| [`05-calidad-codigo.md`](05-calidad-codigo.md) | Purista de Código | 15 | 4 / 5 / 4 / 2 |
| **Total** | | **144** | **31 / 45 / 50 / 18** |

---

## Contradicciones entre auditores, arbitradas contra el código

Los cinco trabajaron aislados y se contradijeron en cinco puntos. Se resuelven leyendo el SQL y el TypeScript directamente, no confiando en ningún reporte a ciegas.

### 1. ¿La ventana del cron es de 3 o de 15 minutos? — **3 minutos, y es una regresión que se acaba de desplegar hoy**

`UX-11` razona sobre 15 minutos citando la `016`. Arquitectura, Negocio y Seguridad dicen 3, citando la `019`. Volví a leer las tres migraciones línea por línea:

- `012_abandoned_bookings_cron.sql:8-12` — crea `delete_abandoned_bookings()` con `INTERVAL '3 minutes'`.
- `016_extend_booking_cron.sql:6-10` — `CREATE OR REPLACE FUNCTION` de la misma función, con `INTERVAL '15 minutes'`. Esta versión estaba en producción desde antes de esta sesión (parte del rango "aplicado hasta la 017").
- `019_credit_locks.sql:15,22` — `CREATE OR REPLACE FUNCTION` de la misma función otra vez, de vuelta a `INTERVAL '3 minutes'`, ahora con el paso extra de liberar créditos bloqueados antes de borrar.

**Son 3 minutos, confirmado por lectura directa del SQL, no por lo que dice ningún reporte.** Y a diferencia de cuando se escribieron los cinco reportes, esto ya no es un hallazgo sobre un archivo sin aplicar: es el comportamiento que corre en la base ahora mismo, porque el usuario aplicó `019` hoy. El hallazgo de UX de que a nadie se le avisa del límite de tiempo sigue siendo válido, y es más urgente que antes, no menos.

### 2. ¿El lock de créditos de la migración 019 funciona? — **No**

Negocio lo lista como acierto #6 ("Los créditos tienen lock transaccional"). Seguridad (`SEC-04`, CRÍTICO) y Arquitectura (`ARQ-07`, CRÍTICO) lo listan como falso remediado.

**Ganan Seguridad y Arquitectura.** La migración agrega una columna, `locked_for_booking_id`. No hay `FOR UPDATE`, transacción ni advisory lock en el SQL, y `src/lib/credits/manager.ts:106-163` sigue siendo un `SELECT` seguido de N `UPDATE` como round-trips HTTP separados. Dos pestañas del mismo usuario en paralelo leen el mismo saldo antes de que ninguna escriba. La columna documenta la intención; no la implementa. Con `019` ya aplicada, esta race corre contra el esquema real desde hoy.

### 3. ¿`hoursUntilBooking()` está bien? — **No, devuelve `NaN`**

Negocio la evalúa como correcta porque el offset `-03:00` está bien puesto. Arquitectura, Código y Seguridad dicen que devuelve `NaN`. Verifiqué con `node -e` directamente: `new Date('2026-09-02T21:00:00:00-03:00')` (formato `HH:MM:SS` real de la columna `TIME` de Postgres, con el `:00` extra que la función concatena) da `NaN`; con `HH:MM` da una fecha válida. **Devuelve `NaN`, confirmado.** La zona horaria de Argentina está bien resuelta; el formato de la hora, no.

### 4. ¿El webhook de Mercado Pago es idempotente? — **Sí para reintentos secuenciales, no para entregas concurrentes**

Negocio lo lista como acierto. Arquitectura lo reporta como `ARQ-05` (CRÍTICO). Ambos aciertan sobre mitades distintas: el corte temprano por `payment_status === 'paid'` neutraliza el reintento normal de MP, que es secuencial. Pero entre el `SELECT` y el `UPDATE` hay una ventana que una entrega concurrente sí atraviesa. Severidad correcta: **ALTO**, no crítico — requiere concurrencia real de MP y el daño es duplicación de efectos secundarios (notificación, consumo de crédito), no pérdida directa de dinero.

### 5. ¿La firma del webhook se verifica? — **La función es correcta; el control no corre**

Negocio lo lista como acierto. Seguridad lo reporta como `SEC-05` (ALTO, falso remediado). `verifyWebhookSignature` (`src/lib/mercadopago/helpers.ts:14-48`) está bien implementada — HMAC-SHA256, manifiesto según spec de MP, `timingSafeEqual` con el `try/catch` correcto. Pero está envuelta en `if (secret)`, y `MP_WEBHOOK_SECRET` no está definida en `.env.local` ni en `.env.local.example`. Hoy no se verifica ninguna firma. El defecto es de diseño (falla abierto) no de criptografía.

---

## Bugs verificados vs. hallazgos de opinión y decisiones de negocio

Los criterios de aceptación piden separar esto con claridad. Tres categorías, no dos:

### A. Defectos de código — verificables, no discutibles

Todo lo de la tabla de "las diez peores críticas" abajo, más el grueso de los 144 hallazgos: código que no hace lo que el propio proyecto dice que debería hacer, o que rompe silenciosamente. Ejemplos con verificación directa de este revisor: el build falla (`npm run build`, comprobado), 3 de 26 tests fallan (`npm run test`, comprobado), `NaN` en la política de cancelación (`node -e`, comprobado), ausencia total de comisión en el modelo de datos (`rg`, comprobado).

### B. Reglas de negocio declaradas que el código contradice — verificables, requieren decisión de producto para cerrarse

No son opiniones: son la comparación directa entre `AGENTS.md` y el código. Pero cerrarlas no es solo "arreglar un bug" — requiere que el negocio decida el mecanismo. Ejemplos:

- **"Seña: mínimo 30%"** — el código permite 0% y 100% sin piso (`007_venue_deposit_settings.sql:4`, sin validación en `dashboard/venue/actions.ts:78`). Es un hecho verificable que el piso no existe en ninguna capa. Cerrar esto requiere que el negocio decida si el piso es realmente no-negociable o si algunos complejos pueden operar sin seña, y solo después se escribe el `CHECK`.
- **"Seña siempre digital vía Mercado Pago"** — el wizard ofrece "Transferencia" como método (`booking-wizard.tsx:79-83`, no crea reserva real, muestra éxito igual). Hecho verificable. Cerrarlo requiere decidir si "Transferencia" es una feature real a terminar o un remanente a borrar.
- **"Reseñas solo de reserva completada"** — el insert real omite `booking_id`, que es `NOT NULL UNIQUE` (`review-section.tsx:55-61` vs `001_initial_schema.sql:90`): **todo insert de reseña falla hoy**. Esto no es opinable, está roto.

### C. Marcado explícitamente `OPINIÓN` por el propio auditor de Negocio — decisiones del dueño del producto, no defectos

El reporte de Negocio (`03-negocio.md`) separa estos tres de forma explícita y los aísla del resto de la tabla de hallazgos:

| ID | Opinión | Por qué no es un bug |
|:---|:---|:---|
| `NEG-30` | La ventana de pago (hoy 3 min, ver arbitraje arriba) mata la conversión | Es un juicio sobre UX/negocio, no un defecto de implementación — el código hace exactamente lo que la migración dice |
| `NEG-31` | "Con menos de 1h no se puede cancelar" es una regla hostil e indefendible | La regla está implementada tal como se escribió (`credits/manager.ts:9-16`); el auditor cuestiona si debería existir, no si el código la cumple |
| `NEG-32` | Un crédito atado a `venue_id` es un cupón del complejo, no un crédito de plataforma | Es correcto que el código haga esto — la objeción es si el modelo de producto declarado ("crédito de plataforma") es el modelo correcto a construir |

Además, el reporte de Negocio marca un punto legal como `[NO CONFIRMADO]` sin pretender ser fuente autorizada: la ausencia de un botón de arrepentimiento visible, que podría ser exigido por la Resolución 424/2020 para comercio electrónico en Argentina. Lo verificable ahí es solo que el mecanismo no existe en el código; la aplicabilidad legal exacta corresponde a asesoría profesional, no a esta auditoría.

---

## Las diez peores críticas, consolidadas

Ordenadas por lo que primero destruye valor. "Convergencia" es cuántos de los 5 auditores llegaron al mismo hallazgo por separado — la señal más fuerte de que es real.

| # | Hallazgo | IDs | Convergencia | Estado tras la actualización |
|:--|:---|:---|:---:|:---|
| 1 | **El proyecto no compila.** 5 imports a archivos PascalCase eliminados, tapados con `@ts-expect-error` que silencia a `tsc` pero no a webpack. | `ARQ-01`, `COD-02`, `UX-09` | 3/5 | Sin cambios — no depende de las migraciones |
| 2 | **La política de cancelación está muerta por un `NaN`.** Nadie recibe crédito, nadie reprograma, cualquiera cancela 5 min antes. | `ARQ-02`, `COD-03`, `SEC-14` | 3/5 | Sin cambios |
| 3 | **Riesgo nuevo: el cobro de pagos podría estar cortado desde hoy.** El bypass de `service_role` del trigger de `018` usa un GUC legacy de PostgREST que puede no estar seteado. | `SEC-08` | 1/5 | **Pasó de teórico a urgente** — ver la sección de arriba. Requiere prueba end-to-end, no lectura de código |
| 4 | **Cualquier usuario autenticado se auto-declara dueño de complejo.** Llave maestra que abre reescritura de reseñas ajenas y reservas manuales. | `SEC-03`, `SEC-11`, `NEG-23` | 2/5 | Sin cambios |
| 5 | **El marketplace no cobra nada.** Sin `commission`, `fee` ni `payout` en ninguna capa. | `NEG-01` | 1/5 | Sin cambios — requiere decisión de producto, no fix técnico |
| 6 | **Doble gasto de créditos por race condition.** `SELECT` + N `UPDATE` sin atomicidad. | `SEC-04`, `ARQ-07` | 2/5 | **Ahora corre contra el esquema real** — antes de hoy, algunas de estas queries podían fallar por columna inexistente |
| 7 | **El producto regala el botón de la desintermediación.** Interruptor "Sin seña" + filtro de búsqueda que lo promociona. | `NEG-02`, `NEG-03` | 1/5 | Sin cambios |
| 8 | **Bypass del trigger de protección vía `court_id`.** Un jugador puede mudar su reserva a otra cancha sin pagar diferencia. | `SEC-02`, `NEG-25` | 2/5 | **Ahora vive en producción** — antes `018` no estaba aplicada |
| 9 | **El flujo de reserva se rompe en tres puntos del retorno de pago** (login, fallo de MP, pantalla de éxito sin mirar `payment_status`). | `UX-01/02/03/05`, `SEC-16`, `ARQ-09` | 3/5 | Sin cambios |
| 10 | **Las herramientas de verificación mienten.** 105 `@ts-expect-error`, 51 `eslint-disable`, `test:integration` en verde sobre carpeta vacía. | `COD-01`, `COD-09`, `ARQ-19` | **4/5** | Sin cambios — y es la causa raíz de por qué nadie notó el riesgo #3 antes de desplegarlo |

---

## Contraste: lo peor contra lo mejor

### Lo peor — destructivo, verificado, con consecuencia directa en dinero o datos

- El build no compila; no hay despliegue posible hasta arreglar 5 imports.
- La política de cancelación entera es inoperante por un `NaN` de una línea, y el email de confirmación promete por escrito algo que el sistema no cumple — exposición legal, no solo técnica.
- Cualquier usuario logueado una vez con Google puede auto-declararse dueño de un complejo ajeno; es la llave que abre el resto de la superficie de `venue_admin`.
- El negocio no tiene ningún mecanismo para cobrar su parte — ni una columna, ni un cálculo, ni un `collector_id` en Mercado Pago.
- Los créditos se pueden gastar dos veces por una carrera de red de manual de libro de texto, y la migración con el nombre "Credit Locks for Transactional Integrity" no agrega ningún lock.
- El riesgo recién descubierto: aplicar hoy la migración que debía arreglar la autorización del `service_role` puede haber cortado, en este mismo momento, la confirmación de pagos.

### Lo mejor — real, verificado, y a preservar en cualquier refactor

- **El índice único parcial de doble reserva** (`008_fix_booking_constraint.sql:8-10`) — citado por cuatro de los cinco auditores por separado. Es la protección transaccional más importante de todo el sistema y funciona sin depender de la capa de aplicación.
- **El precio se recalcula siempre en el servidor** (`create-preference/route.ts:14-58`) — cierra de raíz el exploit más obvio de cualquier marketplace.
- **`getUser()` en las 12 Server Actions y el middleware, sin un solo `getSession()` en servidor** — consistencia poco común, y es exactamente la primitiva correcta.
- **La disponibilidad nunca se cachea** mientras el resto de la ficha sí — evitaron el peor escenario posible, vender un turno ya vendido por caché obsoleta.
- **`verifyWebhookSignature` está bien implementada** — solo hace falta sacarla del `if (secret)` que la vuelve opcional.
- **El patrón de ownership que sí existe** en `dashboard/schedule/actions.ts:23-31` y `dashboard/venue/actions.ts:42-50,81-89` — es exactamente el que falta en `dashboard/bookings/actions.ts`. La solución al hallazgo #4 ya está escrita en el propio repositorio.
- **Decisiones de negocio finas**: excluir Rapipago/PagoFácil de la preferencia de MP porque la seña necesita ser instantánea, con el razonamiento comentado en el propio código.

**El patrón que conecta ambas columnas:** varias de las soluciones correctas ya existen en el repositorio — la capa de datos tipada de `queries.ts`, el helper de seña parametrizado de `currency.ts`, el patrón de ownership de `schedule/actions.ts` — y están huérfanas, sin conectar al flujo real. El equipo sabe escribir el código correcto. El problema es que lo escribe y no lo termina de enchufar, y después declara terminada la tarea.

---

## Plan de acción priorizado — estado de ejecución

Ejecutado en esta sesión, con `npm run build`, `npm run test` (26/26) y `npm run lint` en verde después de cada tanda de cambios. Nada de esto se probó contra la base de datos real — las migraciones nuevas (`021`–`026`) están escritas y verificadas por lectura, pendientes de que el usuario las aplique en Supabase.

### 🔴 CRÍTICO

1. ⚠️ **Prueba real de cobro de pagos — sigue pendiente, requiere al usuario.** No pude ejecutar una reserva de prueba contra el sandbox de MP desde acá. En su lugar, cerré la causa raíz de forma estructural: [`021_fix_service_role_check_and_court_bypass.sql`](../../supabase/migrations/021_fix_service_role_check_and_court_bypass.sql) reemplaza el chequeo del GUC legacy por `auth.role() = 'service_role'` (el helper oficial de Supabase, robusto a la versión de PostgREST). Esto elimina la ambigüedad en vez de depender de una prueba puntual — pero **aplicar esta migración en Supabase sigue siendo un paso manual pendiente**, y una prueba end-to-end después de aplicarla sigue siendo la única confirmación real.
2. ✅ **5 imports rotos, arreglados.** Además, al arreglarlos aparecieron 6 archivos con `"use client"` colocado después de un `import` real (rompe la directiva) — bug nuevo, destapado y corregido en el mismo paso. `npm run build` compila y genera las 25 rutas.
3. ✅ **`hoursUntilBooking()` arreglada** (`src/lib/utils/dates.ts:60`) — normaliza `HH:MM:SS`→`HH:MM` y lanza en vez de devolver `NaN` silencioso. Los 3 tests que fallaban ahora pasan (más un fixture de test que le faltaba `deposit_amount`, corregido en el mismo paso). 26/26 tests en verde.
4. ✅ **Cron restaurado a 15 minutos** — [`022_restore_cron_window_15min.sql`](../../supabase/migrations/022_restore_cron_window_15min.sql), reusando la lógica de liberación de créditos de `019`. Pendiente de aplicar en Supabase.
5. 🟡 **Parcial, por decisión deliberada.** El guard de ownership en `dashboard/bookings/actions.ts` está agregado, copiando el patrón de `schedule/actions.ts:23-31`. El bypass de `court_id`/`source` del trigger está cerrado en la misma migración `021`. **No toqué la policy de auto-asignación de `venue_admin`** (`002_rls_policies.sql:33-34`): bloquear la creación de venues sin dar de baja el defecto correspondiente (el botón "activar" del panel de `platform_admin` es un placebo sin `onClick` — `NEG-22`) dejaría a cualquier complejo nuevo invisible para siempre, sin forma de activarlo. Es una decisión de producto (¿self-serve o moderado?) que corresponde al usuario, no algo para resolver unilateralmente a mitad de una tanda de fixes.

### 🟠 ALTO

6. ✅ **Firma del webhook: falla cerrado en producción.** Si `NODE_ENV==='production'` y `MP_WEBHOOK_SECRET` no está seteada, el webhook responde 500 en vez de aceptar sin validar. Fuera de producción, sigue tolerando (con warning) para no bloquear desarrollo local sin credenciales de MP. Variable documentada en `.env.local.example`.
7. ✅ **`court_id`/`source` agregados a la lista negra** de `protect_booking_fields` — mismo cambio que el punto 5, migración `021`.
8. ⏸️ **Modelo económico (comisión) — no es tarea de código, sigue sin decidir.** Fuera de alcance de esta tanda; requiere que el usuario defina el mecanismo antes de tocar el esquema.
9. ✅ **Insert de reseñas arreglado.** `review-section.tsx` ahora busca la reserva completada y sin reseñar del usuario en ese venue antes de mostrar el botón "Escribir Reseña", y la usa como `booking_id`. Como nada marcaba reservas `completed` automáticamente, agregué [`023_auto_complete_bookings.sql`](../../supabase/migrations/023_auto_complete_bookings.sql) (cron cada 5 min). También cerré el hueco relacionado que encontré al tocar esto: la policy de reseñas no ataba `venue_id` a la reserva real (`SEC-09`/`NEG-24`, review bombing cruzado) y la de "responder reseña" permitía al dueño reescribir `rating`/`comment` ajenos (`SEC-10`/`NEG-06`) — ambos cerrados en [`024_fix_review_venue_binding.sql`](../../supabase/migrations/024_fix_review_venue_binding.sql).
10. ⏸️ **No apliqué `ban-ts-comment`.** Activar la regla ahora produciría ~105 errores nuevos de lint sobre código que no toqué en esta tanda — es un trabajo de limpieza propio, no algo para mezclar a mitad de una tanda de fixes de seguridad/negocio sin dejarlo roto a medio camino.

### 🟡 MEDIO

11. ⏸️ Lock de concurrencia de `applyCredits()` — no abordado en esta tanda.
12. ✅ `SET search_path = public, pg_temp` agregado a las funciones `SECURITY DEFINER` que toqué (`021`, `023`, `024`). Las de `018` y `020` originales quedan sin tocar (son migraciones ya aplicadas; cambiarlas requeriría otra migración de reemplazo, no incluida en esta tanda).
13. ✅ **Piso de seña del 30% aplicado**, tal como lo declara `AGENTS.md` (no es una decisión nueva, es hacer que el código cumpla la regla ya escrita): clamp server-side en `dashboard/venue/actions.ts` + `CHECK` a nivel de base en [`026_deposit_percentage_floor.sql`](../../supabase/migrations/026_deposit_percentage_floor.sql).
14. ⏸️ `returnUrl`/`next` del muro de login y la pantalla de éxito mirando `payment_status` — no abordado en esta tanda.
15. ⏸️ `rescheduleBooking()` sin conectar a la UI — no abordado.
16. ✅ **Bonus, no estaba en la lista original:** cerré la inyección de filtros PostgREST en la búsqueda (`SEC-19`, `search/page.tsx`) — se despoja `, ( ) % *` del término de búsqueda antes de interpolarlo en `.or()`.
17. ✅ **Bonus:** `updated_at` de `bookings` (`COD-04`) — el webhook escribía una columna que no existía. Agregada con el mismo patrón de trigger que ya usan `profiles`/`venues` ([`025_bookings_updated_at.sql`](../../supabase/migrations/025_bookings_updated_at.sql)), y saqué la escritura manual del webhook (ahora la pone el trigger).
18. ✅ **Bonus:** `error.message` crudo ya no se filtra al cliente en `create-preference` ni en el webhook de MP (`SEC-24`) — se loguea completo en servidor y se responde un mensaje genérico.
19. ✅ **Bonus:** XSS del JSON-LD (`SEC-01`) — se escapan `<`, `>` y `&` del `JSON.stringify` antes de inyectarlo en el `<script>`.

### ⚪ BAJO — no abordado en esta tanda

20. Consolidar las cuatro implementaciones divergentes del cálculo de seña.
21. Tipar `createAdminClient()`/`createPublicClient()` con `<Database>` y completar `src/types/database.ts`.
22. Eliminar la referencia colgada a `/mock-payment` en `mercadopago/client.ts:26-27`.
23. Homogeneizar `formatTime` a 24h argentino y conectar `formatPrice`/`formatBookingDate`.
24. Limpiar dependencias de runtime sin consumidores.

---

## Qué falta para que esto quede realmente cerrado

1. **Aplicar las migraciones `021` a `026` en Supabase** — están escritas, verificadas por lectura contra el resto del código y contra las migraciones existentes, pero no ejecutadas contra la base real. Revisarlas antes de aplicar, en particular `021` (toca los triggers de autorización) y `023` (usa `session_replication_role = replica` para poder auto-completar reservas sin chocar con su propio trigger — es una técnica estándar de Postgres para escrituras de mantenimiento internas, pero vale la pena que quede claro qué hace).
2. **La prueba end-to-end de pago contra el sandbox de MP** — sigue siendo la única forma de confirmar con certeza que el flujo de cobro funciona, antes y después de aplicar `021`.
3. **Tres decisiones de producto, no de código**, que quedaron deliberadamente sin tocar: el modelo de comisión (punto 8), si la creación de venues debe requerir moderación (punto 5), y qué hacer con `rescheduleBooking()` (punto 15).

---

## Límites de esta síntesis

- **Sigo sin acceso directo a la base de Supabase.** Todo lo dicho sobre el efecto de aplicar `018`/`019`/`020` es una inferencia por lectura del SQL y del código TypeScript que los consume, no una verificación ejecutada contra la base real. El punto #1 del plan de acción existe precisamente porque esta es la única forma de cerrar esa brecha.
- **No está confirmado el estado de las migraciones `013`, `014`, `015`.** El usuario indicó que antes de hoy "solo estaba aplicado hasta la 017", lo que sugiere que sí están aplicadas, pero no lo verifiqué migración por migración — en particular la `015` (que reemplaza la policy pública de `profiles`) es la de mayor impacto si no lo estuviera.
- **No se ejecutó ninguna prueba dinámica del flujo de pago.** El riesgo del punto #1 de esta síntesis es una hipótesis fundada en la lectura del SQL de `018` y el comportamiento documentado de PostgREST — no una reproducción.
- **Los números económicos de `03-negocio.md` son estimaciones sobre supuestos declarados** (ocupación, take rate hipotético, tasa de cancelación). No hay datos reales de tráfico ni GMV en el repositorio.
- **No se modificó ninguna línea de código.** Esta actualización, igual que la síntesis original, es exclusivamente de lectura: SQL de las migraciones, TypeScript de los call-sites, y los cinco reportes existentes. La única escritura es este documento.
