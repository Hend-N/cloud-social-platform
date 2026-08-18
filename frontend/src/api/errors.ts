export function getApiErrorMessage(
  error: unknown,
  fallback: string = "Registration failed. Please try again."
): string {
  if (error instanceof Error && error.message && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
