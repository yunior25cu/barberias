export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin
      && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}

