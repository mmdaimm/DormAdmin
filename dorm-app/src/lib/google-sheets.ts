import { google } from 'googleapis';

// ─── Environment validation ───────────────────────────────────────────────────

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

if (!clientEmail) {
  throw new Error(
    '[google-sheets] Missing environment variable: GOOGLE_CLIENT_EMAIL'
  );
}

if (!privateKey) {
  throw new Error(
    '[google-sheets] Missing environment variable: GOOGLE_PRIVATE_KEY'
  );
}

if (!spreadsheetId) {
  throw new Error(
    '[google-sheets] Missing environment variable: GOOGLE_SPREADSHEET_ID'
  );
}

// ─── JWT authentication ───────────────────────────────────────────────────────

/**
 * Google service-account JWT used to authenticate every Sheets API call.
 *
 * The private key is stored in the environment as a single-line string with
 * literal "\n" escape sequences; we replace them with real newlines so that
 * the PEM header/footer and base-64 body are on separate lines as required.
 */
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ─── Sheets client ────────────────────────────────────────────────────────────

/**
 * Pre-authenticated Google Sheets API v4 client.
 *
 * @example
 * ```ts
 * import { sheets, SPREADSHEET_ID } from '@/lib/google-sheets';
 *
 * const res = await sheets.spreadsheets.values.get({
 *   spreadsheetId: SPREADSHEET_ID,
 *   range: 'Rooms!A2:D',
 * });
 * ```
 */
export const sheets = google.sheets({ version: 'v4', auth });

/**
 * The Google Spreadsheet ID sourced from `GOOGLE_SPREADSHEET_ID`.
 * Pass this as the `spreadsheetId` parameter in every API call.
 */
export const SPREADSHEET_ID = spreadsheetId;
