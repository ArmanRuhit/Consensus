const openapiSpec = {
    openapi: "3.1.0",
    info: {
        title: "Consensus API",
        version: "1.0.0",
        description: "Polling platform API — create polls, collect responses, view analytics."
    },
    servers: [{ url: "/api", description: "API root" }],
    paths: {
        "/health": {
            get: {
                summary: "Health check",
                tags: ["Health"],
                responses: { "200": { description: "OK" } }
            }
        },
        "/auth/signup": {
            post: {
                summary: "Create account",
                tags: ["Auth"],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["email", "password", "name"],
                        properties: {
                            email: { type: "string", format: "email" },
                            password: { type: "string", minLength: 8 },
                            name: { type: "string" }
                        }
                    } } }
                },
                responses: {
                    "201": { description: "Account created + cookie set" },
                    "400": { description: "Validation error" },
                    "409": { description: "Email already in use" }
                }
            }
        },
        "/auth/login": {
            post: {
                summary: "Sign in",
                tags: ["Auth"],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: {
                        type: "object",
                        required: ["email", "password"],
                        properties: {
                            email: { type: "string", format: "email" },
                            password: { type: "string" }
                        }
                    } } }
                },
                responses: {
                    "200": { description: "Success + cookie set" },
                    "401": { description: "Invalid credentials" }
                }
            }
        },
        "/auth/logout": {
            post: {
                summary: "Sign out",
                tags: ["Auth"],
                security: [{ cookieAuth: [] }],
                responses: { "200": { description: "Cookie cleared" } }
            }
        },
        "/auth/me": {
            get: {
                summary: "Current user",
                tags: ["Auth"],
                security: [{ cookieAuth: [] }],
                responses: {
                    "200": { description: "User object" },
                    "401": { description: "Not authenticated" }
                }
            }
        },
        "/polls": {
            post: {
                summary: "Create a poll",
                tags: ["Polls"],
                security: [{ cookieAuth: [] }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/CreatePollInput" } } }
                },
                responses: {
                    "201": { description: "Poll created" },
                    "400": { description: "Validation error" },
                    "401": { description: "Not authenticated" }
                }
            },
            get: {
                summary: "List my polls",
                tags: ["Polls"],
                security: [{ cookieAuth: [] }],
                responses: {
                    "200": { description: "Array of user's polls" },
                    "401": { description: "Not authenticated" }
                }
            }
        },
        "/polls/{shortId}": {
            get: {
                summary: "Fetch poll by short ID",
                tags: ["Polls"],
                parameters: [{ name: "shortId", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Poll data (shape varies by state)" },
                    "404": { description: "Poll not found" }
                }
            }
        },
        "/polls/{shortId}/responses": {
            post: {
                summary: "Submit response",
                tags: ["Responses"],
                parameters: [{ name: "shortId", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitResponseInput" } } }
                },
                responses: {
                    "201": { description: "Response recorded" },
                    "400": { description: "Invalid data or poll not accepting" },
                    "401": { description: "Authentication required (authenticated mode)" },
                    "409": { description: "Already responded" },
                    "429": { description: "Rate limited" }
                }
            }
        },
        "/polls/{shortId}/analytics": {
            get: {
                summary: "Get poll analytics (creator only)",
                tags: ["Analytics"],
                security: [{ cookieAuth: [] }],
                parameters: [{ name: "shortId", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Analytics data" },
                    "401": { description: "Not authenticated" },
                    "403": { description: "Not the poll creator" },
                    "404": { description: "Poll not found" }
                }
            }
        },
        "/polls/{shortId}/publish": {
            post: {
                summary: "Publish results (creator only)",
                tags: ["Polls"],
                security: [{ cookieAuth: [] }],
                parameters: [{ name: "shortId", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Published" },
                    "400": { description: "Already published" },
                    "401": { description: "Not authenticated" },
                    "403": { description: "Not the poll creator" },
                    "404": { description: "Poll not found" }
                }
            }
        },
        "/polls/{shortId}/close": {
            post: {
                summary: "Close poll early (creator only)",
                tags: ["Polls"],
                security: [{ cookieAuth: [] }],
                parameters: [{ name: "shortId", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": { description: "Poll closed" },
                    "400": { description: "Poll not active" },
                    "401": { description: "Not authenticated" },
                    "403": { description: "Not the poll creator" },
                    "404": { description: "Poll not found" }
                }
            }
        }
    },
    components: {
        securitySchemes: {
            cookieAuth: { type: "apiKey", in: "cookie", name: "token" }
        },
        schemas: {
            CreatePollInput: {
                type: "object",
                required: ["title", "responseMode", "expiresAt", "questions"],
                properties: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string", maxLength: 1000 },
                    responseMode: { type: "string", enum: ["anonymous", "authenticated"] },
                    expiresAt: { type: "string", format: "date-time" },
                    questions: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/QuestionInput" } }
                }
            },
            QuestionInput: {
                type: "object",
                required: ["text", "options"],
                properties: {
                    text: { type: "string", maxLength: 500 },
                    isMandatory: { type: "boolean", default: false },
                    options: { type: "array", minItems: 2, maxItems: 10, items: { $ref: "#/components/schemas/OptionInput" } }
                }
            },
            OptionInput: {
                type: "object",
                required: ["text"],
                properties: { text: { type: "string", maxLength: 200 } }
            },
            SubmitResponseInput: {
                type: "object",
                required: ["answers"],
                properties: {
                    answers: {
                        type: "array",
                        minItems: 1,
                        items: {
                            type: "object",
                            required: ["questionId", "selectedOptionId"],
                            properties: {
                                questionId: { type: "string" },
                                selectedOptionId: { type: "string" }
                            }
                        }
                    }
                }
            }
        }
    }
};

export { openapiSpec };