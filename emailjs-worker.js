addEventListener("scheduled", event => {
  // Ejecuta processNotifications en cada trigger programado
  event.waitUntil(processNotifications());
});

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Maneja las solicitudes entrantes. Para la ruta raíz ("/") se obtienen las notificaciones
 * y se verifica si vencen hoy o mañana; de ser así se envía un correo usando EmailJS.
 * Para "/status", devuelve un mensaje simple de estado.
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "") {
    return await processNotifications();
  }

  if (url.pathname === "/status") {
    return new Response("Worker activo y listo para verificar fechas de vencimiento.", {
      status: 200,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  }

  // Ruta no encontrada
  return new Response("Ruta no encontrada.", {
    status: 404,
    headers: { "Content-Type": "text/plain;charset=UTF-8" }
  });
}

/**
 * Obtiene las notificaciones desde Firestore, verifica si las fechas de vencimiento
 * son hoy o mañana, y en ese caso envía un correo a cada destinatario.
 */
async function processNotifications() {
  // Configuración de Firebase
  const projectId = "system-of-notifications";
  const apiKey = "AIzaSyAuPxS3VBwjv3w2yNsWWAYR4A-MeBctIn0";
  const collection = "notificaciones";

  // Endpoint REST de Firestore para obtener la colección "notificaciones"
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?key=${apiKey}`;

  try {
    const response = await fetch(firestoreUrl);
    if (!response.ok) {
      throw new Error(`Error al conectar con Firestore: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.documents || data.documents.length === 0) {
      return new Response("No se encontraron notificaciones para procesar.", {
        status: 200,
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
      });
    }

    // Procesamos cada notificación
    const results = [];
    for (const doc of data.documents) {
      const fields = doc.fields || {};
      const correo = fields.correo?.stringValue || "";
      const mensaje = fields.mensaje?.stringValue || "";
      const fechaVenc = fields.fechaVencimiento?.timestampValue || fields.fechaVencimiento?.stringValue;

      // Validar que tengamos correo y fecha de vencimiento
      if (!correo || !fechaVenc) {
        results.push(`Notificación con campos incompletos: correo = "${correo}", fechaVenc = "${fechaVenc}"`);
        continue;
      }

      // Si la fecha de vencimiento es hoy o mañana, se envía el correo
      if (isTodayOrTomorrow(fechaVenc)) {
        const formattedDate = formatDate(fechaVenc);
        const emailParams = {
          notify_email: correo,
          due_date: formattedDate,
          message: mensaje
        };

        const sendStatus = await sendNotificationEmail(emailParams);
        results.push(`Envío de correo a "${correo}" (vence: ${formattedDate}): ${sendStatus}`);
      } else {
        results.push(`No aplica envío hoy. Fecha de la notificación: "${fechaVenc}".`);
      }
    }

    return new Response(results.join("\n"), {
      status: 200,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  } catch (error) {
    return new Response(`Ocurrió un error: ${error.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain;charset=UTF-8" }
    });
  }
}

/**
 * Verifica si una fecha dada (en formato ISO/Firestore) es hoy o mañana.
 * @param {string} dateString
 * @returns {boolean}
 */
function isTodayOrTomorrow(dateString) {
  try {
    const nowLocal = new Date(); // Fecha/hora actual del sistema
    const targetDate = new Date(dateString);

    // Normalizamos para comparar solo la fecha (sin horas)
    const nowUTC = Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
    const targetUTC = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    // Diferencia en días
    const dayDiff = (targetUTC - nowUTC) / (24 * 60 * 60 * 1000);
    return dayDiff === 0 || dayDiff === 1; // 0 = hoy, 1 = mañana
  } catch {
    return false;
  }
}

/**
 * Formatea una fecha ISO a un formato legible en español.
 * @param {string} isoDateString
 * @returns {string}
 */
function formatDate(isoDateString) {
  try {
    const date = new Date(isoDateString);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  } catch {
    return isoDateString;
  }
}

/**
 * Envía un correo a través de EmailJS usando fetch.
 * @param {Object} params - Parámetros para EmailJS (notify_email, due_date, message).
 * @returns {string} Resultado del envío de correo.
 */
async function sendNotificationEmail(params) {
  // Credenciales de EmailJS
  const serviceId = "service_beffo46";
  const templateId = "template_m97kcoq";
  const userId = "UmJsbx3GRMXZ3EWWy";

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    template_params: {
      notify_email: params.notify_email,
      due_date: params.due_date,
      message: params.message
    }
  };

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "origin": "https://tudominio.com" // Ajusta este valor si es necesario para CORS
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return "Correo enviado correctamente.";
    } else {
      const errText = await response.text();
      return `Error al enviar el correo: ${errText}`;
    }
  } catch (error) {
    return `Excepción al enviar correo: ${error.message}`;
  }
}
