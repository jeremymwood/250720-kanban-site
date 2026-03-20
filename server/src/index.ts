import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import prisma from "./prisma";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import issueRoutes from "./routes/issue.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";
const gracefulShutdownTimeoutMs = Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || 10000);

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

const corsAllowlist = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

if (isProduction && corsAllowlist.length === 0) {
  console.error("CORS_ORIGIN must define at least one allowed origin in production.");
  process.exit(1);
}

const requiredEnv = ["DATABASE_URL", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  (req as express.Request & { requestId?: string }).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const requestId = (req as express.Request & { requestId?: string }).requestId || "unknown";
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const baseLog = {
      level: "info",
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get("user-agent") || "",
    };
    if (res.statusCode >= 500) {
      console.error(JSON.stringify({ ...baseLog, level: "error" }));
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify({ ...baseLog, level: "warn" }));
    } else if (!isProduction) {
      console.log(JSON.stringify(baseLog));
    }
  });
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // allow curl/health checks and same-origin requests without Origin header
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalizedOrigin = normalizeOrigin(origin);
      if (corsAllowlist.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "font-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
      },
    },
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/issues", issueRoutes);

app.get("/health/live", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "ishi-api",
    status: "live",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      ok: true,
      service: "ishi-api",
      status: "ready",
      timestamp: new Date().toISOString(),
      requestId: (req as express.Request & { requestId?: string }).requestId,
    });
  } catch (err) {
    const requestId = (req as express.Request & { requestId?: string }).requestId;
    console.error(
      JSON.stringify({
        level: "error",
        event: "readiness_check_failed",
        requestId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(503).json({
      ok: false,
      service: "ishi-api",
      status: "not_ready",
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
});

app.get("/", (_req, res) => {
  res.send("Server is running");
});

app.use((req, res) => {
  const requestId = (req as express.Request & { requestId?: string }).requestId;
  res.status(404).json({ error: "Not found", requestId });
});

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as express.Request & { requestId?: string }).requestId || "unknown";
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_server_error",
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  res.status(500).json({ error: "Internal server error", requestId });
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "shutdown_start", signal }));

  const forceExitTimer = setTimeout(() => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "shutdown_timeout",
        timeoutMs: gracefulShutdownTimeoutMs,
      })
    );
    process.exit(1);
  }, gracefulShutdownTimeoutMs);

  forceExitTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      clearTimeout(forceExitTimer);
      console.log(JSON.stringify({ level: "info", event: "shutdown_complete" }));
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExitTimer);
      console.error(
        JSON.stringify({
          level: "error",
          event: "shutdown_error",
          error: err instanceof Error ? err.message : String(err),
        })
      );
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
