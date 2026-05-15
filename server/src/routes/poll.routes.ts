import { Router } from "express";
import { validate } from "../middleware/schema.middleware.js";
import { createPollSchema } from "../validator/poll.validator.js";
import { submitResponseSchema } from "../validator/response.validator.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { responseLimiter } from "../middleware/rateLimiter.middleware.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import type { Request, Response } from "express";
import * as pollService from "../service/poll.service.js";
import * as responseService from "../service/response.service.js";
import * as analyticsService from "../service/analytics.service.js";

const pollRouter = Router()

pollRouter.post('', authMiddleware, validate(createPollSchema), async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await pollService.createPoll(req.userId, req.body);
    return res.status(result.status).json(result.body);
})

pollRouter.get('/:shortId', async (req: Request, res: Response) => {
    const shortId = req.params.shortId;
    if (typeof shortId !== 'string') {
        return res.status(400).json({ error: "Invalid shortId" });
    }
    const result = await pollService.getPollByShortId(shortId);
    return res.status(result.status).json(result.body);
})

pollRouter.post('/:shortId/responses', responseLimiter, validate(submitResponseSchema), async (req: AuthRequest, res: Response) => {
    const shortId = req.params.shortId;
    if (typeof shortId !== 'string') {
        return res.status(400).json({ error: "Invalid shortId" });
    }

    const poll = await pollService.getPollForResponse(shortId);
    if (poll.status !== 200) {
        return res.status(poll.status).json(poll.body);
    }

    if (poll.data!.responseMode === "authenticated") {
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ error: "Authentication required for this poll" });
        }
        const { default: jwt } = await import("jsonwebtoken");
        const { env } = await import("../config/env.js");
        try {
            const payload = jwt.verify(token, env.JWT_SECRET!) as { userId: string };
            req.userId = payload.userId;
        } catch {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
    }

    const result = await responseService.submitResponse(shortId, req.body, req.userId);
    return res.status(result.status).json(result.body);
})

pollRouter.get('/:shortId/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
    const shortId = req.params.shortId;
    if (typeof shortId !== 'string') {
        return res.status(400).json({ error: "Invalid shortId" });
    }
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await analyticsService.getPollAnalytics(shortId, req.userId);
    return res.status(result.status).json(result.body);
})

pollRouter.post('/:shortId/publish', authMiddleware, async (req: AuthRequest, res: Response) => {
    const shortId = req.params.shortId;
    if (typeof shortId !== 'string') {
        return res.status(400).json({ error: "Invalid shortId" });
    }
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await pollService.publishPoll(shortId, req.userId);
    return res.status(result.status).json(result.body);
})

pollRouter.post('/:shortId/close', authMiddleware, async (req: AuthRequest, res: Response) => {
    const shortId = req.params.shortId;
    if (typeof shortId !== 'string') {
        return res.status(400).json({ error: "Invalid shortId" });
    }
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await pollService.closePoll(shortId, req.userId);
    return res.status(result.status).json(result.body);
})

pollRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await pollService.getMyPolls(req.userId);
    return res.status(result.status).json(result.body);
})

export { pollRouter }