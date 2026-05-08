// Express server bootstrap with env validation, CORS, routes, and Mongo startup.
import "dotenv/config";
import cors from "cors";
import express from "express";
import appointmentRoutes from "./routes/appointments.js";
import authRoutes from "./routes/auth.js";
import calendarRoutes from "./routes/calendar.js";
import patientRoutes from "./routes/patients.js";
import settingsRoutes from "./routes/settings.js";
import sessionRoutes from "./routes/session.js";
import dashboardRoutes from "./routes/dashboard.js";
import agentRoutes from "./routes/agent.js";
import devRoutes from "./routes/dev.js";
import { requireAuth } from "./middleware/auth.js";
import { connectMongo } from "./services/mongoService.js";
import { sendError, sendSuccess } from "./utils/http.js";

// Express entry point for the MedFlow backend API.
const app = express();
const port = Number(process.env.PORT || 5000);
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET"];
let mongoConnected = false;
let mongoRetryTimer;

function missingRequiredEnv() {
  return requiredEnvVars.filter((name) => !process.env[name]?.trim?.());
}

function normalizeOrigin(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.VITE_API_BASE_URL ? process.env.VITE_API_BASE_URL.replace(/\/api$/, "") : null,
  "http://localhost:5173",
  "http://localhost:8080",
]
  .filter(Boolean)
  .map(normalizeOrigin);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      const isAllowed = allowedOrigins.includes(normalized);
      return callback(isAllowed ? null : new Error("CORS_ORIGIN_NOT_ALLOWED"), isAllowed);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  sendSuccess(res, {
    service: "medflow-backend",
    mongoConnected,
  });
});

app.use((req, res, next) => {
  if (mongoConnected) return next();
  if (req.path === "/health") return next();
  return sendError(res, 503, {
    code: "DATABASE_UNAVAILABLE",
    message: "Database connection is unavailable. Retry shortly.",
  });
});

app.use("/api/auth", authRoutes);
app.use(requireAuth);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/dev", devRoutes);

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return sendError(res, 413, {
      code: "AUDIO_FILE_TOO_LARGE",
      message: "Uploaded audio file exceeds the configured size limit.",
    });
  }

  if (err?.name === "ValidationError") {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: err.message,
    });
  }

  if (err?.name === "CastError") {
    return sendError(res, 400, {
      code: "INVALID_ID",
      message: "Invalid identifier.",
      details: err.message,
    });
  }

  return sendError(res, 500, {
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error.",
    details: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

const missing = missingRequiredEnv();
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

function scheduleMongoReconnect() {
  if (mongoRetryTimer) return;
  mongoRetryTimer = setTimeout(async () => {
    mongoRetryTimer = undefined;
    try {
      await connectMongo();
      mongoConnected = true;
      console.log("[MedFlow][Mongo] Reconnected successfully.");
    } catch (error) {
      console.error("[MedFlow][Mongo] Reconnect attempt failed.", error?.message || error);
      scheduleMongoReconnect();
    }
  }, 5000);
}

connectMongo()
  .then(() => {
    mongoConnected = true;
    console.log("[MedFlow][Mongo] Connected successfully.");
  })
  .catch((error) => {
    mongoConnected = false;
    console.error("[MedFlow][Mongo] Initial connection failed.", error?.message || error);
    scheduleMongoReconnect();
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`[MedFlow][Server][Startup] Backend listening on port ${port}`);
    });
  });
