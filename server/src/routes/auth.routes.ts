import { Router } from "express";
import type { Request, Response } from "express";
import { validate } from "../middleware/schema.middleware.js";
import { registerSchema, loginSchema } from "../validator/auth.validator.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import * as authService from "../service/auth.service.js";

const authRouter = Router();

authRouter.post("/signup", validate(registerSchema), async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name, res);
    return res.status(result.status).json(result.body);
});

authRouter.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password, res);
    return res.status(result.status).json(result.body);
});

authRouter.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await authService.getMe(req.userId);
    return res.status(result.status).json(result.body);
});

authRouter.post("/logout", authMiddleware, async (_req: AuthRequest, res: Response) => {
    const result = authService.logout(res);
    return res.status(result.status).json(result.body);
});

export { authRouter };