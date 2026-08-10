// js/chat-config.js

(function configureChatAPI() {
    const hostname =
        window.location.hostname;

    const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1";

    window.KATIN_AWAN_CHAT_API_URL =
        isLocal
            ? "http://127.0.0.1:8787/chat"
            : "https://katin-awan-chat-api.fernandezelaine43.workers.dev/chat";

    console.log(
        "Chat API configured:",
        window.KATIN_AWAN_CHAT_API_URL
    );
})();