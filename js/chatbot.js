console.log("KATIN-AWAN CHATBOT JS LOADED");

/* =========================================================
   GLOBAL STATE
   ========================================================= */

let chatbotData = [];

let currentLanguage = "english";

let currentConversationId = null;

let currentConversationTitle = "New Conversation";

let isLoadingConversation = false;

let adminRealtimeChannel = null;

let adminReplyPollingTimer = null;

let adminHistoryRefreshTimer = null;


/* =========================================================
   CONVERSATION ID
   ========================================================= */

function createConversationId() {

    currentConversationId = crypto.randomUUID();

    console.log(
        "Created new conversation:",
        currentConversationId
    );

    return currentConversationId;
}


function ensureConversationId() {

    if (!currentConversationId) {

        createConversationId();

    }

}


/* =========================================================
   LOAD CHATBOT JSON
   ========================================================= */

async function loadChatbotData() {

    try {

        const response =
            await fetch("../data/chatbot.json");

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        chatbotData =
            await response.json();

        console.log(
            "Chatbot JSON loaded."
        );

    } catch (error) {

        console.warn(
            "Chatbot JSON not loaded:",
            error.message
        );

        chatbotData = [];

    }

}


/* =========================================================
   LANGUAGE DETECTION
   ========================================================= */

function detectLanguage(text) {

    const message =
        String(text || "")
            .toLowerCase()
            .replace(
                /[.,!?;:()[\]{}"]/g,
                " "
            );

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
            (score, word) =>
                score +
                (
                    words.has(word)
                        ? 1
                        : 0
                ),
            0
        );

    const tagalogScore =
        tagalogIndicators.reduce(
            (score, word) =>
                score +
                (
                    words.has(word)
                        ? 1
                        : 0
                ),
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


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    const input =
        document.getElementById(
            "chatInput"
        );

    if (!input) {

        console.error(
            "chatInput not found."
        );

        return;

    }

    const text =
        input.value.trim();

    if (!text) {

        return;

    }

    ensureConversationId();

    currentLanguage =
        detectLanguage(text);

    console.log(
        "Detected language:",
        currentLanguage
    );

    addMessage(
        "user",
        text
    );

    input.value = "";

    if (
        currentConversationTitle ===
        "New Conversation"
    ) {

        currentConversationTitle =
            createConversationTitle(text);

        updateConversationTitle();

    }

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    const loading =
        document.createElement(
            "div"
        );

    loading.className =
        "chat-message bot thinking";

    loading.innerText =
        "🤖 Thinking...";

    container.appendChild(
        loading
    );

    scrollChatToBottom();

    let reply;

    try {

        reply =
            await getReply(text);

        if (!reply) {

            reply =
                await askAI(text);

        }

    } catch (error) {

        console.error(
            "Reply error:",
            error
        );

        reply =
            getLocalizedMessage(
                "ai_unavailable"
            );

    }

    await typeMessage(
        loading,
        reply
    );

    await saveChat(
        text,
        reply
    );

    if (
        needsAdminReview(reply)
    ) {

        await saveInquiry(
            text,
            reply
        );

    }

    await loadConversationHistoryList();

}


/* =========================================================
   ASK AI API
   ========================================================= */

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

                        message: message,

                        language:
                            currentLanguage

                    })

                }
            );

        const data =
            await response.json();

        console.log(
            "AI RESPONSE:",
            data
        );

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


/* =========================================================
   ADMIN REVIEW DETECTION
   ========================================================= */

function needsAdminReview(reply) {

    if (!reply) {

        return false;

    }

    const text =
        String(reply).toLowerCase();

    return (

        text.includes(
            "confidence: low"
        ) ||

        text.includes(
            "i do not have access"
        ) ||

        text.includes(
            "i don't have access"
        ) ||

        text.includes(
            "cannot access"
        ) ||

        text.includes(
            "please check"
        ) ||

        text.includes(
            "consult your local barangay hall"
        )

    );

}


/* =========================================================
   SAVE ADMIN INQUIRY
   ========================================================= */

async function saveInquiry(
    question,
    aiResponse
) {

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();

        if (!user) {

            console.log(
                "Guest user - inquiry not saved."
            );

            return;

        }

        ensureConversationId();

        const {
            error
        } =
            await supabaseClient
                .from("chat_inquiries")
                .insert([{

                    user_id:
                        user.id,

                    conversation_id:
                        currentConversationId,

                    question:
                        question,

                    ai_response:
                        aiResponse,

                    status:
                        "pending"

                }]);

        if (error) {

            console.error(
                "Inquiry save error:",
                error
            );

            return;

        }

        console.log(
            "Inquiry sent to administrator."
        );

    } catch (error) {

        console.error(
            "Inquiry save failed:",
            error
        );

    }

}


/* =========================================================
   LOCALIZED MESSAGES
   ========================================================= */

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


/* =========================================================
   SUGGESTED QUESTIONS
   ========================================================= */

function askQuestion(question) {

    const input =
        document.getElementById(
            "chatInput"
        );

    if (!input) {

        return;

    }

    input.value =
        question;

    sendMessage();

}


/* =========================================================
   ADD MESSAGE
   ========================================================= */

function addMessage(
    sender,
    text
) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    const message =
        document.createElement(
            "div"
        );

    message.classList.add(
        "chat-message",
        sender
    );

    message.textContent =
        text;

    container.appendChild(
        message
    );

    scrollChatToBottom();

}


/* =========================================================
   ADD MESSAGE WITHOUT SCROLL
   ========================================================= */

function addMessageWithoutScroll(
    sender,
    text
) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    const message =
        document.createElement(
            "div"
        );

    message.classList.add(
        "chat-message",
        sender
    );

    message.textContent =
        text;

    container.appendChild(
        message
    );

}


/* =========================================================
   TYPE MESSAGE
   ========================================================= */

async function typeMessage(
    element,
    text
) {

    element.textContent = "";

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        element.textContent +=
            text[i];

        if (
            i % 2 === 0
        ) {

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        8
                    )
            );

        }

    }

    scrollChatToBottom();

}


/* =========================================================
   SCROLL CHAT
   ========================================================= */

function scrollChatToBottom() {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    setTimeout(
        () => {

            container.scrollTop =
                container.scrollHeight;

        },
        20
    );

}


/* =========================================================
   CREATE CONVERSATION TITLE
   ========================================================= */

function createConversationTitle(
    question
) {

    let title =
        String(question || "")
            .trim()
            .replace(/\s+/g, " ");

    if (!title) {

        return "New Conversation";

    }

    if (
        title.length > 38
    ) {

        title =
            title.substring(
                0,
                38
            ) + "...";

    }

    return title;

}


/* =========================================================
   UPDATE CONVERSATION TITLE
   ========================================================= */

function updateConversationTitle() {

    const elements =
        document.querySelectorAll(
            ".conversation-title, .chat-title, .current-conversation-title, #currentConversationTitle"
        );

    elements.forEach(
        element => {

            element.textContent =
                currentConversationTitle;

        }
    );

}


/* =========================================================
   CLEAR CURRENT CHAT
   ========================================================= */

function clearCurrentChat() {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    container.innerHTML = "";

    const welcome =
        document.createElement(
            "div"
        );

    welcome.className =
        "new-conversation-message";

    welcome.textContent =
        "Start a new conversation by asking a question.";

    container.appendChild(
        welcome
    );

}


/* =========================================================
   START NEW CHAT
   ========================================================= */

function startNewChat() {

    console.log(
        "Starting new chat..."
    );

    currentConversationId =
        null;

    currentConversationTitle =
        "New Conversation";

    createConversationId();

    clearCurrentChat();

    updateConversationTitle();

    updateActiveHistoryItem(
        null
    );

    const input =
        document.getElementById(
            "chatInput"
        );

    if (input) {

        input.value = "";

        input.focus();

    }

    console.log(
        "New conversation created:",
        currentConversationId
    );

}


/* =========================================================
   SAVE CHAT
   ========================================================= */

async function saveChat(
    question,
    answer
) {

    try {

        ensureConversationId();

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient
                .auth
                .getUser();

        if (userError) {

            console.error(
                "Unable to get logged-in user:",
                userError
            );

            return;

        }

        if (!user) {

            console.log(
                "Guest user - chat history not saved."
            );

            return;

        }

        const {
            error
        } =
            await supabaseClient
                .from("chatbot")
                .insert([{

                    user_id:
                        user.id,

                    conversation_id:
                        currentConversationId,

                    question:
                        question,

                    answer:
                        answer,

                    language:
                        currentLanguage

                }]);

        if (error) {

            console.error(
                "Chat history save error:",
                error
            );

            return;

        }

        console.log(
            "Chat saved:",
            currentConversationId
        );

    } catch (error) {

        console.error(
            "Chat history save failed:",
            error
        );

    }

}


/* =========================================================
   HISTORY ELEMENT
   ========================================================= */

function getHistoryListElement() {

    return (
        document.getElementById(
            "chatHistoryList"
        ) ||

        document.querySelector(
            ".chat-history-list"
        )
    );

}


/* =========================================================
   FORMAT HISTORY DATE
   ========================================================= */

function formatHistoryDate(
    date
) {

    if (!date) {

        return "";

    }

    const value =
        new Date(date);

    if (
        Number.isNaN(
            value.getTime()
        )
    ) {

        return "";

    }

    const now =
        new Date();

    if (
        value.toDateString() ===
        now.toDateString()
    ) {

        return value.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }

    return value.toLocaleDateString(
        [],
        {
            month: "short",
            day: "numeric"
        }
    );

}


/* =========================================================
   UPDATE ACTIVE HISTORY
   ========================================================= */

function updateActiveHistoryItem(
    conversationId
) {

    const items =
        document.querySelectorAll(
            ".chat-history-item"
        );

    items.forEach(
        item => {

            item.classList.toggle(
                "active",
                item.dataset.conversationId ===
                    conversationId
            );

        }
    );

}


/* =========================================================
   CHAT HISTORY UI SETTINGS
   ========================================================= */

function getHistorySettings() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "katinAwanHistorySettings"
            )
        ) || {};

    } catch (error) {

        console.warn(
            "Could not load history settings:",
            error
        );

        return {};

    }

}


function saveHistorySettings(
    settings
) {

    try {

        localStorage.setItem(
            "katinAwanHistorySettings",
            JSON.stringify(settings)
        );

    } catch (error) {

        console.warn(
            "Could not save history settings:",
            error
        );

    }

}


function getConversationSettings(
    conversationId
) {

    const settings =
        getHistorySettings();

    return (
        settings[conversationId] || {
            title: null,
            pinned: false
        }
    );

}


/* =========================================================
   RENAME CONVERSATION
   ========================================================= */

function renameConversation(
    conversationId,
    currentTitle
) {

    if (!conversationId) {

        return;

    }

    const newTitle =
        window.prompt(
            "Rename conversation:",
            currentTitle
        );

    if (
        newTitle === null
    ) {

        return;

    }

    const cleanTitle =
        newTitle
            .trim()
            .replace(/\s+/g, " ");

    if (!cleanTitle) {

        alert(
            "Conversation name cannot be empty."
        );

        return;

    }

    const settings =
        getHistorySettings();

    settings[conversationId] = {

        ...(settings[conversationId] || {}),

        title:
            cleanTitle

    };

    saveHistorySettings(
        settings
    );

    if (
        currentConversationId ===
        conversationId
    ) {

        currentConversationTitle =
            cleanTitle;

        updateConversationTitle();

    }

    loadConversationHistoryList();

}


/* =========================================================
   PIN / UNPIN CONVERSATION
   ========================================================= */

function togglePinConversation(
    conversationId
) {

    if (!conversationId) {

        return;

    }

    const settings =
        getHistorySettings();

    const current =
        settings[conversationId] || {};

    settings[conversationId] = {

        ...current,

        pinned:
            !current.pinned

    };

    saveHistorySettings(
        settings
    );

    loadConversationHistoryList();

}


/* =========================================================
   CLOSE HISTORY MENUS
   ========================================================= */

function closeHistoryMenus() {

    document
        .querySelectorAll(
            ".chat-history-menu.show"
        )
        .forEach(
            menu => {

                menu.classList.remove(
                    "show"
                );

            }
        );

    document
        .querySelectorAll(
            ".chat-history-menu-btn.open"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "open"
                );

            }
        );

}


/* =========================================================
   LOAD CONVERSATION HISTORY
   ========================================================= */

async function loadConversationHistoryList() {

    const historyList =
        getHistoryListElement();

    if (!historyList) {

        console.warn(
            "Chat history list element not found."
        );

        return;

    }

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();

        if (!user) {

            historyList.innerHTML = `
                <div class="chat-history-empty">
                    Log in to see your chat history.
                </div>
            `;

            return;

        }


        /* =================================================
           GET CHAT RECORDS
           ================================================= */

        const {
            data: chatRows,
            error: chatError
        } =
            await supabaseClient
                .from("chatbot")
                .select(`
                    id,
                    question,
                    answer,
                    created_at,
                    conversation_id
                `)
                .eq(
                    "user_id",
                    user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (chatError) {

            console.error(
                "Conversation history error:",
                chatError
            );

            historyList.innerHTML = `
                <div class="chat-history-empty">
                    Unable to load chat history.
                </div>
            `;

            return;

        }


        /* =================================================
           GET ADMIN INQUIRIES
           ================================================= */

        const {
            data: inquiryRows,
            error: inquiryError
        } =
            await supabaseClient
                .from("chat_inquiries")
                .select(`
                    id,
                    conversation_id,
                    status,
                    admin_reply,
                    replied_at
                `)
                .eq(
                    "user_id",
                    user.id
                );


        if (inquiryError) {

            console.warn(
                "Inquiry history error:",
                inquiryError
            );

        }


        /* =================================================
           ADMIN STATUS SETS
           ================================================= */

        const answeredConversations =
            new Set();

        const pendingConversations =
            new Set();


        (
            inquiryRows || []
        ).forEach(
            inquiry => {

                if (
                    !inquiry.conversation_id
                ) {

                    return;

                }


                if (
                    inquiry.status ===
                        "answered" &&
                    inquiry.admin_reply
                ) {

                    answeredConversations.add(
                        inquiry.conversation_id
                    );

                }


                if (
                    inquiry.status ===
                    "pending"
                ) {

                    pendingConversations.add(
                        inquiry.conversation_id
                    );

                }

            }
        );


        /* =================================================
           BUILD CONVERSATIONS
           ================================================= */

        const conversations =
            new Map();


        (
            chatRows || []
        ).forEach(
            row => {

                /*
                   IMPORTANT:

                   Older chatbot records may not have
                   conversation_id.

                   We still show them in history by
                   giving each old record a temporary
                   local identifier.
                */

                const conversationId =
                    row.conversation_id ||
                    `legacy-${row.id}`;


                if (
                    !conversations.has(
                        conversationId
                    )
                ) {

                    const settings =
                        getConversationSettings(
                            conversationId
                        );


                    const defaultTitle =
                        createConversationTitle(
                            row.question
                        );


                    conversations.set(
                        conversationId,
                        {

                            id:
                                conversationId,

                            originalRowId:
                                row.id,

                            title:
                                settings.title ||
                                defaultTitle,

                            created_at:
                                row.created_at,

                            pinned:
                                settings.pinned ===
                                true,

                            hasAdminReply:
                                row.conversation_id
                                    ? answeredConversations.has(
                                        row.conversation_id
                                    )
                                    : false,

                            pending:
                                row.conversation_id
                                    ? pendingConversations.has(
                                        row.conversation_id
                                    )
                                    : false,

                            legacy:
                                !row.conversation_id

                        }
                    );

                }

            }
        );


        /* =================================================
           SORT PINNED FIRST
           ================================================= */

        const sortedConversations =
            Array.from(
                conversations.values()
            ).sort(
                (
                    a,
                    b
                ) => {

                    if (
                        a.pinned !==
                        b.pinned
                    ) {

                        return a.pinned
                            ? -1
                            : 1;

                    }


                    return (
                        new Date(
                            b.created_at
                        ) -
                        new Date(
                            a.created_at
                        )
                    );

                }
            );


        /* =================================================
           CLEAR HISTORY
           ================================================= */

        historyList.innerHTML = "";


        if (
            sortedConversations.length ===
            0
        ) {

            historyList.innerHTML = `
                <div class="chat-history-empty">
                    No previous conversations.
                </div>
            `;

            return;

        }


        /* =================================================
           CREATE HISTORY ITEMS
           ================================================= */

        sortedConversations.forEach(
            conversation => {

                const wrapper =
                    document.createElement(
                        "div"
                    );

                wrapper.className =
                    "chat-history-item-wrapper";


                /* =================================================
                   MAIN HISTORY BUTTON
                   ================================================= */

                const historyButton =
                    document.createElement(
                        "button"
                    );

                historyButton.type =
                    "button";

                historyButton.className =
                    "chat-history-item";

                historyButton.dataset.conversationId =
                    conversation.id;


                /* =================================================
                   INFO
                   ================================================= */

                const info =
                    document.createElement(
                        "div"
                    );

                info.style.display =
                    "flex";

                info.style.flexDirection =
                    "column";

                info.style.alignItems =
                    "flex-start";

                info.style.gap =
                    "2px";


                /* =================================================
                   TITLE
                   ================================================= */

                const title =
                    document.createElement(
                        "span"
                    );

                title.className =
                    "chat-history-item-title";

                title.textContent =
                    conversation.title;


                if (
                    conversation.pinned
                ) {

                    const pin =
                        document.createElement(
                            "span"
                        );

                    pin.className =
                        "chat-history-pin";

                    pin.textContent =
                        "📌";

                    title.appendChild(
                        pin
                    );

                }


                /* =================================================
                   DATE
                   ================================================= */

                const date =
                    document.createElement(
                        "span"
                    );

                date.className =
                    "chat-history-item-date";

                date.textContent =
                    formatHistoryDate(
                        conversation.created_at
                    );


                info.appendChild(
                    title
                );

                info.appendChild(
                    date
                );


                /* =================================================
                   ADMIN BADGES
                   ================================================= */

                if (
                    conversation.hasAdminReply
                ) {

                    const badge =
                        document.createElement(
                            "span"
                        );

                    badge.className =
                        "chat-history-admin-badge";

                    badge.textContent =
                        "Admin replied";

                    badge.title =
                        "The barangay administrator has replied to this conversation.";

                    badge.style.background =
                        "#dcfce7";

                    badge.style.color =
                        "#166534";

                    info.appendChild(
                        badge
                    );

                } else if (
                    conversation.pending
                ) {

                    const badge =
                        document.createElement(
                            "span"
                        );

                    badge.className =
                        "chat-history-pending-badge";

                    badge.textContent =
                        "Waiting for admin";

                    badge.title =
                        "This conversation is waiting for an administrator reply.";

                    badge.style.background =
                        "#fef3c7";

                    badge.style.color =
                        "#92400e";

                    info.appendChild(
                        badge
                    );

                }


                historyButton.appendChild(
                    info
                );


                /* =================================================
                   OPEN CONVERSATION
                   ================================================= */

                historyButton.addEventListener(
                    "click",
                    () => {

                        closeHistoryMenus();

                        loadConversation(
                            conversation.id
                        );

                    }
                );


                /* =================================================
                   THREE DOT BUTTON
                   ================================================= */

                const menuButton =
                    document.createElement(
                        "button"
                    );

                menuButton.type =
                    "button";

                menuButton.className =
                    "chat-history-menu-btn";

                menuButton.textContent =
                    "⋮";

                menuButton.title =
                    "Conversation options";

                menuButton.setAttribute(
                    "aria-label",
                    "Conversation options"
                );


                menuButton.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();


                        const menu =
                            wrapper.querySelector(
                                ".chat-history-menu"
                            );


                        const wasOpen =
                            menu.classList.contains(
                                "show"
                            );


                        closeHistoryMenus();


                        if (
                            !wasOpen
                        ) {

                            menu.classList.add(
                                "show"
                            );

                            menuButton.classList.add(
                                "open"
                            );

                        }

                    }
                );


                /* =================================================
                   DROPDOWN MENU
                   ================================================= */

                const menu =
                    document.createElement(
                        "div"
                    );

                menu.className =
                    "chat-history-menu";


                /* =================================================
                   RENAME
                   ================================================= */

                const renameButton =
                    document.createElement(
                        "button"
                    );

                renameButton.type =
                    "button";

                renameButton.innerHTML =
                    "✏️ Rename";


                renameButton.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        closeHistoryMenus();

                        renameConversation(
                            conversation.id,
                            conversation.title
                        );

                    }
                );


                /* =================================================
                   PIN
                   ================================================= */

                const pinButton =
                    document.createElement(
                        "button"
                    );

                pinButton.type =
                    "button";

                pinButton.innerHTML =
                    conversation.pinned
                        ? "📌 Unpin"
                        : "📌 Pin";


                pinButton.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        closeHistoryMenus();

                        togglePinConversation(
                            conversation.id
                        );

                    }
                );


                /* =================================================
                   DELETE
                   ================================================= */

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.type =
                    "button";

                deleteButton.className =
                    "delete-option";

                deleteButton.innerHTML =
                    "🗑️ Delete";


                deleteButton.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();

                        event.stopPropagation();

                        closeHistoryMenus();

                        await deleteConversation(
                            conversation.id
                        );

                    }
                );


                menu.appendChild(
                    renameButton
                );

                menu.appendChild(
                    pinButton
                );

                menu.appendChild(
                    deleteButton
                );


                /* =================================================
                   ADD EVERYTHING
                   ================================================= */

                wrapper.appendChild(
                    historyButton
                );

                wrapper.appendChild(
                    menuButton
                );

                wrapper.appendChild(
                    menu
                );

                historyList.appendChild(
                    wrapper
                );

            }
        );


        updateActiveHistoryItem(
            currentConversationId
        );


        console.log(
            "Conversation history loaded:",
            sortedConversations.length
        );


    } catch (error) {

        console.error(
            "Failed to load conversation history:",
            error
        );

    }

}


/* =========================================================
   CLOSE HISTORY MENUS WHEN CLICKING OUTSIDE
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".chat-history-item-wrapper"
            )
        ) {

            closeHistoryMenus();

        }

    }
);


/* =========================================================
   DELETE CONVERSATION
   ========================================================= */

async function deleteConversation(
    conversationId
) {

    if (!conversationId) {

        return;

    }


    const confirmed =
        window.confirm(
            "Delete this conversation?\n\nThis will permanently delete the chat messages and its admin inquiry."
        );

    if (!confirmed) {

        return;

    }


    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();


        if (!user) {

            alert(
                "Please log in to delete your conversation."
            );

            return;

        }


        console.log(
            "Deleting conversation:",
            conversationId
        );


        const isLegacyConversation =
            String(
                conversationId
            ).startsWith(
                "legacy-"
            );


        if (
            isLegacyConversation
        ) {

            const legacyRowId =
                String(
                    conversationId
                ).replace(
                    "legacy-",
                    ""
                );


            const {
                error
            } =
                await supabaseClient
                    .from("chatbot")
                    .delete()
                    .eq(
                        "user_id",
                        user.id
                    )
                    .eq(
                        "id",
                        legacyRowId
                    );


            if (error) {

                console.error(
                    "Legacy chat delete error:",
                    error
                );

                alert(
                    "Could not delete the old chat history.\n\nCheck your Supabase DELETE policy for chatbot."
                );

                return;

            }

        } else {

            const {
                error: inquiryDeleteError
            } =
                await supabaseClient
                    .from("chat_inquiries")
                    .delete()
                    .eq(
                        "user_id",
                        user.id
                    )
                    .eq(
                        "conversation_id",
                        conversationId
                    );


            if (inquiryDeleteError) {

                console.error(
                    "Inquiry delete error:",
                    inquiryDeleteError
                );

                alert(
                    "Could not delete the admin inquiry.\n\nCheck your Supabase DELETE policy for chat_inquiries."
                );

                return;

            }


            const {
                error: chatDeleteError
            } =
                await supabaseClient
                    .from("chatbot")
                    .delete()
                    .eq(
                        "user_id",
                        user.id
                    )
                    .eq(
                        "conversation_id",
                        conversationId
                    );


            if (chatDeleteError) {

                console.error(
                    "Chat delete error:",
                    chatDeleteError
                );

                alert(
                    "Could not delete the chat history.\n\nCheck your Supabase DELETE policy for chatbot."
                );

                return;

            }

        }


        const settings =
            getHistorySettings();


        delete settings[
            conversationId
        ];


        saveHistorySettings(
            settings
        );


        if (
            currentConversationId ===
            conversationId
        ) {

            currentConversationId =
                null;

            currentConversationTitle =
                "New Conversation";

            createConversationId();

            clearCurrentChat();

            updateConversationTitle();

            updateActiveHistoryItem(
                null
            );

        }


        await loadConversationHistoryList();


        console.log(
            "Conversation deleted successfully."
        );


    } catch (error) {

        console.error(
            "Conversation deletion failed:",
            error
        );

        alert(
            "Something went wrong while deleting the conversation."
        );

    }

}


/* =========================================================
   LOAD ONE CONVERSATION
   ========================================================= */

async function loadConversation(
    conversationId
) {

    if (
        !conversationId ||
        isLoadingConversation
    ) {

        return;

    }


    isLoadingConversation =
        true;

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();


        if (!user) {

            return;

        }


        console.log(
            "Loading conversation:",
            conversationId
        );


        const isLegacyConversation =
            String(
                conversationId
            ).startsWith(
                "legacy-"
            );


        let query =
            supabaseClient
                .from("chatbot")
                .select(`
                    id,
                    question,
                    answer,
                    language,
                    created_at,
                    conversation_id
                `)
                .eq(
                    "user_id",
                    user.id
                );


        if (
            isLegacyConversation
        ) {

            const legacyRowId =
                String(
                    conversationId
                ).replace(
                    "legacy-",
                    ""
                );


            query =
                query.eq(
                    "id",
                    legacyRowId
                );

        } else {

            query =
                query.eq(
                    "conversation_id",
                    conversationId
                );

        }


        const {
            data,
            error
        } =
            await query.order(
                "created_at",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "Conversation loading error:",
                error
            );

            return;

        }


        currentConversationId =
            conversationId;


        if (
            data &&
            data.length > 0
        ) {

            const settings =
                getConversationSettings(
                    conversationId
                );


            currentConversationTitle =
                settings.title ||
                createConversationTitle(
                    data[0].question
                );

        } else {

            currentConversationTitle =
                "New Conversation";

        }


        const container =
            document.getElementById(
                "chatMessages"
            );

        if (!container) {

            return;

        }


        container.innerHTML = "";


        (
            data ||
            []
        ).forEach(
            item => {

                addMessageWithoutScroll(
                    "user",
                    item.question
                );

                if (
                    item.answer &&
                    item.answer.trim()
                ) {

                    addMessageWithoutScroll(
                        "bot",
                        item.answer
                    );

                }

            }
        );


        if (
            !data ||
            data.length === 0
        ) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "new-conversation-message";

            empty.textContent =
                "This conversation is empty.";

            container.appendChild(
                empty
            );

        }


        updateConversationTitle();

        updateActiveHistoryItem(
            conversationId
        );


        if (
            !isLegacyConversation
        ) {

            await loadAdminRepliesForConversation(
                conversationId
            );

        }


        scrollChatToBottom();


        console.log(
            "Conversation loaded:",
            conversationId
        );


    } catch (error) {

        console.error(
            "Load conversation failed:",
            error
        );

    } finally {

        isLoadingConversation =
            false;

    }

}


/* =========================================================
   LOAD ADMIN REPLIES FOR ONE CONVERSATION
   ========================================================= */

async function loadAdminRepliesForConversation(
    conversationId
) {

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();


        if (!user) {

            return;

        }


        const {
            data,
            error
        } =
            await supabaseClient
                .from("chat_inquiries")
                .select(`
                    id,
                    question,
                    admin_reply,
                    status,
                    replied_at,
                    conversation_id
                `)
                .eq(
                    "user_id",
                    user.id
                )
                .eq(
                    "conversation_id",
                    conversationId
                )
                .eq(
                    "status",
                    "answered"
                )
                .not(
                    "admin_reply",
                    "is",
                    null
                )
                .order(
                    "replied_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "Admin reply history error:",
                error
            );

            return;

        }


        (
            data ||
            []
        ).forEach(
            inquiry => {

                appendAdminReply(
                    inquiry
                );

            }
        );


    } catch (error) {

        console.error(
            "Failed to load admin replies:",
            error
        );

    }

}


/* =========================================================
   DISPLAY / UPDATE ADMIN REPLY
   ========================================================= */

function appendAdminReply(
    inquiry
) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container) {

        return;

    }

    if (
        !inquiry ||
        !inquiry.id ||
        !inquiry.admin_reply
    ) {

        return;

    }


    const existing =
        container.querySelector(
            `[data-admin-inquiry-id="${inquiry.id}"]`
        );


    if (existing) {

        existing.textContent =
            "📢 Barangay Admin:\n\n" +
            inquiry.admin_reply;

        existing.dataset.repliedAt =
            inquiry.replied_at ||
            "";

        return;

    }


    const adminMessage =
        document.createElement(
            "div"
        );

    adminMessage.className =
        "chat-message bot admin-reply-message";

    adminMessage.dataset.adminInquiryId =
        inquiry.id;

    adminMessage.dataset.repliedAt =
        inquiry.replied_at ||
        "";

    adminMessage.textContent =
        "📢 Barangay Admin:\n\n" +
        inquiry.admin_reply;

    container.appendChild(
        adminMessage
    );

    scrollChatToBottom();

}


/* =========================================================
   REMOVE ADMIN REPLY FROM SCREEN
   ========================================================= */

function removeAdminReply(
    inquiryId
) {

    if (!inquiryId) {

        return;

    }

    const element =
        document.querySelector(
            `[data-admin-inquiry-id="${inquiryId}"]`
        );

    if (element) {

        element.remove();

    }

}


/* =========================================================
   CHECK ADMIN REPLIES
   ========================================================= */

async function checkAdminReplies(
    userId
) {

    if (!userId) {

        return;

    }

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("chat_inquiries")
                .select(`
                    id,
                    question,
                    admin_reply,
                    status,
                    replied_at,
                    conversation_id
                `)
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "replied_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "Admin reply check error:",
                error
            );

            return;

        }


        const answered =
            (
                data ||
                []
            ).filter(
                inquiry =>
                    inquiry.status ===
                    "answered" &&
                    inquiry.admin_reply
            );


        if (
            currentConversationId
        ) {

            answered
                .filter(
                    inquiry =>
                        inquiry.conversation_id ===
                        currentConversationId
                )
                .forEach(
                    inquiry => {

                        appendAdminReply(
                            inquiry
                        );

                    }
                );

        }


        await loadConversationHistoryList();


    } catch (error) {

        console.error(
            "Admin reply check failed:",
            error
        );

    }

}


/* =========================================================
   REALTIME ADMIN REPLIES
   ========================================================= */

async function listenForAdminReplies() {

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient
                .auth
                .getUser();


        if (!user) {

            console.log(
                "No logged-in resident. Realtime disabled."
            );

            return;

        }


        if (
            adminRealtimeChannel
        ) {

            try {

                await supabaseClient
                    .removeChannel(
                        adminRealtimeChannel
                    );

            } catch (error) {

                console.warn(
                    "Could not remove old realtime channel:",
                    error
                );

            }

        }


        console.log(
            "Listening for admin replies..."
        );


        adminRealtimeChannel =
            supabaseClient
                .channel(
                    "resident-admin-replies-" +
                    user.id +
                    "-" +
                    Date.now()
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_inquiries",
                        filter:
                            `user_id=eq.${user.id}`
                    },
                    async payload => {

                        console.log(
                            "REALTIME INQUIRY CHANGE:",
                            payload
                        );


                        const inquiry =
                            payload.new ||
                            payload.old ||
                            {};


                        if (
                            payload.eventType ===
                            "DELETE"
                        ) {

                            removeAdminReply(
                                inquiry.id
                            );

                            await loadConversationHistoryList();

                            return;

                        }


                        if (
                            !inquiry.id
                        ) {

                            return;

                        }


                        if (
                            inquiry.status ===
                                "answered" &&
                            inquiry.admin_reply
                        ) {

                            if (
                                inquiry.conversation_id ===
                                currentConversationId
                            ) {

                                appendAdminReply(
                                    inquiry
                                );

                            }

                            await loadConversationHistoryList();

                        }

                    }
                )
                .subscribe(
                    status => {

                        console.log(
                            "Realtime subscription:",
                            status
                        );

                    }
                );


        startAdminReplyPolling(
            user.id
        );


    } catch (error) {

        console.error(
            "Realtime listener error:",
            error
        );


        try {

            const {
                data: {
                    user
                }
            } =
                await supabaseClient
                    .auth
                    .getUser();


            if (user) {

                startAdminReplyPolling(
                    user.id
                );

            }

        } catch (fallbackError) {

            console.error(
                "Fallback setup failed:",
                fallbackError
            );

        }

    }

}


/* =========================================================
   BACKUP POLLING
   ========================================================= */

function startAdminReplyPolling(
    userId
) {

    if (!userId) {

        return;

    }


    if (
        adminReplyPollingTimer
    ) {

        clearInterval(
            adminReplyPollingTimer
        );

    }


    if (
        adminHistoryRefreshTimer
    ) {

        clearInterval(
            adminHistoryRefreshTimer
        );

    }


    /*
       Check the current conversation
       every 2 seconds.
    */

    adminReplyPollingTimer =
        setInterval(
            async () => {

                if (
                    !currentConversationId ||
                    isLoadingConversation
                ) {

                    return;

                }

                await checkAdminReplies(
                    userId
                );

            },
            2000
        );


    /*
       Refresh history every 5 seconds.
    */

    adminHistoryRefreshTimer =
        setInterval(
            async () => {

                await loadConversationHistoryList();

            },
            5000
        );

}


/* =========================================================
   DATABASE CHATBOT ANSWERS
   ========================================================= */

async function getReply(
    text
) {

    const msg =
        String(text || "")
            .toLowerCase()
            .trim();


    const isOnlyGreeting =
        /^(hi|hello|hey|musta|kumusta)[\s!.?]*$/i
            .test(msg);


    if (
        isOnlyGreeting
    ) {

        if (
            currentLanguage ===
            "bisaya"
        ) {

            return (
                "Kumusta! Maayong adlaw. " +
                "Ako si Katin-awan AI Assistant. " +
                "Unsa akong matabang nimo karon?"
            );

        }

        if (
            currentLanguage ===
            "tagalog"
        ) {

            return (
                "Kumusta! Ako ang Katin-awan AI Assistant. " +
                "Paano kita matutulungan ngayon?"
            );

        }

        return (
            "Hello! I am Katin-awan AI Assistant. " +
            "How can I help you today?"
        );

    }


    try {


        /* =================================================
           PROJECTS
           ================================================= */

        if (

            msg.includes("project") ||
            msg.includes("projects") ||
            msg.includes("contractor") ||
            msg.includes("implementer") ||
            msg.includes("ongoing projects") ||
            msg.includes("completed projects") ||
            msg.includes("barangay project")

        ) {

            const {
                data,
                error
            } =
                await supabaseClient
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


            if (error) {

                return (
                    "I cannot access project information right now."
                );

            }


            const total =
                data.length;


            let completedText;
            let ongoingText;
            let totalText;


            if (
                currentLanguage ===
                "tagalog"
            ) {

                completedText =
                    "Nakumpletong mga proyekto";

                ongoingText =
                    "Mga kasalukuyang proyekto";

                totalText =
                    "Kabuuang proyekto";

            } else if (
                currentLanguage ===
                "bisaya"
            ) {

                completedText =
                    "Nahuman nga mga proyekto";

                ongoingText =
                    "Nagpadayon nga mga proyekto";

                totalText =
                    "Kinatibuk-ang proyekto";

            } else {

                completedText =
                    "Completed Projects";

                ongoingText =
                    "Ongoing Projects";

                totalText =
                    "Total Projects";

            }


            const completed =
                data.filter(
                    p =>
                        (
                            p.status ||
                            ""
                        )
                            .toLowerCase() ===
                        "completed"
                ).length;


            const ongoing =
                data.filter(
                    p =>
                        (
                            p.status ||
                            ""
                        )
                            .toLowerCase() ===
                        "ongoing"
                ).length;


            const contractors = [
                ...new Set(
                    data
                        .map(
                            p =>
                                p.contractor
                        )
                        .filter(
                            c =>
                                c &&
                                c !==
                                "Not specified"
                        )
                )
            ];


            const projectList =
                data
                    .slice(0, 5)
                    .map(
                        p =>
                            `📌 ${p.title}
Status: ${p.status}
Progress: ${p.progress ?? 0}%`
                    )
                    .join(
                        "\n\n"
                    );


            const title =
                currentLanguage ===
                "bisaya"
                    ?
                    "🏗️ Impormasyon sa mga Proyekto sa Barangay"
                    :
                currentLanguage ===
                "tagalog"
                    ?
                    "🏗️ Impormasyon ng mga Proyekto ng Barangay"
                    :
                    "🏗️ Barangay Project Information";


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

${projectList || "No projects found."}
`;

        }


        /* =================================================
           BUDGET
           ================================================= */

        if (
            msg.includes("budget")
        ) {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("projects")
                    .select(
                        "title,budget"
                    );


            if (error) {

                return (
                    "Budget information unavailable."
                );

            }


            let totalBudget =
                0;


            data.forEach(
                project => {

                    totalBudget +=
                        Number(
                            project.budget ||
                            0
                        );

                }
            );


            const budgetList =
                data
                    .map(
                        (
                            project,
                            index
                        ) =>
                            `${index + 1}. ${project.title}
₱${Number(
    project.budget ||
    0
).toLocaleString()}`
                    )
                    .join(
                        "\n\n"
                    );


            const title =
                currentLanguage ===
                "bisaya"
                    ?
                    "💰 Impormasyon sa Badyet sa mga Proyekto"
                    :
                currentLanguage ===
                "tagalog"
                    ?
                    "💰 Impormasyon ng Badyet ng mga Proyekto"
                    :
                    "💰 Project Budget Information";


            return `
${title}

📂 Project Budget Breakdown:

${budgetList || "No budget records found."}

━━━━━━━━━━━━━━━━

💰 Total Project Funding:
₱${totalBudget.toLocaleString()}

📊 Total Projects:
${data.length}
`;

        }


        /* =================================================
           EXPENSES
           ================================================= */

        if (
            msg.includes("expense") ||
            msg.includes("expenses")
        ) {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("expenses")
                    .select(
                        "amount"
                    );


            if (error) {

                return (
                    "Expense data unavailable."
                );

            }


            let totalExpense =
                0;


            data.forEach(
                expense => {

                    totalExpense +=
                        Number(
                            expense.amount ||
                            0
                        );

                }
            );


            const title =
                currentLanguage ===
                "bisaya"
                    ?
                    "💸 Impormasyon sa mga Gasto sa Barangay"
                    :
                currentLanguage ===
                "tagalog"
                    ?
                    "💸 Impormasyon ng mga Gastos ng Barangay"
                    :
                    "💸 Barangay Expense Information";


            return `
${title}

💸 Total Expenses:

₱${totalExpense.toLocaleString()}

📄 Expense Records:

${data.length}
`;

        }


        /* =================================================
           FEEDBACK
           ================================================= */

        if (
            msg.includes("feedback")
        ) {

            const {
                count,
                error
            } =
                await supabaseClient
                    .from("feedback")
                    .select(
                        "id",
                        {
                            count:
                                "exact",
                            head:
                                true
                        }
                    );


            if (error) {

                return (
                    "Feedback information unavailable."
                );

            }


            if (
                currentLanguage ===
                "tagalog"
            ) {

                return `
📢 Feedback Information

Maaaring magpadala ng feedback gamit ang Feedback page ng Katin-awan Portal.

📊 Total Feedback Records:
${count || 0}
`;

            }


            if (
                currentLanguage ===
                "bisaya"
            ) {

                return `
📢 Impormasyon sa Feedback

Mahimo ka magpadala og feedback gamit ang Feedback page sa Katin-awan Portal.

📊 Kinatibuk-ang Feedback Records:
${count || 0}
`;

            }


            return `
📢 Feedback Information

You can send feedback using the Feedback page of the Katin-awan Portal.

📊 Total Feedback Records:
${count || 0}
`;

        }


        /* =================================================
           OCR
           ================================================= */

        if (
            msg.includes("ocr") ||
            msg.includes("optical character")
        ) {

            if (
                currentLanguage ===
                "tagalog"
            ) {

                return (
                    "🔍 OCR ay nangangahulugang Optical Character Recognition. " +
                    "Ginagamit ito upang makilala at makuha ang text mula sa mga scanned documents o images."
                );

            }


            if (
                currentLanguage ===
                "bisaya"
            ) {

                return (
                    "🔍 Ang OCR nagpasabot og Optical Character Recognition. " +
                    "Gigamit kini aron makaila ug makuha ang text gikan sa scanned documents o images."
                );

            }


            return (
                "🔍 OCR means Optical Character Recognition. " +
                "It is used to recognize and extract text from scanned documents or images."
            );

        }


        /* =================================================
           DOCUMENTS
           ================================================= */

        if (
            msg.includes("document") ||
            msg.includes("documents")
        ) {

            if (
                currentLanguage ===
                "tagalog"
            ) {

                return (
                    "📄 Maaari mong tingnan ang mga pampublikong dokumento " +
                    "sa Documents page ng Katin-awan Portal."
                );

            }


            if (
                currentLanguage ===
                "bisaya"
            ) {

                return (
                    "📄 Makita nimo ang mga public documents " +
                    "sa Documents page sa Katin-awan Portal."
                );

            }


            return (
                "📄 You can view public documents through " +
                "the Documents page of the Katin-awan Portal."
            );

        }


        /* =================================================
           MAP
           ================================================= */

        if (
            msg.includes("map") ||
            msg.includes("location") ||
            msg.includes("where is")
        ) {

            if (
                currentLanguage ===
                "tagalog"
            ) {

                return (
                    "🗺️ Maaari mong tingnan ang barangay map " +
                    "sa Map page ng Katin-awan Portal."
                );

            }


            if (
                currentLanguage ===
                "bisaya"
            ) {

                return (
                    "🗺️ Makita nimo ang barangay map " +
                    "sa Map page sa Katin-awan Portal."
                );

            }


            return (
                "🗺️ You can view the barangay map " +
                "through the Map page of the Katin-awan Portal."
            );

        }


        /* =================================================
           GENERAL WEBSITE QUESTIONS
           ================================================= */

        if (
            msg.includes("katin-awan") ||
            msg.includes("portal") ||
            msg.includes("website")
        ) {

            return (
                "🏛️ Katin-awan Portal is a barangay transparency platform " +
                "that provides information about projects, budgets, expenses, " +
                "documents, maps, feedback, and other public information."
            );

        }


    } catch (error) {

        console.error(
            "Database chatbot error:",
            error
        );

    }


    return null;

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeChatbot() {

    console.log(
        "Initializing Katin-awan chatbot..."
    );


    await loadChatbotData();


    const {
        data: {
            user
        }
    } =
        await supabaseClient
            .auth
            .getUser();


    if (user) {

        console.log(
            "Logged-in resident:",
            user.id
        );


        await loadConversationHistoryList();


        await listenForAdminReplies();


    } else {

        console.log(
            "No logged-in resident."
        );

    }


    const input =
        document.getElementById(
            "chatInput"
        );


    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );

    }

}


/* =========================================================
   GLOBAL CLICK HANDLER
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Chatbot DOM ready."
        );


        initializeChatbot();

    }
);