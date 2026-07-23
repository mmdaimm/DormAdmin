import { NextRequest, NextResponse } from 'next/server';
import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import { getRates, SHEET_SETTINGS } from '@/services/sheetService';

/**
 * GET /api/settings
 * Returns current electric_rate and water_rate from the Settings sheet.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rates = await getRates();
    return NextResponse.json({ success: true, rates });
  } catch (error) {
    console.error('[GET /api/settings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings.' },
      { status: 502 }
    );
  }
}

/**
 * PUT /api/settings
 * Body: { electricRate: number, waterRate: number }
 *
 * Overwrites the B column values for the matching keys in the Settings sheet.
 * Assumes row 2 = electric_rate, row 3 = water_rate (standard initial layout).
 * If rows are missing, it appends them.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  let body: { electricRate?: number; waterRate?: number; minStayMonths?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const { electricRate, waterRate, minStayMonths } = body;

  if (
    (electricRate !== undefined && (typeof electricRate !== 'number' || electricRate <= 0)) ||
    (waterRate !== undefined && (typeof waterRate !== 'number' || waterRate < 0)) ||
    (minStayMonths !== undefined && (typeof minStayMonths !== 'number' || minStayMonths < 0))
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          'electricRate must be > 0; waterRate & minStayMonths must be non-negative numbers.',
      },
      { status: 422 }
    );
  }

  try {
    // Read existing rows to find which row each key is on
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_SETTINGS}!A2:C`,
    });

    const rows: string[][] = (existing.data.values as string[][] | null) ?? [];

    // Build a map: key → 1-based sheet row index (header is row 1, data from row 2)
    const rowIndexMap: Record<string, number> = {};
    rows.forEach((row, i) => {
      const key = (row[0] ?? '').trim();
      if (key) rowIndexMap[key] = i + 2; // +2 because header=row1, data starts row2
    });

    const updates: Array<{ range: string; values: (string | number)[][] }> = [];
    const appends: (string | number)[][] = [];

    // electric_rate
    if (electricRate !== undefined) {
      if (rowIndexMap['electric_rate']) {
        updates.push({
          range: `${SHEET_SETTINGS}!B${rowIndexMap['electric_rate']}`,
          values: [[electricRate]],
        });
      } else {
        appends.push(['electric_rate', electricRate, 'ค่าไฟต่อหน่วย (บาท/หน่วย)']);
      }
    }

    // water_rate
    if (waterRate !== undefined) {
      if (rowIndexMap['water_rate']) {
        updates.push({
          range: `${SHEET_SETTINGS}!B${rowIndexMap['water_rate']}`,
          values: [[waterRate]],
        });
      } else {
        appends.push(['water_rate', waterRate, 'ค่าน้ำคงที่ต่อเดือน (บาท)']);
      }
    }

    // min_stay_months
    if (minStayMonths !== undefined) {
      if (rowIndexMap['min_stay_months']) {
        updates.push({
          range: `${SHEET_SETTINGS}!B${rowIndexMap['min_stay_months']}`,
          values: [[minStayMonths]],
        });
      } else {
        appends.push(['min_stay_months', minStayMonths, 'ระยะเวลาสัญญาขั้นต่ำเริ่มต้น (เดือน)']);
      }
    }

    // Execute batch update for existing rows
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }

    // Append missing keys
    if (appends.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_SETTINGS}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appends },
      });
    }

    const updatedRates = await getRates();

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully.',
      rates: updatedRates,
    });
  } catch (error) {
    console.error('[PUT /api/settings]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings.' },
      { status: 502 }
    );
  }
}
