/**
 * Health Check Endpoint
 * Used for monitoring and orchestration (k8s, load balancers, etc.)
 */
import prisma from "../db.server";

export async function loader({ request }) {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    checks: {},
  };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = { status: "healthy" };
  } catch (error) {
    checks.checks.database = { status: "unhealthy", error: error.message };
    checks.status = "unhealthy";
  }

  // Environment check
  const requiredEnvVars = ["SHOPIFY_API_KEY", "CLAUDE_API_KEY"];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    checks.checks.environment = {
      status: "unhealthy",
      missing: missingVars,
    };
    checks.status = "degraded";
  } else {
    checks.checks.environment = { status: "healthy" };
  }

  const statusCode = checks.status === "healthy" ? 200 : checks.status === "degraded" ? 200 : 503;

  return new Response(JSON.stringify(checks, null, 2), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
