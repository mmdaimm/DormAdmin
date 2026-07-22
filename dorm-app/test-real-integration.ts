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

  console.log('🎉 REAL CODEBASE INTEGRATION TEST PASSED 100%!');
}

runRealIntegrationTests().catch((err) => {
  console.error('❌ Integration test error:', err);
  process.exit(1);
});
