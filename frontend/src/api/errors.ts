export function getApiErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    response?: {
      data?: {
        detail?: unknown;
      };
    };
    message?: string;
  };

  const detail = maybeError.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          "msg" in item
        ) {
          return String(item.msg);
        }

        return JSON.stringify(item);
      })
      .join(", ");
  }

  if (typeof detail === "object" && detail !== null) {
    return JSON.stringify(detail);
  }

  if (maybeError.message) {
    return maybeError.message;
  }

  return fallback;
}
