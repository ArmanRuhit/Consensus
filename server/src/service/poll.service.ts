import { randomBytes } from "crypto";
import { prisma } from "../config/prisma.js";
import { getIO } from "../config/socket.js";
import { env } from "../config/env.js";
import type { PollResponseMode, PollState } from "@prisma/client";

const generateShortId = (): string => {
    return randomBytes(6).toString("base64url").slice(0, 8);
};

interface CreatePollInput {
    title: string;
    description?: string;
    responseMode: "anonymous" | "authenticated";
    expiresAt: string;
    questions: {
        text: string;
        isMandatory: boolean;
        options: { text: string }[];
    }[];
}

export const createPoll = async (userId: string, input: CreatePollInput) => {
    const shortId = generateShortId();
    const responseMode: PollResponseMode = input.responseMode === "anonymous" ? "ANONYMOUS" : "AUTHENTICATED";

    const poll = await prisma.poll.create({
        data: {
            short_id: shortId,
            creator_id: userId,
            title: input.title,
            description: input.description ?? null,
            response_mode: responseMode,
            expires_at: new Date(input.expiresAt),
            questions: {
                create: input.questions.map((q, qi) => ({
                    text: q.text,
                    is_mandatory: q.isMandatory,
                    order_index: qi,
                    option: {
                        create: q.options.map((o, oi) => ({
                            text: o.text,
                            order_index: oi,
                        })),
                    },
                })),
            },
        },
        select: {
            id: true,
            short_id: true,
        },
    });

    return {
        status: 201,
        body: {
            id: poll.id,
            shortId: poll.short_id,
            url: `${env.CLIENT_URL}/p/${poll.short_id}`,
        },
    };
};

export const getPollForResponse = async (shortId: string) => {
    const poll = await prisma.poll.findUnique({
        where: { short_id: shortId },
        select: { id: true, state: true, expires_at: true, response_mode: true },
    });

    if (!poll) {
        return { status: 404, body: { error: "Poll not found" }, data: null as null };
    }

    if (poll.expires_at <= new Date() && poll.state === "ACTIVE") {
        await prisma.poll.update({
            where: { id: poll.id },
            data: { state: "EXPIRED" },
        });
        return { status: 400, body: { error: "Poll has expired" }, data: null as null };
    }

    if (poll.state !== "ACTIVE") {
        return { status: 400, body: { error: "Poll is no longer accepting responses" }, data: null as null };
    }

    return {
        status: 200,
        body: null,
        data: { responseMode: poll.response_mode.toLowerCase() as "anonymous" | "authenticated" },
    };
};

export const publishPoll = async (shortId: string, userId: string) => {
    const poll = await prisma.poll.findUnique({
        where: { short_id: shortId },
        select: { id: true, creator_id: true, state: true },
    });

    if (!poll) {
        return { status: 404, body: { error: "Poll not found" } };
    }

    if (poll.creator_id !== userId) {
        return { status: 403, body: { error: "Only the poll creator can publish results" } };
    }

    if (poll.state === "PUBLISHED") {
        return { status: 400, body: { error: "Poll is already published" } };
    }

    await prisma.poll.update({
        where: { id: poll.id },
        data: { state: "PUBLISHED", published_at: new Date() },
    });

    getIO().to(`poll:${shortId}`).emit("poll:state", { shortId, state: "published" });

    return { status: 200, body: { message: "Results published successfully" } };
};

export const closePoll = async (shortId: string, userId: string) => {
    const poll = await prisma.poll.findUnique({
        where: { short_id: shortId },
        select: { id: true, creator_id: true, state: true },
    });

    if (!poll) {
        return { status: 404, body: { error: "Poll not found" } };
    }

    if (poll.creator_id !== userId) {
        return { status: 403, body: { error: "Only the poll creator can close a poll" } };
    }

    if (poll.state !== "ACTIVE") {
        return { status: 400, body: { error: "Only active polls can be closed" } };
    }

    await prisma.poll.update({
        where: { id: poll.id },
        data: { state: "EXPIRED" },
    });

    getIO().to(`poll:${shortId}`).emit("poll:state", { shortId, state: "expired" });

    return { status: 200, body: { message: "Poll closed successfully" } };
};

export const getMyPolls = async (userId: string) => {
    const polls = await prisma.poll.findMany({
        where: { creator_id: userId },
        orderBy: { created_at: "desc" },
        include: {
            _count: { select: { responses: true } },
        },
    });

    return {
        status: 200,
        body: polls.map((p) => ({
            shortId: p.short_id,
            title: p.title,
            state: p.state.toLowerCase(),
            responseMode: p.response_mode.toLowerCase(),
            responseCount: p._count.responses,
            expiresAt: p.expires_at.toISOString(),
            createdAt: p.created_at.toISOString(),
            publishedAt: p.published_at?.toISOString() ?? null,
        })),
    };
};

export const getPollByShortId = async (shortId: string) => {
    const poll = await prisma.poll.findUnique({
        where: { short_id: shortId },
        include: {
            questions: {
                orderBy: { order_index: "asc" },
                include: {
                    option: {
                        orderBy: { order_index: "asc" },
                    },
                },
            },
            _count: {
                select: { responses: true },
            },
        },
    });

    if (!poll) {
        return { status: 404, body: { error: "Poll not found" } };
    }

    // Lazy expiry
    if (poll.state === "ACTIVE" && poll.expires_at <= new Date()) {
        const updated = await prisma.poll.update({
            where: { id: poll.id },
            data: { state: "EXPIRED" },
        });
        poll.state = updated.state as PollState;
    }

    const base = {
        shortId: poll.short_id,
        state: poll.state.toLowerCase(),
        title: poll.title,
        description: poll.description,
    };

    if (poll.state === "PUBLISHED") {
        const answers = await prisma.answer.groupBy({
            by: ["question_id", "selected_option_id"],
            where: { response: { poll_id: poll.id } },
            _count: true,
        });

        const questions = poll.questions.map((q) => {
            const questionAnswers = answers.filter((a) => a.question_id === q.id);
            const totalAnswered = questionAnswers.reduce((sum, a) => sum + a._count, 0);
            return {
                id: q.id,
                text: q.text,
                totalAnswered,
                options: q.option.map((o) => {
                    const match = questionAnswers.find((a) => a.selected_option_id === o.id);
                    const count = match?._count ?? 0;
                    return {
                        id: o.id,
                        text: o.text,
                        count,
                        percentage: totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0,
                    };
                }),
            };
        });

        return {
            status: 200,
            body: {
                ...base,
                totalResponses: poll._count.responses,
                questions,
            },
        };
    }

    if (poll.state === "EXPIRED") {
        return {
            status: 200,
            body: base,
        };
    }

    // ACTIVE
    return {
        status: 200,
        body: {
            ...base,
            responseMode: poll.response_mode.toLowerCase(),
            expiresAt: poll.expires_at.toISOString(),
            questions: poll.questions.map((q) => ({
                id: q.id,
                text: q.text,
                isMandatory: q.is_mandatory,
                options: q.option.map((o) => ({
                    id: o.id,
                    text: o.text,
                })),
            })),
        },
    };
};