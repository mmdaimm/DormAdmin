import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, getAllInvoices } from '@/services/sheetService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const expenses = await getExpenses();
    const invoices = await getAllInvoices();

    const summaryMap: Record<string, { income: number, expense: number, profit: number }> = {};
    
    if (year !== 'all') {
      // Initialize months 01 to 12 for the specific year
      for (let i = 1; i <= 12; i++) {
        const monthStr = `${year}-${String(i).padStart(2, '0')}`;
        summaryMap[monthStr] = { income: 0, expense: 0, profit: 0 };
      }
    }

    // Process Income (Invoices)
    for (const inv of invoices) {
      const invYear = inv.period.substring(0, 4);
      if (year === 'all') {
        if (!summaryMap[invYear]) summaryMap[invYear] = { income: 0, expense: 0, profit: 0 };
        summaryMap[invYear].income += (inv.paidAmount || 0);
      } else if (inv.period.startsWith(year) && summaryMap[inv.period]) {
        summaryMap[inv.period].income += (inv.paidAmount || 0);
      }
    }

    // Process Expenses
    for (const exp of expenses) {
      const expMonth = exp.date.substring(0, 7); // YYYY-MM
      const expYear = exp.date.substring(0, 4);
      if (year === 'all') {
        if (!summaryMap[expYear]) summaryMap[expYear] = { income: 0, expense: 0, profit: 0 };
        summaryMap[expYear].expense += exp.amount;
      } else if (expMonth.startsWith(year) && summaryMap[expMonth]) {
        summaryMap[expMonth].expense += exp.amount;
      }
    }

    // Calculate Debt (Global, independent of year)
    let totalDebt = 0;
    const latestInvoicesByRoom: Record<string, any> = {};
    for (const inv of invoices) {
      if (!latestInvoicesByRoom[inv.roomId] || inv.period > latestInvoicesByRoom[inv.roomId].period) {
        latestInvoicesByRoom[inv.roomId] = inv;
      }
    }

    for (const roomId in latestInvoicesByRoom) {
      const inv = latestInvoicesByRoom[roomId];
      // Grand Total = total_amount + old_arrears - credit_applied (Spec 3.1) —
      // must match the same formula used everywhere else in the system
      // (SlipPdf.tsx, dashboard/page.tsx, invoiceCalculator.ts).
      const grandTotal = (inv.totalAmount ?? 0) + (inv.remainingArrears ?? 0) - (inv.creditApplied ?? 0);
      if (inv.status === 'UNPAID') {
        totalDebt += grandTotal;
      } else if (inv.status === 'PARTIAL') {
        totalDebt += Math.max(0, grandTotal - (inv.paidAmount ?? 0));
      }
    }

    // Format data for Recharts
    const chartData = Object.keys(summaryMap).sort().map(key => {
      const data = summaryMap[key];
      data.profit = data.income - data.expense;
      return {
        month: key, // Keep the key as 'month' to reuse Recharts XAxis dataKey
        ...data
      };
    });

    const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = chartData.reduce((sum, d) => sum + d.expense, 0);
    const totalProfit = totalIncome - totalExpense;

    return NextResponse.json({
      success: true,
      data: chartData,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        profit: totalProfit,
        debt: totalDebt
      }
    });

  } catch (error) {
    console.error('[GET /api/accounting/summary]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate summary' }, { status: 500 });
  }
}
