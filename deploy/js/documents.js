// js/documents.js

let publicDocuments = [];
let transparencyLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    loadDocuments();
    loadTransparencyLogs();
});

/* =========================
   DOCUMENTS
========================= */

async function loadDocuments() {
    const documentsList = document.getElementById("documentsList");
    if (!documentsList) return;

    const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        documentsList.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load documents: ${escapeHTML(error.message)}</p>
            </div>
        `;
        return;
    }

    publicDocuments = data || [];
    renderDocuments(publicDocuments);
}

function renderDocuments(docs) {
    const documentsList = document.getElementById("documentsList");
    if (!documentsList) return;

    if (!docs || docs.length === 0) {
        documentsList.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No documents found.</p>
            </div>
        `;
        return;
    }

    documentsList.innerHTML = docs.map(doc => `
        <div class="document-card">
            <div class="doc-icon">${getDocumentIcon(doc.category)}</div>

            <div>
                <h3>${escapeHTML(doc.title || "Untitled Document")}</h3>
                <p>Updated: ${formatDate(doc.created_at)}</p>
                <span>${escapeHTML(doc.category || "Other")}</span>
                <p class="document-preview">
                    ${escapeHTML(doc.description || "No description provided.")}
                </p>
            </div>

            <button onclick="viewDocumentDetails(${doc.id})">View</button>
        </div>
    `).join("");
}

function searchDocuments() {
    const searchInput = document.getElementById("documentSearch");
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase().trim();
    const selectedCategory = document.getElementById("documentFilter")?.value || "All";

    let filtered = publicDocuments;

    if (selectedCategory !== "All") {
        filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    if (keyword) {
        filtered = filtered.filter(doc =>
            String(doc.title || "").toLowerCase().includes(keyword) ||
            String(doc.category || "").toLowerCase().includes(keyword) ||
            String(doc.description || "").toLowerCase().includes(keyword)
        );
    }

    renderDocuments(filtered);
}

function filterDocuments() {
    searchDocuments();
}

function viewDocumentDetails(id) {
    const doc = publicDocuments.find(item => Number(item.id) === Number(id));

    if (!doc) {
        alert("Document not found.");
        return;
    }

    const modal = document.getElementById("documentModal");
    if (!modal) return;

    document.getElementById("documentModalTitle").textContent =
        doc.title || "Untitled Document";

    document.getElementById("documentModalDescription").textContent =
        doc.description || "No description provided.";

    document.getElementById("documentModalDate").textContent =
        "Updated: " + formatDate(doc.created_at);

    document.getElementById("documentModalCategory").textContent =
        doc.category || "Other";

    const viewBtn = document.getElementById("documentModalViewBtn");

    if (doc.file_url) {
        viewBtn.style.display = "inline-block";
        viewBtn.onclick = () => window.open(doc.file_url, "_blank");
    } else {
        viewBtn.style.display = "none";
    }

    modal.classList.add("active");
}

function closeDocumentModal() {
    const modal = document.getElementById("documentModal");
    if (modal) modal.classList.remove("active");
}

document.addEventListener("click", function(e) {
    const modal = document.getElementById("documentModal");
    if (modal && e.target === modal) modal.classList.remove("active");
});

/* =========================
   TRANSPARENCY LOGS
========================= */

async function loadTransparencyLogs() {
    const logsList = document.getElementById("transparencyLogsList");
    if (!logsList) return;

    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select("*")
        .eq("public_visible", true)
        .order("created_at", { ascending: false });

    if (error) {
        logsList.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load transparency logs: ${escapeHTML(error.message)}</p>
            </div>
        `;
        return;
    }

    transparencyLogs = data || [];
    renderTransparencyLogs(transparencyLogs);
}

function renderTransparencyLogs(logs) {
    const logsList = document.getElementById("transparencyLogsList");
    if (!logsList) return;

    if (!logs || logs.length === 0) {
        logsList.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No public transparency logs found.</p>
            </div>
        `;
        return;
    }

    logsList.innerHTML = logs.map(log => {
        const adminName = log.admin_name || "Administrator";

        return `
            <div class="document-card">
                <div class="doc-icon">${getLogIcon(log.module)}</div>

                <div>
                    <h3>${escapeHTML(log.action || "System Activity")}</h3>
                    <p><b>Module:</b> ${escapeHTML(log.module || "General")}</p>
                    <p><b>Changed by:</b> ${escapeHTML(adminName)}</p>
                    <p>${escapeHTML(log.details || "No details provided.")}</p>
                    <span>${formatDateTime(log.created_at)}</span>
                </div>
            </div>
        `;
    }).join("");
}

function searchTransparencyLogs() {
    const searchInput = document.getElementById("logSearch");
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase().trim();
    const selectedModule = document.getElementById("logFilter")?.value || "All";

    let filtered = transparencyLogs;

    if (selectedModule !== "All") {
        filtered = filtered.filter(log => log.module === selectedModule);
    }

    if (keyword) {
        filtered = filtered.filter(log => {
            const adminName = log.admin_name || "Administrator";

            return (
                String(log.action || "").toLowerCase().includes(keyword) ||
                String(log.module || "").toLowerCase().includes(keyword) ||
                String(log.details || "").toLowerCase().includes(keyword) ||
                String(adminName || "").toLowerCase().includes(keyword)
            );
        });
    }

    renderTransparencyLogs(filtered);
}

function filterTransparencyLogs() {
    searchTransparencyLogs();
}

/* =========================
   HELPERS
========================= */

function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function formatDateTime(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getDocumentIcon(category) {
    switch (category) {
        case "Financial Report":
            return "📊";
        case "Budget Document":
            return "💰";
        case "Receipt":
            return "🧾";
        case "Project Document":
            return "🏗️";
        case "Contract":
            return "📑";
        default:
            return "📄";
    }
}

function getLogIcon(module) {
    switch (module) {
        case "Projects":
            return "🏗️";
        case "Documents":
            return "📄";
        case "Expenses":
            return "💰";
        case "Feedback":
            return "📢";
        case "Budget":
            return "📊";
        case "Users":
            return "👥";
        case "Documents/OCR":
            return "🔍";
        default:
            return "📋";
    }
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}