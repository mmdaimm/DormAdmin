import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';

const isTestMode = process.env.TEST_MODE === 'true';
const DATA_DIR = path.join(process.cwd(), 'data');
const MOCK_DB_PATH = path.join(DATA_DIR, 'mock_db.json');

// --- Helper for Mock DB ---
async function readMockDb(): Promise<Record<string, string[][]>> {
  if (!fs.existsSync(MOCK_DB_PATH)) return {};
  const data = await fsPromises.readFile(MOCK_DB_PATH, 'utf-8');
  return JSON.parse(data);
}

async function writeMockDb(db: Record<string, string[][]>): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
  }
  await writeFileAtomic(MOCK_DB_PATH, JSON.stringify(db, null, 2));
}

function parseRange(range: string): { sheetName: string; startRow: number; endRow: number | null; startCol: number; endCol: number | null } {
  // Example ranges: "Settings!A2:C", "!A2:E", "Invoices!H5:L5"
  const [sheetPart, cellPart] = range.split('!');
  const sheetName = sheetPart || 'Expenses'; // Fallback for !A2:E which doesn't specify sheet name but we know it's Expenses in this app
  
  const match = cellPart?.match(/([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?/);
  if (!match) return { sheetName, startRow: 1, endRow: null, startCol: 0, endCol: null };
  
  const startCol = match[1].charCodeAt(0) - 65; // A=0
  const startRow = parseInt(match[2], 10);
  const endCol = match[3] ? match[3].charCodeAt(0) - 65 : null;
  const endRow = match[4] ? parseInt(match[4], 10) : null;
  
  return { sheetName, startRow, endRow, startCol, endCol };
}

// --- IO Wrappers ---

export async function getSheetValues(range: string): Promise<any[][]> {
  if (isTestMode) {
    const db = await readMockDb();
    const { sheetName, startRow, endRow } = parseRange(range);
    const sheetData = db[sheetName] || [];
    
    // Convert 1-based startRow to 0-based index for slice. (A2 means index 1)
    const startIndex = Math.max(0, startRow - 1);
    const endIndex = endRow ? endRow : sheetData.length;
    
    return sheetData.slice(startIndex, endIndex);
  }
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return response.data.values ?? [];
}

export async function appendSheetValues(range: string, values: any[][]): Promise<void> {
  if (isTestMode) {
    const db = await readMockDb();
    const { sheetName } = parseRange(range);
    if (!db[sheetName]) db[sheetName] = [];
    
    // Force string values
    const stringValues = values.map(row => row.map(cell => String(cell ?? '')));
    db[sheetName].push(...stringValues);
    
    await writeMockDb(db);
    return;
  }
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

export async function updateSheetValues(range: string, values: any[][]): Promise<void> {
  if (isTestMode) {
    const db = await readMockDb();
    const { sheetName, startRow, startCol } = parseRange(range);
    if (!db[sheetName]) db[sheetName] = [];
    
    const rowIndex = Math.max(0, startRow - 1);
    
    for (let r = 0; r < values.length; r++) {
      const targetRow = rowIndex + r;
      if (!db[sheetName][targetRow]) db[sheetName][targetRow] = [];
      
      for (let c = 0; c < values[r].length; c++) {
        const targetCol = startCol + c;
        db[sheetName][targetRow][targetCol] = String(values[r][c] ?? '');
      }
    }
    
    await writeMockDb(db);
    return;
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function batchUpdateSheetValues(data: { range: string; values: any[][] }[]): Promise<void> {
  if (isTestMode) {
    const db = await readMockDb();
    
    for (const item of data) {
      const { sheetName, startRow, startCol } = parseRange(item.range);
      if (!db[sheetName]) db[sheetName] = [];
      
      const rowIndex = Math.max(0, startRow - 1);
      
      for (let r = 0; r < item.values.length; r++) {
        const targetRow = rowIndex + r;
        if (!db[sheetName][targetRow]) db[sheetName][targetRow] = [];
        
        for (let c = 0; c < item.values[r].length; c++) {
          const targetCol = startCol + c;
          db[sheetName][targetRow][targetCol] = String(item.values[r][c] ?? '');
        }
      }
    }
    
    await writeMockDb(db);
    return;
  }
  
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
}
