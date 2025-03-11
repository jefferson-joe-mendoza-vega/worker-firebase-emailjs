addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Maneja las solicitudes entrantes al Worker.
 * Obtiene los datos de la colección "notificaciones" en Firestore y los devuelve como JSON,
 * formateando la fecha de vencimiento (fechaVencimiento) en español.
 */
async function handleRequest(request) {
  // Reemplaza con tus credenciales reales de Firebase:
  const apiKey = "AIzaSyAuPxS3VBwjv3w2yNsWWAYR4A-MeBctIn0";
  const projectId = "system-of-notifications";
  const collectionName = "notificaciones";

  // Construye la URL del endpoint REST de Firestore para la colección "notificaciones"
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?key=${apiKey}`;

  try {
    // Llama al endpoint REST de Firestore
    const response = await fetch(url);
    const data = await response.json();

    // Si no hay documentos, responde con un mensaje indicándolo
    if (!data.documents || !data.documents.length) {
      return new Response(JSON.stringify({ mensaje: "No se encontraron notificaciones." }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // Mapea cada documento para extraer y formatear los campos de interés
    const notificaciones = data.documents.map(doc => {
      const fields = doc.fields || {};
      const correo = fields.correo ? fields.correo.stringValue : "";
      const fechaVencimiento = fields.fechaVencimiento ? fields.fechaVencimiento.timestampValue : null;
      const mensaje = fields.mensaje ? fields.mensaje.stringValue : "";
      const nombreSW = fields.nombreSW ? fields.nombreSW.stringValue : "";
      const urlSW = fields.urlSW ? fields.urlSW.stringValue : "";
      const fechaRegistro = fields.fechaRegistro ? fields.fechaRegistro.timestampValue : null;

      // Formatea la fecha de vencimiento a una cadena en español (si existe)
      let fechaVencimientoFormateada = "";
      if (fechaVencimiento) {
        fechaVencimientoFormateada = new Date(fechaVencimiento).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric"
        });
      }

      return {
        correo,
        fechaVencimiento: fechaVencimientoFormateada,
        mensaje,
        nombreSW,
        urlSW,
        fechaRegistro: fechaRegistro ? new Date(fechaRegistro).toLocaleString("es-ES") : ""
      };
    });

    // Responde con la lista de notificaciones en formato JSON
    return new Response(JSON.stringify(notificaciones, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    // Manejo básico de errores
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
