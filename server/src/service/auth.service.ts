import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const generateToken = (userId: string) => jwt.sign({ userId }, env.JWT_SECRET!, { expiresIn: "7d" });

const setAuthCookie = (res: Response, token: string) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

const clearAuthCookie = (res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
    });
};

const clearAuthCookie = (res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
    });
};

export const register = async (email: string, password: string, name: string, res: Response) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return { status: 409, body: { error: "Email already in use" } };
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, name, password_hash: hashed },
    });
    setAuthCookie(res, generateToken(user.id));
    return {
        status: 201,
        body: { user: { id: user.id, email: user.email, name: user.name } },
    };
};

export const login = async (email: string, password: string, res: Response) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return { status: 401, body: { error: "Invalid credentials" } };
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return { status: 401, body: { error: "Invalid credentials" } };
    }
    setAuthCookie(res, generateToken(user.id));
    return {
        status: 200,
        body: { user: { id: user.id, email: user.email, name: user.name } },
    };
};

export const getMe = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return { status: 404, body: { error: "User not found" } };
    }
    return {
        status: 200,
        body: { user: { id: user.id, email: user.email, name: user.name } },
    };
};

export const logout = (res: Response) => {
    clearAuthCookie(res);
    return { status: 200, body: { message: "Logged out successfully" } };
};