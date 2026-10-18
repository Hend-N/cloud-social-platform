import axios from "axios";

type ValidationItem = { loc?: unknown[]; msg?: string };

function formatValidation(items: ValidationItem[]): string {
  return items
    .map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc.filter((p) => p !== "body" && p !== "query").join(".")
        : "";
      const msg = item.msg ?? "is invalid";
      return field ? `${field}: ${msg}` : msg;
    })
    .join("; ");
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (axios.isAxiosError(error)) {
    // No response at all: server down, wrong API URL, or blocked by CORS.
    if (!error.response) {
      return "Can't reach the server. Make sure the backend is running and the API URL/proxy is configured correctly.";
    }

    const status = error.response.status;
    const d = error.response.data as any;

    if (typeof d?.detail === "string") return d.detail;
    // FastAPI validation errors (422) arrive as a list.
    if (Array.isArray(d?.detail)) return formatValidation(d.detail);
    if (typeof d?.message === "string") return d.message;
    if (typeof d === "string" && d.trim() && !d.trimStart().startsWith("<"))
      return d;

    if (status === 404)
      return "Endpoint not found (404). The request is not reaching the API gateway; check the proxy/API URL.";
    if (status >= 500)
      return `The server had a problem (${status}). Check the backend logs.`;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
