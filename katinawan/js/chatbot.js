let chatbotData = [];
let currentLanguage = 'english';

async function loadChatbotData() {
    const response = await fetch("../data/chatbot.json");
    chatbotData = await response.json();
}

function setLanguage(lang) {
    currentLanguage = lang;

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelector(`.lang-btn[onclick*="${lang}"]`).classList.add('active');
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text) return;

    addMessage('user', text);
    input.value = '';

    const reply = getReply(text);
    addMessage('bot', reply);
}

function askQuestion(question) {
    document.getElementById('chatInput').value = question;
    sendMessage();
}

function addMessage(sender, text) {
    const container = document.getElementById('chatMessages');

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', sender);
    msgDiv.innerText = text;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function getReply(text) {
    text = text.toLowerCase();

    for (let item of chatbotData) {
        for (let keyword of item.keywords) {
            if (text.includes(keyword.toLowerCase())) {
                return item[currentLanguage] || item['english'];
            }
        }
    }

    return currentLanguage === 'english'
        ? "Sorry, I don't have an answer for that."
        : currentLanguage === 'tagalog'
        ? "Paumanhin, wala akong sagot para diyan."
        : "Pasensya, wala koy tubag ani.";
}

loadChatbotData();