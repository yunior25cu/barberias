export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const suppliedOrigin = new URL(origin).origin;
    const requestOrigin = new URL(request.url).origin;
    const configuredOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
    return (suppliedOrigin === requestOrigin || suppliedOrigin === configuredOrigin)
      && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}
