process.env.GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || 'dummy@test.com';
process.env.GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || 'dummy';
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'dummy';
process.env.GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || 'dummy';

import assert from 'assert';

async function runRealIntegrationTests() {
  console.log('=== REAL INTEGRATION TEST SUITE (IMPORTING ACTUAL CODEBASE EXPORTS) ===\n');

  // Dynamic imports so process.env is set BEFORE modules evaluate top-level checks
  const { calculateMoveOutSettlement, SettlementError } = await import('./src/services/settlementCalculator');
  const { computeEffectiveArrearsForInvoices } = await import('./src/services/sheetService');

  // 1. Test REAL calculateMoveOutSettlement function from src/services/settlementCalculator.ts
  {
    const result = calculateMoveOutSettlement({
      roomId: 'RM001',
      roomNumber: '101',
      moveOutDate: '2026-08-15',
      prevElectricMeter: 100,
      finalElectricMeter: 150,
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 200,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      damageFee: 500,
      damageNotes: 'ค่าทำความสะอาด',
      isFullMonthRent: false,
    });

    console.log('[TEST 1] REAL calculateMoveOutSettlement (Refund Case):');
    console.log('  Period format:', result.period); // 2026-08-OUT
    console.log('  Refund Amount:', result.refundAmount);

    assert.strictEqual(result.period, '2026-08-OUT');
    assert.strictEqual(result.unitsUsed, 50);
    assert.strictEqual(result.electricityBill, 250);
    assert.strictEqual(result.waterBill, 60);
    assert.strictEqual(result.damageFee, 500);
    assert.strictEqual(result.depositAmount, 5000);
    assert.strictEqual(result.creditBalance, 200);
    assert.strictEqual(result.totalCredits, 5200);
    assert(result.refundAmount > 0);
    console.log('  ✅ PASSED TEST 1\n');
  }

  // 2. Test REAL computeEffectiveArrearsForInvoices function from src/services/sheetService.ts
  {
    const realInvoices = [
      {
        invoiceId: 'INV-13-2026-07',
        roomId: '13',
        period: '2026-07',
        prevMeter: 0,
        currMeter: 100,
        waterBill: 60,
        otherBill: 100,
        arrears: 0,
        totalAmount: 1733,
        paidAmount: 0,
        status: 'UNPAID',
        remainingArrears: 0,
      },
      {
        invoiceId: 'INV-13-2026-08',
        roomId: '13',
        period: '2026-08',
        prevMeter: 100,
        currMeter: 200,
        waterBill: 60,
        otherBill: 100,
        arrears: 1733,
        totalAmount: 2660,
        paidAmount: 2000,
        status: 'PARTIAL',
        remainingArrears: 1733,
      },
      {
        invoiceId: 'INV-13-2026-08-OUT',
        roomId: '13',
        period: '2026-08-OUT',
        prevMeter: 200,
        currMeter: 250,
        waterBill: 60,
        otherBill: 300,
        arrears: 2393,
        totalAmount: 1344,
        paidAmount: 2143,
        status: 'PAID',
        remainingArrears: 2393,
      },
      {
        invoiceId: 'INV-13-2026-09',
        roomId: '13',
        period: '2026-09',
        prevMeter: 250,
        currMeter: 350,
        waterBill: 60,
        otherBill: 100,
        arrears: 1733,
        totalAmount: 2410,
        paidAmount: 0,
        status: 'UNPAID',
        remainingArrears: 1733,
      },
    ];

    const processed = computeEffectiveArrearsForInvoices(realInvoices as any);
    processed.sort((a: any, b: any) => a.period.localeCompare(b.period));

    console.log('[TEST 2] REAL computeEffectiveArrearsForInvoices (Multi-Month Sequence with OUT period):');
    for (const inv of processed) {
      console.log(`  Period ${inv.period}: remainingArrears = ${inv.remainingArrears}`);
    }

    assert.strictEqual(processed[0].remainingArrears, 0);
    assert.strictEqual(processed[1].remainingArrears, 1733);
    assert.strictEqual(processed[2].remainingArrears, 2393);
    assert.strictEqual(processed[3].remainingArrears, 0, 'Month 9 arrears should be 0 because 2026-08-OUT was PAID!');
    console.log('  ✅ PASSED TEST 2\n');
  }

  // 3. Test REAL minimum stay duration deposit forfeiture (Option A)
  {
    const { calculateFullMonthsStayed } = await import('./src/services/settlementCalculator');

    console.log('[TEST 3] REAL Minimum Stay Deposit Forfeiture (Option A):');

    // Case 3A: Entry 2026-03-15, MoveOut 2026-08-10 (4 full months stayed < minStay 5) => Deposit Forfeited
    const resEarly = calculateMoveOutSettlement({
      roomId: 'RM001',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-10',
      minStayMonths: 5,
      prevElectricMeter: 100,
      finalElectricMeter: 150,
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 0,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      isFullMonthRent: true,
    });

    console.log('  3A (Early move-out 4/5 months): monthsStayed =', resEarly.monthsStayed, 'isDepositForfeited =', resEarly.isDepositForfeited, 'effectiveDeposit =', resEarly.effectiveDeposit);
    assert.strictEqual(resEarly.monthsStayed, 4);
    assert.strictEqual(resEarly.isDepositForfeited, true);
    assert.strictEqual(resEarly.effectiveDeposit, 0);

    // Case 3B: Entry 2026-03-15, MoveOut 2026-08-15 (5 full months stayed >= minStay 5) => Deposit Refunded
    const resFull = calculateMoveOutSettlement({
      roomId: 'RM001',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-15',
      minStayMonths: 5,
      prevElectricMeter: 100,
      finalElectricMeter: 150,
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 0,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      isFullMonthRent: true,
    });

    console.log('  3B (Completed 5/5 months): monthsStayed =', resFull.monthsStayed, 'isDepositForfeited =', resFull.isDepositForfeited, 'effectiveDeposit =', resFull.effectiveDeposit);
    assert.strictEqual(resFull.monthsStayed, 5);
    assert.strictEqual(resFull.isDepositForfeited, false);
    assert.strictEqual(resFull.effectiveDeposit, 5000);

    // Case 3C: Early move-out with Manual Override (overrideForfeit = true) => Deposit Refunded
    const resOverride = calculateMoveOutSettlement({
      roomId: 'RM001',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-10',
      minStayMonths: 5,
      overrideForfeit: true,
      prevElectricMeter: 100,
      finalElectricMeter: 150,
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 0,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      isFullMonthRent: true,
    });

    console.log('  3C (Early move-out with override): isDepositForfeited =', resOverride.isDepositForfeited, 'effectiveDeposit =', resOverride.effectiveDeposit);
    assert.strictEqual(resOverride.isDepositForfeited, false);
    assert.strictEqual(resOverride.effectiveDeposit, 5000);

    console.log('  ✅ PASSED TEST 3\n');
  }

  console.log('🎉 REAL CODEBASE INTEGRATION TEST PASSED 100%!');
}

runRealIntegrationTests().catch((err) => {
  console.error('❌ Integration test error:', err);
  process.exit(1);
});
