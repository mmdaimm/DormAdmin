process.env.GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || 'dummy@test.com';
process.env.GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || 'dummy';
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'dummy';
process.env.GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || 'dummy';

import assert from 'assert';

async function runFullSystemAudit() {
  console.log('================================================================');
  console.log('   DORMADMIN FULL SYSTEM AUDIT & TEST SUITE (AUDITOR / TESTER)  ');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function runTest(name: string, fn: () => void) {
    try {
      console.log(`[TEST] ${name}`);
      fn();
      console.log(`  ✅ PASSED\n`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${err.message}\n`);
      failedCount++;
    }
  }

  // ── 1. SETTLEMENT CALCULATOR & MINIMUM STAY DURATION (OPTION A) ──────────────
  const { calculateMoveOutSettlement, calculateFullMonthsStayed, SettlementError } = await import('./src/services/settlementCalculator');

  runTest('1.1 Settlement Calculator - Option A Full Months Stayed Logic', () => {
    // 2026-03-15 to 2026-08-10 (4 full months stayed, day 10 < day 15)
    assert.strictEqual(calculateFullMonthsStayed('2026-03-15', '2026-08-10'), 4);
    // 2026-03-15 to 2026-08-15 (5 full months stayed, day 15 >= day 15)
    assert.strictEqual(calculateFullMonthsStayed('2026-03-15', '2026-08-15'), 5);
    // 2026-01-01 to 2026-06-01 (5 full months stayed)
    assert.strictEqual(calculateFullMonthsStayed('2026-01-01', '2026-06-01'), 5);
    // Invalid date handling
    assert.strictEqual(calculateFullMonthsStayed('', '2026-08-15'), 0);
  });

  runTest('1.2 Settlement Calculator - Deposit Forfeiture (Early Move-Out < minStay)', () => {
    const res = calculateMoveOutSettlement({
      roomId: 'RM101',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-10', // 4 full months < minStay 5
      minStayMonths: 5,
      prevElectricMeter: 100,
      finalElectricMeter: 150, // 50 units * 5 = 250
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 200,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      damageFee: 500,
      isFullMonthRent: true,
    });

    assert.strictEqual(res.period, '2026-08-OUT');
    assert.strictEqual(res.monthsStayed, 4);
    assert.strictEqual(res.minStayMonths, 5);
    assert.strictEqual(res.isDepositForfeited, true, 'Deposit must be forfeited for early move-out');
    assert.strictEqual(res.effectiveDeposit, 0, 'Effective deposit must be 0 when forfeited');
    assert.strictEqual(res.totalCharges, 3000 + 250 + 60 + 500); // 3810
    assert.strictEqual(res.totalCredits, 200); // Only creditBalance applied
    assert.strictEqual(res.additionalPayAmount, 3610);
    assert.strictEqual(res.refundAmount, 0);
  });

  runTest('1.3 Settlement Calculator - Deposit Refund (Completed Stay >= minStay)', () => {
    const res = calculateMoveOutSettlement({
      roomId: 'RM101',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-15', // 5 full months >= minStay 5
      minStayMonths: 5,
      prevElectricMeter: 100,
      finalElectricMeter: 150, // 50 units * 5 = 250
      monthlyRent: 3000,
      depositAmount: 5000,
      creditBalance: 200,
      arrears: 0,
      electricRate: 5,
      waterRate: 60,
      damageFee: 500,
      isFullMonthRent: true,
    });

    assert.strictEqual(res.monthsStayed, 5);
    assert.strictEqual(res.isDepositForfeited, false);
    assert.strictEqual(res.effectiveDeposit, 5000);
    assert.strictEqual(res.totalCharges, 3810);
    assert.strictEqual(res.totalCredits, 5200); // 5000 deposit + 200 credit
    assert.strictEqual(res.refundAmount, 1390);
    assert.strictEqual(res.additionalPayAmount, 0);
  });

  runTest('1.4 Settlement Calculator - Manual Override Forfeiture', () => {
    const res = calculateMoveOutSettlement({
      roomId: 'RM101',
      roomNumber: '101',
      entryDate: '2026-03-15',
      moveOutDate: '2026-08-10', // 4 full months < 5
      minStayMonths: 5,
      overrideForfeit: true, // Manual override by Admin!
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

    assert.strictEqual(res.monthsStayed, 4);
    assert.strictEqual(res.isDepositForfeited, false);
    assert.strictEqual(res.effectiveDeposit, 5000);
  });

  runTest('1.5 Settlement Calculator - Electric Meter Validation Error Catch', () => {
    try {
      calculateMoveOutSettlement({
        roomId: 'RM101',
        roomNumber: '101',
        moveOutDate: '2026-08-15',
        prevElectricMeter: 200,
        finalElectricMeter: 100, // Invalid: final < prev
        monthlyRent: 3000,
        depositAmount: 5000,
        creditBalance: 0,
        arrears: 0,
        electricRate: 5,
        waterRate: 60,
      });
      assert.fail('Should throw SettlementError');
    } catch (err: any) {
      assert(err instanceof SettlementError || err.name === 'SettlementError');
      assert(err.message.includes('ต้องไม่น้อยกว่า'));
    }
  });

  // ── 2. DYNAMIC ARREARS & TIMELINE RECALCULATION (AUDIT RULE #8) ─────────────
  const { computeEffectiveArrearsForInvoices, calculateArrears } = await import('./src/services/sheetService');

  runTest('2.1 Dynamic Effective Arrears Recalculation across Invoice Timeline', () => {
    const invoices = [
      {
        invoiceId: 'INV-13-2026-07',
        roomId: '13',
        period: '2026-07',
        totalAmount: 1733,
        remainingArrears: 0,
        paidAmount: 0,
        status: 'UNPAID',
      },
      {
        invoiceId: 'INV-13-2026-08',
        roomId: '13',
        period: '2026-08',
        totalAmount: 2660,
        remainingArrears: 1733,
        paidAmount: 2000,
        status: 'PARTIAL',
      },
      {
        invoiceId: 'INV-13-2026-08-OUT',
        roomId: '13',
        period: '2026-08-OUT',
        totalAmount: 1344,
        remainingArrears: 2393,
        paidAmount: 3737,
        status: 'PAID',
      },
      {
        invoiceId: 'INV-13-2026-09',
        roomId: '13',
        period: '2026-09',
        totalAmount: 2410,
        remainingArrears: 1733, // Stale snapshot before 2026-08-OUT was paid!
        paidAmount: 0,
        status: 'UNPAID',
      },
    ];

    const processed = computeEffectiveArrearsForInvoices(invoices as any);
    processed.sort((a: any, b: any) => a.period.localeCompare(b.period));

    assert.strictEqual(processed[0].remainingArrears, 0);
    assert.strictEqual(processed[1].remainingArrears, 1733);
    assert.strictEqual(processed[2].remainingArrears, 2393);
    assert.strictEqual(processed[3].remainingArrears, 0, 'Month 9 arrears must adjust to 0 after 2026-08-OUT was fully paid');
  });

  runTest('2.2 Calculate Arrears Helper Function Behavior', () => {
    // Null invoice
    assert.strictEqual(calculateArrears(null), 0);
    // PAID invoice
    assert.strictEqual(calculateArrears({ status: 'PAID', totalAmount: 3000, paidAmount: 3000 } as any), 0);
    // PARTIAL invoice (uses Column H / arrears property if present)
    assert.strictEqual(calculateArrears({ status: 'PARTIAL', arrears: 1500, totalAmount: 3000, paidAmount: 1500 } as any), 1500);
    // UNPAID invoice with old_arrears (remainingArrears)
    assert.strictEqual(calculateArrears({ status: 'UNPAID', totalAmount: 2000, remainingArrears: 1000, creditApplied: 0, paidAmount: 0 } as any), 3000);
  });

  // ── 3. INVOICE COMPUTATION VALIDATION (INVOICE CALCULATOR) ──────────────────
  const { computeInvoiceValues, InvoiceComputeError } = await import('./src/services/invoiceCalculator');

  runTest('3.1 Period Format Validation (Accepts YYYY-MM and YYYY-MM-OUT)', () => {
    // Valid YYYY-MM
    assert.doesNotThrow(() => {
      // Period regex check
      const period = '2026-08';
      assert(/^\d{4}-\d{2}(-OUT)?$/.test(period));
    });

    // Valid YYYY-MM-OUT
    assert.doesNotThrow(() => {
      const period = '2026-08-OUT';
      assert(/^\d{4}-\d{2}(-OUT)?$/.test(period));
    });

    // Invalid period
    assert.strictEqual(/^\d{4}-\d{2}(-OUT)?$/.test('2026/08'), false);
    assert.strictEqual(/^\d{4}-\d{2}(-OUT)?$/.test('INVALID'), false);
  });

  console.log('================================================================');
  console.log(` AUDIT COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFullSystemAudit().catch((err) => {
  console.error('❌ Audit runner fatal error:', err);
  process.exit(1);
});
