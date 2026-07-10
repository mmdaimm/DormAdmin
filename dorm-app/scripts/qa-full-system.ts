import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

async function fetchApi(endpoint: string, cookie: string, method = 'GET', body: any = null) {
  const options: any = {
    method,
    headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  
  let data: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  
  return { status: res.status, data };
}

async function runFullSystemTest() {
  console.log('🚀 Starting Full System QA Test...');
  try {
    // 1. Auth Login
    console.log('\n--- 1. Authentication ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'owner123' })
    });
    
    if (!loginRes.ok) throw new Error('Login failed');
    const setCookieHeader = loginRes.headers.raw()['set-cookie'] || [];
    let token = '';
    for (const cookieStr of setCookieHeader) {
      if (cookieStr.startsWith('auth_token=')) {
        token = cookieStr.split(';')[0];
        break;
      }
    }
    console.log('✅ Logged in successfully');

    // 2. Fetch Rooms & Tenants (Pre-Move-In)
    console.log('\n--- 2. Load Dashboard & Base Data ---');
    const dashRes = await fetchApi('/dashboard', token);
    console.log('Dashboard Data:', JSON.stringify(dashRes.data, null, 2));

    // 3. Move In a New Tenant (Room 105)
    console.log('\n--- 3. Move-In Tenant (Room 105) ---');
    const moveInRes = await fetchApi('/tenants', token, 'POST', {
      firstname: 'Somchai',
      lastname: 'Test',
      phone: '0812345678',
      room_id: '105',
      entryDate: '2026-07-01',
      status: 'ACTIVE',
      lineUserId: '@somchai_line'
    });
    console.log('Move-In Response:', moveInRes.status, moveInRes.data);

    // 4. Calculate Invoice for Room 105
    console.log('\n--- 4. Calculate Invoice (Room 105) ---');
    const calcRes = await fetchApi('/invoices/calculate', token, 'POST', {
      roomId: '105',
      roomNumber: '105',
      period: '2026-08',
      currMeter: 8500,
      otherBill: 0
    });
    console.log('Calculate Invoice Response:', calcRes.status, JSON.stringify(calcRes.data, null, 2));

    // 5. Generate Invoice
    console.log('\n--- 5. Save/Generate Invoice (Room 105) ---');
    const saveInvRes = await fetchApi('/invoices', token, 'POST', calcRes.data.data);
    console.log('Save Invoice Response:', saveInvRes.status, saveInvRes.data);
    
    // 6. Pay Invoice (Partial Payment)
    console.log('\n--- 6. Partial Payment (Room 105) ---');
    if (saveInvRes.data?.invoice?.invoiceId) {
      const payRes = await fetchApi('/invoices/pay', token, 'POST', {
        invoiceId: saveInvRes.data.invoice.invoiceId,
        amountPaid: 1000 // Partial payment
      });
      console.log('Partial Payment Response:', payRes.status, payRes.data);
    }

    // 7. Pay Invoice (Full/Overpayment)
    console.log('\n--- 7. Overpayment (Room 102) ---');
    const invList = await fetchApi('/invoices', token);
    const room102Inv = invList.data?.invoices?.find((i: any) => i.roomId === '102' && i.status !== 'PAID');
    if (room102Inv) {
      const payRes = await fetchApi('/invoices/pay', token, 'POST', {
        invoiceId: room102Inv.invoiceId,
        amountPaid: 5000 // Overpayment (2915 total)
      });
      console.log('Overpayment Response:', payRes.status, payRes.data);
    }

    // 8. Accounting Summary
    console.log('\n--- 8. Accounting Summary ---');
    const accRes = await fetchApi('/accounting/summary?year=all', token);
    console.log('Accounting Response:', accRes.status, accRes.data?.totals);

    console.log('\n🎉 Full System QA Test Complete!');
  } catch (err) {
    console.error('Test script failed:', err);
  }
}

runFullSystemTest();
