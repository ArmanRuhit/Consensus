import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

const validate = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body)

    if(!parsed.success) {
        return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors})
    }
    req.body = parsed.data,
    next()
    return
}

export { validate }