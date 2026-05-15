import { prisma } from "../config/prisma.js";

export const getPollAnalytics = async (shortId: string, userId: string) => {
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

    if (poll.creator_id !== userId) {
        return { status: 403, body: { error: "Only the poll creator can view analytics" } };
    }

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
            isMandatory: q.is_mandatory,
            orderIndex: q.order_index,
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
            shortId: poll.short_id,
            state: poll.state.toLowerCase(),
            title: poll.title,
            description: poll.description,
            responseMode: poll.response_mode.toLowerCase(),
            expiresAt: poll.expires_at.toISOString(),
            createdAt: poll.created_at.toISOString(),
            publishedAt: poll.published_at?.toISOString() ?? null,
            totalResponses: poll._count.responses,
            questions,
        },
    };
};
