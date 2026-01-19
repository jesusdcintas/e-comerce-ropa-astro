# 📧 Configuración de Brevo para Emails de Factura

## ¿Qué es Brevo?
Servicio gratuito para enviar emails transaccionales (facturas, confirmaciones, etc.)

**Plan Gratuito:**
- ✅ 300 emails/día (9,000/mes) GRATIS
- ✅ Soporta PDFs adjuntos
- ✅ No requiere tarjeta de crédito

---

## 🚀 Configuración Inicial (5 minutos)

### 1. Crear cuenta en Brevo
1. Ir a [brevo.com](https://www.brevo.com/)
2. Registrarse con tu email
3. Verificar el email de confirmación

### 2. Obtener API Key
1. Ir a **Settings** → **SMTP & API** → **API Keys**
2. Hacer clic en **"Create a new API key"**
3. Darle un nombre (ejemplo: "Tienda Email")
4. **Copiar la key** (empieza con `xkeysib-`)

### 3. Verificar Remitente
1. Ir a **Senders & IP** → **Senders**
2. Agregar el email que usaste para registrarte
3. Verificar el email (Brevo envía un enlace)
4. ✅ Una vez verificado, ya puedes enviar

### 4. Configurar el proyecto
Editar el archivo `.env`:

```env
BREVO_API_KEY=xkeysib-TU_API_KEY_AQUI
EMAIL_FROM=tu-email-verificado@gmail.com
```

### 5. Reiniciar servidor
```bash
npm run dev
```

---

## ✅ Probar que funciona

1. Ir a **http://localhost:4321/mis-pedidos**
2. Hacer clic en **"Enviar factura"** en cualquier pedido
3. Revisar tu bandeja de entrada (y spam)
4. Deberías recibir el email con el PDF adjunto

---

## ⚠️ Importante

### Emails verificados
- Solo puedes enviar desde emails **verificados** en Brevo
- Por defecto, el email con el que te registraste ya está verificado
- Para usar otro email (ejemplo: `noreply@mitienda.com`), hay que:
  - Tener un dominio propio
  - Añadir registros DNS
  - Verificar el dominio en Brevo

### Límites
- **300 emails/día** en plan gratuito
- Suficiente para desarrollo y pequeños negocios
- Si necesitas más, hay planes de pago desde $20/mes

### Mejores prácticas
- Usar un email profesional: `pedidos@mitienda.com` en lugar de Gmail
- Verificar dominio completo para evitar que los emails vayan a spam
- Monitorear el dashboard de Brevo para ver tasa de entrega

---

## 📊 Monitorear Emails

Dashboard de Brevo → **Campaigns** → **Transactional**
- Ver emails enviados
- Tasa de apertura
- Rebotes
- Quejas de spam

---

## 🆘 Solución de problemas

**El email no llega:**
1. Verificar que `EMAIL_FROM` está verificado en Brevo
2. Revisar carpeta de spam
3. Ver logs en el terminal (buscar ✅ statusCode: 201)
4. Revisar dashboard de Brevo → Logs

**Error 403:**
- El email remitente no está verificado
- Cambiar `EMAIL_FROM` a un email verificado

**Error de API Key:**
- Verificar que la API Key está correcta en `.env`
- Reiniciar el servidor después de cambiar `.env`

---

## 📦 Dependencias instaladas

```json
{
  "@getbrevo/brevo": "^2.x",
  "jspdf": "^2.5.2"
}
```

---

## 🎯 Resumen rápido

```bash
# 1. Crear cuenta en brevo.com
# 2. Obtener API Key
# 3. Verificar email remitente
# 4. Configurar .env
BREVO_API_KEY=xkeysib-...
EMAIL_FROM=tu-email@gmail.com

# 5. Reiniciar
npm run dev

# 6. Probar desde /mis-pedidos
```

¡Listo! 🎉
