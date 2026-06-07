// js/documents.js

let publicDocuments = [];
let transparencyLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("documents.js loaded");
    loadDocuments();
    loadTransparencyLogs();
});

/* =========================
   DOCUMENTS
========================= */

async function loadDocuments() {
    const documentsList = document.getElementById("documentsList");

    if (!documentsList) {
        console.error("documentsList not found");
        return;
    }

    const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    console.log("Public documents data:", data);
    console.log("Public documents error:", error);

    if (error) {
        documentsList.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load documents: ${error.message}</p>
            </div>
        `;
        return;
    }

    publicDocuments = data || [];
    renderDocuments(publicDocuments);
}

function renderDocuments(docs) {
    const documentsList = document.getElementById("documentsList");

    if (!docs || docs.length === 0) {
        documentsList.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No documents found.</p>
            </div>
        `;
        return;
    }

    documentsList.innerHTML = "";

    docs.forEach(doc => {
        const card = document.createElement("div");
        card.classList.add("document-card");

        card.innerHTML = `
            <div class="doc-icon">${getDocumentIcon(doc.category)}</div>

            <div>
                <h3>${doc.title || "Untitled Document"}</h3>
                <p>Updated: ${formatDate(doc.created_at)}</p>
                <span>${doc.category || "Other"}</span>
                <p class="document-preview">
                    ${doc.description || "No description provided."}
                </p>
            </div>

            <button onclick="viewDocumentDetails(${doc.id})">View</button>
        `;

        documentsList.appendChild(card);
    });
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
            (doc.title || "").toLowerCase().includes(keyword) ||
            (doc.category || "").toLowerCase().includes(keyword) ||
            (doc.description || "").toLowerCase().includes(keyword)
        );
    }

    renderDocuments(filtered);
}

function filterDocuments() {
    searchDocuments();
}

function viewDocumentDetails(id) {
    const doc = publicDocuments.find(item => item.id === id);

    if (!doc) {
        alert("Document not found.");
        return;
    }

    const modal = document.getElementById("documentModal");

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

    if (modal) {
        modal.classList.remove("active");
    }
}

document.addEventListener("click", function(e) {
    const modal = document.getElementById("documentModal");

    if (modal && e.target === modal) {
        modal.classList.remove("active");
    }
});

/* =========================
   TRANSPARENCY LOGS
========================= */

async function loadTransparencyLogs() {
    const logsList = document.getElementById("transparencyLogsList");

    if (!logsList) {
        console.error("transparencyLogsList not found");
        return;
    }

    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select("*")
        .eq("public_visible", true)
        .order("created_at", { ascending: false });

    console.log("Transparency logs data:", data);
    console.log("Transparency logs error:", error);

    if (error) {
        logsList.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load transparency logs: ${error.message}</p>
            </div>
        `;
        return;
    }

    transparencyLogs = data || [];
    renderTransparencyLogs(transparencyLogs);
}

function renderTransparencyLogs(logs) {
    const logsList = document.getElementById("transparencyLogsList");

    if (!logs || logs.length === 0) {
        logsList.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No public transparency logs found.</p>
            </div>
        `;
        return;
    }

    logsList.innerHTML = "";

    logs.forEach(log => {
        const card = document.createElement("div");
        card.classList.add("document-card");

        card.innerHTML = `
            <div class="doc-icon">${getLogIcon(log.module)}</div>

            <div>
                <h3>${log.action || "System Activity"}</h3>
                <p><b>Module:</b> ${log.module || "General"}</p>
                <p>${log.details || "No details provided."}</p>
                <span>${formatDateTime(log.created_at)}</span>
            </div>
        `;

        logsList.appendChild(card);
    });
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
        filtered = filtered.filter(log =>
            (log.action || "").toLowerCase().includes(keyword) ||
            (log.module || "").toLowerCase().includes(keyword) ||
            (log.details || "").toLowerCase().includes(keyword)
        );
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
        default:
            return "📋";
    }
}