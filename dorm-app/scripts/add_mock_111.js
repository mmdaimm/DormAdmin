const fs = require('fs');

const DB_PATH = 'e:/Project/DormAdmin/dorm-app/data/mock_db.json';

function run() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

  // 1. Add or Update Room 111
  let room111Idx = db.Rooms.findIndex((r, i) => i > 0 && r[0] === '111');
  if (room111Idx === -1) {
    db.Rooms.push(['111', '111', '1500', '', '0', '3000', 'T-111-2', 'T-111-2']);
  } else {
    db.Rooms[room111Idx][6] = 'T-111-2'; // primary
    db.Rooms[room111Idx][7] = 'T-111-2'; // legacy primary
  }

  // 2. Clear old tenants for 111
  db.Tenants = db.Tenants.filter((t, i) => i === 0 || t[4] !== '111');
  // Add new tenants - Both moved in on 24/07/2025
  db.Tenants.push(['T-111-1', 'สมรักษ์', 'คำสิงห์', '0811111111', '111', '2025-07-24', 'ACTIVE', 'somruck111']);
  db.Tenants.push(['T-111-2', 'สมพงษ์', 'พงษ์สม', '0822222222', '111', '2025-07-24', 'ACTIVE', 'sompong222']);

  // 3. Clear old invoices for 111
  db.Invoices = db.Invoices.filter((inv, i) => i === 0 || inv[1] !== '111');

  // 4. Generate 12 months of invoices (2025-07 to 2026-06)
  
  const periods = [
    { p: '2025-07', m: 50 },
    { p: '2025-08', m: 90 },
    { p: '2025-09', m: 140 },
    { p: '2025-10', m: 180 },
    { p: '2025-11', m: 240 },
    { p: '2025-12', m: 280 },
    { p: '2026-01', m: 310 },
    { p: '2026-02', m: 350 },
    { p: '2026-03', m: 400 },
    { p: '2026-04', m: 470 },
    { p: '2026-05', m: 520 },
    { p: '2026-06', m: 580 },
  ];

  let currentArrears = 0;
  let lastMeter = 0;
  const rent = 1500;
  const water = 60;
  const elecRate = 5;

  const paymentPatterns = ['FULL', 'PARTIAL', 'UNPAID', 'FULL', 'PARTIAL', 'FULL', 'UNPAID', 'UNPAID', 'FULL', 'PARTIAL', 'FULL', 'PARTIAL'];

  periods.forEach((periodData, index) => {
    const isFirstMonth = (index === 0);
    // Moved in on 24th July (31 days). Days stayed = 8.
    // Prorated Rent = floor(1500 * 8 / 31) = 387
    // Discount (proratedAmount) = 1500 - 387 = 1113
    const proratedAmount = isFirstMonth ? 1113 : 0;
    
    const prevMeter = lastMeter;
    const currMeter = periodData.m;
    const elecBill = (currMeter - prevMeter) * elecRate;
    
    // totalNewCharges matches the schema logic: rent + water + elec - discount
    const totalNewCharges = rent + water + elecBill - proratedAmount;
    
    let remainingArrears = currentArrears;
    let grandTotal = totalNewCharges + remainingArrears;
    
    let paidAmount = 0;
    let status = 'UNPAID';
    
    const pattern = paymentPatterns[index];
    if (pattern === 'FULL') {
      paidAmount = grandTotal;
      status = 'PAID';
    } else if (pattern === 'PARTIAL') {
      paidAmount = Math.floor(grandTotal / 2); // Pay half
      status = 'PARTIAL';
    } else if (pattern === 'UNPAID') {
      paidAmount = 0;
      status = 'UNPAID';
    }

    currentArrears = grandTotal - paidAmount;

    db.Invoices.push([
      `INV-111-${periodData.p}`,
      '111',
      periodData.p,
      prevMeter,
      currMeter,
      water,
      0, // otherBill
      currentArrears, // arrears (dynamic tracking)
      totalNewCharges, // totalAmount
      paidAmount,
      status,
      '', // pdf
      remainingArrears, // remainingArrears snapshot
      '',
      proratedAmount, // prorated
      0  // creditApplied
    ]);

    lastMeter = currMeter;
  });

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log('Room 111 mock data generated successfully with prorated first month.');
}

run();
