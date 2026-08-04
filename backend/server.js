// backend/server.js

import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

const GROQ_API_KEY =
    process.env.GROQ_API_KEY;

const GROQ_MODEL =
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant";

const SUPABASE_URL =
    process.env.SUPABASE_URL;

/*
 * This accepts any of these environment-variable names:
 * SUPABASE_PUBLISHABLE_KEY
 * SUPABASE_ANON_KEY
 * SUPABASE_KEY
 *
 * The VALUE should be your publishable/public Supabase key,
 * not a secret or service-role key.
 */
const SUPABASE_API_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

const defaultAllowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000"
];

const environmentOrigins =
    String(
        process.env.ALLOWED_ORIGINS || ""
    )
        .split(",")
        .map(function (origin) {
            return origin.trim();
        })
        .filter(Boolean);

const allowedOrigins = [
    ...new Set([
        ...defaultAllowedOrigins,
        ...environmentOrigins
    ])
];

/* =====================================
   STARTUP CHECK
===================================== */

console.log(
    "Groq key loaded:",
    Boolean(GROQ_API_KEY)
);

console.log(
    "Groq model:",
    GROQ_MODEL
);

console.log(
    "Supabase URL loaded:",
    Boolean(SUPABASE_URL)
);

console.log(
    "Supabase API key loaded:",
    Boolean(SUPABASE_API_KEY)
);

/* =====================================
   MIDDLEWARE
===================================== */

app.use(
    cors({
        origin: function (
            origin,
            callback
        ) {
            /*
             * Allow health checks and tools that do not
             * send a browser Origin header.
             */
            if (!origin) {
                callback(null, true);
                return;
            }

            if (
                allowedOrigins.includes(origin)
            ) {
                callback(null, true);
                return;
            }

            console.warn(
                "Blocked CORS origin:",
                origin
            );

            callback(
                new Error(
                    "This website is not allowed to access the chat service."
                )
            );
        }
    })
);

app.use(
    express.json({
        limit: "20kb"
    })
);

/* =====================================
   HEALTH CHECK
===================================== */

app.get(
    "/health",
    function (request, response) {
        response.json({
            status: "ok",
            service:
                "Katin-awan Chat API",

            configuration: {
                groqKey:
                    Boolean(GROQ_API_KEY),

                groqModel:
                    GROQ_MODEL,

                supabaseUrl:
                    Boolean(SUPABASE_URL),

                supabaseKey:
                    Boolean(
                        SUPABASE_API_KEY
                    )
            }
        });
    }
);

/* =====================================
   CHAT
===================================== */

app.post(
    "/chat",
    async function (
        request,
        response
    ) {
        try {
            const authorizationHeader =
                request.get(
                    "authorization"
                ) || "";

            const accessToken =
                authorizationHeader.startsWith(
                    "Bearer "
                )
                    ? authorizationHeader.slice(7)
                    : "";

            if (!accessToken) {
                response.status(401).json({
                    error:
                        "Please log in before using the chatbot."
                });

                return;
            }

            /*
             * Confirm that the Supabase JWT really
             * belongs to a signed-in user.
             */
            const authenticatedUser =
                await verifySupabaseUser(
                    accessToken
                );

            if (!authenticatedUser?.id) {
                response.status(401).json({
                    error:
                        "Your login session is invalid or has expired. Please log in again."
                });

                return;
            }

            const message =
                String(
                    request.body?.message || ""
                ).trim();

            if (!message) {
                response.status(400).json({
                    error:
                        "Please enter a message."
                });

                return;
            }

            if (message.length > 1000) {
                response.status(400).json({
                    error:
                        "The message must not exceed 1,000 characters."
                });

                return;
            }
            const requestedLanguage =
    String(
        request.body?.language || ""
    )
        .trim()
        .toLowerCase();

const languageNames = {
    english: "English",
    tagalog: "Filipino or Tagalog",
    bisaya: "Cebuano or Bisaya"
};

/*
 * Use the frontend language when it is valid.
 * Otherwise, detect the language from the message.
 */
const responseLanguage =
    languageNames[requestedLanguage] ||
    detectResponseLanguage(message);

console.log(
    "Detected response language:",
    responseLanguage
);

            if (!GROQ_API_KEY) {
                throw new Error(
                    "GROQ_API_KEY is missing from backend/.env."
                );
            }

            if (!GROQ_MODEL) {
                throw new Error(
                    "GROQ_MODEL is missing from backend/.env."
                );
            }

            const groqResponse =
                await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${GROQ_API_KEY}`,

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                model:
                                    GROQ_MODEL,

                                temperature:
                                    0.2,

                                max_tokens:
                                    350,

                                messages: [
                                    {
                                        role:
                                            "system",

                                       content:
    getSystemInstructions(
        responseLanguage
    )
                                    },
                                    {
                                        role:
                                            "user",

                                        content:
                                            message
                                    }
                                ]
                            })
                    }
                );

            const groqData =
                await groqResponse.json();

            if (!groqResponse.ok) {
                const groqMessage =
                    groqData
                        ?.error
                        ?.message ||
                    "Groq could not generate a response.";

                console.error(
                    "Groq API error:",
                    groqMessage
                );

                response.status(502).json({
                    error:
                        groqMessage
                });

                return;
            }

            const reply =
                groqData
                    ?.choices?.[0]
                    ?.message?.content
                    ?.trim();

            if (!reply) {
                response.status(502).json({
                    error:
                        "Groq returned an empty response."
                });

                return;
            }

            response.status(200).json({
                reply
            });
        } catch (error) {
            console.error(
                "Chat endpoint error:",
                error.message
            );

            /*
             * This reveals the error description for
             * development, but never reveals key values.
             */
            response.status(500).json({
    error:
        error.message ||
        "The chat service is temporarily unavailable."
});
        }
    }
);

/* =====================================
   SUPABASE USER VERIFICATION
===================================== */
async function verifySupabaseUser(accessToken) {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const supabaseApiKey =
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY;

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL is missing from backend/.env."
        );
    }

    if (!supabaseApiKey) {
        throw new Error(
            "Supabase publishable key is missing from backend/.env."
        );
    }

    const authResponse = await fetch(
        `${supabaseUrl}/auth/v1/user`,
        {
            method: "GET",

            headers: {
                apikey:
                    supabaseApiKey,

                Authorization:
                    `Bearer ${accessToken}`
            }
        }
    );

    if (!authResponse.ok) {
        const errorText =
            await authResponse.text();

        console.error(
            "Supabase authentication failed:",
            authResponse.status,
            errorText
        );

        return null;
    }

    return authResponse.json();
}
function detectResponseLanguage(message) {
    const words =
        String(message || "")
            .toLowerCase()
            .match(/[a-zñ'-]+/g) || [];

    const englishWords = new Set([
        "what",
        "why",
        "where",
        "when",
        "who",
        "how",
        "explain",
        "describe",
        "show",
        "tell",
        "is",
        "are",
        "the",
        "this",
        "that",
        "important",
        "project",
        "projects",
        "budget",
        "expense",
        "expenses",
        "documents",
        "three",
        "sentences"
    ]);

    const tagalogWords = new Set([
        "ano",
        "bakit",
        "saan",
        "kailan",
        "sino",
        "paano",
        "magkano",
        "ilan",
        "alin",
        "mahalaga",
        "maaari",
        "pwede",
        "pakita",
        "sabihin",
        "mayroon",
        "proyekto",
        "gastos",
        "dokumento",
        "mga",
        "ang"
    ]);

    const bisayaWords = new Set([
        "unsa",
        "unsay",
        "ngano",
        "asa",
        "kanus-a",
        "kinsa",
        "giunsa",
        "pila",
        "palihog",
        "nimo",
        "nako",
        "inyong",
        "aduna",
        "maayo",
        "importante",
        "proyekto",
        "gasto"
    ]);

    let englishScore = 0;
    let tagalogScore = 0;
    let bisayaScore = 0;

    words.forEach(function (word) {
        if (englishWords.has(word)) {
            englishScore++;
        }

        if (tagalogWords.has(word)) {
            tagalogScore++;
        }

        if (bisayaWords.has(word)) {
            bisayaScore++;
        }
    });

    if (
        englishScore >= tagalogScore &&
        englishScore >= bisayaScore &&
        englishScore > 0
    ) {
        return "English";
    }

    if (
        bisayaScore > tagalogScore &&
        bisayaScore > 0
    ) {
        return "Cebuano or Bisaya";
    }

    if (tagalogScore > 0) {
        return "Filipino or Tagalog";
    }

    return "English";
}   
/* =====================================
   CHATBOT INSTRUCTIONS
===================================== */
function getSystemInstructions(
    responseLanguage
) {
    return `
You are Katin-awan AI, a barangay transparency assistant.

MANDATORY LANGUAGE RULE:
The required response language is ${responseLanguage}.
Answer only in ${responseLanguage}.
Do not answer in Filipino or Tagalog when the required language is English.
Do not answer in English when the required language is Filipino or Tagalog.
Do not change languages because the word "barangay" appears in the question.

You may help users understand:
- barangay projects
- project budgets
- approved expenses
- public documents
- OCR
- transparency reports
- feedback submission
- navigation within the Katin-awan portal

Rules:
1. Be concise, respectful, and easy to understand.
2. Never invent official projects, amounts, names, dates, or statuses.
3. Direct users to the appropriate portal page when verified live information is unavailable.
4. Never reveal private receipts, private OCR files, user profiles, feedback contents, or administrator-only information.
5. Explain that OCR may contain mistakes and requires administrator review.
6. Stay focused on Katin-awan and barangay transparency.
`.trim();
}

/* =====================================
   SERVER ERROR HANDLER
===================================== */

app.use(
    function (
        error,
        request,
        response,
        next
    ) {
        console.error(
            "Server middleware error:",
            error.message
        );

        response.status(500).json({
            error:
                error.message.includes(
                    "not allowed"
                )
                    ? error.message
                    : "The server encountered an error."
        });
    }
);

/* =====================================
   START SERVER
===================================== */

app.listen(
    PORT,
    "0.0.0.0",
    function () {
        console.log(
            `Katin-awan Chat API running on port ${PORT}`
        );

        console.log(
            `Health check: http://localhost:${PORT}/health`
        );
    }
);