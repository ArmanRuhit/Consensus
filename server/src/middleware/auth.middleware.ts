import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthRequest extends Request {
    userId?: string
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token  // ← cookie instead of header

    if(!token) {
        res.status(401).json({error: 'No token provided'})
        return
    }

    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables')
    }

    try {
        const payload = jwt.verify(token, env.JWT_SECRET!) as { userId : string }
        req.userId = payload.userId
        next()
        return
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }   
}


