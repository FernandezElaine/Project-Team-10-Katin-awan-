// js/chat-config.js

(function configureChatAPI() {
    const hostname =
        window.location.hostname;

    const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1";

    window.KATIN_AWAN_CHAT_API_URL =
        isLocal
            ? "http://127.0.0.1:3000/chat"
            : "https://YOUR-DEPLOYED-BACKEND-DOMAIN/chat";

    console.log(
        "Chat API configured:",
        window.KATIN_AWAN_CHAT_API_URL
    );
})();