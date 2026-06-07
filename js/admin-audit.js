// js/admin-audit.js
import { supabase } from "./supabase.js";

let auditList = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAuditLogs();
});

export async function loadAuditLogs() {
    const container = document.getElementById("auditContainer");
    if (!container) return;

    const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">Failed to load audit logs: ${error.message}</p>`;
        return;
    }

    auditList = data || [];
    renderAuditLogs(auditList);
}

function renderAuditLogs(list) {
    const container = document.getElementById("auditContainer");
    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = "<p>No audit logs found.</p>";
        return;
    }

    list.forEach(log => {
        const div = document.createElement("div");
        div.classList.add("document-card");
        div.innerHTML = `
            <div>
                <h3>${log.action}</h3>
                <p><b>Module:</b> ${log.module}</p>
                <p>${log.details}</p>
                <p><b>User ID:</b> ${log.user_id || "Unknown"}</p>
                <p><b>Date:</b> ${new Date(log.created_at).toLocaleString()}</p>
            </div>
        `;
        container.appendChild(div);
    });
}