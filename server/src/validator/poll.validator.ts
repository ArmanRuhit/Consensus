import { z } from "zod"

const optionSchema = z.object({
    text: z.string().min(1, "Option text is required").max(200, "Option text must be at most 200 characters"),
})

const questionSchema = z.object({
    text: z.string().min(1, "Question text is required").max(500, "Question text must be at most 500 characters"),
    isMandatory: z.boolean().default(false),
    options: z.array(optionSchema).min(2, "Each question must have at least 2 options").max(10, "Each question can have at most 10 options"),
})

export const createPollSchema = z.object({
    title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
    description: z.string().max(1000, "Description must be at most 1000 characters").optional(),
    responseMode: z.enum(["anonymous", "authenticated"]),
    expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), "expiresAt must be a valid ISO date string").refine((val) => new Date(val) > new Date(), "expiresAt must be in the future"),
    questions: z.array(questionSchema).min(1, "At least one question is required"),
})