// js/admin-dashboard.js

async function loadAdminDashboardStats() {
    await loadTotalUsers();
    await loadTotalProjects();
    await loadPendingFeedback();
    await loadOcrReviews();
}

async function loadTotalUsers() {
    const el = document.getElementById("adminTotalUsers");
    if (!el) return;

    const { count, error } = await supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true });

    el.textContent = error ? "0" : count || 0;
}

async function loadTotalProjects() {
    const el = document.getElementById("adminTotalProjects");
    if (!el) return;

    const { count, error } = await supabaseClient
        .from("projects")
        .select("*", { count: "exact", head: true });

    el.textContent = error ? "0" : count || 0;
}

// Temporary feedback count (use Supabase later)
async function loadPendingFeedback() {
    const el = document.getElementById("adminPendingFeedback");
    if (!el) return;

    try {
        const response = await fetch("../data/feedback.json");
        const data = await response.json();
        el.textContent = data.filter(f => f.status === "Pending").length;
    } catch {
        el.textContent = "0";
    }
}

// Temporary OCR count
function loadOcrReviews() {
    const el = document.getElementById("adminOcrReviews");
    if (!el) return;
    el.textContent = "2"; // Placeholder
}

loadAdminDashboardStats();