export interface SettlementInput {
  roomId: string;
  roomNumber: string;
  moveOutDate: string; // Format: YYYY-MM-DD
  finalElectricMeter: number;
  prevElectricMeter: number;
  monthlyRent: number;
  depositAmount: number;
  creditBalance: number;
  arrears: number;
  electricRate: number;
  waterRate: number;
  damageFee?: number;
  damageNotes?: string;
  isFullMonthRent?: boolean;
}

export interface SettlementResult {
  roomId: string;
  roomNumber: string;
  moveOutDate: string;
  period: string; // Format: YYYY-MM-OUT
  prevElectricMeter: number;
  finalElectricMeter: number;
  unitsUsed: number;
  electricityBill: number;
  waterBill: number;
  proratedRent: number;
  monthlyRent: number;
  damageFee: number;
  damageNotes?: string;
  arrears: number;
  totalCharges: number;
  depositAmount: number;
  creditBalance: number;
  totalCredits: number;
  netAmount: number;
  refundAmount: number;
  additionalPayAmount: number;
}

export class SettlementError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = 'SettlementError';
  }
}

/**
 * Pure calculation function for final move-out settlement.
 * Computes final utilities, prorated rent, arrears vs deposit & credit.
 */
export function calculateMoveOutSettlement(input: SettlementInput): SettlementResult {
  const {
    roomId,
    roomNumber,
    moveOutDate,
    finalElectricMeter,
    prevElectricMeter,
    monthlyRent,
    depositAmount = 0,
    creditBalance = 0,
    arrears = 0,
    electricRate,
    waterRate,
    damageFee = 0,
    damageNotes = '',
    isFullMonthRent = false,
  } = input;

  if (!roomId || !moveOutDate) {
    throw new SettlementError('กรุณาระบุข้อมูลห้องพักและวันที่ย้ายออกให้ครบถ้วน', 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveOutDate)) {
    throw new SettlementError('รูปแบบวันที่ย้ายออกต้องเป็น YYYY-MM-DD', 400);
  }

  if (finalElectricMeter < prevElectricMeter) {
    throw new SettlementError(
      `เลขมิเตอร์ไฟสุดท้าย (${finalElectricMeter}) ต้องไม่น้อยกว่าเลขมิเตอร์เดิม (${prevElectricMeter})`,
      422
    );
  }

  const moveOutDateObj = new Date(moveOutDate);
  if (isNaN(moveOutDateObj.getTime())) {
    throw new SettlementError('วันที่ย้ายออกไม่ถูกต้อง', 400);
  }

  const year = moveOutDateObj.getFullYear();
  const month = moveOutDateObj.getMonth() + 1; // 1-12
  const day = moveOutDateObj.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Electricity calculation
  const unitsUsed = finalElectricMeter - prevElectricMeter;
  const electricityBill = Math.round(unitsUsed * electricRate);
  const waterBill = waterRate;

  // Prorated Rent calculation
  let proratedRent = monthlyRent;
  if (!isFullMonthRent) {
    proratedRent = Math.round((monthlyRent / daysInMonth) * day);
  }

  const cleanDamageFee = Math.max(0, damageFee);
  const cleanArrears = Math.max(0, arrears);
  const cleanDeposit = Math.max(0, depositAmount);
  const cleanCredit = Math.max(0, creditBalance);

  // Totals
  const totalCharges = proratedRent + electricityBill + waterBill + cleanArrears + cleanDamageFee;
  const totalCredits = cleanDeposit + cleanCredit;
  const netAmount = totalCharges - totalCredits;

  const refundAmount = netAmount < 0 ? Math.abs(netAmount) : 0;
  const additionalPayAmount = netAmount > 0 ? netAmount : 0;

  const periodMonthStr = `${year}-${String(month).padStart(2, '0')}`;
  const period = `${periodMonthStr}-OUT`;

  return {
    roomId,
    roomNumber,
    moveOutDate,
    period,
    prevElectricMeter,
    finalElectricMeter,
    unitsUsed,
    electricityBill,
    waterBill,
    proratedRent,
    monthlyRent,
    damageFee: cleanDamageFee,
    damageNotes: damageNotes.trim(),
    arrears: cleanArrears,
    totalCharges,
    depositAmount: cleanDeposit,
    creditBalance: cleanCredit,
    totalCredits,
    netAmount,
    refundAmount,
    additionalPayAmount,
  };
}
