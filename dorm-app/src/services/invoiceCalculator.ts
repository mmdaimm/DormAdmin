import { getRates, getRooms, getAllInvoices, calculateArrears } from '@/services/sheetService';
import type { Invoice } from '@/types';

export interface InvoiceComputeInput {
  roomId: string;
  roomNumber: string;
  period: string;
  currMeter: number;
  otherBill: number;
  proratedAmount?: number;
}

export interface InvoiceComputeResult {
  invoice: Invoice;
  roomNumber: string;
  unitsUsed: number;
  electricityBill: number;
  monthlyRent: number;
  remainingArrears: number;
  grandTotal: number;
}

export class InvoiceComputeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Single source of truth for invoice math. Always re-fetches fresh data and
 * recomputes from scratch — callers must never pass in pre-computed
 * financial figures. Used by BOTH /api/invoices/calculate (preview only)
 * and /api/invoices (actual save), so client-supplied numbers can never be
 * persisted without server-side recomputation.
 */
export async function computeInvoiceValues(
  input: InvoiceComputeInput
): Promise<InvoiceComputeResult> {
  const { roomId, roomNumber, period, currMeter, otherBill, proratedAmount = 0 } = input;

  if (!roomId || !roomNumber || !period || currMeter === undefined || otherBill === undefined) {
    throw new InvoiceComputeError(
      'Missing required fields: roomId, roomNumber, period, currMeter, otherBill.',
      400
    );
  }

  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new InvoiceComputeError('Field "period" must match the format YYYY-MM.', 400);
  }

  const [rates, rooms, allInvoices] = await Promise.all([
    getRates(),
    getRooms(),
    getAllInvoices(),
  ]);

  const room = rooms.find((r) => r.roomId === roomId);
  if (!room) {
    throw new InvoiceComputeError(`Room with roomId "${roomId}" not found.`, 404);
  }

  const roomInvoices = allInvoices.filter((inv) => inv.roomId === roomId);
  const isDuplicate = roomInvoices.some((inv) => inv.period === period);
  if (isDuplicate) {
    throw new InvoiceComputeError(
      `ห้อง ${roomNumber} ได้ออกใบแจ้งหนี้ประจำเดือน ${period} ไปเรียบร้อยแล้ว`,
      409
    );
  }

  const previousInvoices = roomInvoices
    .filter((inv) => inv.period < period && inv.status !== ('CANCELLED' as any) && inv.status !== ('VOID' as any))
    .sort((a, b) => b.period.localeCompare(a.period));
  const lastInvoice = previousInvoices.length > 0 ? previousInvoices[0] : null;

  const prevMeter = lastInvoice
    ? (parseFloat(lastInvoice.currMeter as any ?? (lastInvoice as any).curr_meter ?? 0) || 0)
    : 0;

  if (currMeter < prevMeter) {
    throw new InvoiceComputeError(
      `currMeter (${currMeter}) cannot be less than prevMeter (${prevMeter}).`,
      422
    );
  }

  const unitsUsed = currMeter - prevMeter;
  const electricityBill = unitsUsed * rates.electricRate;
  const waterBill = rates.waterRate;
  const arrears = calculateArrears(lastInvoice);

  const currentMonthTotal = (room.monthlyRent - proratedAmount) + electricityBill + waterBill + otherBill;
  const preliminaryTotal = currentMonthTotal + arrears;
  const creditBalance = room.creditBalance ?? 0;
  const creditApplied = Math.min(preliminaryTotal, creditBalance);
  const grandTotal = preliminaryTotal - creditApplied;

  const invoiceId = `INV-${roomId}-${period}`;

  const invoice: Invoice = {
    invoiceId,
    roomId,
    period,
    prevMeter,
    currMeter,
    waterBill,
    otherBill,
    arrears,
    totalAmount: currentMonthTotal,
    paidAmount: 0,
    status: 'UNPAID',
    creditApplied,
    isNewFormat: true,
    proratedAmount,
  };

  return {
    invoice,
    roomNumber,
    unitsUsed,
    electricityBill,
    monthlyRent: room.monthlyRent,
    remainingArrears: arrears,
    grandTotal,
  };
}
