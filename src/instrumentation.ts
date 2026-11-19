import type { Instrumentation } from "next";

type MonitorConnection = { instrumentationKey: string; ingestionEndpoint: string };

function getMonitorConnection(): MonitorConnection | null {
  const raw = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!raw) return null;

  const values = new Map(
    raw.split(";").map((part) => {
      const separator = part.indexOf("=");
      return separator < 0
        ? ["", ""]
        : [part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim()];
    }),
  );
  const instrumentationKey = values.get("instrumentationkey");
  const ingestionEndpoint = values.get("ingestionendpoint") ?? "https://dc.services.visualstudio.com/";
  if (!instrumentationKey || !/^https:\/\//i.test(ingestionEndpoint)) return null;

  return { instrumentationKey, ingestionEndpoint: `${ingestionEndpoint.replace(/\/+$/, "")}/` };
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!context.routePath.startsWith("/[slug]/")) return;

  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined;
  const safeError = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { name: "UnknownError", message: "Next.js request failed", stack: undefined };
  const connection = getMonitorConnection();

  if (!connection) {
    console.error("Next.js business page request failed", {
      error: safeError,
      route: context.routePath,
      routeType: context.routeType,
      method: request.method,
      ...(digest ? { digest } : {}),
    });
    return;
  }

  const event = {
    ver: 1,
    name: "Microsoft.ApplicationInsights.Event",
    time: new Date().toISOString(),
    iKey: connection.instrumentationKey,
    tags: {
      "ai.cloud.role": "alcorte-nextjs",
      "ai.operation.name": `${request.method} ${context.routePath}`,
    },
    data: {
      baseType: "EventData",
      baseData: {
        ver: 2,
        name: "NextBusinessPageRenderError",
        properties: {
          route: context.routePath,
          routeType: context.routeType,
          routerKind: context.routerKind,
          method: request.method,
          errorName: safeError.name,
          errorMessage: safeError.message.slice(0, 2048),
          errorStack: safeError.stack?.slice(0, 12000) ?? "",
          ...(context.renderSource ? { renderSource: context.renderSource } : {}),
          ...(digest ? { digest } : {}),
        },
      },
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${connection.ingestionEndpoint}v2/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 206) {
      console.error("Application Insights rejected a business page error event", { status: response.status });
    }
  } catch {
    console.error("Application Insights could not receive a business page error event");
  } finally {
    clearTimeout(timeout);
  }
};
