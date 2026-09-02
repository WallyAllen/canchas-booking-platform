# Auditoría de UX y Accesibilidad — Ronda 2

- **Fecha:** 2026-09-01
- **Commit base:** `a1f7e7f` (working tree con ~148 archivos modificados)
- **Perfil del auditor:** defensor del usuario. Martín, 34 años, en la vereda de 7 y 50, 12% de batería, 3G, guantes puestos, quiere jugar hoy a las 21:00.
- **Método:** lectura del código fuente + `npm run lint` + `rg`. **No se levantó el dev server ni se renderizó la app.** Los hallazgos que dependen de píxeles reales están marcados `[REQUIERE VERIFICACIÓN VISUAL]`.

---

## Resumen ejecutivo

**Este flujo no convierte. Se cae antes de llegar a Mercado Pago, y si llega, se cae al volver.**

Hay tres roturas duras y encadenadas. Primero, el muro de login: `booking/[courtId]/page.tsx:19` redirige con `?returnUrl=...` pero `login/page.tsx:24` lee `?next`. El parámetro se descarta y Martín termina en el home después de loguearse, sin su turno, sin su cancha y sin saber por qué. Segundo, la vuelta desde Mercado Pago: las `back_urls` de fallo y de pendiente apuntan a `/booking/[courtId]?error=...`, y esa página redirige a `/search` cuando no hay `date`/`time` — el usuario que falló el pago aterriza en un listado genérico sin una sola palabra de explicación. Tercero, la pantalla de éxito canta "¡Reserva Confirmada! Tu pago ha sido procesado exitosamente" sin mirar `payment_status`, y si el webhook todavía no llegó (o si el cron ya borró la reserva) muestra "Error al cargar la reserva".

Encima de eso, la barra de búsqueda del home arranca con la clase `invisible` y solo aparece cuando GSAP termina de correr; el error de pago se guarda en un `useState` que nunca se renderiza; el método "Transferencia" navega a una URL con el string literal `court-id` dentro; y `next.config.mjs` no habilita el host de Supabase Storage, así que **ninguna foto real de complejo se renderiza** — todos los predios muestran un emoji ⚽.

La búsqueda ignora fecha y hora (está documentado como decisión de MVP en `search/page.tsx:22-24`), o sea que el "Hoy / 21:00" del hero es decorativo. Y nadie le avisa nunca al usuario que la reserva se autodestruye si tarda en pagar.

Contraste y semántica están, sorprendentemente, bastante mejor que el resto: el verde del dark mode pasa AA con holgura y la grilla de disponibilidad usa `<button disabled aria-label>` de verdad. El problema de accesibilidad no es el color, es el teclado y los nombres accesibles.

---

## "El recorrido del Martín"

### Paso 0 — Abre reservaya.com. 12% de batería, 3G.

El home es un Server Component con `revalidate = 3600`, así que el HTML llega rápido. Bien. Pero:

`src/components/home/hero-search.tsx:46`
```tsx
<div ref={containerRef} className="hero-search-container w-full max-w-5xl mx-auto bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl p-2 sm:p-3 invisible">
```

`src/components/home/hero-search.tsx:26-32`
```tsx
useGSAP(() => {
  gsap.fromTo(
    containerRef.current,
    { y: 40, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", delay: 0.3 }
  )
}, { scope: containerRef })
```

El buscador — el CTA principal del producto — nace `invisible` y solo se hace visible cuando GSAP corre `autoAlpha: 1`. En 3G eso significa: descargar el bundle de cliente con `gsap` + `@gsap/react`, hidratar, esperar 0.3s de delay y 1s de animación. Hasta entonces Martín ve un titular, un párrafo y un vacío negro donde debería estar la caja de búsqueda. Si el chunk de GSAP falla (túnel, ascensor, batería que corta el radio), el buscador **nunca aparece**.

**Punto de abandono #1.** Y no es un "se ve feo": es la funcionalidad principal ausente.

Además, `src/app/(main)/page.tsx:121-123`:
```tsx
<div className="hidden lg:block z-0">
  <Hero3D />
</div>
```
`hidden lg:block` es CSS. React igual monta `<Hero3D />` en el celular, y `src/components/home/hero-3d.tsx:26-30` inyecta un `<Script src="https://unpkg.com/@splinetool/viewer@1.9.72/build/spline-viewer.js">` y un `<spline-viewer url="https://prod.spline.design/.../scene.splinecode" />`. Martín descarga el runtime de Spline y una escena 3D que **nunca va a ver**. Es `strategy="lazyOnload"`, así que no bloquea el FCP, pero le come datos y batería a alguien que tiene 12%.

### Paso 1 — Tap: "Hoy". Tap: "21:00". Tap: "Buscar". (3 taps + 1 popover)

`src/app/(main)/search/page.tsx:22-24`
```tsx
// Note: For a real app, date/time filtering for availability requires a complex query
// checking the bookings table to ensure the slot is free.
// For this MVP, we will filter by venue properties first.
```

Los parámetros `date` y `time` viajan en la URL y **no se usan para nada**. Martín pidió "hoy a las 21" y recibe la lista completa de complejos de La Plata ordenada por rating, incluidos los que están llenos a esa hora y los que ni siquiera abren.

**Punto de abandono #2.** El producto le mintió en el primer paso. Cada complejo que abra y descubra ocupado a las 21 es una chance más de cerrar la pestaña.

### Paso 2 — La pantalla de resultados

`src/components/search/search-layout.tsx:22`
```tsx
<div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
```
`100vh` en móvil incluye la barra de direcciones del navegador; con `overflow-hidden` en el contenedor raíz, el borde inferior queda cortado bajo la UI del browser. `[REQUIERE VERIFICACIÓN VISUAL]`

Y arriba de la lista, `src/components/search/search-filters.tsx:111-186` mete cuatro controles con ancho fijo (`w-[130px]`, `w-[140px]`, `w-[150px]`, `w-[140px]`) más el botón de Filtros, todo dentro de un `flex flex-wrap`, más el input de búsqueda `w-full` de arriba. En 375px eso son tres filas de controles antes de ver una sola cancha. `[REQUIERE VERIFICACIÓN VISUAL]`

El empty state sí está bien resuelto (`venue-list.tsx:27-39`): título, explicación y sugerencia concreta. Le falta un botón que efectivamente limpie los filtros — le dice "probá eliminando algunos filtros" pero no le da el botón.

### Paso 3 — Abre una ficha de complejo

`src/app/(main)/venue/[id]/page.tsx:174` renderiza `<VenueGallery photos={venue.photos || []} />`. Las fotos las sube el dueño con `supabase.storage...getPublicUrl()` (`src/components/dashboard/venue/venue-photos-form.tsx:44`), o sea que viven en `*.supabase.co`. Pero:

`next.config.mjs`
```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: 'placehold.co' },
  ],
},
```

El optimizador de `next/image` rechaza cualquier host no listado. Los `onError` de `venue-card.tsx:41` y `venue-gallery.tsx:47` capturan el fallo y muestran el emoji ⚽. Resultado: **el sitio de reservas no tiene fotos de canchas.** Martín no sabe si va a jugar en un sintético nuevo o en un baldío con red.

**Punto de abandono #3.** La confianza en un marketplace es visual. Sin fotos no hay reserva.

Lo que sí está: dirección, teléfono (`venue/[id]/page.tsx:165-170`), comodidades, mini-mapa con la dirección en texto debajo, chat con el predio. Eso está bien pensado. Lo que no está: cómo llegar (no hay link a Google Maps / Waze), y **nada sobre qué pasa si llueve** — hay un campo `is_covered` por cancha (`court-list.tsx:70-78`) pero cero política de suspensión por lluvia en toda la app.

### Paso 4 — La grilla de disponibilidad

`src/components/venue/availability-grid.tsx:120`
```tsx
<table className="w-full text-sm text-left border-collapse min-w-[800px]">
```
Una tabla de 800px de ancho mínimo dentro de un `overflow-x-auto`, en una pantalla de 375px. Martín tiene que hacer scroll horizontal con guantes para llegar a la columna de las 21:00. La primera columna es `sticky left-0`, lo cual ayuda, pero sigue siendo el patrón de escritorio metido a la fuerza en un teléfono.

`src/components/venue/availability-grid.tsx:33-34`
```tsx
// Hardcode hours for MVP: 14:00 to 23:00 (10 slots of 1 hour)
const hours = Array.from({ length: 10 }, (_, i) => i + 14)
```
Horas cableadas. Un complejo que abre a las 10 no puede mostrar sus turnos de la mañana. Y esto no coincide con el dashboard del dueño (16–23, `dashboard/schedule/page.tsx:39`) ni con el TimePicker del buscador (8:00–23:30, `time-picker.tsx:27`).

Y el error silencioso:
`src/components/venue/availability-grid.tsx:36-54`
```tsx
if (error) throw error
setBookings(data || [])
} catch (error) {
  console.error("Error fetching bookings:", error)
} finally {
  setLoading(false)
}
```
Si la RPC falla, `bookings` queda `[]` y **todos los turnos se pintan "Libre"**. Martín elige las 21:00, avanza, y recién en `booking/[courtId]/page.tsx:87` se entera de que estaba ocupado. Sin mensaje de error, sin reintento, sin "no pudimos cargar la disponibilidad".

### Paso 5 — Tap en "Libre" de las 21:00 → **el muro**

`src/components/venue/availability-grid.tsx:78-81`
```tsx
const handleSlotClick = (courtId: string, hour: number) => {
  const timeStr = `${hour.toString().padStart(2, '0')}:00:00`
  router.push(`/booking/${courtId}?date=${dateStr}&time=${timeStr}`)
}
```

`src/app/(main)/booking/[courtId]/page.tsx:16-21`
```tsx
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  const returnUrl = encodeURIComponent(`/booking/${params.courtId}?date=${searchParams.date}&time=${searchParams.time}`)
  redirect(`/login?returnUrl=${returnUrl}`)
}
```

`src/app/(auth)/login/page.tsx:24`
```tsx
const nextUrl = searchParams.get("next") || "/"
```

**El servidor manda `returnUrl`. El login lee `next`. Nadie lee `returnUrl`.**

La cadena completa: `nextUrl = "/"` → `signInWithGoogle("/")` → `useUser.ts:85` arma `redirectTo: ${origin}/callback?next=/` → `callback/route.ts:7` lee `next ?? '/'` → `NextResponse.redirect(${origin}/)`.

Martín hace OAuth con Google (salida a otro dominio, vuelta, ~4-8 segundos en 3G) y **aterriza en la portada**. Su cancha, su fecha y su horario se evaporaron. Tiene que rehacer los 5 pasos anteriores.

**Punto de abandono #4, y el más caro de todos.** Este solo hallazgo justifica el veredicto del reporte.

Peor: el muro aparece *antes* de que se le muestre siquiera cuánto va a pagar. El desglose de seña vive dentro del wizard, que está detrás del login. Se le pide identidad antes de darle valor.

### Paso 6 — Suponiendo que Martín vuelva a navegar hasta el wizard

`src/components/booking/booking-wizard.tsx:100-110` dibuja un progress bar de **tres** pasos. En el componente solo existen `step === 1` y `step === 2`. El tercer círculo nunca se completa. Le está diciendo "te falta más de lo que te falta".

Paso 1 muestra cancha, dirección, fecha, hora, y "Monto Total". **No muestra la seña todavía.** Recién en el paso 2:

`src/components/booking/booking-wizard.tsx:191`
```tsx
<p className="text-muted-foreground mt-1">Para confirmar la reserva debes abonar la seña (30%).</p>
```
El 30% está cableado en el texto, pero el monto real sale de `court.venues?.deposit_percentage ?? 30` (`booking/[courtId]/page.tsx:103`). Un complejo con 50% de seña le va a mostrar "la seña (30%)" y cobrarle 50%.

El desglose en sí (`:195-209`) está **bien hecho**: Precio Total / Resto a pagar en el complejo / Total a pagar ahora (Seña). Es lo mejor del wizard.

Lo que falta en toda esta pantalla, y que es dinero:
- **Cero mención de la política de cancelación.** El usuario firma sin saber que a menos de 6 horas pierde la seña. Se entera recién cuando abre `cancel-dialog.tsx:99-106`, cuando ya pagó.
- **Cero mención de que la reserva expira.** Ver más abajo.

### Paso 7 — Tap en "Ir a pagar"

`src/components/booking/booking-wizard.tsx:238-240`
```tsx
<Button className="w-full" onClick={handlePayment} disabled={loading}>
  {loading ? "Procesando..." : "Ir a pagar"}
</Button>
```
Esto está bien: se deshabilita mientras envía y cambia el label. No hay doble cobro por doble tap. Correcto.

Pero si la llamada falla:
`src/components/booking/booking-wizard.tsx:42, 74-78`
```tsx
const [error, setError] = useState<string | null>(null)
// ...
} catch (error) {
  console.error('Error initiating payment:', error)
  setError('Error al iniciar el pago con Mercado Pago.')
  setLoading(false)
}
```
**La variable `error` no se renderiza en ninguna parte del JSX.** (`grep -n "error" booking-wizard.tsx` devuelve solo la declaración, el `catch` que la sombrea, y dos `console.error`.) `AlertCircle` se importa en la línea 13 y no se usa.

El botón vuelve a decir "Ir a pagar" y **no pasa absolutamente nada visible**. Martín toca. Nada. Toca de nuevo. Nada. Se va.

**Punto de abandono #5.**

Y si eligió "Transferencia":
`src/components/booking/booking-wizard.tsx:80-83`
```tsx
toast({ title: 'Éxito', description: 'En esta versión Demo, la transferencia redirige al éxito directamente simulando aprobación manual.' })
router.push(`/booking/court-id/success?booking_id=${(booking.id || '')}`)
```
El string literal `court-id` en la URL, y `booking.id` siempre es `undefined` (se pasa como `id: undefined` en `booking/[courtId]/page.tsx:109`). La ruta resultante es `/booking/court-id/success?booking_id=` → `success/page.tsx:17-19` ve `booking_id` vacío y redirige a `/search`. Más el toast que le habla de "esta versión Demo" a un usuario real.

El botón "Cancelar" del paso 1 tiene el mismo problema: llama `cancelPendingBooking('')` con string vacío.

### Paso 8 — Mercado Pago

Cuatro salidas posibles. Ninguna está bien atendida.

`src/lib/mercadopago/client.ts:43-48`
```ts
back_urls: {
  success: `${baseUrl}/booking/${courtId}/success?booking_id=${bookingId}`,
  failure: `${baseUrl}/booking/${courtId}?error=payment_failed`,
  pending: `${baseUrl}/booking/${courtId}?error=payment_pending`
},
auto_return: 'approved',
```

**(a) Falla el pago.** Vuelve a `/booking/[courtId]?error=payment_failed`. Pero `booking/[courtId]/page.tsx:12` solo tipa `searchParams: { date?: string; time?: string }` y las líneas 23-26 hacen:
```tsx
const { date, time } = searchParams
if (!date || !time) {
  redirect("/search")
}
```
Sin `date` ni `time` en esa URL → **redirect a `/search`**. Martín pagó mal, lo escupe un buscador vacío, y el `?error=payment_failed` no se lee en ningún lado del código.

**(b) Pago pendiente.** Idéntico: `/search`. Sin "estamos confirmando tu pago", sin nada.

**(c) Cierra la pestaña de MP.** Su reserva `pending` queda viva en la base hasta que el cron la borra. No hay ningún ping, mail ni pantalla que le diga que el turno sigue reservándose o que ya lo perdió.

**(d) Vuelve a `success` antes del webhook.** Este es el peor:

`src/app/(main)/booking/[courtId]/success/page.tsx:59-64`
```tsx
<div className="bg-green-500/10 p-8 text-center border-b border-green-500/20">
  ...
  <h1 className="text-2xl font-black text-green-500 mb-2">¡Reserva Confirmada!</h1>
  <p className="text-muted-foreground">Tu pago ha sido procesado exitosamente y la cancha ya es tuya.</p>
</div>
```

La página lee `booking` de la base y **jamás mira `booking.payment_status` ni `booking.status`**. Si el webhook todavía no corrió, la reserva está `pending` y la pantalla igual afirma "la cancha ya es tuya". Después el cron (`delete_abandoned_bookings`) borra la fila y Martín se queda sin turno con un mail de confirmación mental en la cabeza.

Y si el cron ya la borró antes de que él vuelva:
`src/app/(main)/booking/[courtId]/success/page.tsx:44-51`
```tsx
if (error || !booking) {
  return (
    <div className="container py-20 text-center">
      <h2 className="text-2xl font-bold mb-4">Error al cargar la reserva</h2>
      <Link href="/bookings" className="text-primary hover:underline">Ver mis reservas</Link>
    </div>
  )
}
```
Pagó con la tarjeta y la app le dice "Error al cargar la reserva". Pánico total y una llamada al predio.

**Falta el estado que salva todo esto:** "Estamos confirmando tu pago con Mercado Pago. Esto puede tardar hasta un minuto." con polling o refresh. No existe.

### Paso 9 — La ventana de expiración

Corrijo la premisa: **son 15 minutos, no 3.** `012_abandoned_bookings_cron.sql` puso 3 minutos, pero `016_extend_booking_cron.sql` redefine la función a `INTERVAL '15 minutes'`. La migración 016 gana. (El mensaje del commit `a1f7e7f`, "delete abandoned bookings after 3 minutes", está desactualizado.)

Dicho eso, el hallazgo de fondo se sostiene entero:

```
$ grep -rniE "setInterval|countdown|contador|expira|temporizador" src/ --include="*.tsx"
(sin resultados relevantes al flujo de reserva)
```

**No hay ningún contador, ningún aviso, ninguna frase en toda la app que le diga al usuario que su reserva tiene fecha de vencimiento.** Ni en el wizard, ni antes de saltar a MP, ni en el mail.

Es una trampa silenciosa. Martín entra a MP, no encuentra la tarjeta, va a buscar la billetera, vuelve a los 18 minutos, paga bien, MP aprueba, el webhook busca la reserva… y la fila ya no existe:

`src/app/api/webhooks/mercadopago/route.ts:58-71`
```ts
const { data: booking, error } = await supabase.from('bookings')
  .update({ payment_status: 'paid', status: 'confirmed', ... })
  .eq('id', bookingId)
  .select('*, profiles(*), courts(*, venues(*))')
  .single()

if (error) { console.error(...); throw error }
```
`.single()` sobre cero filas → error → 500 → MP reintenta y falla siempre. **Plata cobrada, cero reserva, cero notificación, cero rastro para el usuario.** Y el `success` le dice "Error al cargar la reserva".

---

## Tabla de hallazgos

| ID | Título | Archivo:línea | Severidad | Impacto en conversión |
|:---|:---|:---|:---|:---|
| UX-01 | El `returnUrl` del muro de login se descarta: el usuario vuelve al home sin su turno | `src/app/(main)/booking/[courtId]/page.tsx:19` + `src/app/(auth)/login/page.tsx:24` | CRÍTICO | Alto |
| UX-02 | Vuelta de MP con `failure`/`pending` termina en `/search` sin explicación | `src/lib/mercadopago/client.ts:45-46` + `src/app/(main)/booking/[courtId]/page.tsx:24-26` | CRÍTICO | Alto |
| UX-03 | `success` afirma "Reserva Confirmada" sin mirar `payment_status`; no hay estado "confirmando" | `src/app/(main)/booking/[courtId]/success/page.tsx:59-64` | CRÍTICO | Alto |
| UX-04 | El error de pago se guarda en estado y **nunca se renderiza**: el botón falla en silencio | `src/components/booking/booking-wizard.tsx:42,76` | CRÍTICO | Alto |
| UX-05 | Ninguna foto real de complejo carga: falta el host de Supabase Storage en `next.config.mjs` | `next.config.mjs:3-14` + `src/components/dashboard/venue/venue-photos-form.tsx:44` | CRÍTICO | Alto |
| UX-06 | El buscador del hero nace `invisible` y depende de GSAP para existir | `src/components/home/hero-search.tsx:46` | CRÍTICO | Alto |
| UX-07 | Método "Transferencia" navega a `/booking/court-id/success?booking_id=` (literal roto) | `src/components/booking/booking-wizard.tsx:82` | CRÍTICO | Alto |
| UX-08 | Error de la RPC de disponibilidad → todos los turnos se pintan "Libre" | `src/components/venue/availability-grid.tsx:49-53` | CRÍTICO | Alto |
| UX-09 | Imports PascalCase de archivos kebab-case: la build rompe en Linux/Vercel | `src/components/search/venue-list.tsx:4` (+6 más) | CRÍTICO | Alto |
| UX-10 | La búsqueda ignora `date` y `time`: el "Hoy 21:00" del hero es decorativo | `src/app/(main)/search/page.tsx:22-24` | ALTO | Alto |
| UX-11 | Cero aviso de que la reserva expira (15 min); sin contador | `src/components/booking/booking-wizard.tsx` (ausencia) + `016_extend_booking_cron.sql` | ALTO | Alto |
| UX-12 | La política de cancelación no se muestra antes de pagar | `src/components/booking/booking-wizard.tsx:186-244` | ALTO | Medio |
| UX-13 | Login exigido antes de mostrar el precio y la seña | `src/app/(main)/booking/[courtId]/page.tsx:16-21` | ALTO | Alto |
| UX-14 | Grilla de disponibilidad = tabla `min-w-[800px]` con scroll horizontal en móvil | `src/components/venue/availability-grid.tsx:120` | ALTO | Alto |
| UX-15 | Spline 3D se descarga en móvil aunque esté oculto con `hidden lg:block` | `src/app/(main)/page.tsx:121-123` + `src/components/home/hero-3d.tsx:26-30` | ALTO | Medio |
| UX-16 | 14 `alert()` nativos + bug de precedencia que siempre imprime "Desconocido" | `src/components/dashboard/courts/court-form-modal.tsx:21` (+3) | ALTO | Medio |
| UX-17 | Dashboard: "+ Reservar" solo visible con `hover` → inalcanzable en celular | `src/components/dashboard/bookings/bookings-client.tsx:265-269` | ALTO | Medio |
| UX-18 | Dashboard/schedule: celdas con `cursor-pointer` sin handler; fecha en ISO crudo | `src/app/dashboard/schedule/page.tsx:88`, `src/components/dashboard/schedule/schedule-navigation.tsx:36` | ALTO | Medio |
| UX-19 | Botones placebo: "Responder", "Ban", "Hacer Venue Admin", "Reprogramar" | `src/app/dashboard/reviews/page.tsx:94`, `src/app/admin/users/page.tsx:66,68`, `src/components/booking/reschedule-dialog.tsx:59` | ALTO | Medio |
| UX-20 | Sidebar del dashboard ocupa la pantalla entera en móvil (7 ítems, sin colapsar) | `src/app/dashboard/layout.tsx:33` + `src/components/layout/sidebar.tsx:30` | ALTO | Medio |
| UX-21 | Wizard dibuja 3 pasos; solo existen 2 | `src/components/booking/booking-wizard.tsx:100-110` | MEDIO | Medio |
| UX-22 | "seña (30%)" cableado en texto vs `deposit_percentage` configurable | `src/components/booking/booking-wizard.tsx:191`, `src/components/booking/cancel-dialog.tsx:35` | MEDIO | Medio |
| UX-23 | Paletas light-only (`bg-red-50`, `bg-green-100`) dentro de una app dark | `src/components/booking/cancel-dialog.tsx:87,92,100`, `src/app/dashboard/schedule/page.tsx:97-99` | MEDIO | Bajo |
| UX-24 | `formatPrice` / `formatBookingDate` existen y no se usan: 30 `toLocaleString` a mano | `src/lib/utils/currency.ts:5`, `src/lib/utils/dates.ts:24` | MEDIO | Bajo |
| UX-25 | `formatTime` devuelve `"2:00 PM"` (formato no argentino) | `src/lib/utils/dates.ts:40-45` | MEDIO | Bajo |
| UX-26 | Cuatro rangos horarios distintos cableados en cuatro archivos | `availability-grid.tsx:34`, `dashboard/schedule/page.tsx:39`, `time-picker.tsx:27`, `create-preference/route.ts:75` | MEDIO | Medio |
| UX-27 | Filtros de búsqueda con anchos fijos → 3 filas de controles en 375px | `src/components/search/search-filters.tsx:111-186` | MEDIO | Medio |
| UX-28 | `/search` usa `h-[calc(100vh-64px)] overflow-hidden` en móvil | `src/components/search/search-layout.tsx:22` | MEDIO | Medio |
| UX-29 | Hero y promos mandan `?date=` que la ficha de complejo ignora | `src/components/home/promo-carousel.tsx:62` + `src/app/(main)/venue/[id]/page.tsx:116` | MEDIO | Medio |
| UX-30 | Cero skeletons en toda la app (el componente existe, 0 usos) | `src/components/ui/skeleton.tsx` (sin consumidores) | MEDIO | Medio |
| UX-31 | Nada sobre lluvia / suspensión de partido en ninguna pantalla | (ausencia global) | MEDIO | Medio |
| UX-32 | Ficha de complejo sin CTA sticky en móvil | `src/app/(main)/venue/[id]/page.tsx:149-278` | MEDIO | Medio |
| UX-33 | Stats "+50 canchas / +10k reservas / 24-7" cableados y falsos | `src/app/(main)/page.tsx:157-173` | MEDIO | Bajo |
| UX-34 | `venue-image.tsx` usa `<Image fill>` sin `sizes` | `src/components/venue/venue-image.tsx:26-32` | MEDIO | Bajo |
| UX-35 | Los links legales del footer y del login apuntan a rutas inexistentes (404) | `src/components/search/search-layout.tsx:80-82`, `src/app/(auth)/login/page.tsx:132-134` | MEDIO | Bajo |
| UX-36 | "Overview" y "Close" en inglés en una UI en español | `src/components/layout/sidebar.tsx:17`, `src/components/ui/dialog.tsx:75` | BAJO | Bajo |
| UX-37 | `not-found.tsx` es Server Component con `onClick` | `src/app/not-found.tsx:11` | BAJO | Bajo |
| UX-38 | El fallback de MP apunta a `/mock-payment`, ruta borrada del working tree | `src/lib/mercadopago/client.ts:26` | BAJO | Bajo |
| UX-39 | `error.message` crudo del servidor devuelto al cliente | `src/app/api/booking/create-preference/route.ts:116` | BAJO | Bajo |
| UX-40 | `package.json` sigue con el nombre `elpotrero-init` | `package.json:2` | BAJO | Bajo |

**Conteo:** 9 CRÍTICOS · 11 ALTOS · 15 MEDIOS · 5 BAJOS.

---

## Detalle por hallazgo

### UX-01 — CRÍTICO — El `returnUrl` del muro de login se descarta

**Ubicación:** `src/app/(main)/booking/[courtId]/page.tsx:19` y `src/app/(auth)/login/page.tsx:24`

```tsx
// booking/[courtId]/page.tsx:19-20 — EMISOR
const returnUrl = encodeURIComponent(`/booking/${params.courtId}?date=${searchParams.date}&time=${searchParams.time}`)
redirect(`/login?returnUrl=${returnUrl}`)
```
```tsx
// login/page.tsx:24 — RECEPTOR
const nextUrl = searchParams.get("next") || "/"
```

La cadena completa hasta el destino final: `nextUrl = "/"` → `signInWithGoogle("/")` → `useUser.ts:85` `redirectTo: ${origin}/callback?next=/` → `callback/route.ts:7,14` `redirect(${origin}/)`.

**Qué ve el usuario:** elige cancha, día y hora; le piden loguearse; hace el viaje a Google y vuelve… al home. Cero contexto, cero explicación, cero rastro de su elección.

**Por qué abandona:** invirtió cinco interacciones y un roundtrip de OAuth y el sistema le borró todo. La segunda vez que le pase, cierra.

**Remediación descriptiva:** unificar el nombre del parámetro en toda la cadena (`redirect`, `login`, `signInWith*`, `/callback`), validar que sea una ruta interna relativa antes de redirigir, y aceptar ambos nombres durante la transición. `src/app/(main)/bookings/page.tsx:19` usa el mismo `?returnUrl=` y tiene el mismo defecto.

---

### UX-02 — CRÍTICO — La vuelta con `failure` o `pending` cae en `/search`

**Ubicación:** `src/lib/mercadopago/client.ts:44-46` y `src/app/(main)/booking/[courtId]/page.tsx:12,23-26`

```ts
failure: `${baseUrl}/booking/${courtId}?error=payment_failed`,
pending: `${baseUrl}/booking/${courtId}?error=payment_pending`
```
```tsx
searchParams: { date?: string; time?: string }   // ← `error` ni siquiera está tipado
// ...
const { date, time } = searchParams
if (!date || !time) { redirect("/search") }
```

`grep -rn "payment_failed\|payment_pending" src/` solo devuelve el propio `client.ts`. Nadie los consume.

**Qué ve el usuario:** rechazo del banco, vuelve a la app, y aparece un listado de canchas. Sin mensaje. Sin saber si le cobraron.

**Por qué abandona:** cree que algo se rompió, y ante la duda de "¿me cobraron o no?" no reintenta — llama al complejo o se va a otro lado.

**Remediación descriptiva:** que las `back_urls` conserven `date` y `time`, y que la página de reserva lea `error` y renderice un bloque accionable ("El pago fue rechazado. Tu turno de las 21:00 sigue disponible por X minutos — reintentar" / "Tu pago quedó pendiente de acreditación, te avisamos por mail"). Es más simple y más honesto mandar `failure`/`pending` a una ruta propia de estado de pago que reciba el `booking_id`.

---

### UX-03 — CRÍTICO — `success` miente sobre el estado del pago

**Ubicación:** `src/app/(main)/booking/[courtId]/success/page.tsx:44-51, 59-64`

```tsx
if (error || !booking) {
  return (<div className="container py-20 text-center">
    <h2 className="text-2xl font-bold mb-4">Error al cargar la reserva</h2>
    <Link href="/bookings" className="text-primary hover:underline">Ver mis reservas</Link>
  </div>)
}
// ...
<h1 className="text-2xl font-black text-green-500 mb-2">¡Reserva Confirmada!</h1>
<p className="text-muted-foreground">Tu pago ha sido procesado exitosamente y la cancha ya es tuya.</p>
```

La consulta trae la fila completa (`select('*')`) — `payment_status` y `status` están disponibles — y no se consultan en ninguna rama.

**Qué ve el usuario:** en el mejor caso, un tilde verde prematuro sobre una reserva todavía `pending`. En el peor, "Error al cargar la reserva" después de haber pagado.

**Por qué abandona (o peor, se queja):** el usuario que confía en el tilde verde y llega al predio sin reserva es una reseña de 1 estrella y un dueño enojado. Este es el hallazgo con más costo reputacional del reporte.

**Remediación descriptiva:** ramificar por `payment_status`. `paid` → la pantalla actual. `pending`/inexistente → una pantalla "Estamos confirmando tu pago con Mercado Pago" con refresco automático acotado y un fallback claro después de N intentos ("todavía no nos llegó la confirmación; guardá este número y revisá Mis Reservas"). Nunca mostrar "Error al cargar la reserva" a alguien que acaba de volver de un checkout.

---

### UX-04 — CRÍTICO — El error de pago existe en memoria y no en pantalla

**Ubicación:** `src/components/booking/booking-wizard.tsx:13, 42, 74-78`

```tsx
import { AlertCircle } from "lucide-react"      // línea 13 — importado, nunca usado
const [error, setError] = useState<string | null>(null)   // línea 42
// ...
} catch (error) {                                // línea 74 — sombrea el estado
  console.error('Error initiating payment:', error)
  setError('Error al iniciar el pago con Mercado Pago.')
  setLoading(false)
}
```

Verificación: `grep -n "error" src/components/booking/booking-wizard.tsx` devuelve exactamente las líneas 42, 74, 75 y 163. **No hay ningún `{error && ...}` en el JSX.**

**Qué ve el usuario:** el botón dice "Procesando…", vuelve a decir "Ir a pagar", y no pasa nada más. Silencio absoluto.

**Por qué abandona:** un botón que no responde se interpreta como app rota. No hay reintento porque no hay señal de que reintentar sirva.

**Remediación descriptiva:** renderizar un bloque de error con `role="alert"` encima de los botones (el patrón ya existe y funciona bien en `login/page.tsx:85-93`), renombrar la variable del `catch` para no sombrear el estado, y usar el `AlertCircle` ya importado.

---

### UX-05 — CRÍTICO — No se ve ni una sola foto real de cancha

**Ubicación:** `next.config.mjs:3-14`, `src/components/dashboard/venue/venue-photos-form.tsx:44`

```js
remotePatterns: [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'placehold.co' },
],
```
Las fotos que suben los dueños salen de `supabase.storage.from(...).getPublicUrl(fileName)` → host `*.supabase.co`, que no está en la lista. El optimizador rechaza el request, los `onError` de `venue-card.tsx:41` y `venue-gallery.tsx:47-50` capturan el fallo, y la UI degrada al emoji ⚽.

**Qué ve el usuario:** un marketplace de canchas sin canchas. Pelotitas grises.

**Por qué abandona:** nadie paga una seña de $4.500 por un lugar que no puede ver. La foto es el 80% de la decisión.

**Remediación descriptiva:** agregar el host de Supabase Storage (idealmente derivado de `NEXT_PUBLIC_SUPABASE_URL`) a `remotePatterns`. `[REQUIERE VERIFICACIÓN VISUAL]` para confirmar que en la instancia real las fotos efectivamente cuelgan de ese host y no de un CDN intermedio.

---

### UX-06 — CRÍTICO — El buscador depende de una librería de animación para ser visible

Ver "Paso 0" arriba. `src/components/home/hero-search.tsx:46`.

**Remediación descriptiva:** que el estado inicial visible sea el default y la animación sea aditiva (por ejemplo, animar solo `y` con la opacidad ya en 1, o aplicar `invisible` únicamente después de que GSAP confirmó que está listo). El CTA principal de un producto no debe depender de que ejecute JavaScript de terceros.

---

### UX-07 — CRÍTICO — "Transferencia" navega a una URL literal rota

**Ubicación:** `src/components/booking/booking-wizard.tsx:79-83`

```tsx
} else {
  // Transferencia MVP
  toast({ title: 'Éxito', description: 'En esta versión Demo, la transferencia redirige al éxito directamente simulando aprobación manual.' })
  router.push(`/booking/court-id/success?booking_id=${(booking.id || '')}`)
}
```

Tres defectos en cuatro líneas: el segmento literal `court-id`; `booking.id` que siempre es `undefined` (`booking/[courtId]/page.tsx:109`: `id: undefined`); y un toast que le habla al usuario final de "esta versión Demo".

Además la tarjeta de "Transferencia" promete "Alias / CBU. Requiere adjuntar comprobante" (`:229`) — no hay ningún flujo de alias, CBU ni adjunto en el código.

**Qué ve el usuario:** elige transferencia, lee un mensaje sobre una demo, y termina en `/search`.

**Remediación descriptiva:** o se implementa el flujo de transferencia completo, o se saca la opción de la UI. Ofrecer un método de pago que no existe es peor que ofrecer uno solo.

---

### UX-08 — CRÍTICO — Un fetch fallido pinta toda la grilla como "Libre"

**Ubicación:** `src/components/venue/availability-grid.tsx:36-59`

```tsx
if (error) throw error
setBookings(data || [])
} catch (error) {
  console.error("Error fetching bookings:", error)
} finally { setLoading(false) }
```

No hay estado de error en el componente. `bookings` queda `[]`, la línea 143 `bookings.some(...)` da `false` para todos, y cada celda renderiza el botón verde "Libre".

**Qué ve el usuario:** una cancha con disponibilidad total un viernes a las 21. Elige, avanza, y `booking/[courtId]/page.tsx:87-99` le dice "Turno Ocupado — Alguien más reservó este turno hace unos instantes". Mentira: nadie reservó nada, falló la red.

**Remediación descriptiva:** agregar estado de error con reintento explícito, y no renderizar la grilla como disponible cuando la carga falló. Si `courts.length === 0` (`:56`) tampoco se hace fetch y queda una tabla con encabezados y cero filas, sin empty state — mismo tratamiento.

---

### UX-09 — CRÍTICO — Imports con casing incorrecto: la build no sobrevive a Linux

```
src/components/search/search-layout.tsx:7      import { VenueMap } from "@/components/map/VenueMap"
src/components/search/venue-list.tsx:4         import { VenueCard } from "@/components/venue/VenueCard"
src/components/dashboard/bookings/bookings-client.tsx:7  import { BookingActions } from "@/components/dashboard/bookings/BookingActions"
src/components/map/venue-map.tsx:3             import { SearchVenueItem } from "@/components/search/VenueList"
src/components/map/venue-map-client.tsx:9      import { SearchVenueItem } from "@/components/search/VenueList"
src/app/(auth)/login/page.tsx:7                import { useUser } from "@/hooks/use-user"
src/app/(main)/profile/page.tsx:6              import { useUser } from "@/hooks/use-user"
```

Los archivos reales son `venue-map.tsx`, `venue-card.tsx`, `booking-actions.tsx`, `venue-list.tsx`, `useUser.ts`. En macOS (APFS case-insensitive) resuelven; en el filesystem de Vercel no. Cada uno está tapado con un `@ts-expect-error`, que silencia el chequeo de tipos pero no arregla la resolución de módulos.

Lo incluyo en un reporte de UX porque el impacto para el usuario es "la página no existe". `[REQUIERE VERIFICACIÓN]` en un build real sobre Linux.

---

### UX-10 — ALTO — La búsqueda ignora fecha y hora

`src/app/(main)/search/page.tsx:15-20` parsea `q`, `type`, `surface`, `minPrice`, `maxPrice`, `minRating` — nunca `date` ni `time`. El comentario de las líneas 22-24 lo declara como decisión consciente de MVP.

**Por qué abandona:** el usuario que busca "hoy 21:00" y recibe una lista sin filtrar tiene que abrir N fichas para descubrir cuál tiene ese turno libre. En 3G con 12% de batería, N ≤ 2.

**Remediación descriptiva:** cruzar con `bookings` (la RPC `get_venue_availability` de la migración 020 ya hace exactamente esta consulta por venue) y, como mínimo intermedio, mostrar un badge "sin disponibilidad a las 21:00" en las tarjetas y un aviso honesto de que el filtro horario todavía no aplica.

---

### UX-11 — ALTO — La ventana de expiración es invisible

Corrección de premisa: `016_extend_booking_cron.sql` reemplaza el `INTERVAL '3 minutes'` de la 012 por `INTERVAL '15 minutes'`.

La reserva `pending` se crea en `create-preference/route.ts:68-79`, justo antes del salto a MP. A partir de ese instante corre el reloj, y **el usuario no tiene forma de saberlo**.

Escenario real y frecuente: 18 minutos en el checkout de MP (buscar la tarjeta, código SMS del banco), pago aprobado, y el webhook (`api/webhooks/mercadopago/route.ts:58-71`) hace `.update().eq('id', bookingId).select().single()` sobre una fila ya borrada → error → 500 → MP reintenta y falla siempre. Cobro sin reserva y sin notificación.

**Remediación descriptiva:** mostrar la ventana antes del salto ("Tenés 15 minutos para completar el pago") y un contador visible al volver; y en el webhook, tratar el caso "reserva inexistente" como una condición esperada que dispare reembolso o recreación en vez de un 500 en loop.

---

### UX-12 — ALTO — La política de cancelación llega tarde

El wizard (`booking-wizard.tsx:186-244`) no menciona cancelaciones. El único lugar donde aparece la regla es `cancel-dialog.tsx:91-107`, cuando el usuario ya pagó y quiere salir:

```tsx
) : givesCredit ? (
  <p>Al cancelar ahora, recibirás <strong>${depositAmount.toLocaleString('es-AR')} en Créditos</strong> ...</p>
) : (
  <p>Al cancelar con menos de 6 horas de anticipación, <strong>perdés la seña abonada de ${depositAmount.toLocaleString('es-AR')}</strong>.</p>
)
```

El diálogo en sí está bien construido: tres estados según la ventana, checkbox de confirmación explícita y botón deshabilitado hasta tildarlo (`:133`). El problema es exclusivamente el momento.

**Remediación descriptiva:** una línea en el paso 2, junto al desglose: "Cancelás con más de 6 h → recuperás la seña como crédito. Con menos de 6 h → la perdés." Reduce ansiedad de compra y disputas posteriores.

---

### UX-13 — ALTO — Muro de login antes del valor

El gate está en el servidor, en `booking/[courtId]/page.tsx:16-21`, antes de que el usuario haya visto una sola vez cuánto es la seña. El desglose (Precio Total / Resto en el complejo / Seña) vive detrás de ese muro.

**Remediación descriptiva:** dejar ver el paso 1 y el desglose de precios sin sesión, y pedir login recién al tocar "Ir a pagar" (con el retorno funcionando, ver UX-01). El precio es el argumento de venta; esconderlo detrás del login es regalar la conversión.

---

### UX-14 — ALTO — La grilla de 800px

`availability-grid.tsx:120` (`min-w-[800px]`), con 10 columnas de `min-w-[80px]` más una columna de cancha de 200px. La columna de cancha es `sticky left-0` (`:136`), lo cual está bien pensado, pero el patrón de fondo sigue siendo una hoja de cálculo.

**Remediación descriptiva:** en móvil, invertir el eje — una lista de horas con chips de canchas libres por hora es la forma nativa de este problema en pantalla angosta. La grilla de escritorio puede quedarse tal cual desde `md:`.

---

### UX-15 — ALTO — Spline 3D en el celular

`page.tsx:121-123` esconde con CSS, no con JS. `hero-3d.tsx:26-30` monta el `<Script>` y el `<spline-viewer>` igual.

**Remediación descriptiva:** montar `Hero3D` condicionalmente por media query en JS (o pasar la escena a un poster estático), y respetar `prefers-reduced-motion` mientras tanto.

---

### UX-16 — ALTO — `alert()` nativos y el bug de precedencia

14 llamadas a `alert()` en el árbol de componentes (chat, inbox, dashboard, cancel-dialog). En móvil son diálogos modales del sistema, fuera del diseño, que interrumpen y no dejan copiar el contexto.

Y cuatro de ellas tienen este bug:
```tsx
alert("Error: " + error instanceof Error ? error.message : "Desconocido")
```
`+` liga más fuerte que `? :`, así que se evalúa `("Error: " + error) instanceof Error` → siempre `false` → el usuario **siempre** ve `"Desconocido"`. Presente en `court-form-modal.tsx:21`, `pricing-modal.tsx:21`, `manual-booking-modal.tsx:28`.

**Remediación descriptiva:** reemplazar por el sistema de toast que ya existe (`ui/use-toast.ts`) y arreglar la precedencia con paréntesis.

---

### UX-17 — ALTO — El dueño en el celular no puede crear una reserva manual

`src/components/dashboard/bookings/bookings-client.tsx:265-269`
```tsx
<div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-primary">
    + Reservar
  </Button>
</div>
```
`opacity-0` + `group-hover` = invisible en touch. El dueño al costado de la cancha, con un cliente adelante que quiere el turno de las 22, no encuentra el botón.

**Remediación descriptiva:** en pantallas táctiles (o simplemente por debajo de `md:`), mostrar el botón siempre. Un affordance que solo existe con hover no existe en la mitad de los dispositivos.

---

### UX-18 — ALTO — El calendario del dashboard promete interacción que no da

`src/app/dashboard/schedule/page.tsx:88`
```tsx
{hours.map(hour => (
  <div key={hour} className="h-full min-h-[80px] border-r last:border-r-0 border-dashed hover:bg-muted/30 transition-colors cursor-pointer" />
))}
```
Celdas con `cursor-pointer` y `hover:bg-muted/30` **sin ningún `onClick`**. Lo mismo en los bloques de reserva (`:104`). El dueño toca la celda de las 21, se ilumina, y no pasa nada.

Y `schedule-navigation.tsx:36` muestra `{currentDate}` crudo: `2026-09-01`, en vez de "Lun 1 de septiembre".

El contenedor es `min-w-[800px]` (`:57`) — mismo problema de tabla ancha que UX-14, y esta pantalla es *específicamente* la que el dueño usa desde el teléfono.

---

### UX-19 — ALTO — Cuatro botones placebo en producción

```tsx
// dashboard/reviews/page.tsx:94-97
<Button variant="outline" size="sm">
  <MessageCircle className="h-4 w-4 mr-2" />
  Responder
</Button>
```
```tsx
// admin/users/page.tsx:66,68
<Button variant="outline" size="sm" className="mr-2">Hacer Venue Admin</Button>
<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Ban</Button>
```
```tsx
// booking/reschedule-dialog.tsx:59
<p className="mb-4">Funcionalidad de reprogramación en desarrollo.</p>
```

Ninguno tiene handler. "Reprogramar" al menos es honesto dentro del diálogo, pero el botón se ofrece en la lista de reservas de todos los usuarios (`bookings/page.tsx:116`) como si funcionara.

**Remediación descriptiva:** ocultar o deshabilitar con tooltip explicativo. Un botón que no hace nada erosiona la confianza en todos los demás botones de la app.

---

### UX-20 — ALTO — El sidebar del dashboard se come la pantalla en móvil

`src/app/dashboard/layout.tsx:33`
```tsx
<aside className="w-full md:w-64">
  <Sidebar />
</aside>
```
`src/components/layout/sidebar.tsx:30`
```tsx
<nav className="flex flex-col gap-2 p-4 md:w-64 border-r min-h-[calc(100vh-4rem)] bg-muted/20">
```
En móvil: ancho completo, columna vertical, `min-h-[calc(100vh-4rem)]`. Siete ítems más el encabezado ocupan **una pantalla entera antes de que empiece el contenido**, en cada carga de cada página del dashboard. `[REQUIERE VERIFICACIÓN VISUAL]`

**Remediación descriptiva:** en móvil, un `Sheet` lateral (el patrón ya está resuelto en `header.tsx:129-168`) o una barra inferior de navegación.

---

### UX-21 a UX-40 — resumen de hallazgos MEDIO y BAJO

- **UX-21** `booking-wizard.tsx:100-110` dibuja `[1,2,3]`; el componente solo renderiza `step === 1` y `step === 2`. El tercer nodo nunca se completa y el usuario percibe un paso fantasma.
- **UX-22** `booking-wizard.tsx:191` dice "la seña (30%)" cableado, mientras el monto sale de `deposit_percentage` (`booking/[courtId]/page.tsx:103`). `cancel-dialog.tsx:35` hace `Math.ceil(booking.total_price * 0.3)` también cableado. `helpers.ts:6` `calculateDeposit` idem. Existe `currency.ts:17` `calculateDeposit(total, pct)` bien parametrizada y nadie la usa.
- **UX-23** `cancel-dialog.tsx:87,92,100` usa `bg-red-50/text-red-800`, `bg-green-50/text-green-800`, `bg-amber-50/text-amber-800`; `dashboard/schedule/page.tsx:97-99` y `bookings-client.tsx:238-240` usan `bg-red-100/bg-green-100/bg-blue-100`. Paletas de light mode en una app cuyo default es `dark` (`app/layout.tsx:24`): cajas blancas dentro de tarjetas oscuras. El contraste *interno* de esos pares pasa AA (6.8:1, 6.8:1, 7.1:1) — el problema es coherencia visual, no legibilidad. `[REQUIERE VERIFICACIÓN VISUAL]`
- **UX-24** `formatPrice`, `formatBookingDate`, `formatDepositLabel`, `todayArgentina` están escritos y testeados en `src/lib/utils/` y **no los importa nadie** (`hoursUntilBooking` es la única excepción). En su lugar hay ~30 `"$" + n.toLocaleString('es-AR')` a mano. La salida es correcta ("$15.000"), pero cualquier cambio de formato hay que hacerlo en 30 lugares.
- **UX-25** `dates.ts:40-45` `formatTime('21:00')` → `"9:00 PM"`. Formato ajeno al uso argentino. Hoy no se usa, pero es una trampa esperando a que alguien lo importe.
- **UX-26** Cuatro rangos horarios distintos: 14–23 (`availability-grid.tsx:34`), 16–23 (`dashboard/schedule/page.tsx:39`), 14:00–23:30 (`bookings-client.tsx:90`), 8:00–23:30 (`time-picker.tsx:27`). Y `create-preference/route.ts:75` inserta `end_time: "23:59:00"` para todas las reservas, sin importar la duración real del turno. El usuario ve "1 hora" en el wizard (`booking-wizard.tsx:139`) y la base guarda otra cosa.
- **UX-27 / UX-28** Ver "Paso 2". `[REQUIERE VERIFICACIÓN VISUAL]`
- **UX-29** `promo-carousel.tsx:62` linkea a `/venue/${id}?date=${promo.date}` y `hero-search.tsx:40` propaga `date`/`time` a `/search`, pero `venue/[id]/page.tsx:116` solo desestructura `{ params }` y `availability-grid.tsx:27` arranca con `useState<Date>(new Date())`. El contexto elegido se pierde en cada salto.
- **UX-30** `ui/skeleton.tsx` existe; `grep -rn "Skeleton" src/ --include="*.tsx"` fuera del propio archivo: cero resultados. Todos los estados de carga son spinners genéricos (`app/loading.tsx`, `venue/[id]/page.tsx:211`, `venue-map.tsx:11`, `login/page.tsx:62`). Ninguno tiene timeout ni salida: un spinner que gira para siempre no da ninguna acción al usuario.
- **UX-31** No hay una sola cadena sobre lluvia, suspensión o reprogramación por clima en todo `src/`. En La Plata, en canchas descubiertas, es la pregunta número uno.
- **UX-32** `venue/[id]/page.tsx` no tiene barra de acción fija. En móvil, después de scrollear galería + descripción + comodidades + canchas, hay que seguir bajando hasta la grilla para poder reservar.
- **UX-33** `page.tsx:157-173`: "+50 Canchas", "+10k Reservas", "24/7". El propio comentario dice `{/* f) Stats (Hardcoded para diseño) */}`. Cifras inventadas en la home de un producto que maneja pagos.
- **UX-34** `venue-image.tsx:26-32` usa `<Image fill>` sin `sizes`, a diferencia de `venue-card.tsx:39` y `venue-gallery.tsx:45` que sí lo pasan. Sin `sizes`, `fill` sirve la variante más grande disponible. En 3G eso importa.
- **UX-35** `search-layout.tsx:80-82` y `login/page.tsx:132-134` linkean a `/terminos`, `/privacidad` y `/contacto`. No existe ninguna de las tres rutas bajo `src/app/`. El usuario acepta términos con un link que da 404 — además de ser un problema legal.
- **UX-36** "Overview" (`sidebar.tsx:17`) en un menú donde todo lo demás está en español; "Close" (`dialog.tsx:75`, `sheet.tsx:75`) y "Close toast" (`toast.tsx:120`) son los nombres accesibles que va a leer un lector de pantalla en español.
- **UX-37** `app/not-found.tsx:11` es un Server Component (sin `"use client"`) con `onClick={() => window.location.href="/"}`. `[REQUIERE VERIFICACIÓN]` en build de producción.
- **UX-38** `mercadopago/client.ts:26` devuelve `init_point: /mock-payment?...` cuando el token es de test. `src/app/(main)/mock-payment/page.tsx` está borrada en el working tree. En desarrollo, "Ir a pagar" lleva a un 404.
- **UX-39** `create-preference/route.ts:116` devuelve `error.message` del servidor al cliente. Hoy el wizard no lo muestra (por UX-04), pero cuando UX-04 se arregle, mostrará mensajes crudos de Supabase/Postgres.
- **UX-40** `package.json:2`: `"name": "elpotrero-init"`.

---

## Accesibilidad WCAG 2.2 AA

`AGENTS.md` lo declara requisito y `.cursor/rules/accessibility.mdc` desarrolla el estándar (semántica, teclado, ARIA, skip link, live regions). El código cumple una parte.

### Salida real del linter

```
$ npm run lint

> elpotrero-init@0.1.0 lint
> next lint

✔ No ESLint warnings or errors
```

**Esta salida limpia no significa nada.** Dos razones concretas:

1. **19 supresiones explícitas de `jsx-a11y`** en el árbol:
```
src/components/booking/booking-wizard.tsx:4   /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
src/components/booking/booking-wizard.tsx:5   (la misma línea, duplicada)
src/components/venue/venue-gallery.tsx:1      /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
src/components/ui/label.tsx:1,8               /* eslint-disable jsx-a11y/label-has-associated-control */
+ 14 archivos más con label-has-associated-control desactivado
   (dashboard/courts/*, dashboard/venue/*, dashboard/schedule/*, dashboard/bookings/*, metric-card)
```
Los archivos con las violaciones más graves son exactamente los que tienen la regla apagada.

2. **`jsx-a11y` no ve a través del componente `Button`.** Todos los botones de solo ícono se escriben `<Button size="icon"><ChevronLeft/></Button>`. Como `Button` es un componente propio (`ui/button.tsx:44`) y no un `<button>` literal, la regla no puede evaluar si tiene nombre accesible.

**Conclusión: el linter da un falso verde. Los hallazgos de abajo son manuales.**

### 1.4.3 Contraste mínimo — calculado sobre los tokens reales de `globals.css`

Los tokens están en `oklch`. Convertidos a sRGB y evaluados:

| Par | Hex | Ratio | 4.5:1 |
|:---|:---|---:|:---|
| `--primary` dark `oklch(0.65 0.17 146)` sobre `--background` dark | `#36a949` / `#0a0a0a` | **6.53:1** | ✅ |
| `--primary` dark sobre `--card` dark `oklch(0.205 0 0)` | `#36a949` / `#171717` | **5.91:1** | ✅ |
| `--primary` dark sobre `--muted` dark `oklch(0.269 0 0)` | `#36a949` / `#262626` | **4.99:1** | ✅ |
| `--muted-foreground` dark sobre `--card` | `#a1a1a1` / `#171717` | **6.94:1** | ✅ |
| `--foreground` dark sobre `--background` | `#fafafa` / `#0a0a0a` | **18.97:1** | ✅ |
| `--primary-foreground` sobre `--primary` (botón primario) | `#0a0a0a` / `#36a949` | **6.53:1** | ✅ |
| `--destructive` dark sobre `--card` | `#ff6467` / `#171717` | **6.21:1** | ✅ |
| `--primary` **light** `oklch(0.55 0.15 146)` sobre blanco | `#238735` / `#ffffff` | **4.58:1** | ✅ (al filo) |

**El verde del tema pasa AA en ambos modos.** Esto está bien resuelto y corrige un hallazgo de la ronda 1. Nota: el `#22c55e` de la premisa (`green-500`) no es el token del tema; da 8.69:1 sobre el fondo oscuro.

Lo que **sí falla**, y son clases de Tailwind sueltas, no tokens:

| Ubicación | Clase | Ratio | Criterio |
|:---|:---|---:|:---|
| `success/page.tsx:63` `¡Reserva Confirmada!` | `text-green-500` sobre blanco (light mode) | **2.28:1** | ❌ **1.4.3** (falla incluso el umbral 3:1 de texto grande) |
| `bookings/page.tsx:62` badge Confirmada | `text-green-500` sobre `bg-green-500/10` en light | **~2.3:1** | ❌ 1.4.3 |
| `profile/credits-list.tsx:71` | `text-green-600` sobre fondo claro | limítrofe | ⚠️ `[REQUIERE VERIFICACIÓN VISUAL]` |

El `ThemeProvider` usa `defaultTheme="dark"` **con `enableSystem`** (`app/layout.tsx:22-27`), así que un usuario con el sistema en claro obtiene el tema claro y ve estos fallos. En dark, los mismos verdes dan 7.87:1 y pasan.

### 1.4.11 Contraste de elementos no textuales

- `availability-grid.tsx:164`: el botón "Libre" es `bg-primary/10` con `border-primary/20`. Un borde al 20% de opacidad sobre `--card` no llega a 3:1. El estado disponible/ocupado se comunica por color + texto ("Libre"/"Ocupado"), así que **1.4.1 (Uso del color) sí está cumplido** — es solo el borde. `[REQUIERE VERIFICACIÓN VISUAL]`

### 2.4.1 Saltar bloques — ❌

`.cursor/rules/accessibility.mdc` exige explícitamente el skip link como primer hijo de `<body>`. `grep -rn "Saltar al contenido" src/` → cero resultados. `app/layout.tsx:21` no lo tiene y `(main)/layout.tsx:12` renderiza `<main className="flex-1">` sin `id` ni `tabIndex={-1}`.

Un usuario de teclado atraviesa logo + 3-4 links de nav + avatar/menú en cada página antes de llegar al contenido.

### 2.1.1 Teclado — ❌ tres violaciones confirmadas

**(a) Selección de método de pago** — `booking-wizard.tsx:215-231`:
```tsx
<div
  className={`border rounded-xl p-4 cursor-pointer transition-all ${...}`}
  onClick={() => setPaymentMethod('mercadopago')}
>
```
`<div onClick>` sin `role`, sin `tabIndex`, sin `onKeyDown`. Es la elección de método de pago: **inalcanzable por teclado**. La regla que lo detectaría está desactivada en las líneas 4-5 del mismo archivo. Es un grupo de radio y debería ser `<input type="radio">` con `<label>`.

**(b) Encabezados de tabla ordenables** — `bookings-client.tsx:144-158`:
```tsx
<th className="px-6 py-4 font-medium cursor-pointer hover:bg-muted" onClick={() => handleSort('booking_date')}>
  <div className="flex items-center gap-1">Fecha y Hora <ArrowUpDown className="h-3 w-3" /></div>
</th>
```
Cinco `<th onClick>` sin `<button>` interno, sin `aria-sort` (falla también **4.1.2**). No se llega con Tab y el lector de pantalla no anuncia el orden actual.

**(c) Miniaturas de galería** — `venue-gallery.tsx:105`:
```tsx
<div key={i} className="relative h-1/3 overflow-hidden cursor-pointer group" onClick={() => setCurrentIndex(i + 1)}>
```
Regla desactivada en la línea 1 del archivo.

### 2.4.7 Foco visible — ❌

**(a)** `review-section.tsx:107-113`:
```tsx
<button key={star} onClick={() => setRating(star)} className="p-1 focus:outline-hidden">
  <Star className={...} />
</button>
```
`focus:outline-hidden` elimina el indicador sin reemplazo. Cinco estrellas sin foco visible **y sin nombre accesible** (solo un `<svg>` adentro) → también **4.1.2**.

**(b)** `header.tsx:131-137` — el botón del menú móvil lleva `focus-visible:ring-0 focus-visible:ring-offset-0`, anulando el anillo de foco que `buttonVariants` define en `button.tsx:8`. Sí tiene `<span className="sr-only">Toggle Menu</span>` (aunque en inglés).

En el resto de la app el anillo de foco de `button.tsx:8` (`focus-visible:ring-3 focus-visible:ring-ring/50`) está bien puesto — el token `--ring` es `oklch(0.7 0.17 146)` = `#49b958`, con contraste suficiente sobre el fondo oscuro.

### 4.1.2 Nombre, rol, valor — ❌ botones de solo ícono sin nombre

| Ubicación | Elemento |
|:---|:---|
| `availability-grid.tsx:99,106` | `<Button size="icon">` con `ChevronLeft`/`ChevronRight` — navegación de día, sin `aria-label` |
| `schedule-navigation.tsx:31,38` | ídem, en el calendario del dueño |
| `venue-gallery.tsx:76-91` | flechas anterior/siguiente del lightbox |
| `promo-carousel.tsx:49,103` | flechas del carrusel |
| `header.tsx:78-85` | trigger del menú de usuario (solo el `<Avatar>` adentro; `AvatarFallback` es un `UserIcon`) |

Los que **sí** están bien: `availability-grid.tsx:154,158,163` (`aria-label="Turno pasado"`, `"Ocupado"`, `` `Reservar turno de las ${hour} horas` ``), `booking-actions.tsx:40` (`<span className="sr-only">Abrir menú</span>`), `dialog.tsx:75` / `sheet.tsx:75` (`sr-only` "Close", en inglés), `toast.tsx:120` (`aria-label="Close toast"`, en inglés).

### 4.1.3 Mensajes de estado — parcial

- ✅ `login/page.tsx:86` tiene `aria-live="polite"` en el bloque de error. Es el único de la app.
- ❌ `booking-wizard.tsx` no tiene ninguno — y su mensaje de error ni siquiera se renderiza (UX-04).
- ⚠️ Los toasts usan `@base-ui/react/toast`; `ToastViewport` (`toast.tsx:20-31`) no declara `role` ni `aria-live` propios y depende de lo que provea la primitiva. `[REQUIERE VERIFICACIÓN]` con lector de pantalla real.
- ❌ Los 14 `alert()` nativos rompen el flujo y no cumplen **3.3.1** (identificación del error en contexto).

### 1.3.1 Información y relaciones — parcial

- `availability-grid.tsx:120-175`: `<table>` sin `<caption>` y `<th>` sin `scope`. Un lector de pantalla en modo tabla no puede asociar la celda "Libre" con su cancha y su hora. Los `aria-label` de cada botón salvan parcialmente la situación ("Reservar turno de las 21 horas") pero **no incluyen el nombre de la cancha**: con 4 canchas, el usuario oye "Reservar turno de las 21 horas" cuatro veces idénticas.
- `bookings-client.tsx:141-206` y `admin/page.tsx`: mismo patrón, tablas sin `caption`/`scope`.
- `cancel-dialog.tsx:111-123`: el checkbox `id="terms"` **sí** tiene `<label htmlFor="terms">` correcto. Bien.
- `review-section.tsx:118-120`: `<label htmlFor="comment">` con `<Textarea id="comment">`. Bien.
- Los 14 archivos con `label-has-associated-control` desactivado (`dashboard/courts/*`, `dashboard/venue/*`) usan `<label>` sueltos sin `htmlFor`. `[REQUIERE VERIFICACIÓN]` archivo por archivo; no forman parte del flujo del jugador.

### 1.1.1 Contenido no textual — parcial

- `bookings/page.tsx:71`: `alt="Venue"` — genérico y en inglés. Debería ser el nombre del complejo.
- `player-chat-modal.tsx:294`: `<img src={msg.image_url} alt="Adjunto" />` — único `<img>` crudo de la app; `alt` genérico.
- ✅ `venue-card.tsx:37`, `venue-gallery.tsx:43,64,111` usan `alt` descriptivo con el nombre del complejo.

### 2.5.8 Tamaño del objetivo (mínimo) — pasa AA, falla la práctica móvil

WCAG 2.2 AA pide **24×24 px** (2.5.5, que pide 44×44, es AAA). Contra el estándar real:

| Variante (`ui/button.tsx:23-35`) | Tamaño | 2.5.8 (24px) |
|:---|:---|:---|
| `default` | `h-8` = 32px | ✅ |
| `sm` | `h-7` = 28px | ✅ |
| `xs` / `icon-xs` | 24px | ✅ (exacto, sin margen) |
| `icon` | `size-8` = 32px | ✅ |

**No hay violación de WCAG 2.2 AA por tamaño.** (Esto corrige el "UX-09 ❌ No Resuelto" de la ronda 1, que citaba 2.5.5 AAA como si fuera AA.) Dicho esto, para Martín con guantes en la calle, 28-32px es incómodo y las celdas `h-10` (40px) de la grilla de disponibilidad son el mínimo aceptable de la app.

### Mapa Leaflet — alternativa no visual

- `venue/[id]/page.tsx:236-265`: el mini-mapa **sí** tiene la dirección en texto debajo (`:262`). Alternativa presente. ✅
- `search-layout.tsx:90-92`: la vista Mapa alterna con la vista Lista mediante botones etiquetados (`:35-52`), y la lista es la alternativa textual equivalente. ✅
- El `MapContainer` (`venue-map-client.tsx:86-91`) no lleva `role="application"` ni instrucciones de teclado; Leaflet provee navegación por flechas de forma nativa. `[REQUIERE VERIFICACIÓN]` con lector de pantalla.
- Falta en toda la app un link "Cómo llegar" a Google Maps / Waze — que sería a la vez la mejor alternativa no visual y una mejora de conversión.

### Trampa de foco en `dialog.tsx` / `sheet.tsx`

Ambos delegan en `@base-ui/react/dialog` (`dialog.tsx:4`, `sheet.tsx:4`), que implementa foco atrapado, cierre con Escape y retorno de foco al trigger. No hay overrides que lo rompan. `[REQUIERE VERIFICACIÓN]` en navegador, pero por código está bien.

### Veredicto de accesibilidad

**No conforme con WCAG 2.2 AA.** Fallos confirmados en **2.4.1** (sin skip link), **2.1.1** (método de pago y ordenamiento de tablas inalcanzables por teclado), **2.4.7** (foco eliminado en el rating de estrellas), **4.1.2** (cinco grupos de botones de solo ícono sin nombre accesible + `aria-sort` ausente), **1.4.3** (verdes de Tailwind en modo claro, 2.28:1), **1.3.1** (tablas sin `caption`/`scope`) y **4.1.3** parcial.

El color está bien. La semántica interactiva, no.

---

## Falsos remediados

Contrastado contra `audit-reports/06-reporte-resolucion-final.md`.

| ID previo | Estado declarado | Realidad verificada en `a1f7e7f` |
|:---|:---|:---|
| **UX-01** "Toast evanescente en errores de pago" | ✅ Resuelto — *"booking-wizard.tsx — Alert inline con `aria-live="polite"`"* | **FALSO.** No existe ningún alert inline ni `aria-live` en `booking-wizard.tsx`. `grep -n "aria-live" src/components/booking/booking-wizard.tsx` → vacío. El estado `error` (línea 42) se setea en la 76 y **no se renderiza en ninguna parte**. Regresión respecto de lo declarado. |
| **UX-05** "Import PascalCase (crash Vercel/Linux)" | ✅ Resuelto — *"venue-map.tsx, location-picker.tsx → kebab-case"* | **PARCIAL / FALSO.** Se arregló el nombre de los *archivos*, no los *imports*. Quedan 7: `search-layout.tsx:7`, `venue-list.tsx:4`, `bookings-client.tsx:7`, `venue-map.tsx:3`, `venue-map-client.tsx:9`, `login/page.tsx:7`, `profile/page.tsx:6`. Todos tapados con `@ts-expect-error`. |
| **UX-06** "Contraste `--primary` Light Mode < AA" | 🟡 Parcial | **RESUELTO de verdad.** `oklch(0.55 0.15 146)` = `#238735` sobre blanco da **4.58:1**. Pasa AA. Se puede cerrar. |
| **UX-07** "Badges `text-green-500` (2.29:1)" | 🟡 Parcial | **CONFIRMADO como fallo, pero solo en modo claro.** En dark (default) da 7.87:1 y pasa. En light da 2.28:1 y falla. Sigue abierto porque `enableSystem` está activo. |
| **UX-08 / NEW-UX-10** "14 `alert()` + bug de precedencia" | 🟡 / ❌ | **CONFIRMADO, sin cambios.** 14 `alert()` intactos; el bug de precedencia sigue en `court-form-modal.tsx:21`, `pricing-modal.tsx:21`, `manual-booking-modal.tsx:28`. |
| **UX-09** "Touch targets < 44×44px" | ❌ No Resuelto | **MAL CLASIFICADO.** Cita WCAG 2.5.5, que es nivel **AAA**. El criterio AA aplicable es **2.5.8 (24×24)**, y todas las variantes de `Button` lo cumplen. Es una mejora de ergonomía móvil, no un incumplimiento AA. |
| **NEW-UX-07** "Filtros saturan pantalla móvil" | ❌ No Resuelto | **CONFIRMADO.** `search-filters.tsx:111-186`, anchos fijos sin colapsar. |
| **NEW-UX-08** "Botón Responder es placebo" | ❌ No Resuelto | **CONFIRMADO.** `dashboard/reviews/page.tsx:94-97`, `<Button>` sin `onClick`. |
| **NEW-UX-09** "Ban sin confirmación" | ❌ No Resuelto | **PEOR DE LO REPORTADO.** `admin/users/page.tsx:68` no solo no tiene confirmación: **no tiene handler**. No hace nada. |
| **NEW-UX-11** "`package.json` name `elpotrero-init`" | ❌ No Resuelto | **CONFIRMADO.** `package.json:2`. |
| **UX-02** "Toast en login sin persistencia" | ✅ Resuelto | **VERDADERO.** `login/page.tsx:85-93`, bloque inline con `aria-live="polite"`. Bien hecho. |
| **UX-03** "Turnos ocupados como `div` sin semántica" | ✅ Resuelto | **VERDADERO.** `availability-grid.tsx:154,158,163`, `<button disabled aria-label>`. Bien hecho. |
| **UX-04** "Badges sin contraste en Dark Mode" | ✅ Resuelto | **VERDADERO.** `bookings-client.tsx:178-180`, variantes `dark:` presentes. |
| — | — | **Regresión nueva no listada:** `next.config.mjs` nunca incorporó el host de Supabase Storage (UX-05 de este reporte), y `mercadopago/client.ts:26` sigue apuntando a `/mock-payment`, ruta borrada en este working tree. |

---

## Lo que está genuinamente bien diseñado

1. **`src/components/booking/booking-wizard.tsx:195-209`** — el desglose de precio. "Precio Total / Resto a pagar en el complejo / Total a pagar ahora (Seña)", con la seña destacada en color primario y tamaño mayor. Responde exactamente la pregunta que se hace el usuario: *cuánto pago ahora y cuánto después*. Es lo mejor del flujo.

2. **`src/components/booking/cancel-dialog.tsx:86-136`** — la mecánica del diálogo de cancelación. Tres ramas según la ventana temporal (<1h no se puede / >6h da crédito / <6h pierde la seña), monto concreto en cada mensaje, checkbox de consentimiento explícito con `<label htmlFor>` correcto, y botón deshabilitado hasta tildarlo (`:133`). Solo está en el momento equivocado del flujo.

3. **`src/components/venue/availability-grid.tsx:151-168`** — los tres estados de slot resueltos con `<button disabled>` reales y `aria-label` distintos por estado, más el texto visible "Libre"/"Ocupado"/"-". Cumple 1.4.1 (no depende solo del color) y da nombre accesible. Es la parte más accesible de la app.

4. **`src/components/search/venue-list.tsx:27-39`** — el empty state de búsqueda: ícono, título ("No encontramos canchas"), causa probable y sugerencia concreta ("probá ampliando tu búsqueda o eliminando algunos filtros"). Le falta el botón que ejecute la sugerencia, pero el texto está bien pensado.

5. **`src/app/(auth)/login/page.tsx:85-93`** — el bloque de error con `aria-live="polite"`, ícono, título y detalle, que persiste en pantalla. Es el patrón correcto y debería copiarse tal cual al wizard de pago.

6. **`src/components/venue/venue-card.tsx:70-79`** — el indicador "Con seña / Sin seña" con punto de color junto al precio "Desde $X". Comunica la fricción de pago **antes** de entrar a la ficha, que es exactamente donde el usuario necesita saberlo. Y el filtro correspondiente existe en `search-filters.tsx:251-262`.

7. **`src/app/(main)/venue/[id]/page.tsx:123-154`** — el JSON-LD `SportsActivityLocation` con dirección, geo, teléfono y `aggregateRating`, más los `openGraph`/`twitter` con `locale: "es_AR"` (`:85-114`). Para un negocio local en La Plata, esto es adquisición gratis y está bien armado.

8. **`src/app/(main)/booking/[courtId]/success/page.tsx:103-107`** — el botón "Invitar amigos" que arma un mensaje de WhatsApp prellenado con fecha, hora y complejo. Es el momento exacto de máxima intención social y el canal correcto para Argentina. Buena lectura del contexto.

---

## Límites de esta auditoría

**No se renderizó la aplicación.** No se levantó el dev server, no se usó navegador, no se corrió lector de pantalla ni herramienta automática de accesibilidad en runtime (axe, Lighthouse). Toda la evidencia es código fuente: JSX, clases de Tailwind, estados de React, handlers y strings.

Lo que **sí** es verificable con certeza desde el código y considero confirmado: la desconexión `returnUrl`/`next` (UX-01), las `back_urls` que caen en `/search` (UX-02), el `payment_status` no consultado (UX-03), el estado `error` no renderizado (UX-04, confirmado por grep exhaustivo), la URL literal `court-id` (UX-07), el `catch` que traga el error de disponibilidad (UX-08), los imports con casing incorrecto (UX-09), la ausencia total de contador de expiración (UX-11), los handlers faltantes en botones (UX-17/18/19), los ratios de contraste (calculados desde los tokens `oklch` reales), las supresiones de linter y la salida real de `npm run lint`.

Lo que **requiere navegador** y quedó marcado en el cuerpo:
- **UX-05** — que las fotos efectivamente fallen depende de dónde estén alojadas en la instancia real de producción; el código apunta a Supabase Storage y `next.config.mjs` no lo lista, pero no vi una URL real de foto.
- **UX-20, UX-23, UX-27, UX-28** — todo lo que es "cuánto espacio ocupa en 375px": el sidebar del dashboard, las paletas light-only dentro del dark mode, el wrapping de los filtros y el `100vh` con `overflow-hidden`. Se leen mal en el código, pero la magnitud hay que medirla.
- **UX-37** — si `not-found.tsx` con `onClick` en un Server Component rompe el build de producción o Next.js lo tolera.
- **4.1.3 (toasts)** — si `@base-ui/react/toast` inyecta `aria-live` por su cuenta.
- **Leaflet por teclado** — la navegación nativa de Leaflet con lector de pantalla.
- **UX-14** — la usabilidad real del scroll horizontal con columna sticky en la grilla de disponibilidad.

Tampoco se auditó: `src/app/admin/**` más allá de los botones placebo, el flujo de chat en profundidad, el alta de complejo (`dashboard/venue/new`), ni los emails de `lib/notifications/templates.ts` (donde, de paso, se vuelve a cablear el 30%: `templates.ts:31`).
