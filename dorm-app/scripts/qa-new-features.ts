import fetch from 'node-fetch';

async function runTests() {
  console.log('--- STARTING QA TEST FOR NEW FEATURES ---');

  const BASE_URL = 'http://localhost:3000/api';

  try {
    // 0. Login
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'owner123' })
    });
    const loginData = await loginRes.json();
    
    // Extract cookie from Set-Cookie header
    const setCookieHeader = loginRes.headers.raw()['set-cookie'] || [];
    let token = '';
    for (const cookieStr of setCookieHeader) {
      if (cookieStr.startsWith('auth_token=')) {
        token = cookieStr.split(';')[0].split('=')[1];
        break;
      }
    }

    const authHeaders = { 
      'Content-Type': 'application/json',
      'Cookie': `auth_token=${token}`
    };

    // 1. Test POST /api/tenants with lineUserId
    console.log('\n1. Testing POST /api/tenants with lineUserId...');
    const postRes = await fetch(`${BASE_URL}/tenants`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        firstname: 'TestLine',
        lastname: 'User',
        phone: '0899999999',
        room_id: '101',
        entryDate: '2026-07-09',
        status: 'ACTIVE',
        lineUserId: '@testline123'
      })
    });
    
    if (!postRes.ok) {
        console.error('Failed POST. Status:', postRes.status, await postRes.text());
        throw new Error('POST failed');
    }
    const postData = await postRes.json();
    console.log('✅ POST /api/tenants success:', postData.tenant.firstname, postData.tenant.lineUserId);

    // 2. Test GET /api/tenants to verify lineUserId was saved
    console.log('\n2. Testing GET /api/tenants...');
    const getRes = await fetch(`${BASE_URL}/tenants`, { headers: authHeaders });
    const getData = await getRes.json();
    const found = getData.tenants.find((t: any) => t.tenantId === postData.tenant.tenantId);
    if (found && found.lineUserId === '@testline123') {
      console.log('✅ GET /api/tenants found the lineUserId successfully.');
    } else {
      console.error('❌ GET /api/tenants failed to return correct lineUserId', found);
    }

    // 3. Test GET /api/accounting/summary?year=all
    console.log('\n3. Testing GET /api/accounting/summary?year=all...');
    const accRes = await fetch(`${BASE_URL}/accounting/summary?year=all`, { headers: authHeaders });
    const accData = await accRes.json();
    if (accData.success) {
      console.log('✅ GET /api/accounting/summary?year=all success.');
      console.log('Data sample:', accData.data.slice(0, 2));
      console.log('Totals:', accData.totals);
    } else {
      console.error('❌ GET /api/accounting/summary?year=all failed:', accData);
    }

    console.log('\n--- QA TEST COMPLETE ---');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
}

runTests();
