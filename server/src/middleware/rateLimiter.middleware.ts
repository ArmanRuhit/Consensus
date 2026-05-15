import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import type { Request } from "express";

const responseLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    keyGenerator: (req: Request) => {
        const userId = (req as any).userId as string | undefined;
        if (userId) return `user:${userId}`;
        return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
    },
    message: { error: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

export { responseLimiter };
