/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export const bookingConfirmationTemplate = (booking: any, user: any, venue: any) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; line-height: 1.5; padding: 20px; }
    .container { max-w-xl; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { color: #22c55e; font-size: 24px; font-weight: bold; text-decoration: none; }
    .title { font-size: 20px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; }
    .details { background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .detail-item { margin-bottom: 8px; }
    .detail-label { font-weight: 600; color: #4b5563; }
    .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">El Potrero</div>
      <h1 class="title">¡Tu reserva está confirmada!</h1>
      <p>Hola ${user.full_name || 'jugador'}, tu partido en ${venue.name} ha sido confirmado con éxito.</p>
    </div>
    
    <div class="details">
      <div class="detail-item"><span class="detail-label">📍 Predio:</span> ${venue.name} (${venue.address})</div>
      <div class="detail-item"><span class="detail-label">📅 Fecha:</span> ${new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('es-AR')}</div>
      <div class="detail-item"><span class="detail-label">⏰ Horario:</span> ${booking.start_time.substring(0, 5)} hs</div>
      <div class="detail-item"><span class="detail-label">💵 Seña abonada:</span> $${Math.ceil(booking.total_price * 0.3).toLocaleString('es-AR')}</div>
      <div class="detail-item"><span class="detail-label">💳 Resto a pagar:</span> $${(booking.total_price - Math.ceil(booking.total_price * 0.3)).toLocaleString('es-AR')}</div>
    </div>
    
    <div style="text-align: center;">
      <a href="https://elpotrero.vercel.app/bookings" class="button">Ver mis reservas</a>
    </div>
    
    <div class="footer">
      <p>Tené en cuenta que podés cancelar hasta 6 horas antes para recuperar tu seña en forma de créditos.</p>
      <p>© ${new Date().getFullYear()} El Potrero. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
`

export const reminderTemplate = (booking: any, user: any, venue: any) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; line-height: 1.5; padding: 20px; }
    .container { max-w-xl; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { color: #22c55e; font-size: 24px; font-weight: bold; text-decoration: none; }
    .title { font-size: 20px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #ea580c; }
    .details { background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 24px; border-left: 4px solid #ea580c; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">El Potrero</div>
      <h1 class="title">¡Prepará los botines!</h1>
      <p>Hola ${user.full_name || 'jugador'}, te recordamos que tenés un partido en menos de 2 horas.</p>
    </div>
    
    <div class="details">
      <p><strong>📍 Predio:</strong> ${venue.name}</p>
      <p><strong>🗺 Dirección:</strong> ${venue.address}</p>
      <p><strong>⏰ Horario:</strong> ${booking.start_time.substring(0, 5)} hs</p>
      <p><strong>📱 Teléfono del predio:</strong> ${venue.phone || 'No disponible'}</p>
    </div>
    
    <p style="text-align: center;">Recordá llegar 10 minutos antes y abonar el resto de la cancha en recepción.</p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} El Potrero.</p>
    </div>
  </div>
</body>
</html>
`

export const cancellationTemplate = (booking: any, user: any, venue: any, creditAmount: number) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; line-height: 1.5; padding: 20px; }
    .container { max-w-xl; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { color: #22c55e; font-size: 24px; font-weight: bold; text-decoration: none; }
    .title { font-size: 20px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #dc2626; }
    .details { background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .credit-box { background: #ecfdf5; padding: 16px; border-radius: 6px; border: 1px solid #10b981; color: #065f46; margin-bottom: 24px; text-align: center; }
    .forfeit-box { background: #fef2f2; padding: 16px; border-radius: 6px; border: 1px solid #ef4444; color: #991b1b; margin-bottom: 24px; text-align: center; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">El Potrero</div>
      <h1 class="title">Reserva Cancelada</h1>
      <p>Hola ${user.full_name || 'jugador'}, confirmamos la cancelación de tu turno en ${venue.name} para el ${new Date(`${booking.booking_date}T12:00:00`).toLocaleDateString('es-AR')} a las ${booking.start_time.substring(0, 5)} hs.</p>
    </div>
    
    ${creditAmount > 0 
      ? `<div class="credit-box">
           <strong>¡Seña recuperada!</strong><br/>
           Al haber cancelado con más de 6 horas de anticipación, hemos acreditado <strong>$${creditAmount.toLocaleString('es-AR')}</strong> en tu cuenta para tu próxima reserva.
         </div>`
      : `<div class="forfeit-box">
           <strong>Seña perdida</strong><br/>
           Al haber cancelado con menos de 6 horas de anticipación, la seña abonada se pierde según nuestras políticas.
         </div>`
    }
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} El Potrero.</p>
    </div>
  </div>
</body>
</html>
`

export const welcomeTemplate = (user: any) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937; line-height: 1.5; padding: 20px; }
    .container { max-w-xl; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { color: #22c55e; font-size: 24px; font-weight: bold; text-decoration: none; }
    .title { font-size: 20px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; }
    .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 16px; }
    .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">El Potrero</div>
      <h1 class="title">¡Bienvenido a El Potrero! ⚽</h1>
    </div>
    
    <p>Hola ${user.full_name || 'jugador'},</p>
    <p>Estamos muy felices de tenerte con nosotros. A partir de ahora podés buscar las mejores canchas de tu ciudad, comparar precios, ver disponibilidad en tiempo real y reservar al instante abonando solo la seña.</p>
    
    <div style="text-align: center;">
      <a href="https://elpotrero.vercel.app/search" class="button">Buscar mi primera cancha</a>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} El Potrero.</p>
    </div>
  </div>
</body>
</html>
`
