import { sendOrderReceiptEmail, sendAdminNewOrderNotification } from '../src/lib/emails.ts';
import fs from 'fs';
import path from 'path';

// Manual .env loader
function loadEnv() {
    try {
        const envPath = path.resolve('.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
            }
        });
        console.log('✅ .env cargado');
    } catch (e) {
        console.error('Error loading .env file', e);
    }
}

loadEnv();

// Mock data
const mockOrder = {
    id: 9999,
    created_at: new Date().toISOString(),
    total_amount: 5000, // 50.00€
    shipping_name: 'Tester Admin',
    shipping_email: 'jdcintas.dam@gmail.com',
    shipping_address: 'Calle Falsa 123',
    shipping_city: 'Madrid',
    shipping_zip: '28001'
};

const mockItems = [
    {
        product_name: 'Camiseta Test',
        size: 'M',
        quantity: 2,
        price_at_time: 2500
    }
];

async function runTest() {
    console.log('🚀 Iniciando Test de Emails...');

    console.log('\n1. Test: Recibo Cliente...');
    const res1 = await sendOrderReceiptEmail(mockOrder, mockItems);
    console.log('Resultado:', res1.success ? 'ÉXITO' : 'FALLO', res1.error || '');

    console.log('\n2. Test: Notificación Admin...');
    const res2 = await sendAdminNewOrderNotification(mockOrder, mockItems);
    console.log('Resultado:', res2.success ? 'ÉXITO' : 'FALLO', res2.error || '');
}

runTest();
