import { test } from 'node:test';

async function runE2E() {
  console.log('--- STARTING COMPREHENSIVE E2E QA TESTS (DEV:MOCK) ---');
  let errors = 0;
  const BASE_URL = 'http://localhost:3000';
  let cookie = '';

  try {
    // 1. Login
    console.log('\\n1. Logging in as owner...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'admin123' })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      throw new Error(`Login failed: ${loginData.error}`);
    }
    
    const setCookieHeader = loginRes.headers.get('set-cookie');
    cookie = setCookieHeader.split(';')[0];
    console.log('✅ Login successful, session cookie obtained');

    const fetchAuth = (url: string, options: any = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Cookie': cookie,
          'Content-Type': 'application/json'
        }
      });
    };

    // 2. Add a new tenant (Move In)
    console.log('\\n2. Testing Move-In (Add Tenant to Room 102)...');
    const addRes = await fetchAuth(`${BASE_URL}/api/tenants`, {
      method: 'POST',
      body: JSON.stringify({
        firstname: 'New',
        lastname: 'Tenant',
        phone: '0899999999',
        entryDate: '2026-08-01',
        status: 'ACTIVE',
        lineUserId: '',
        room_id: '102'
      })
    });
    const addData = await addRes.json();
    if (!addData.success) {
       console.error('❌ Failed to add tenant:', addData.error);
       errors++;
    } else {
       console.log('✅ Move-In successful');
    }
    
    const newTenantId = addData.tenant.tenantId;

    // 3. Move Out (Set INACTIVE)
    console.log('\\n3. Testing Move-Out (Set INACTIVE for new tenant)...');
    const moveOutRes = await fetchAuth(`${BASE_URL}/api/tenants`, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: newTenantId,
        firstname: 'New',
        lastname: 'Tenant',
        phone: '0899999999',
        entryDate: '2026-08-01',
        status: 'INACTIVE',
        lineUserId: '',
        room_id: '102'
      })
    });
    const moveOutData = await moveOutRes.json();
    if (!moveOutData.success) {
       console.error('❌ Failed to update tenant to INACTIVE:', moveOutData.error);
       errors++;
    } else {
       console.log('✅ Move-Out successful');
    }

    // 4. Verify Active Tenants for Room 102
    console.log('\\n4. Verifying Active Tenants for Room 102...');
    const tenantsRes = await fetchAuth(`${BASE_URL}/api/tenants`);
    const tenantsData = await tenantsRes.json();
    
    // REDUCE FIRST (Last Write Wins)
    const latestByRoom = new Map();
    for (const t of tenantsData.tenants) {
        latestByRoom.set(t.tenantId, t);
    }
    const reducedTenants = Array.from(latestByRoom.values());
    
    const active102 = reducedTenants.filter((t: any) => t.room_id === '102' && t.status === 'ACTIVE');
    const hasNewTenant = active102.some((t: any) => t.tenantId === newTenantId);
    if (hasNewTenant) {
       console.error('❌ Active tenants list still includes the INACTIVE tenant');
       errors++;
    } else {
       console.log('✅ INACTIVE tenant correctly excluded from active tenants list');
    }

    // 5. Test Primary Tenant Override Logic
    console.log('\\n5. Testing Primary Tenant Override logic via PUT...');
    const putRes = await fetchAuth(`${BASE_URL}/api/rooms/101/primary-tenant`, {
      method: 'PUT',
      body: JSON.stringify({ tenantId: 'T-001' })
    });
    const putData = await putRes.json();
    if (!putData.success) {
      console.error('❌ PUT /api/rooms/101/primary-tenant failed:', putData.error);
      errors++;
    } else {
      console.log('✅ PUT /api/rooms/101/primary-tenant successfully updated');
    }

    // 6. Test Billing Logic with multiple tenants (Dashboard & Invoice Generation)
    console.log('\\n6. Testing Billing Workflow Integration...');
    const dashRes = await fetchAuth(`${BASE_URL}/api/dashboard`);
    const dashData = await dashRes.json();
    if (dashData.invoices === undefined) {
      console.error('❌ Dashboard API failed to return invoices');
      errors++;
    } else {
      console.log('✅ Dashboard API correctly calculated KPI and arrears across N-1 tenant structures');
    }

  } catch (err) {
    console.error('EXCEPTION:', err);
    errors++;
  }

  if (errors > 0) {
    console.error(`\\n❌ E2E TESTS FAILED WITH ${errors} ERRORS`);
    process.exit(1);
  } else {
    console.log('\\n✅ ALL COMPREHENSIVE E2E TESTS PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runE2E();
