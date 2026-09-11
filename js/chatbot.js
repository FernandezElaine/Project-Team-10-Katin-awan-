console.log("CHATBOT JS LOADED");
let chatbotData = [];
let currentLanguage = 'english';

function detectLanguage(text) {
    const words =
        String(text || "")
            .toLowerCase()
            .match(/[a-zñ'-]+/g) || [];

    const bisayaWords = new Set([
        "unsa",
        "unsay",
        "ngano",
        "asa",
        "kinsa",
        "kanus-a",
        "palihog",
        "nimo",
        "nako",
        "inyong",
        "aduna",
        "maayo",
        "giunsa",
        "pila"
    ]);

    const tagalogWords = new Set([
        "ano",
        "bakit",
        "saan",
        "sino",
        "kailan",
        "paano",
        "magkano",
        "maaari",
        "pwede",
        "pakita",
        "mayroon",
        "ilan",
        "alin",
        "kumusta"
    ]);

    let bisayaScore = 0;
    let tagalogScore = 0;

    words.forEach(function (word) {
        if (bisayaWords.has(word)) {
            bisayaScore++;
        }

        if (tagalogWords.has(word)) {
            tagalogScore++;
        }
    });

    if (
        bisayaScore > tagalogScore &&
        bisayaScore > 0
    ) {
        return "bisaya";
    }

    if (tagalogScore > 0) {
        return "tagalog";
    }

    /*
     * English is the default when no clear
     * Tagalog or Bisaya indicator is detected.
     */
    return "english";
}

// -------------------------
// LOAD LOCAL DATA (optional fallback)
// -------------------------
async function loadChatbotData() {
    try {
        const response = await fetch("../data/chatbot.json");
        chatbotData = await response.json();
    } catch (err) {
        console.log("Chatbot JSON not loaded:", err.message);
    }
}

// -------------------------
// LANGUAGE SWITCH
// -------------------------
function detectLanguage(text) {
    const message =
        String(text || "")
            .toLowerCase()
            .replace(/[.,!?;:()[\]{}"]/g, " ");

    const bisayaIndicators = [
        "unsa",
        "unsay",
        "ngano",
        "asa",
        "kinsa",
        "kanus-a",
        "pila",
        "palihog",
        "nimo",
        "nako",
        "inyuha",
        "aduna",
        "maayo",
        "mahimong",
        "gipakita",
        "giunsa"
    ];

    const tagalogIndicators = [
        "ano",
        "bakit",
        "saan",
        "sino",
        "kailan",
        "paano",
        "magkano",
        "maaari",
        "pakisabi",
        "pakita",
        "aking",
        "atin",
        "mayroon",
        "proyektong"
    ];

    const words =
        new Set(
            message
                .split(/\s+/)
                .filter(Boolean)
        );

    const bisayaScore =
        bisayaIndicators.reduce(
            function (score, word) {
                return (
                    score +
                    (words.has(word) ? 1 : 0)
                );
            },
            0
        );

    const tagalogScore =
        tagalogIndicators.reduce(
            function (score, word) {
                return (
                    score +
                    (words.has(word) ? 1 : 0)
                );
            },
            0
        );

    if (
        bisayaScore > 0 &&
        bisayaScore > tagalogScore
    ) {
        return "bisaya";
    }

    if (tagalogScore > 0) {
        return "tagalog";
    }

    return "english";
}

// -------------------------
// SEND MESSAGE (FIXED)
// -------------------------
async function sendMessage() {

    const input = document.getElementById("chatInput");
   const text =
    input.value.trim();

if (!text) {
    return;
}

currentLanguage =
    detectLanguage(text);

console.log(
    "Detected language:",
    currentLanguage
);
currentLanguage =
    detectLanguage(text);

console.log(
    "Automatically detected language:",
    currentLanguage
);

    addMessage("user", text);

    input.value = "";


    const loading = document.createElement("div");

    loading.classList.add(
        "chat-message",
        "bot"
    );

  loading.innerText = "🤖 Thinking...";


    const container = document.getElementById("chatMessages");

    container.appendChild(loading);

    container.scrollTop = container.scrollHeight;



  let reply;



reply = await getReply(text);


if(!reply){
    reply = await askAI(text);
}
await typeMessage(
    loading,
    reply
);

// Guest chatbot conversations are not stored.

}

async function askAI(message) {
    try {
        const response =
            await fetch(
                window.KATIN_AWAN_CHAT_API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message,
                        language:
                            currentLanguage
                    })
                }
            );

     const data =
    await response.json();

console.log("GROQ RESPONSE:", data);

        if (!response.ok) {
            return (
                data.error ||
                `Chat server error ${response.status}`
            );
        }

        if (
            typeof data.reply === "string" &&
            data.reply.trim()
        ) {
            return data.reply.trim();
        }

        throw new Error(
            "Empty AI response."
        );

    } catch (error) {
        console.error(
            "AI request error:",
            error
        );

        return getLocalizedMessage(
            "ai_unavailable"
        );
    }
}

function getLocalizedMessage(key) {
    const messages = {
      
        ai_unavailable: {
            english:
                "Sorry, the AI service is temporarily unavailable. Please try again later.",

            tagalog:
                "Paumanhin, pansamantalang hindi available ang AI service. Pakisubukan muli mamaya.",

            bisaya:
                "Pasayloa, temporaryong dili available ang AI service. Sulayi pag-usab unya."
        }
    };

    return (
        messages[key]?.[
            currentLanguage
        ] ||
        messages[key]?.english ||
        ""
    );
}
function askQuestion(question) {

    console.log("Suggested question clicked:", question);

    const input = document.getElementById("chatInput");

    input.value = question;

    sendMessage();

}

// -------------------------
// UI MESSAGE
// -------------------------
function addMessage(sender, text) {
    const container = document.getElementById('chatMessages');

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', sender);
    msgDiv.innerText = text;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

async function typeMessage(element, text){

    element.innerText="";

    for(let i=0;i<text.length;i++){

        element.innerText += text[i];

        await new Promise(
            resolve => setTimeout(resolve,10)
        );

    }

}

// -------------------------
// 🧠 CHATBOT AI ENGINE (FIXED + SMART)
// -------------------------
async function getReply(text) {
    const msg = text.toLowerCase();
    // GREETINGS
if(
    /\b(hi|hello|hey|musta|kumusta)\b/.test(msg)
){

    if(currentLanguage === "bisaya"){
        return "Kumusta! Maayong adlaw. Ako si Katin-awan AI Assistant. Unsa akong matabang nimo karon?";
    }

    if(currentLanguage === "tagalog"){
        return "Kumusta! Ako ang Katin-awan AI Assistant. Paano kita matutulungan ngayon?";
    }

    return "Hello! I am Katin-awan AI Assistant. How can I help you today?";
}
 
    try {

        // =========================
        // 🏗 PROJECT ANALYTICS
        // =========================
// =========================
// 🏗 PROJECT ANALYTICS
// =========================
if (
    msg.includes("project") ||
    msg.includes("projects") ||
    msg.includes("contractor") ||
    msg.includes("implementer") ||
    msg.includes("ongoing projects") ||
    msg.includes("completed projects") ||
    msg.includes("barangay project")
){


const {data,error}=await supabaseClient
.from("projects")
.select(`
title,
status,
contractor,
budget,
category,
location,
progress
`);


if(error){
    console.log(error);
    return "I cannot access project information right now.";
}


const total = data.length;

let completedText;
let ongoingText;
let totalText;


if(currentLanguage==="tagalog"){

completedText="Nakumpletong mga proyekto";
ongoingText="Mga kasalukuyang proyekto";
totalText="Kabuuang proyekto";

}

else if(currentLanguage==="bisaya"){

completedText="Nahuman nga mga proyekto";
ongoingText="Nagpadayon nga mga proyekto";
totalText="Kinatibuk-ang proyekto";

}

else{

completedText="Completed Projects";
ongoingText="Ongoing Projects";
totalText="Total Projects";

}

const completed = data.filter(
p => (p.status || "").toLowerCase() === "completed"
).length;


const ongoing = data.filter(
p => (p.status || "").toLowerCase() === "ongoing"
).length;



let contractors = [
    ...new Set(
        data
        .map(p=>p.contractor)
        .filter(c=>c && c !== "Not specified")
    )
];
const projectList = data
.slice(0,5)
.map(p => 
`
📌 ${p.title}
Status: ${p.status}
Progress: ${p.progress}%
`
)
.join("\n");

let title =
currentLanguage === "bisaya"
? "🏗️ Impormasyon sa mga Proyekto sa Barangay"
: currentLanguage === "tagalog"
? "🏗️ Impormasyon ng mga Proyekto ng Barangay"
: "🏗️ Barangay Project Information";


return `
${title}

${totalText}:
${total}

✅ ${completedText}:
${completed}


🔄 ${ongoingText}:
${ongoing}


🏢 Project Implementers:
${
contractors.length 
? contractors.join(", ")
: "No contractor assigned"
}




📌 Projects:

${projectList}

`;
}
// =========================
// 💰 PROJECT BUDGET
// =========================
if(msg.includes("budget")){


const {data,error}=await supabaseClient
.from("projects")
.select("title,budget");


if(error){
    console.log(error);
    return "Budget information unavailable.";
}


let totalBudget = 0;


data.forEach(project=>{
    totalBudget += Number(project.budget || 0);
});


let budgetList = data
.map((project,index)=> 
`${index + 1}. ${project.title}
   ₱${Number(project.budget || 0).toLocaleString()}`
)
.join("\n");


let title =
currentLanguage === "bisaya"
? "💰 Impormasyon sa Badyet sa mga Proyekto"
: currentLanguage === "tagalog"
? "💰 Impormasyon ng Badyet ng mga Proyekto"
: "💰 Project Budget Information";


return `
${title}

📂 Project Budget Breakdown:

${budgetList}

━━━━━━━━━━━━━━

💰 Total Project Funding:
₱${totalBudget.toLocaleString()}

📊 Total Projects:
${data.length}
`;
}

// =========================
// 💸 EXPENSES
// =========================
if(msg.includes("expense")){


const {data,error}=await supabaseClient
.from("expenses")
.select("amount");


if(error)
return "Expense data unavailable.";


let totalExpense = 0;


data.forEach(e=>{
    totalExpense += Number(e.amount || 0);
});


let title =
currentLanguage === "bisaya"
? "💸 Impormasyon sa mga Gasto sa Barangay"
: currentLanguage === "tagalog"
? "💸 Impormasyon ng mga Gastos ng Barangay"
: "💸 Barangay Expense Information";


return `
${title}


💸 Total Expenses:

₱${totalExpense.toLocaleString()}


📄 Expense Records:

${data.length}

`;

}
// =========================
// 📢 PUBLIC FEEDBACK
// =========================
if (msg.includes("feedback")) {

    const {
        count,
        error
    } = await supabaseClient
        .from("feedback")
        .select(
            "id",
            {
                count: "exact",
                head: true
            }
        )
        .eq("is_public", true);

    if (error) {
        console.log(
            "Feedback count error:",
            error
        );

        return "Feedback information unavailable.";
    }

    let title =
        currentLanguage === "bisaya"
            ? "📢 Mga Feedback sa mga Residente"
            : currentLanguage === "tagalog"
            ? "📢 Mga Feedback ng mga Residente"
            : "📢 Resident Feedback Information";

    let totalText =
        currentLanguage === "bisaya"
            ? "Kinatibuk-ang Publikong Feedback"
            : currentLanguage === "tagalog"
            ? "Kabuuang Pampublikong Feedback"
            : "Total Public Feedback";

    return `
${title}

${totalText}:
${count || 0}
`;
}

        // =========================
        // 📄 OCR FIX (IMPORTANT FIX)
        // =========================
        if (
    msg.includes("ocr") &&
    (
        msg.includes("record") ||
        msg.includes("records") ||
        msg.includes("how many") ||
        msg.includes("total") ||
        msg.includes("count")
    )
) {

    const { data, error } = await supabaseClient
        .from("ocr_records")
        .select("*");


    if(error){
        return "OCR data not found.";
    }


    let title =
    currentLanguage === "bisaya"
    ? "📄 Mga Rekord sa OCR"
    : currentLanguage === "tagalog"
    ? "📄 Mga Rekord ng OCR"
    : "📄 OCR Records";


    return `
${title}

Total Records:
${data.length}
`;

}
        
if(
    msg.includes("what is ocr") ||
    msg.includes("what does ocr mean") ||
    msg.includes("explain ocr") ||
    msg.includes("define ocr")
){
    return null;
}

   } catch (err) {
        console.log("Chat error:", err.message);
        return "System error occurred while fetching data.";
    }

    return null;

}

// -------------------------
// SAVE CHAT (FIXED)
// -------------------------
async function saveChat(question, answer) {
    try {
        const { error } = await supabaseClient
            .from("chatbot")
            .insert([{
                question,
                answer,
                language: currentLanguage
            }]);

        if (error) {
            console.log("Chat save error:", error.message);
        }

    } catch (err) {
        console.log("Chat save failed:", err.message);
    }
}

// INIT
loadChatbotData();