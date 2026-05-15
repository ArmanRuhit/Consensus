import { prisma } from "../config/prisma.js";
import { getIO } from "../config/socket.js";

interface AnswerInput {
    questionId: string;
    selectedOptionId: string;
}

interface SubmitResponseInput {
    answers: AnswerInput[];
}

export const submitResponse = async (
    shortId: string,
    input: SubmitResponseInput,
    userId?: string,
) => {
    const poll = await prisma.poll.findUnique({
        where: { short_id: shortId },
        include: {
            questions: {
                include: { option: true },
            },
        },
    });

    if (!poll) {
        return { status: 404, body: { error: "Poll not found" } };
    }

    if (poll.state !== "ACTIVE") {
        return { status: 400, body: { error: "Poll is no longer accepting responses" } };
    }

    if (poll.expires_at <= new Date()) {
        await prisma.poll.update({
            where: { id: poll.id },
            data: { state: "EXPIRED" },
        });
        return { status: 400, body: { error: "Poll has expired" } };
    }

    if (poll.response_mode === "AUTHENTICATED") {
        if (!userId) {
            return { status: 401, body: { error: "Authentication required for this poll" } };
        }
        const existing = await prisma.response.findFirst({
            where: { poll_id: poll.id, respondent_id: userId },
        });
        if (existing) {
            return { status: 409, body: { error: "You have already responded to this poll" } };
        }
    }

    const errors: string[] = [];

    for (const question of poll.questions) {
        const answer = input.answers.find((a) => a.questionId === question.id);
        if (question.is_mandatory && !answer) {
            errors.push(`Question "${question.text}" is required`);
            continue;
        }
        if (answer) {
            const optionExists = question.option.some((o) => o.id === answer.selectedOptionId);
            if (!optionExists) {
                errors.push(`Invalid option for question "${question.text}"`);
            }
        }
    }

    if (errors.length > 0) {
        return { status: 400, body: { error: errors.join("; ") } };
    }

    const response = await prisma.response.create({
        data: {
            poll_id: poll.id,
            respondent_id: userId ?? null,
            answers: {
                create: input.answers.map((a) => ({
                    question_id: a.questionId,
                    selected_option_id: a.selectedOptionId,
                })),
            },
        },
        select: { id: true },
    });

    getIO().to(`poll:${poll.short_id}`).emit("response:new", {
        responseId: response.id,
        shortId: poll.short_id,
        answers: input.answers.map((a) => ({
            questionId: a.questionId,
            selectedOptionId: a.selectedOptionId,
        })),
    });

    return {
        status: 201,
        body: { id: response.id, message: "Response submitted successfully" },
    };
};
