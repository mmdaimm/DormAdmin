import fs from 'fs';
import path from 'path';

// Generate mock data for the DormAdmin application
// To run: npx tsx scripts/seed-mock-db.ts

const DATA_DIR = path.join(process.cwd(), 'data');
const MOCK_DB_PATH = path.join(DATA_DIR, 'mock_db.json');

// --- Helper Functions ---
function getMonthsBetween(startDateStr: string, endDateStr: string): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const months = [];
  
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Data Generation ---
async function generateMockDb() {
  const db: Record<string, string[][]> = {
    Settings: [],
    Rooms: [],
    Tenants: [],
    Users: [],
    Invoices: [],
    Expenses: []
  };

  // 1. Settings
  db.Settings.push(
    ['Key', 'Value', 'Description'],
    ['electric_rate', '5', 'ค่าไฟ (บาท/หน่วย)'],
    ['water_rate', '60', 'ค่าน้ำ (เหมาจ่าย)']
  );

  // 2. Users (Mock users)
  // admin123 => $2b$10$LSk9kt5VfQBD21OkLjHWheVrrnkUpwDmew66/OSYvVUjurnWZa.26
  db.Users.push(
    ['Username', 'Password', 'Role'],
    ['admin', '$2b$10$LSk9kt5VfQBD21OkLjHWheVrrnkUpwDmew66/OSYvVUjurnWZa.26', 'admin'],
    ['owner', '$2b$10$512YnwXepMQMmA6ilJn0V.R6nvWLzjX9lAdZlXIBP1yyPNYOtsDGe', 'owner']
  );

  // 3. Rooms
  db.Rooms.push(['roomId', 'roomNumber', 'monthlyRent', 'lineToken', 'creditBalance', 'depositAmount']);
  const roomIds = ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110'];
  roomIds.forEach((roomId) => {
    db.Rooms.push([roomId, roomId, '1500', '', '0', '3000']);
  });

  // 4. Tenants
  db.Tenants.push(['tenantId', 'firstname', 'lastname', 'phone', 'room_id', 'entryDate', 'status', 'lineUserId']);
  const entryDates = [
    '2024-01-01', '2024-02-15', '2024-03-01', '2024-05-10', '2024-08-01',
    '2025-01-01', '2025-04-12', '2025-06-01', '2025-09-01', '2026-01-01'
  ];
  
  // Room 104 is the move-out case.
  roomIds.forEach((roomId, index) => {
    const isMovedOut = roomId === '104';
    db.Tenants.push([
      `T-00${index + 1}`,
      `ผู้เช่า${roomId}`,
      `นามสกุล${roomId}`,
      `0810000${roomId}`,
      roomId,
      entryDates[index],
      isMovedOut ? 'INACTIVE' : 'ACTIVE',
      ''
    ]);
  });

  // 5. Invoices
  db.Invoices.push(['invoiceId', 'roomId', 'period', 'prevMeter', 'currMeter', 'waterBill', 'otherBill', 'arrears', 'totalAmount', 'paidAmount', 'status', 'pdfUrl', 'remainingArrears', 'discount', 'prorated', 'creditApplied']);
  // Target month: 2026-07
  const endMonth = '2026-07';
  
  roomIds.forEach((roomId, index) => {
    const entryDate = entryDates[index];
    const months = getMonthsBetween(entryDate, endMonth);
    
    let currentMeter = randomInt(1000, 5000);
    let cumulativeArrears = 0;
    let creditBalance = 0;

    months.forEach((period) => {
      // If room 104 (moved out), they moved out in 2025-12
      if (roomId === '104' && period > '2025-12') return;

      const prevMeter = currentMeter;
      const unitsUsed = randomInt(50, 300);
      currentMeter = prevMeter + unitsUsed;
      
      const electricBill = unitsUsed * 5;
      const waterBill = 60;
      const otherBill = 100;
      const rent = 1500;
      const totalAmount = rent + electricBill + waterBill + otherBill;
      
      let paidAmount = 0;
      let status = 'UNPAID';
      let remainingArrears = 0;
      let creditApplied = 0;
      let newCreditBalance = creditBalance;
      
      const grandTotal = totalAmount + cumulativeArrears - creditBalance;
      
      // Payment Logic
      if (roomId === '101') {
        // Room 101: Pays exactly 1500 THB every month (Partial)
        paidAmount = 1500;
        status = 'PARTIAL';
        remainingArrears = grandTotal - paidAmount;
        if (creditBalance > 0) {
           const used = Math.min(creditBalance, totalAmount + cumulativeArrears);
           creditApplied = used;
           newCreditBalance -= used;
        }
      } else if (roomId === '102') {
        // Room 102: Skips odd months, pays full on even months
        const monthNum = parseInt(period.split('-')[1], 10);
        if (monthNum % 2 !== 0) {
          paidAmount = 0;
          status = 'UNPAID';
          remainingArrears = grandTotal;
        } else {
          paidAmount = grandTotal;
          status = 'PAID';
          remainingArrears = 0;
        }
      } else if (roomId === '103') {
        // Room 103: Overpays randomly
        if (creditBalance > 0) {
          creditApplied = Math.min(creditBalance, totalAmount + cumulativeArrears);
          newCreditBalance -= creditApplied;
        }
        
        const adjustedGrandTotal = totalAmount + cumulativeArrears - creditApplied;
        paidAmount = adjustedGrandTotal + 500; // Overpay by 500
        status = 'PAID';
        remainingArrears = 0;
        newCreditBalance += 500;
      } else {
        // Normal Rooms: Pay full
        if (creditBalance > 0) {
          creditApplied = Math.min(creditBalance, totalAmount + cumulativeArrears);
          newCreditBalance -= creditApplied;
        }
        
        const adjustedGrandTotal = totalAmount + cumulativeArrears - creditApplied;
        paidAmount = adjustedGrandTotal;
        status = 'PAID';
        remainingArrears = 0;
      }
      
      db.Invoices.push([
        `INV-${roomId}-${period}`, // A
        roomId, // B
        period, // C
        prevMeter.toString(), // D
        currentMeter.toString(), // E
        waterBill.toString(), // F
        otherBill.toString(), // G
        cumulativeArrears.toString(), // H (Old Arrears)
        totalAmount.toString(), // I
        paidAmount.toString(), // J
        status, // K
        '', // L (PDF URL)
        remainingArrears.toString(), // M
        '', // N (discount)
        '0', // O (prorated)
        creditApplied.toString() // P
      ]);
      
      cumulativeArrears = remainingArrears;
      creditBalance = newCreditBalance;
    });
    
    // Update credit balance in Room array for this room
    if (creditBalance > 0) {
      const roomRow = db.Rooms.find(r => r[0] === roomId);
      if (roomRow) {
        roomRow[4] = creditBalance.toString();
      }
    }
  });

  // 6. Expenses
  db.Expenses.push(['id', 'date', 'category', 'description', 'amount']);
  const years = ['2024', '2025', '2026'];
  years.forEach((year, index) => {
    db.Expenses.push([
      `EXP-${year}-001`,
      `${year}-04-15`,
      'MAINTENANCE',
      'ล้างแอร์ประจำปี',
      '2000'
    ]);
  });

  // Create data dir if not exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Write to mock_db.json
  fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`✅ Successfully generated mock database at ${MOCK_DB_PATH}`);
  console.log(`Total Invoices generated: ${db.Invoices.length}`);
}

generateMockDb().catch(console.error);
