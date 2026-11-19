import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) return;

  const { useAzureMonitor } = await import("@azure/monitor-opentelemetry");
  const startAzureMonitor = useAzureMonitor;
  startAzureMonitor({
    samplingRatio: 1,
    enableLiveMetrics: false,
    enableStandardMetrics: false,
    instrumentationOptions: {
      azureSdk: { enabled: false },
      http: { enabled: false },
    },
    azureMonitorExporterOptions: {
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    },
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!context.routePath.startsWith("/[slug]/")) return;

  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined;

  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    const safeError = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "UnknownError", message: "Next.js request failed" };
    console.error("Next.js request failed", {
      error: safeError,
      route: context.routePath,
      routeType: context.routeType,
      method: request.method,
      ...(digest ? { digest } : {}),
    });
    return;
  }

  const span = trace.getTracer("alcorte-nextjs").startSpan("next.request.error", {
    attributes: {
      "http.route": context.routePath,
      "http.request.method": request.method,
      "next.router.kind": context.routerKind,
      "next.route.type": context.routeType,
      ...(context.renderSource ? { "next.render.source": context.renderSource } : {}),
      ...(digest ? { "next.error.digest": digest } : {}),
    },
  });

  if (error instanceof Error) {
    span.recordException(error);
  } else {
    span.recordException({ name: "UnknownError", message: "Next.js request failed" });
  }
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.end();
};
