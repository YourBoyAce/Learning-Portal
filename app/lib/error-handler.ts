import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Standard generic error message for clients to avoid leaking schema or internal details.
 */
const GENERIC_ERROR_MESSAGE = "An error occurred. Please try again.";

/**
 * Logs the error securely and returns a generic message and ID to be sent to the client.
 * Use this when you have a custom return object structure.
 * @param error The original error object caught in the try-catch block
 * @param context Optional context string to help identify where the error occurred
 */
export function logError(error: unknown, context?: string) {
  const errorId = crypto.randomUUID();
  console.error(`[Error ID: ${errorId}] ${context ? context + ': ' : ''}`, error);
  return {
    message: GENERIC_ERROR_MESSAGE,
    id: errorId,
  };
}

/**
 * Use this in Server Actions to log the actual error and return a safe, generic response.
 * @param error The original error object caught in the try-catch block
 * @param context Optional context string to help identify where the error occurred
 */
export function logAndReturnActionError(error: unknown, context?: string) {
  const { message, id } = logError(error, context);
  return {
    success: false as const,
    error: message,
    errorId: id,
  };
}

/**
 * Use this in API Routes to log the actual error and return a safe, generic JSON response.
 * @param error The original error object caught in the try-catch block
 * @param context Optional context string to help identify where the error occurred
 * @param status HTTP status code to return (default: 500)
 */
export function apiErrorResponse(error: unknown, context?: string, status = 500) {
  const { message, id } = logError(error, context);
  return NextResponse.json(
    {
      error: message,
      errorId: id,
    },
    { status }
  );
}
