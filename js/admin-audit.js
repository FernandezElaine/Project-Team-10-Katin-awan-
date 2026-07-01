// js/admin-audit.js

let auditLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAuditLogs();
});

async function loadAuditLogs() {
    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        document.getElementById("auditContainer").innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load audit logs: ${error.message}</p>
            </div>
        `;
        return;
    }

    auditLogs = data || [];
    renderAuditLogs(auditLogs);
    updateAuditSummary(auditLogs);
}

function renderAuditLogs(logs) {
    const container = document.getElementById("auditContainer");
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="public-panel">
                <p>No audit logs found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = logs.map(log => {
        const adminName = log.admin_name || "Administrator";

        return `
            <div class="document-card">
                <div class="doc-icon">${getLogIcon(log.module)}</div>

                <div>
                    <h3>${escapeHTML(log.action || "System Activity")}</h3>
                    <p><b>Changed by:</b> ${escapeHTML(adminName)}</p>
                    <p><b>Module:</b> ${escapeHTML(log.module || "General")}</p>
                    <p>${escapeHTML(log.details || "No details provided.")}</p>
                    <span>${formatDateTime(log.created_at)}</span>
                </div>
            </div>
        `;
    }).join("");
}

function searchAdminAudit() {
    const keyword = document.getElementById("adminAuditSearch").value.toLowerCase().trim();
    const moduleFilter = document.getElementById("adminAuditFilter").value;

    let filtered = auditLogs;

    if (moduleFilter !== "All") {
        filtered = filtered.filter(log => log.module === moduleFilter);
    }

    if (keyword) {
        filtered = filtered.filter(log =>
            String(log.action || "").toLowerCase().includes(keyword) ||
            String(log.module || "").toLowerCase().includes(keyword) ||
            String(log.details || "").toLowerCase().includes(keyword) ||
            String(log.admin_name || "").toLowerCase().includes(keyword)
        );
    }

    renderAuditLogs(filtered);
    updateAuditSummary(filtered);
}

function filterAdminAudit() {
    searchAdminAudit();
}

function updateAuditSummary(logs) {
    document.getElementById("totalLogs").textContent = logs.length;

    document.getElementById("projectLogs").textContent =
        logs.filter(log => log.module === "Projects").length;

    document.getElementById("documentLogs").textContent =
        logs.filter(log =>
            log.module === "Documents" ||
            log.module === "Documents/OCR"
        ).length;

    document.getElementById("userLogs").textContent =
        logs.filter(log => log.module === "Users").length;
}

function getLogIcon(module) {
    switch (module) {
        case "Projects":
            return "🏗️";
        case "Documents":
            return "📄";
        case "Documents/OCR":
            return "🔍";
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

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}