import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma";
import { Role } from "@prisma/client";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import crypto from "crypto";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import twilio from "twilio";

const router = express.Router();

const ACCESS_TOKEN_TTL = process.env.AUTH_ACCESS_TOKEN_TTL || "15m";
const parsedRefreshTokenDays = Number(process.env.AUTH_REFRESH_TOKEN_DAYS || "30");
const REFRESH_TOKEN_DAYS = Number.isFinite(parsedRefreshTokenDays)
  ? Math.min(Math.max(Math.floor(parsedRefreshTokenDays), 1), 90)
  : 30;
const LOGIN_IP_POINTS = 10;
const LOGIN_USERNAME_POINTS = 5;
const isProduction = process.env.NODE_ENV === "production";
const refreshCookieName = "refresh_token";

if ((process.env.JWT_SECRET || "").length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters.");
}

type RateLimiterLike = {
  consume: (key: string, points?: number) => Promise<unknown>;
  get: (key: string) => Promise<{ consumedPoints: number } | null>;
  delete: (key: string) => Promise<boolean>;
};

const redisUrl = process.env.REDIS_URL;
const useRedisRateLimit = Boolean(redisUrl);
let redisClient: unknown = null;

if (isProduction && !redisUrl) {
  throw new Error("REDIS_URL is required in production for rate limiting.");
}

if (useRedisRateLimit) {
  try {
    // Use dynamic require so local dev still runs without ioredis installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis");
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
    (redisClient as { connect?: () => Promise<void> }).connect?.().catch(() => {
      if (isProduction) {
        console.error("[auth] Redis connect failed in production.");
        process.exit(1);
      } else {
        console.warn("[auth] REDIS_URL provided but Redis connect failed; using memory limiter.");
        redisClient = null;
      }
    });
  } catch {
    if (isProduction) {
      throw new Error("ioredis is required in production when REDIS_URL is set.");
    }
    console.warn("[auth] REDIS_URL provided but ioredis is not installed; using memory limiter.");
  }
}

function createRateLimiter(
  keyPrefix: string,
  points: number,
  duration: number,
  blockDuration: number
): RateLimiterLike {
  if (isProduction && !redisClient) {
    throw new Error("Redis rate limiter is required in production.");
  }

  if (redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient as Record<string, unknown>,
      keyPrefix,
      points,
      duration,
      blockDuration,
    }) as unknown as RateLimiterLike;
  }

  return new RateLimiterMemory({
    keyPrefix,
    points,
    duration,
    blockDuration,
  }) as unknown as RateLimiterLike;
}

const loginIpLimiter = createRateLimiter("auth_login_ip", LOGIN_IP_POINTS, 15 * 60, 15 * 60);

const loginEmailLimiter = createRateLimiter(
  "auth_login_username",
  LOGIN_USERNAME_POINTS,
  15 * 60,
  15 * 60
);

const registerIpLimiter = createRateLimiter("auth_register_ip", 5, 60 * 60, 60 * 60);

const verifyIpLimiter = createRateLimiter("auth_verify_ip", 10, 15 * 60, 15 * 60);

const resendIpLimiter = createRateLimiter("auth_resend_ip", 5, 15 * 60, 15 * 60);
const verifyUsernameLimiter = createRateLimiter("auth_verify_username", 8, 15 * 60, 15 * 60);
const resendUsernameLimiter = createRateLimiter("auth_resend_username", 3, 15 * 60, 15 * 60);
const refreshIpLimiter = createRateLimiter("auth_refresh_ip", 60, 15 * 60, 15 * 60);
const logoutIpLimiter = createRateLimiter("auth_logout_ip", 30, 15 * 60, 15 * 60);

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const canUseEmailVerification = Boolean(twilioAccountSid && twilioAuthToken && twilioVerifyServiceSid);
const enforceEmailVerification =
  process.env.ENFORCE_EMAIL_VERIFICATION === "true" || (isProduction && canUseEmailVerification);
const seedVerificationBypassUsernames = (process.env.SEED_VERIFICATION_BYPASS_USERNAMES || "")
  .split(",")
  .map((username) => username.trim().toLowerCase())
  .filter(Boolean);
const seedVerificationBypassEmails = (process.env.SEED_VERIFICATION_BYPASS_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const twilioClient = canUseEmailVerification
  ? twilio(twilioAccountSid as string, twilioAuthToken as string)
  : null;

function getRequestKey(req: express.Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function sendRateLimitResponse(res: express.Response, err: unknown, fallbackMessage: string) {
  const msBeforeNext =
    typeof err === "object" &&
    err !== null &&
    "msBeforeNext" in err &&
    typeof (err as { msBeforeNext?: unknown }).msBeforeNext === "number"
      ? (err as { msBeforeNext: number }).msBeforeNext
      : undefined;
  const retryAfterSeconds = msBeforeNext ? Math.max(Math.ceil(msBeforeNext / 1000), 1) : undefined;

  if (retryAfterSeconds) {
    res.setHeader("Retry-After", retryAfterSeconds.toString());
  }

  return res.status(429).json({
    error: fallbackMessage,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createAccessToken(userId: string, role: Role) {
  const expiresIn = ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"];
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET!, { expiresIn });
}

async function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

function setRefreshCookie(res: express.Response, token: string, expiresAt: Date) {
  const isProd = process.env.NODE_ENV === "production";
  const maxAgeMs = Math.max(expiresAt.getTime() - Date.now(), 0);
  res.cookie("refresh_token", token, {
    httpOnly: true,
    sameSite: isProd ? "strict" : "lax",
    secure: isProd,
    path: "/api/auth",
    expires: expiresAt,
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res: express.Response) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    sameSite: isProd ? "strict" : "lax",
    secure: isProd,
    path: "/api/auth",
  });
}

async function loginRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const ip = getRequestKey(req);
    const ipState = await loginIpLimiter.get(ip);
    if (ipState && ipState.consumedPoints >= LOGIN_IP_POINTS) {
      return res.status(429).json({ error: "Too many login attempts. Try again later." });
    }

    const username = (req.body?.username || "").toLowerCase();
    if (username) {
      const userState = await loginEmailLimiter.get(username);
      if (userState && userState.consumedPoints >= LOGIN_USERNAME_POINTS) {
        return res.status(429).json({ error: "Too many login attempts. Try again later." });
      }
    }

    return next();
  } catch {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
}

async function consumeLoginFailure(req: express.Request, username: string) {
  try {
    await loginIpLimiter.consume(getRequestKey(req));
  } catch {
    // ignore limiter consume errors on failure path
  }

  if (!username) return;
  try {
    await loginEmailLimiter.consume(username);
  } catch {
    // ignore limiter consume errors on failure path
  }
}

async function registerRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await registerIpLimiter.consume(getRequestKey(req));
    return next();
  } catch (err) {
    return sendRateLimitResponse(res, err, "Too many registration attempts. Try again later.");
  }
}

async function verifyRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await verifyIpLimiter.consume(getRequestKey(req));
    const username = (req.body?.username || "").trim().toLowerCase();
    if (username) {
      await verifyUsernameLimiter.consume(username);
    }
    return next();
  } catch (err) {
    return sendRateLimitResponse(res, err, "Too many verification attempts. Try again later.");
  }
}

async function resendRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await resendIpLimiter.consume(getRequestKey(req));
    const username = (req.body?.username || "").trim().toLowerCase();
    if (username) {
      await resendUsernameLimiter.consume(username);
    }
    return next();
  } catch (err) {
    return sendRateLimitResponse(res, err, "Too many resend attempts. Try again later.");
  }
}

async function refreshRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await refreshIpLimiter.consume(getRequestKey(req));
    return next();
  } catch (err) {
    return sendRateLimitResponse(res, err, "Too many refresh attempts. Try again later.");
  }
}

async function logoutRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await logoutIpLimiter.consume(getRequestKey(req));
    return next();
  } catch (err) {
    return sendRateLimitResponse(res, err, "Too many logout attempts. Try again later.");
  }
}

async function sendVerificationEmailCode(email: string) {
  if (!twilioClient || !twilioVerifyServiceSid) {
    throw new Error("Email verification service not configured");
  }

  await twilioClient.verify.v2.services(twilioVerifyServiceSid).verifications.create({
    to: email,
    channel: "email",
  });
}

const registerSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(255),
});

const loginSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(1).max(255),
});

const verifyEmailSchema = z.object({
  username: z.string().trim().min(3).max(40),
  code: z.string().trim().min(4).max(10),
});

const resendVerificationSchema = z.object({
  username: z.string().trim().min(3).max(40),
});

// POST /api/auth/register
router.post("/register", validateBody(registerSchema), registerRateLimit, async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const verificationRequired = enforceEmailVerification;
    const verificationEmailEnabled = canUseEmailVerification;

    if (!trimmedName || !normalizedUsername || !normalizedEmail || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (verificationRequired && !verificationEmailEnabled) {
      return res.status(503).json({
        error: "Email verification is required but not configured on the server.",
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: trimmedName,
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        role: Role.CLIENT,
        emailVerified: !verificationRequired,
        active: false,
      },
    });

    let verificationEmailSent = false;
    let registerMessage = verificationRequired
      ? "Registration received. Check your email for a verification code."
      : "Registration received. An admin will review your account shortly.";

    if (verificationEmailEnabled) {
      try {
        await sendVerificationEmailCode(normalizedEmail);
        verificationEmailSent = true;
        if (!verificationRequired) {
          registerMessage = "Registration received. A verification email was sent (optional while verification enforcement is off).";
        }
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
        registerMessage = verificationRequired
          ? "Registration received, but verification email could not be sent yet. Try resending the code."
          : "Registration received. Verification email is temporarily unavailable, but enforcement is currently off.";
      }
    }

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      user: userWithoutPassword,
      verificationEmailSent,
      verificationRequired,
      message: registerMessage,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", validateBody(verifyEmailSchema), verifyRateLimit, async (req, res) => {
  try {
    const { username, code } = req.body;
    const normalizedUsername = username.trim().toLowerCase();

    if (!canUseEmailVerification || !twilioClient || !twilioVerifyServiceSid) {
      return res.status(503).json({ error: "Email verification service is not configured" });
    }

    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: "Email already verified", emailVerified: true });
    }

    const check = await twilioClient.verify.v2.services(twilioVerifyServiceSid).verificationChecks.create({
      to: user.email,
      code: code.trim(),
    });

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return res.status(200).json({ message: "Email verified. You can now log in after account approval." });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", validateBody(resendVerificationSchema), resendRateLimit, async (req, res) => {
  try {
    const { username } = req.body;
    const normalizedUsername = username.trim().toLowerCase();

    if (!canUseEmailVerification) {
      return res.status(503).json({ error: "Email verification service is not configured" });
    }

    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    await sendVerificationEmailCode(user.email);
    return res.status(200).json({ message: "Verification code sent" });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", validateBody(loginSchema), loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    
    if (!user) {
      await consumeLoginFailure(req, normalizedUsername);
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await consumeLoginFailure(req, normalizedUsername);
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Temporary bypass to unblock known seed users while verification rollout stabilizes.
    const shouldBypassSeedVerification =
      seedVerificationBypassUsernames.includes(normalizedUsername) ||
      seedVerificationBypassEmails.includes(user.email.toLowerCase());
    if (shouldBypassSeedVerification && !user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    if (enforceEmailVerification && !user.emailVerified) {
      await consumeLoginFailure(req, normalizedUsername);
      return res.status(403).json({ error: "Please verify your email first" });
    }

    if (!user.active) {
      if (user.role === Role.ADMIN) {
        const activeAdmins = await prisma.user.count({
          where: { role: Role.ADMIN, active: true },
        });
        if (activeAdmins === 0) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { active: true },
          });
        }
      }
    }

    if (!user.active) {
      await consumeLoginFailure(req, normalizedUsername);
      return res.status(403).json({ error: "Account pending approval" });
    }

    const token = createAccessToken(user.id, user.role);
    const refresh = await issueRefreshToken(user.id);
    setRefreshCookie(res, refresh.token, refresh.expiresAt);

    await Promise.all([
      loginEmailLimiter.delete(normalizedUsername),
      loginIpLimiter.delete(getRequestKey(req)),
    ]);

    const { password: _, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/refresh
router.post("/refresh", refreshRateLimit, async (req, res) => {
  try {
    const token = req.cookies?.[refreshCookieName];
    if (!token) {
      return res.status(401).json({ error: "Missing refresh token" });
    }

    const tokenHash = hashToken(token);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (stored.revokedAt) {
      // If a previously-revoked token is reused, invalidate the whole user refresh session set.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (stored.expiresAt <= new Date()) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (enforceEmailVerification && !stored.user.emailVerified) {
      clearRefreshCookie(res);
      return res.status(403).json({ error: "Please verify your email first" });
    }

    if (!stored.user.active) {
      clearRefreshCookie(res);
      return res.status(403).json({ error: "Account pending approval" });
    }

    const newRefresh = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const newToken = crypto.randomBytes(64).toString("hex");
      const newTokenHash = hashToken(newToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: stored.userId,
          expiresAt,
        },
      });

      return { token: newToken, expiresAt };
    });
    setRefreshCookie(res, newRefresh.token, newRefresh.expiresAt);

    const accessToken = createAccessToken(stored.user.id, stored.user.role);
    const { password: _, ...userWithoutPassword } = stored.user;
    res.json({ token: accessToken, user: userWithoutPassword });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", logoutRateLimit, async (req, res) => {
  try {
    const token = req.cookies?.[refreshCookieName];
    if (token) {
      const tokenHash = hashToken(token);
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
