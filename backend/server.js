const express = require("express");
const cors = require("cors");

require("dotenv").config({
    path: "backend/.env"
});

const { createClient } = require("@supabase/supabase-js");
const Groq = require("groq-sdk");


console.log("SUPABASE URL:", process.env.SUPABASE_URL);

console.log(
    "SUPABASE KEY:",
    process.env.SUPABASE_KEY ? "FOUND" : "MISSING"
);

console.log(
    "GROQ KEY:",
    process.env.GROQ_API_KEY ? "FOUND" : "MISSING"
);


// Supabase connection
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);


// Groq AI connection
const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


const app = express();

app.use(cors());
app.use(express.json());


// CHAT ROUTE
app.post("/chat", async (req, res) => {

    try {

        const message = req.body.message;
        const language = req.body.language || "english";

        const { data: projects, error } = await supabase
    .from("projects")
    .select("*");


if(error){
    console.log("SUPABASE ERROR:", error);
}

console.log("SELECTED LANGUAGE:", language);
console.log("USER MESSAGE:", message);

        const completion = await client.chat.completions.create({

            model: "llama-3.3-70b-versatile",

            messages: [

{
role: "system",
content:
`
You are Katin-awan AI Assistant.

IMPORTANT LANGUAGE RULE:

The selected language is: ${language}

You MUST answer ONLY in that language.

If selected language is:
- english → Use English only.
- tagalog → Use Filipino/Tagalog only.
- bisaya → Use Cebuano/Bisaya only.

NEVER answer in English when bisaya is selected.
NEVER answer in Tagalog when bisaya is selected.
NEVER mix languages.

Before answering, check the selected language first.
IMPORTANT:
- Never mix languages.
- Do not use English words when Bisaya or Tagalog is selected unless it is a technical term.
- Keep answers friendly and easy for residents to understand.


You help residents understand:
- Barangay projects
- Budgets
- Expenses
- Public documents
- Transparency reports
- OCR results


PROJECT DATABASE:

${JSON.stringify(projects)}


OCR INFORMATION:

OCR means Optical Character Recognition.

It converts scanned documents, images, or photos into readable digital text.

In Katin-awan, OCR helps organize and extract information from barangay documents so residents can search and access information easier.


RULES:

- For barangay information, use only the database provided.
- Do not invent project, budget, or expense information.
- Explain numbers and amounts clearly.
- If data is unavailable, say:
"No record found in the database."

- For greetings or general questions, answer naturally.
- Keep responses simple and resident-friendly.

`
},

{
role:"user",
content:
`
The user selected ${language} language.

Reply in ${language} only.

User message:
${message}
`
}
            ]

        });


   let aiReply = completion.choices[0].message.content;


// Safety language correction
if(language === "bisaya"){

    aiReply = aiReply
    .replace(/Hello/gi,"Kumusta")
    .replace(/Hi/gi,"Kumusta")
    .replace(/How can I assist you today/gi,"Unsa akong matabang nimo karon");

}


res.json({

    reply: aiReply

});


    } catch(error) {

        console.log("FULL AI ERROR:", error);


        res.status(500).json({

            error: "AI server error"

        });

    }

});


// SERVER START
app.listen(3000, () => {

    console.log(
        "Groq AI Backend running on port 3000"
    );

});