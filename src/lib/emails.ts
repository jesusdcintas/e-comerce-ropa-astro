import * as brevo from '@getbrevo/brevo';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from './logo';

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, import.meta.env.BREVO_API_KEY || '');

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
 * Genera el PDF del Ticket (Recibo automático) con diseño Premium
 */
export const generateTicketPDF = (order: any, items: any[], outputType: 'base64' | 'buffer' = 'base64'): string | Buffer => {
  const doc = new jsPDF();
  const ticketNum = order.ticket_number || `T-${order.id.toString().padStart(6, '0')}`;

  // Header Superior (Blanco y Oro)
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 45, 'F');

  // Línea decorativa dorada superior
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.8);
  doc.line(0, 45, 210, 45);

  // Replicación del Logo con Texto (Fashion Store)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(26, 26, 26);
  const fashionTxt = "FASHION";
  const storeTxt = "STORE";
  const fashionWidth = doc.getTextWidth(fashionTxt + " ");
  const storeWidth = doc.getTextWidth(storeTxt);
  const totalWidth = fashionWidth + storeWidth;
  const startX = (210 - totalWidth) / 2;

  doc.text(fashionTxt, startX, 28);
  doc.setTextColor(212, 175, 55); // Color Oro Premium
  doc.text(storeTxt, startX + fashionWidth, 28);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("PREMIUM BOUTIQUE", 105, 35, { align: "center", charSpace: 2 });

  // Cuerpo del Ticket
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA SIMPLIFICADA", 105, 60, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("DOCUMENTO NO VÁLIDO COMO FACTURA COMERCIAL", 105, 66, { align: "center" });

  // Información del Pedido (Elegante)
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(20, 75, 170, 22, 2, 2, 'FD');

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ID CONTROL:", 30, 84);
  doc.setFont("helvetica", "normal");
  doc.text(ticketNum, 60, 84);

  doc.setFont("helvetica", "bold");
  doc.text("FECHA:", 30, 90);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(order.created_at).toLocaleDateString('es-ES'), 60, 90);

  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", 120, 87);
  doc.setFont("helvetica", "normal");
  doc.text(order.shipping_name, 140, 87);

  // Tabla Premium
  let y = 108;
  doc.setFillColor(26, 26, 26);
  doc.roundedRect(20, y, 170, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN DEL ARTÍCULO", 25, y + 6.5);
  doc.text("TOTAL", 170, y + 6.5);

  y += 18;
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "normal");

  items.forEach(item => {
    doc.text(`${item.product_name}`, 25, y);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Talla: ${item.size || item.product_size} | Cantidad: ${item.quantity}`, 25, y + 5);

    doc.setFontSize(11);
    doc.setTextColor(26, 26, 26);
    doc.text(formatPrice(item.price_at_time * item.quantity), 170, y, { align: 'right' });

    y += 15;
    doc.setDrawColor(245, 245, 245);
    doc.line(20, y - 8, 190, y - 8);

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  // Totales
  y += 5;
  const vat = calculateVAT(order.total_amount);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Base Imponible (IVA incl.):", 130, y);
  doc.text(vat.base, 185, y, { align: 'right' });
  y += 7;
  doc.text("IVA Aplicado (21%):", 130, y);
  doc.text(vat.iva, 185, y, { align: 'right' });

  y += 12;
  doc.setFillColor(26, 26, 26);
  doc.rect(120, y - 8, 70, 12, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAGADO", 125, y);
  doc.setTextColor(255, 255, 255);
  doc.text(vat.total, 185, y, { align: 'right' });

  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Gracias por elegir la elegancia de Fashion Store.", 105, 285, { align: "center" });

  if (outputType === 'buffer') {
    return Buffer.from(doc.output('arraybuffer'));
  }

  return doc.output('datauristring').split(',')[1];
};

/**
 * Genera el PDF de la Factura con diseño Corporativo/Premium
 */
export const generateInvoicePDF = (order: any, items: any[], outputType: 'base64' | 'buffer' = 'base64'): string | Buffer => {
  const doc = new jsPDF();
  const invoiceNum = order.invoice_number || `F-${new Date().getFullYear()}-${order.id.toString().padStart(5, '0')}`;
  const fiscal = order.invoice_fiscal_data || {};

  // Header Blanco Elegant
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 50, 'F');

  // Replicación del Logo con Texto (Fashion Store) - Superior Izquierda
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(26, 26, 26);
  doc.text("FASHION", 20, 25);
  doc.setTextColor(212, 175, 55);
  doc.text("STORE", 20 + doc.getTextWidth("FASHION "), 25);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("PREMIUM BOUTIQUE", 20, 31, { charSpace: 1.5 });

  // (Eliminamos el texto repetido ya que el logo ahora es el texto principal)

  // Título FACTURA con línea
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", 190, 35, { align: "right" });

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1.5);
  doc.line(20, 48, 190, 48);

  // Detalles de Facturación Grid
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(9);

  // Box Emisor
  doc.setFont("helvetica", "bold");
  doc.text("EMISOR", 20, 65);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);
  doc.text("Fashion Store S.L.", 20, 70);
  doc.text("NIF: B12345678", 20, 74);
  doc.text("Calle de la Moda, 123", 20, 78);
  doc.text("28001 Madrid, España", 20, 82);

  // Box Receptor
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE / RECEPTOR", 110, 65);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);
  doc.text(fiscal.razon_social || order.shipping_name, 110, 70);
  doc.text(`NIF/CIF: ${fiscal.nif || 'N/A'}`, 110, 74);
  doc.text(fiscal.direccion || order.shipping_address, 110, 78);
  doc.text(`${fiscal.codigo_postal || ''} ${fiscal.city || fiscal.ciudad || ''}`, 110, 82);

  // Box Info Factura
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(20, 95, 170, 15, 2, 2, 'F');
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.text("Nº FACTURA:", 25, 104);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceNum, 55, 104);

  doc.setFont("helvetica", "bold");
  doc.text("FECHA:", 135, 104);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString('es-ES'), 155, 104);

  // Tabla Factura
  let y = 125;
  doc.setFillColor(212, 175, 55);
  doc.rect(20, y, 170, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN", 25, y + 6.5);
  doc.text("CANT.", 115, y + 6.5, { align: "center" });
  doc.text("P. UNIT.", 145, y + 6.5, { align: "right" });
  doc.text("TOTAL", 185, y + 6.5, { align: "right" });

  y += 18;
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "normal");

  items.forEach(item => {
    const totalItem = (item.price_at_time * item.quantity) / 100;
    doc.text(`${item.product_name} (${item.size || item.product_size})`, 25, y);
    doc.text(item.quantity.toString(), 115, y, { align: 'center' });
    doc.text((item.price_at_time / 100).toFixed(2) + '€', 145, y, { align: 'right' });
    doc.text(totalItem.toFixed(2) + '€', 185, y, { align: 'right' });

    y += 12;
    doc.setDrawColor(240, 240, 240);
    doc.line(20, y - 6, 190, y - 6);

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  // Totales
  y += 10;
  const vat = calculateVAT(order.total_amount);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Base Imponible:", 130, y);
  doc.text(vat.base, 185, y, { align: 'right' });
  y += 7;
  doc.text("IVA (21%):", 130, y);
  doc.text(vat.iva, 185, y, { align: 'right' });

  y += 15;
  doc.setFillColor(26, 26, 26);
  doc.roundedRect(120, y - 10, 70, 15, 2, 2, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL FACTURA", 125, y);
  doc.setTextColor(255, 255, 255);
  doc.text(vat.total, 185, y, { align: 'right' });

  // Pie de página Legal
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("FashionStore Studio S.L. - Inscrita en el Registro Mercantil de Madrid, Tomo 1234, Folio 56, Sección 8, Hoja M-78901.", 105, 280, { align: "center" });
  doc.text("Este documento cumple con todos los requisitos legales del Real Decreto 1619/2012 de facturación.", 105, 284, { align: "center" });

  if (outputType === 'buffer') {
    return Buffer.from(doc.output('arraybuffer'));
  }

  return doc.output('datauristring').split(',')[1];
};

/**
 * Envía el recibo/ticket automático tras la compra
 * NOTA: Alias sendInvoiceEmail para compatibilidad con checkout/success.astro
 */
export const sendOrderReceiptEmail = async (order: any, items: any[]) => {
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@10489692.brevosend.com';
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
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true };
  } catch (error) {
    console.error('Error sending receipt:', error);
    return { success: false, error };
  }
};

/**
 * Envía la factura oficial (solicitada por el cliente)
 */
export const sendOfficialInvoiceEmail = async (order: any, items: any[]) => {
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@10489692.brevosend.com';
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
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@10489692.brevosend.com';

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
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@10489692.brevosend.com';
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
 * Notifica al administrador de una nueva consulta o mensaje
 */
export const sendAdminInquiryNotification = async (inquiry: any, message: string) => {
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@gmail.com';
  const adminEmail = import.meta.env.ADMIN_EMAIL || from;

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
  const from = import.meta.env.EMAIL_FROM || 'jdcintas.dam@gmail.com';
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

  const entries = [
    ["Ventas Totales", stats.revenue || '0€'],
    ["Pedidos Realizados", stats.orders_count || '0'],
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
