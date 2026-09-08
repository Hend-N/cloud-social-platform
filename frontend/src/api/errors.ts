import axios from "axios";
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as any;
    if (typeof d?.detail === "string") return d.detail;
    if (typeof d?.message === "string") return d.message;
    if (typeof d === "string") return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
