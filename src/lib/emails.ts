import * as brevo from '@getbrevo/brevo';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from './logo';

// Helper para compatibilidad entre Astro y Node
const getEnv = (key: string) => {
  const val = (import.meta.env?.[key]) || (process.env?.[key]) || '';
  return val;
};

console.log('[EMAILS] Cargando biblioteca de correos...');
console.log('[EMAILS] BREVO_API_KEY detectada:', !!getEnv('BREVO_API_KEY'));

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, getEnv('BREVO_API_KEY'));

const formatPrice = (cents: number) => (cents / 100).toFixed(2) + '€';

/**
 * Calcula el desglose de IVA (IVA incluido en el precio)
 */
const calculateVAT = (totalCents: number, rate = 0.21) => {
  const total = totalCents / 100;
  const base = total / (1 + rate);
  const iva = total - base;
  return {
    total: total.toFixed(2) + '€',
    base: base.toFixed(2) + '€',
    iva: iva.toFixed(2) + '€'
  };
};

/**
 * Formatea códigos de documento según el estándar ONL-F/R-YYYYMMDD-XXXX
 */
export const formatDocNumber = (id: number | string, date: string | Date, prefix = 'ONL-F') => {
  const d = new Date(date);
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0');
  const idStr = id.toString().padStart(4, '0');
  return `${prefix}-${dateStr}-${idStr}`;
};

/**
 * Genera el PDF del Ticket (Recibo automático) con diseño Ultra-Premium
 */
export const generateTicketPDF = (order: any, items: any[], outputType: 'base64' | 'buffer' = 'base64'): string | Buffer => {
  const doc = new jsPDF();
  const ticketNum = order.ticket_number || formatDocNumber(order.id, order.created_at, 'ONL-F');

  // Header Blanco Elegant con sombra sutil simulada
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 60, 'F');

  // Línea decorativa dorada superior
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1);
  doc.line(20, 50, 190, 50);

  // Logo FASHION STORE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text("FASHION", 20, 35);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text("STORE", 20 + doc.getTextWidth("FASHION "), 35);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text("PREMIUM BOUTIQUE SELECTION", 20, 42, { charSpace: 1.5 });

  // Título Documento
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RECIBO DE COMPRA", 190, 37, { align: "right" });

  // Información del Pedido
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(20, 65, 170, 30, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.setFont("helvetica", "bold");
  doc.text("Nº PEDIDO", 30, 75);
  doc.text("FECHA", 80, 75);
  doc.text("METODO PAGO", 130, 75);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`#${order.id.toString().padStart(6, '0')}`, 30, 82);
  doc.text(new Date(order.created_at).toLocaleDateString('es-ES'), 80, 82);
  doc.text("TARJETA BANCARIA", 130, 82);

  // Tabla
  let y = 110;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(20, y, 170, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPCIÓN DEL ARTÍCULO", 25, y + 7.5);
  doc.text("IMPORTE", 185, y + 7.5, { align: "right" });

  y += 22;
  doc.setTextColor(15, 23, 42);

  items.forEach(item => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${item.product_name}`, 25, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Talla: ${item.size || item.product_size}  |  Cant: ${item.quantity}`, 25, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(formatPrice(item.price_at_time * item.quantity), 185, y + 2, { align: 'right' });

    y += 18;
    doc.setDrawColor(241, 245, 249);
    doc.line(20, y - 8, 190, y - 8);

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  // Totales
  y += 5;
  const vat = calculateVAT(order.total_amount);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text("Base Imponible", 130, y);
  doc.text(vat.base, 185, y, { align: 'right' });

  y += 7;
  doc.text("IVA (21%)", 130, y);
  doc.text(vat.iva, 185, y, { align: 'right' });

  y += 15;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(120, y - 10, 70, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAGADO", 125, y);
  doc.setTextColor(212, 175, 55);
  doc.text(vat.total, 185, y, { align: 'right' });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Gracias por su compra. Para cualquier devolución dispone de 30 días desde la recepción.", 105, 285, { align: "center" });

  if (outputType === 'buffer') return Buffer.from(doc.output('arraybuffer'));
  return doc.output('datauristring').split(',')[1];
};

/**
 * Genera el PDF de la Factura con diseño Corporativo Premium
 */
export const generateInvoicePDF = (order: any, items: any[], outputType: 'base64' | 'buffer' = 'base64'): string | Buffer => {
  const doc = new jsPDF();
  const invoiceNum = order.invoice_number || `F-${new Date().getFullYear()}-${order.id.toString().padStart(5, '0')}`;
  const fiscal = order.invoice_fiscal_data || {};

  // Logo FASHION STORE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text("FASHION", 20, 35);
  doc.setTextColor(212, 175, 55);
  doc.text("STORE", 20 + doc.getTextWidth("FASHION "), 35);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("PREMIUM BOUTIQUE SELECTION", 20, 42, { charSpace: 1.5 });

  // Título Factura
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", 190, 37, { align: "right" });

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1.5);
  doc.line(20, 50, 190, 50);

  // Grid de Datos
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("EMISOR", 20, 70);
  doc.text("CLIENTE", 110, 70);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(["Fashion Store S.L.", "NIF: B12345678", "Calle de la Moda, 123", "28001 Madrid, España"], 20, 76);

  doc.text([
    fiscal.razon_social || order.shipping_name,
    `NIF/CIF: ${fiscal.nif || 'N/A'}`,
    fiscal.direccion || order.shipping_address,
    `${fiscal.codigo_postal || ''} ${fiscal.ciudad || ''}`
  ], 110, 76);

  // Info Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 105, 170, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Nº FACTURA", 25, 114);
  doc.text("FECHA", 140, 114);

  doc.setFont("helvetica", "normal");
  doc.text(invoiceNum, 55, 114);
  doc.text(new Date().toLocaleDateString('es-ES'), 155, 114);

  // Tabla
  let y = 135;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN", 25, y + 6.5);
  doc.text("CANT.", 120, y + 6.5, { align: "center" });
  doc.text("PRECIO", 150, y + 6.5, { align: "right" });
  doc.text("TOTAL", 185, y + 6.5, { align: "right" });

  y += 18;
  doc.setTextColor(15, 23, 42);
  items.forEach(item => {
    const totalItem = (item.price_at_time * item.quantity) / 100;
    doc.setFont("helvetica", "bold");
    doc.text(`${item.product_name}`, 25, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Talla: ${item.size || item.product_size}`, 25, y + 4.5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(item.quantity.toString(), 120, y + 2, { align: 'center' });
    doc.text((item.price_at_time / 100).toFixed(2) + '€', 150, y + 2, { align: 'right' });
    doc.text(totalItem.toFixed(2) + '€', 185, y + 2, { align: 'right' });

    y += 15;
    doc.setDrawColor(241, 245, 249);
    doc.line(20, y - 8, 190, y - 8);

    if (y > 250) { doc.addPage(); y = 20; }
  });

  // Totales
  y += 5;
  const vat = calculateVAT(order.total_amount);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Base Imponible", 130, y);
  doc.text(vat.base, 185, y, { align: 'right' });
  y += 7;
  doc.text("IVA (21%)", 130, y);
  doc.text(vat.iva, 185, y, { align: 'right' });

  y += 15;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(120, y - 10, 70, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 125, y);
  doc.setTextColor(212, 175, 55);
  doc.text(vat.total, 185, y, { align: 'right' });

  // Pie de Página
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Fashion Store Studio S.L. - Registro Mercantil de Madrid, Tomo 1234, Folio 56, Sección 8, Hoja M-78901.", 105, 280, { align: "center" });
  doc.text("Este documento cumple con los requisitos legales del Real Decreto 1619/2012 de facturación.", 105, 284, { align: "center" });

  if (outputType === 'buffer') return Buffer.from(doc.output('arraybuffer'));
  return doc.output('datauristring').split(',')[1];
};

/**
 * Envía el recibo/ticket automático tras la compra
 * NOTA: Alias sendInvoiceEmail para compatibilidad con checkout/success.astro
 */
export const sendOrderReceiptEmail = async (order: any, items: any[]) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;
  const pdfBuffer = generateTicketPDF(order, items) as string;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
      <div style="background: #0f172a; color: white; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Confirmación de Pedido</h1>
        <p style="opacity: 0.7; margin: 5px 0;">¡Gracias por tu compra en Fashion Store!</p>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${order.shipping_name}</strong>,</p>
        <p>Hemos recibido tu pedido correctamente. Adjunto encontrarás tu recibo de compra.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Nº de Pedido:</p>
          <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">#${order.id.toString().padStart(6, '0')}</p>
        </div>
        <p style="font-size: 14px; color: #64748b;">Si necesitas una factura con datos fiscales, puedes solicitarla desde la sección "Mis Pedidos" en tu cuenta.</p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Confirmación de pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];
  sendSmtpEmail.attachment = [{ name: `Recibo_${order.id}.pdf`, content: pdfBuffer }];

  try {
    console.log(`[EMAILS] Intentando enviar recibo a cliente: ${to} desde ${from}`);
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[EMAILS] Recibo enviado con éxito. Resp:', JSON.stringify(response));
    return { success: true };
  } catch (error: any) {
    console.error('[EMAILS] Error enviando recibo:', error);
    if (error.response?._body) {
      console.error('[EMAILS] Detalle del error Brevo:', error.response._body);
    }
    return { success: false, error };
  }
};

/**
 * Envía la factura oficial (solicitada por el cliente)
 */
export const sendOfficialInvoiceEmail = async (order: any, items: any[]) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;
  const pdfBuffer = generateInvoicePDF(order, items) as string;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
      <div style="background: #d4af37; color: white; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Factura Enviada</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${order.shipping_name}</strong>,</p>
        <p>Adjunto encontrarás la factura oficial correspondiente a tu pedido #${order.id.toString().padStart(6, '0')}.</p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Factura oficial pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];
  sendSmtpEmail.attachment = [{ name: `Factura_${order.id}.pdf`, content: pdfBuffer }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending invoice:', error);
    return { success: false, error };
  }
};

// Alias para compatibilidad con componentes antiguos
export const sendInvoiceEmail = sendOrderReceiptEmail;

export const sendCouponEmail = async (email: string, name: string, coupon: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
      <div style="background-color: #0f172a; padding: 50px 20px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 15px;">Membresía Exclusiva</div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">¡Un regalo para <span style="color: #d4af37;">Ti</span>!</h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${name}</strong>,<br>
          En <strong>Fashion Store</strong> valoramos tu estilo único. Por eso, hemos desbloqueado un beneficio exclusivo para tu próxima selección en nuestra tienda.
        </p>
        
        <div style="background-color: #f8fafc; padding: 40px; border-radius: 20px; margin-bottom: 30px; border: 2px dashed #e2e8f0;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Tu Código Privado</p>
          <p style="margin: 0; font-size: 42px; font-weight: 900; color: #0f172a; letter-spacing: 4px; font-family: monospace;">${coupon.codigo}</p>
          <div style="height: 1px; background: #e2e8f0; margin: 20px 0;"></div>
          <p style="margin: 0; font-size: 24px; font-weight: 900; color: #d4af37;">${coupon.descuento_porcentaje}% DE DESCUENTO</p>
          <p style="margin-top: 10px; font-size: 12px; color: #94a3b8; font-weight: 500;">Válido hasta el ${new Date(coupon.fecha_expiracion).toLocaleDateString()}</p>
        </div>
        
        <div style="margin-top: 40px;">
          <a href="https://fashionstore.com" style="display: inline-block; background-color: #d4af37; color: #ffffff; padding: 18px 45px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.3s ease;">Aplicar mi Descuento</a>
        </div>
        
        <p style="margin-top: 40px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          * Este cupón es de uso único y personal. No acumulable con otras promociones.<br>
          © 2026 Fashion Store. Calidad premium para gente auténtica.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Tu cupón de regalo: ${coupon.descuento_porcentaje}% de descuento - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: email, name: name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[SUCCESS] Email de cupón enviado a:', email);
    return { success: true };
  } catch (error) {
    console.error('[ERROR] Error enviando email de cupón:', error);
    return { success: false, error };
  }
};

/**
 * Envía email de notificación de pedido cancelado
 */
export const sendOrderCancelledEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
      <div style="background: #ef4444; color: white; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Pedido Cancelado</h1>
        <p style="opacity: 0.9; margin: 5px 0;">Tu pedido #${order.id.toString().padStart(6, '0')} ha sido cancelado.</p>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${order.shipping_name}</strong>,</p>
        <p>Te confirmamos que tu pedido ha sido cancelado correctamente. </p>
        
        ${order.payment_status === 'paid' ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-weight: bold;">Procesando Reembolso</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #166534;">Hemos iniciado el reembolso de <strong>${(order.total_amount / 100).toFixed(2)}€</strong> a tu tarjeta. Deberías verlo reflejado en tu cuenta en un plazo de 5 a 10 días hábiles.</p>
          </div>
        ` : `
          <p>Como el pedido no había sido pagado todavía, no se ha realizado ningún cargo en tu cuenta.</p>
        `}

        <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Esperamos volver a verte pronto por nuestra tienda.</p>
        
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #64748b;">
          Atentamente,<br>
          <strong>Equipo de Fashion Store</strong>
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Cancelación de pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error };
  }
};

/**
 * Envía email de notificación cuando el pedido está siendo preparado
 */
export const sendOrderProcessingEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 50px 20px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 15px;">Atención al Detalle</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Preparación <span style="color: #d4af37;">Completada</span></h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Nuestro equipo ha finalizado la revisión y el embalaje de tu pedido <strong>#${order.id.toString().padStart(6, '0')}</strong>. Tu selección ya está lista para ser recogida por el transportista.
        </p>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; margin-bottom: 35px; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">Próximo paso: Envío y Entrega</p>
          <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;">Te notificaremos en cuanto el paquete abandone nuestras instalaciones.</p>
        </div>

        <p style="margin-top: 40px; font-size: 11px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; pt-30;">
          Gracias por elegir Fashion Store.<br>
          Cuidamos cada detalle para que tu experiencia sea única.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Estamos preparando tu pedido - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending processing notification:', error);
    return { success: false, error };
  }
};

/**
 * Envía email de notificación cuando el pedido ha sido enviado
 */
export const sendOrderShippedEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;
  const trackingUrl = `${getEnv('PUBLIC_SITE_URL') || 'https://fashionstore-cintas.netlify.app'}/seguimiento/${order.id}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 50px 20px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 15px;">Logística en Marcha</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Tu pedido ya está en <span style="color: #d4af37;">Camino</span></h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Grandes noticias. Tu pedido <strong>#${order.id.toString().padStart(6, '0')}</strong> ha sido procesado y ya está viajando hacia tu dirección.
        </p>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; margin-bottom: 35px; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px;">Portal de Seguimiento</p>
          <a href="${trackingUrl}" style="display: inline-block; background-color: #d4af37; color: #ffffff; padding: 18px 45px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 10px 20px -5px rgba(212, 175, 55, 0.4);">Rastrear mi Paquete</a>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          <strong>Transportista:</strong> ${order.carrier_name || 'FashionStore Priority'}<br>
          <strong>Nº Seguimiento:</strong> ${order.tracking_number || `FS-${order.id}-2026`}
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Tu pedido ya está en camino - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending shipment notification:', error);
    return { success: false, error };
  }
};

/**
 * Envía email de notificación cuando el pedido está en reparto (último tramo)
 */
export const sendOrderInDeliveryEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;
  const trackingUrl = `${getEnv('PUBLIC_SITE_URL') || 'https://fashionstore-cintas.netlify.app'}/seguimiento/${order.id}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 50px 20px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 15px;">Última Milla</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Tu pedido se entrega <span style="color: #d4af37;">Hoy</span></h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Tu pedido <strong>#${order.id.toString().padStart(6, '0')}</strong> ya está en el vehículo de reparto. Nuestro transportista lo entregará en tu dirección a lo largo del día de hoy.
        </p>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; margin-bottom: 35px; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 15px;">Localización en vivo</p>
          <a href="${trackingUrl}" style="display: inline-block; background-color: #d4af37; color: #ffffff; padding: 18px 45px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 10px 20px -5px rgba(212, 175, 55, 0.4);">Seguir Repartidor</a>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          Estimamos la entrega entre las <strong>09:00 y las 20:00</strong>.<br>
          Por favor, asegúrate de que haya alguien disponible para la recepción.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Tu pedido se entrega hoy - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return { success: false, error };
  }
};

/**
 * Envía email de notificación cuando el pedido ha sido entregado
 */
export const sendOrderDeliveredEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #16a34a; padding: 50px 20px; text-align: center;">
        <div style="color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; opacity: 0.8; margin-bottom: 15px;">Entrega Completada</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Pedido entregado</h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Nos complace informarte que tu pedido <strong>#${order.id.toString().padStart(6, '0')}</strong> ha sido entregado correctamente.
        </p>

        <div style="background-color: #f0fdf4; padding: 30px; border-radius: 20px; margin-bottom: 35px; border: 1px solid #dcfce7;">
           <p style="margin: 0; font-size: 14px; font-weight: 700; color: #166534;">Esperamos que disfrutes de tu compra.</p>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
          Adjunto encontrarás el recibo oficial de tu pedido. Si necesitas gestionar cualquier devolución, puedes hacerlo desde tu panel de cliente.
        </p>

        <div style="margin-top: 40px;">
           <a href="${getEnv('PUBLIC_SITE_URL') || 'https://fashionstore-cintas.netlify.app'}/mis-pedidos" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 18px 45px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Ver mi Historial</a>
        </div>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Pedido entregado - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al administrador de una nueva consulta o mensaje
 */
export const sendAdminInquiryNotification = async (inquiry: any, message: string) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const adminEmail = getEnv('ADMIN_EMAIL') || 'jdcintas.dam@gmail.com';

  const isNew = !inquiry.responded_at;
  const subject = isNew
    ? `[Nueva Consulta] de ${inquiry.customer_name || inquiry.customer_email}`
    : `[Nuevo Mensaje] Consulta #${inquiry.id.toString().padStart(4, '0')}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 40px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 10px;">Gestión de Clientes</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">Notificación de <span style="color: #d4af37;">Soporte</span></h1>
      </div>
      <div style="padding: 40px;">
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
          <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">De: ${inquiry.customer_name || 'Cliente'} (${inquiry.customer_email})</p>
          <div style="height: 1px; background: #e2e8f0; margin: 15px 0;"></div>
          <p style="margin: 0; font-size: 16px; color: #0f172a; line-height: 1.6; font-style: italic;">"${message}"</p>
        </div>
        
        <div style="text-align: center;">
          <a href="https://fashionstore-cintas.netlify.app/admin/inquiries" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">Responder al Cliente</a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">ID Consulta: #${inquiry.id.toString().padStart(4, '0')} | Fashion Store Admin</p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store Support', email: from };
  sendSmtpEmail.to = [{ email: adminEmail, name: 'Administrador' }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al cliente de una respuesta del administrador
 */
export const sendCustomerInquiryNotification = async (inquiry: any, message: string) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = inquiry.customer_email;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 40px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 10px;">Atención Personalizada</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">Tienes una nueva <span style="color: #d4af37;">Respuesta</span></h1>
      </div>
      <div style="padding: 40px;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${inquiry.customer_name || ''}</strong>,<br>
          Nuestro equipo ha respondido a tu consulta sobre <strong>${inquiry.product_name || 'nuestros servicios'}</strong>:
        </p>
        
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px; border-left: 4px solid #d4af37;">
          <p style="margin: 0; font-size: 15px; color: #0f172a; line-height: 1.6;">${message}</p>
        </div>
        
        <div style="text-align: center;">
          <a href="https://fashionstore-cintas.netlify.app/mensajes" style="display: inline-block; background-color: #d4af37; color: #ffffff; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Ver Conversación Completa</a>
        </div>
        
        <p style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px;">
          Gracias por confiar en Fashion Store.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Fashion Store: Tienes un nuevo mensaje de nuestro equipo`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: inquiry.customer_name || 'Cliente' }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending customer notification:', error);
    return { success: false, error };
  }
};

export const generateDashboardPDF = (stats: any): string => {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("RESUMEN DE NEGOCIO", 20, 25);

  doc.setFontSize(10);
  doc.text(`Fecha de exportación: ${new Date().toLocaleString('es-ES')}`, 20, 32);

  // KPIs
  let y = 60;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(18);
  doc.text("Indicadores Clave (KPIs)", 20, y);

  y += 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  const revenueCents = parseFloat(stats.revenue?.replace('€', '') || '0') * 100;
  const vatStats = calculateVAT(revenueCents);

  const entries = [
    ["Pedidos Realizados", stats.orders_count || '0'],
    ["Ventas Totales (IVA Inc.)", stats.revenue || '0€'],
    ["Base Imponible", vatStats.base],
    ["IVA (21%)", vatStats.iva],
    ["Valor Medio Pedido", stats.avg_order || '0€'],
    ["Nuevos Clientes", stats.new_customers || '0'],
    ["Tasa de Conversión", stats.conv_rate || '0%']
  ];

  entries.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 30, y);
    doc.setFont("helvetica", "normal");
    doc.text(value.toString(), 110, y);
    y += 10;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Fashion Store - Reporte Confidencial", 105, 285, { align: "center" });

  return doc.output('datauristring').split(',')[1];
};

/**
 * Genera un informe detallado de ventas para exportación PDF
 */
export const generateOrdersReportPDF = (orders: any[], label: string): string => {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("INFORME DE VENTAS", 20, 20);

  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55); // brand-gold
  doc.text(`PERIODO: ${label.toUpperCase()}`, 20, 30);

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Exportado el: ${new Date().toLocaleString('es-ES')}`, 190, 30, { align: 'right' });

  // Resumen del informe
  let y = 60;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.text("Métricas del Período", 20, y);

  // Preparar transacciones (Venta positiva + Reembolso negativo)
  const transactions: any[] = [];
  let totalGross = 0;
  let totalRefunds = 0;

  orders.forEach(order => {
    // Entrada positiva: Venta original
    const ticketNum = order.ticket_number || formatDocNumber(order.id, order.created_at, 'ONL-F');
    const gross = order.total_amount;
    const payMethod = "Tarjeta"; // Por ahora solo Stripe
    totalGross += gross;
    transactions.push({
      id: order.id,
      docCode: ticketNum,
      date: order.created_at,
      name: order.shipping_name,
      status: order.status,
      type: `VENTA - ${payMethod}`,
      amount: gross
    });

    // Entrada negativa: Reembolsos parciales o totales
    let refundAmount = (order.order_items || []).reduce((acc: number, item: any) => acc + (item.price * (item.return_refunded_quantity || 0)), 0);

    const isTotalCancellation = order.status === 'cancelled' && (order.payment_status === 'refunded' || order.payment_status === 'paid');

    if (isTotalCancellation || refundAmount > 0) {
      let finalRefundValue = isTotalCancellation ? order.total_amount : refundAmount;

      if (finalRefundValue > order.total_amount) {
        finalRefundValue = order.total_amount;
      }

      const refundNum = order.refund_invoice_number || formatDocNumber(order.id, order.updated_at || new Date(), 'ONL-R');
      const payMethod = "Tarjeta";

      totalRefunds += finalRefundValue;
      transactions.push({
        id: order.id,
        docCode: refundNum,
        date: order.return_received_at || order.updated_at,
        name: order.shipping_name,
        status: 'REEMBOLSADO',
        type: `ABONO - ${payMethod}`,
        amount: -finalRefundValue
      });
    }
  });

  const netRevenue = totalGross - totalRefunds;
  const vatStats = calculateVAT(netRevenue);

  y += 15;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Ventas Brutas:", 30, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatPrice(totalGross), 70, y);

  doc.setFont("helvetica", "bold");
  doc.text("Reembolsos:", 110, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 38, 38); // Red
  doc.text(`-${formatPrice(totalRefunds)}`, 160, y);
  doc.setTextColor(15, 23, 42);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total Neto:", 30, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(formatPrice(netRevenue), 70, y);
  doc.setTextColor(15, 23, 42);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "bold");
  doc.text("Base Imponible:", 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(vatStats.base, 160, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("IVA (21%):", 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(vatStats.iva, 160, y);

  // Tabla de Pedidos
  y += 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle de Transacciones", 20, y);

  y += 10;
  doc.setFillColor(245, 245, 245);
  doc.rect(5, y, 200, 8, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("DOCUMENTO", 8, y + 5.5);
  doc.text("FECHA", 45, y + 5.5);
  doc.text("CLIENTE", 65, y + 5.5);
  doc.text("TIPO", 115, y + 5.5);
  doc.text("BASE", 155, y + 5.5, { align: 'right' });
  doc.text("IVA", 180, y + 5.5, { align: 'right' });
  doc.text("TOTAL", 201, y + 5.5, { align: 'right' });

  y += 15;
  doc.setTextColor(26, 26, 26);

  transactions.forEach((tx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;

      // Header simplificado en nuevas páginas
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 15, 'F');
      y = 25;
    }

    const itemVat = calculateVAT(Math.abs(tx.amount));
    const isRefund = tx.amount < 0;

    doc.setFont("helvetica", isRefund ? "italic" : "bold");
    if (isRefund) doc.setTextColor(220, 38, 38);

    doc.setFontSize(7);
    doc.text(tx.docCode, 8, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(tx.date).toLocaleDateString('es-ES'), 45, y);
    doc.text(tx.name.substring(0, 25), 65, y);
    doc.text(tx.type, 115, y);

    const signStr = isRefund ? '-' : '';
    doc.text(signStr + itemVat.base, 155, y, { align: 'right' });
    doc.text(signStr + itemVat.iva, 180, y, { align: 'right' });
    doc.text(signStr + itemVat.total, 201, y, { align: 'right' });

    doc.setTextColor(26, 26, 26);
    y += 8;
    doc.setDrawColor(245, 245, 245);
    doc.line(5, y - 4, 201, y - 4);
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Fashion Store - Reporte Generado Automáticamente", 105, 290, { align: "center" });

  return doc.output('datauristring').split(',')[1];
};

/**
 * Envía un email de confirmación tras borrar la cuenta
 */
export const sendAccountDeletedEmail = async (email: string, name: string) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
      <div style="background: #0f172a; color: white; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Cuenta Eliminada</h1>
        <p style="opacity: 0.7; margin: 5px 0;">Te echaremos de menos en Fashion Store</p>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Te confirmamos que tu cuenta y tus datos personales han sido eliminados de nuestro sistema según tu solicitud.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4af37;">
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
            <strong>Nota legal:</strong> De acuerdo con la normativa vigente, conservaremos de forma segura y privada el registro de tus transacciones y facturas durante el periodo legal obligatorio (6 años), momento tras el cual serán eliminadas permanentemente.
          </p>
        </div>
        
        <p>Esperamos volver a verte pronto. Siempre serás bienvenido en nuestra boutique.</p>
        
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #64748b;">
          Atentamente,<br>
          <strong>Equipo de Fashion Store</strong>
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Confirmación de cuenta eliminada - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: email, name: name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending deletion email:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al cliente que su solicitud de devolución ha sido recibida
 */
export const sendReturnRequestedEmail = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 50px 20px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 15px;">Gestión de Devoluciones</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Solicitud <span style="color: #d4af37;">Recibida</span></h1>
      </div>
      <div style="padding: 40px;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Hemos registrado tu solicitud de devolución para el pedido <strong>#${order.id.toString().padStart(6, '0')}</strong>.
        </p>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; border: 1px dashed #d4af37; margin-bottom: 30px;">
            <p style="margin: 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Código para el Transportista</p>
            <p style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; font-family: monospace;">${order.return_tracking_id}</p>
        </div>

        <h3 style="color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px;">Siguientes pasos:</h3>
        <ol style="color: #64748b; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>Prepara el paquete en su embalaje original.</li>
            <li>Adjunta una nota con este código dentro del paquete para que podamos identificarlo.</li>
            <li>Entrega el paquete al transportista y facilítale el código <strong>${order.return_tracking_id}</strong> si te lo solicita.</li>
            <li>Una vez entregado, marca el pedido como "Enviado" en tu panel de cliente.</li>
        </ol>

        <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; border-t: 1px solid #f1f5f9; padding-top: 20px;">
            El reembolso se procesará automáticamente en cuanto verifiquemos el estado de los artículos.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Solicitud de devolución pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending return request email:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al cliente que su reembolso ha sido procesado
 */
export const sendReturnRefundedEmail = async (order: any, refundAmount: number) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #16a34a; padding: 50px 20px; text-align: center;">
        <div style="color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; opacity: 0.8; margin-bottom: 15px;">Devolución Finalizada</div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">Reembolso <span style="color: #ffffff; opacity: 0.7;">Procesado</span></h1>
      </div>
      <div style="padding: 40px; text-align: center;">
        <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
          Hola <strong>${order.shipping_name}</strong>,<br>
          Hemos recibido y verificado los artículos de tu devolución correspondiente al pedido <strong>#${order.id.toString().padStart(6, '0')}</strong>.
        </p>

        <div style="background-color: #f0fdf4; padding: 30px; border-radius: 20px; margin-bottom: 35px; border: 1px solid #dcfce7;">
           <p style="margin: 0; font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Importe Reembolsado</p>
           <p style="margin: 0; font-size: 32px; font-weight: 900; color: #16a34a;">${(refundAmount / 100).toFixed(2)}€</p>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
          El dinero debería aparecer en tu cuenta en un plazo de 5 a 10 días hábiles, dependiendo de tu entidad bancaria.
        </p>

        <p style="margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
          Gracias por tu paciencia. Esperamos verte de nuevo pronto en nuestra boutique.
        </p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Tu reembolso ha sido procesado - Pedido #${order.id.toString().padStart(6, '0')}`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending refund confirmation email:', error);
    return { success: false, error };
  }
};

/**
 * Genera el PDF del Reembolso (Negativo para admin, Positivo para cliente)
 */
export const generateRefundInvoicePDF = (order: any, refundAmount: number, items: any[] = [], outputType: 'base64' | 'buffer' = 'base64', isAdminView: boolean = false): string | Buffer => {
  const doc = new jsPDF();
  const refundNum = order.refund_invoice_number || formatDocNumber(order.id, order.updated_at || new Date(), 'ONL-R');
  const fiscal = order.invoice_fiscal_data || {};
  const sign = isAdminView ? '-' : '';
  const mainColor = [15, 23, 42];    // Slate
  const accentColor = [212, 175, 55]; // Gold

  // Header Elegant
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 60, 'F');

  // Logo FASHION STORE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
  doc.text("FASHION", 20, 35);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text("STORE", 20 + doc.getTextWidth("FASHION "), 35);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("PREMIUM BOUTIQUE SELECTION", 20, 42, { charSpace: 1.5 });

  // Título Dinámico - Ajustado para evitar solapamiento
  doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
  doc.setFontSize(isAdminView ? 16 : 22);
  doc.setFont("helvetica", "bold");
  doc.text(isAdminView ? "FACTURA RECTIFICATIVA" : "REEMBOLSO", 190, 35, { align: "right" });

  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(1);
  doc.line(20, 50, 190, 50);

  // Grid Datos
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("EMISOR", 20, 70);
  doc.text("CLIENTE", 110, 70);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(["Fashion Store S.L.", "NIF: B12345678"], 20, 76);
  doc.text([fiscal.razon_social || order.shipping_name, `NIF/CIF: ${fiscal.nif || 'N/A'}`], 110, 76);

  // Info Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 95, 170, 15, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(isAdminView ? "Nº RECTIFICATIVA" : "REF. REEMBOLSO", 25, 104);
  doc.text("PEDIDO ORIGEN", 135, 104);

  doc.setFont("helvetica", "normal");
  doc.text(refundNum, 65, 104);
  doc.text(`#${order.id.toString().padStart(6, '0')}`, 165, 104);

  // Tabla
  let y = 125;
  doc.setFillColor(15, 23, 42); // Slate
  doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("CONCEPTO DE ABONO", 25, y + 6.5);
  doc.text("IMPORTE", 185, y + 6.5, { align: "right" });

  y += 20;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  const desc = order.status === 'cancelled' ? `Anulación de pedido #${order.id}` : `Devolución de productos - Pedido #${order.id}`;
  doc.text(desc, 25, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${sign}${(refundAmount / 100).toFixed(2)}€`, 185, y, { align: 'right' });

  // Si hay cupón, mostrar información adicional de descuento aplicado originalmente
  if (order.coupon_code) {
    y += 10;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`* Descuento aplicado en compra original (Cupón: ${order.coupon_code})`, 25, y);
  }

  // Totales
  y += 25;
  const vat = calculateVAT(refundAmount);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Base Imponible", 130, y);
  doc.text(`${sign}${vat.base}`, 185, y, { align: 'right' });
  y += 7;
  doc.text("IVA (21%)", 130, y);
  doc.text(`${sign}${vat.iva}`, 185, y, { align: 'right' });

  y += 15;
  doc.setFillColor(15, 23, 42); // Slate
  doc.roundedRect(120, y - 10, 70, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL ABONO", 125, y);
  doc.setTextColor(212, 175, 55); // Gold
  doc.text(`${sign}${vat.total}`, 185, y, { align: 'right' });

  if (outputType === 'buffer') return Buffer.from(doc.output('arraybuffer'));
  return doc.output('datauristring').split(',')[1];
};

/**
 * Envía la factura rectificativa por email
 */
export const sendRefundInvoiceEmail = async (order: any, refundAmount: number) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const to = order.shipping_email;
  const pdfBase64 = generateRefundInvoicePDF(order, refundAmount, [], 'base64', false) as string;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
      <div style="background: #1e293b; color: white; padding: 40px 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Documento de Abono</h1>
        <p style="opacity: 0.7; margin: 5px 0;">Tu reembolso ha sido procesado</p>
      </div>
      <div style="padding: 30px;">
        <p>Hola <strong>${order.shipping_name}</strong>,</p>
        <p>Te informamos de que hemos procesado el reembolso de <strong>${(refundAmount / 100).toFixed(2)}€</strong> correspondiente a tu pedido #${order.id.toString().padStart(6, '0')}.</p>
        <p>Adjunto encontrarás la <strong>factura rectificativa</strong> para tu contabilidad.</p>
        <p style="margin-top: 20px; font-size: 13px; color: #64748b;">El abono aparecerá en tu cuenta en un plazo de 5-10 días hábiles.</p>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Factura Rectificativa pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: to, name: order.shipping_name }];
  const orderLabel = order.id.toString().padStart(6, '0');
  sendSmtpEmail.attachment = [{ name: `Factura_Reembolso_${orderLabel}.pdf`, content: pdfBase64 }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending refund invoice:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al administrador de un nuevo pedido realizado
 */
export const sendAdminNewOrderNotification = async (order: any, items: any[]) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const adminEmail = getEnv('ADMIN_EMAIL') || 'jdcintas.dam@gmail.com';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #f1f5f9; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 40px; text-align: center;">
        <div style="color: #d4af37; font-size: 10px; font-weight: 800; text-transform: uppercase; tracking: 0.2em; margin-bottom: 10px;">Gestión de Ventas</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">¡Nuevo Pedido <span style="color: #d4af37;">Recibido</span>!</h1>
      </div>
      <div style="padding: 40px;">
        <div style="background-color: #f8fafc; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Pedido #${order.id.toString().padStart(6, '0')}</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Cliente: ${order.shipping_name} (${order.shipping_email})</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Total: <strong>${(order.total_amount / 100).toFixed(2)}€</strong></p>
          <div style="height: 1px; background: #e2e8f0; margin: 15px 0;"></div>
          <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Artículos:</p>
          <ul style="margin: 0; padding: 0; list-style: none; font-size: 12px; color: #0f172a;">
            ${items.map(item => `<li>• ${item.product_name} (Talla: ${item.size || item.product_size}) x${item.quantity}</li>`).join('')}
          </ul>
        </div>
        
        <div style="text-align: center;">
          <a href="https://fashionstore-cintas.netlify.app/admin" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Ir al Panel de Control</a>
        </div>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `🔔 [VENTA] Nuevo pedido #${order.id.toString().padStart(6, '0')} - Fashion Store`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store Alerts', email: from };
  sendSmtpEmail.to = [{ email: adminEmail, name: 'Administrador' }];

  try {
    console.log(`[EMAILS] Intentando enviar notificación de nuevo pedido a admin: ${adminEmail} desde ${from}`);
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[EMAILS] Respuesta de Brevo:', JSON.stringify(response));
    console.log('[EMAILS] Notificación de nuevo pedido enviada con éxito');
    return { success: true };
  } catch (error: any) {
    console.error('[EMAILS] Error enviando alerta de nuevo pedido a admin:', error);
    if (error.response?._body) {
      console.error('[EMAILS] Detalles del error:', error.response._body);
    }
    return { success: false, error };
  }
};

/**
 * Notifica al administrador de una cancelación de pedido
 */
export const sendAdminOrderCancelledNotification = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const adminEmail = getEnv('ADMIN_EMAIL') || 'jdcintas.dam@gmail.com';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #fee2e2; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #ef4444; padding: 40px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">Pedido Cancelado</h1>
      </div>
      <div style="padding: 40px;">
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          El pedido <strong>#${order.id.toString().padStart(6, '0')}</strong> de <strong>${order.shipping_name}</strong> ha sido cancelado por el cliente.
        </p>
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 16px; border: 1px solid #fee2e2; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;">Se ha procesado automáticamente la restauración del stock.</p>
          ${order.payment_status === 'refunded' ? '<p style="margin: 5px 0 0 0; font-size: 13px; color: #991b1b; font-weight: bold;">⚠️ Reembolso de Stripe emitido.</p>' : ''}
        </div>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `❌ [CANCELADO] Pedido #${order.id.toString().padStart(6, '0')}`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store Alerts', email: from };
  sendSmtpEmail.to = [{ email: adminEmail, name: 'Administrador' }];

  try {
    console.log(`[EMAILS] Intentando enviar notificación de cancelación a admin: ${adminEmail}`);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[EMAILS] Notificación de cancelación enviada con éxito');
    return { success: true };
  } catch (error) {
    console.error('[EMAILS] Error enviando alerta de cancelación a admin:', error);
    return { success: false, error };
  }
};

/**
 * Notifica al administrador de una nueva solicitud de devolución
 */
export const sendAdminReturnRequestedNotification = async (order: any) => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';
  const adminEmail = getEnv('ADMIN_EMAIL') || 'jdcintas.dam@gmail.com';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid #fef3c7; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #d4af37; padding: 40px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">Nueva Solicitud de Devolución</h1>
      </div>
      <div style="padding: 40px;">
        <div style="background-color: #fffbeb; padding: 30px; border-radius: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Pedido #${order.id.toString().padStart(6, '0')}</p>
          <p style="margin: 0; font-size: 12px; color: #64748b;">Cliente: ${order.shipping_name}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Motivo: <strong>${order.return_reason || 'No especificado'}</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">ID Seguimiento de Retorno: <strong>${order.return_tracking_id}</strong></p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://fashionstore-cintas.netlify.app/admin" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase;">Revisar Devolución</a>
        </div>
      </div>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `🔄 [DEVOLUCIÓN] Solicitud para pedido #${order.id.toString().padStart(6, '0')}`;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store Alerts', email: from };
  sendSmtpEmail.to = [{ email: adminEmail, name: 'Administrador' }];

  try {
    console.log(`[EMAILS] Intentando enviar notificación de devolución a admin: ${adminEmail}`);
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[EMAILS] Notificación de devolución enviada con éxito');
    return { success: true };
  } catch (error) {
    console.error('[EMAILS] Error enviando alerta de devolución a admin:', error);
    return { success: false, error };
  }
};

/**
 * Envía un email de newsletter a un suscriptor
 * Usado por el sistema de campañas masivas
 */
export const sendNewsletterEmail = async (
  email: string,
  nombre: string,
  subject: string,
  contentHtml: string,
  campaignId?: string
): Promise<{ success: boolean; error?: any }> => {
  const from = getEnv('EMAIL_FROM') || 'jdcintas.dam@10489692.brevosend.com';

  // Wrapper HTML con diseño premium y opción de baja
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 0; overflow: hidden; background-color: #ffffff;">
        
        <!-- Header Premium -->
        <div style="background-color: #0f172a; padding: 40px 30px; text-align: center;">
          <div style="margin-bottom: 15px;">
            <span style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">FASHION</span>
            <span style="font-size: 28px; font-weight: 900; color: #d4af37; letter-spacing: -1px;">STORE</span>
          </div>
          <p style="margin: 0; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px;">Newsletter Exclusiva</p>
        </div>
        
        <!-- Contenido Principal -->
        <div style="padding: 40px 30px;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #64748b;">
            Hola <strong style="color: #0f172a;">${nombre || 'Cliente'}</strong>,
          </p>
          
          <!-- Contenido dinámico de la campaña -->
          <div style="color: #334155; font-size: 15px; line-height: 1.7;">
            ${contentHtml}
          </div>
        </div>
        
        <!-- Footer con opción de baja -->
        <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 15px 0; font-size: 12px; color: #94a3b8;">
            © 2026 Fashion Store. Calidad premium para gente auténtica.
          </p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">
            Recibes este email porque estás suscrito a nuestra newsletter.<br>
            <a href="https://fashionstore.com/mi-cuenta" style="color: #d4af37; text-decoration: underline;">Gestionar preferencias</a> · 
            <a href="https://fashionstore.com/mi-cuenta" style="color: #64748b; text-decoration: underline;">Darse de baja</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = { name: 'Fashion Store', email: from };
  sendSmtpEmail.to = [{ email: email, name: nombre || 'Suscriptor' }];
  
  // Headers personalizados para tracking
  if (campaignId) {
    sendSmtpEmail.headers = {
      'X-Campaign-ID': campaignId
    };
  }

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[NEWSLETTER] Email enviado a: ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[NEWSLETTER] Error enviando a ${email}:`, error);
    return { success: false, error };
  }
};
