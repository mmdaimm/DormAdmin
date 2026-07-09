import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, addExpense } from '@/services/sheetService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // optional YYYY-MM
    
    let expenses = await getExpenses();
    
    if (month) {
      expenses = expenses.filter(e => e.date.startsWith(month));
    }
    
    return NextResponse.json({ success: true, expenses });
  } catch (error) {
    console.error('[GET /api/accounting/expenses]', error);
    return NextResponse.json({ success: false, error: 'Failed to get expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, category, description, amount } = body;
    
    if (!date || !category || !description || amount === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }
    
    const expense = await addExpense({ date, category, description, amount });
    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error('[POST /api/accounting/expenses]', error);
    return NextResponse.json({ success: false, error: 'Failed to add expense' }, { status: 500 });
  }
}
