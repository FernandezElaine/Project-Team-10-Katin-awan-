let chatbotData = [];
let currentLanguage = 'english';

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
function setLanguage(lang) {
    currentLanguage = lang;

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`.lang-btn[onclick*="${lang}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// -------------------------
// SEND MESSAGE (FIXED)
// -------------------------
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text) return;

    addMessage('user', text);
    input.value = '';

    const reply = await getReply(text);

    addMessage('bot', reply);

    saveChat(text, reply);
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

// -------------------------
// 🧠 CHATBOT AI ENGINE (FIXED + SMART)
// -------------------------
async function getReply(text) {
    const msg = text.toLowerCase();

    try {

        // =========================
        // 🏗 PROJECT ANALYTICS
        // =========================
        if (
            msg.includes("project") ||
            msg.includes("contractor") ||
            msg.includes("highest") ||
            msg.includes("status")
        ) {
            const { data, error } = await supabaseClient
                .from("projects")
                .select("status, contractor");

            if (error) return "Error fetching project data.";

            const total = data.length;
            const completed = data.filter(p => (p.status || "").toLowerCase() === "completed").length;
            const ongoing = data.filter(p => (p.status || "").toLowerCase() === "ongoing").length;

            // top contractor
            const map = {};
            data.forEach(p => {
                const c = (p.contractor || "Unassigned").trim();
                map[c] = (map[c] || 0) + 1;
            });

            const top = Object.entries(map).sort((a,b) => b[1]-a[1])[0];

            return `
🏗 PROJECT SUMMARY:
• Total: ${total}
• Completed: ${completed}
• Ongoing: ${ongoing}

🏆 Top Contractor: ${top ? top[0] : "None"}
            `;
        }

        // =========================
        // 💰 BUDGET
        // =========================
        if (msg.includes("budget")) {
            const { data, error } = await supabaseClient
                .from("budgets")
                .select("*");

            if (error) return "Budget data not found.";

            return `💰 Total budget records: ${data.length}`;
        }

        // =========================
        // 💸 EXPENSES
        // =========================
        if (msg.includes("expense")) {
            const { data, error } = await supabaseClient
                .from("expenses")
                .select("*");

            if (error) return "Expense data not found.";

            return `💸 Total expenses: ${data.length}`;
        }

        // =========================
        // 📢 FEEDBACK
        // =========================
        if (msg.includes("feedback")) {
            const { data, error } = await supabaseClient
                .from("feedback")
                .select("status");

            if (error) return "Feedback data not found.";

            const pending = data.filter(f =>
                (f.status || "").toLowerCase() === "pending"
            ).length;

            return `📢 Pending feedback: ${pending}`;
        }

        // =========================
        // 📄 OCR FIX (IMPORTANT FIX)
        // =========================
        if (msg.includes("ocr") || msg.includes("document")) {
            const { data, error } = await supabaseClient
                .from("ocr_records")   // ✅ FIXED NAME HERE
                .select("*");

            if (error) return "OCR data not found.";

            return `📄 OCR records: ${data.length}`;
        }

    } catch (err) {
        console.log("Chat error:", err.message);
        return "System error occurred while fetching data.";
    }

    // =========================
    // DEFAULT RESPONSE
    // =========================
    return currentLanguage === "english"
        ? "I can help you with projects, budget, expenses, feedback, and documents."
        : currentLanguage === "tagalog"
        ? "Maaari kitang tulungan sa projects, budget, expenses, feedback, at documents."
        : "Makatabang ko nimo sa projects, budget, expenses, feedback.";
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