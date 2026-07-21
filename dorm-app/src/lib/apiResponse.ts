import { NextResponse } from 'next/server';

/**
 * Standard API Success response wrapper.
 * Returns HTTP JSON with success: true and spreads the data object.
 */
export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Standard API Error response wrapper.
 * Returns HTTP JSON with success: false, error message, and optional fieldErrors.
 */
export function apiError(
  message: string,
  status = 400,
  fieldErrors?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    },
    { status }
  );
}
