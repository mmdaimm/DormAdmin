import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

let adminCookie = '';
let ownerCookie = '';

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (!res.ok) throw new Error(`Login failed for ${username}: ${res.statusText}`);
  
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) throw new Error(`No cookie returned for ${username}`);
  
  const token = cookieHeader.split(';')[0];
  return token;
}

async function fetchApi(endpoint: string, cookie: string, method = 'GET', body: any = null) {
  const options: any = {
    method,
    headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  
  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }
  
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting E2E QA Suite...');
  
  // 1. Auth & RBAC
  console.log('\n--- 1. Auth & RBAC Tests ---');
  try {
    adminCookie = await login('admin', 'admin123');
    ownerCookie = await login('owner', 'owner123');
    console.log('✅ Logged in successfully as admin and owner');
    
    // Admin trying to access /api/settings with POST (Restricted)
    const adminSettingsPost = await fetchApi('/api/settings', adminCookie, 'POST', { rates: [] });
    if (adminSettingsPost.status === 403) {
      console.log('✅ Admin blocked from mutating settings (403 Forbidden)');
    } else {
      console.error(`❌ Admin was NOT blocked from mutating settings! Status: ${adminSettingsPost.status}`);
    }
    
    // Admin trying to access /api/settings with GET (Allowed)
    const adminSettingsGet = await fetchApi('/api/settings', adminCookie, 'GET');
    if (adminSettingsGet.status === 200) {
      console.log('✅ Admin allowed to view settings (200 OK)');
    } else {
      console.error(`❌ Admin was blocked from viewing settings! Status: ${adminSettingsGet.status}`);
    }
  } catch (err: any) {
    console.error('❌ Auth test failed:', err.message);
  }

  // 2. Dashboard KPIs
  console.log('\n--- 2. Dashboard KPI Tests ---');
  try {
    const dashRes = await fetchApi('/api/dashboard', ownerCookie);
    if (dashRes.status === 200) {
      const data = dashRes.data;
      console.log('✅ Dashboard loaded successfully');
      console.log(`   - Total Rooms: ${data.kpi.totalRooms}`);
      console.log(`   - Occupied Rooms: ${data.kpi.occupiedRooms} (Expected: 9 since 104 moved out)`);
      console.log(`   - Unpaid Invoices: ${data.kpi.unpaidCount}`);
      console.log(`   - Total Outstanding (Arrears): ฿${data.kpi.totalOutstanding.toLocaleString()}`);
      
      if (data.kpi.occupiedRooms === 9) {
        console.log('✅ Move-out logic (INACTIVE) is correctly excluding tenants from occupancy KPI!');
      } else {
        console.error('❌ Move-out logic failed in KPI');
      }
    } else {
      console.error(`❌ Dashboard failed! Status: ${dashRes.status}`);
    }
  } catch (err: any) {
    console.error('❌ Dashboard test failed:', err.message);
  }

  // 3. Payment Processing & Overpayment Edge Cases
  console.log('\n--- 3. Payment Edge Case Tests ---');
  try {
    // Fetch all invoices to find a target for Room 101 (Partial payment case)
    const invRes = await fetchApi('/api/invoices', ownerCookie);
    if (invRes.status === 200) {
      const invoices = invRes.data.invoices;
      
      // Let's test paying a Room 101 invoice.
      const room101Unpaid = invoices.filter(i => i.roomId === '101' && i.status === 'PARTIAL');
      if (room101Unpaid.length > 0) {
         console.log(`✅ Found Room 101 with PARTIAL status (Arrears accumulated correctly)`);
         const target = room101Unpaid[0];
         console.log(`   Invoice ${target.invoiceId} - Remaining Arrears: ${target.remainingArrears}`);
      } else {
         console.error('❌ Could not find Room 101 PARTIAL invoices');
      }

      // Test Room 103 Overpayment (Let's pay an unpaid invoice for 103 with excessive amount)
      const room103Unpaid = invoices.filter(i => i.roomId === '103' && i.status !== 'PAID');
      if (room103Unpaid.length > 0) {
         const target = room103Unpaid[0];
         const amountToPay = target.totalAmount + target.arrears + 5000; // Massively overpay
         
         const payRes = await fetchApi('/api/invoices/pay', ownerCookie, 'POST', {
           invoiceId: target.invoiceId,
           amountPaid: amountToPay,
         });
         
         if (payRes.status === 200) {
            console.log(`✅ Processed overpayment for Room 103 (Paid: ฿${amountToPay})`);
            console.log(`   New Credit Balance calculated: ฿${payRes.data.newCredit}`);
            
            // Verify Room 103 credit in Room list
            const roomsRes = await fetchApi('/api/rooms', ownerCookie);
            const r103 = roomsRes.data.rooms.find(r => r.roomId === '103');
            console.log(`   Verified Room 103 Credit in Database: ฿${r103.creditBalance}`);
            if (r103.creditBalance > 0) {
              console.log('✅ Credit balance correctly saved to DB');
            } else {
              console.error('❌ Credit balance was NOT saved to DB');
            }
         } else {
            console.error(`❌ Payment failed! Status: ${payRes.status} ${JSON.stringify(payRes.data)}`);
         }
      }
    } else {
      console.error(`❌ Failed to fetch invoices! Status: ${invRes.status}`);
    }
  } catch (err: any) {
    console.error('❌ Payment test failed:', err.message);
  }

  console.log('\n🎉 E2E Tests Complete!');
}

runTests();
