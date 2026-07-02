// js/admin-dashboard.js

async function loadAdminDashboardStats() {
    await loadTotalUsers();
    await loadTotalProjects();
    await loadPendingFeedback();
    await loadOcrReviews();

    // 🔥 ADD THIS LINE
    await loadContractorAnalytics();
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

async function loadContractorAnalytics() {
    const el = document.getElementById("adminContractorAnalytics");
    if (!el) return;

    const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("contractor, status");

    if (error || !projects) {
        el.innerHTML = "No data";
        return;
    }

    const map = {};

    projects.forEach(p => {
        const contractor = p.contractor || "Unassigned";

        if (!map[contractor]) {
            map[contractor] = {
                name: contractor,
                total: 0,
                completed: 0
            };
        }

        map[contractor].total++;

        if (p.status === "Completed") {
            map[contractor].completed++;
        }
    });

    const result = Object.values(map);

    el.innerHTML = `
        <table border="1" width="100%">
            <tr>
                <th>Contractor</th>
                <th>Total Projects</th>
                <th>Completed</th>
                <th>Completion Rate</th>
            </tr>

            ${result.map(c => `
                <tr>
                    <td>${c.name}</td>
                    <td>${c.total}</td>
                    <td>${c.completed}</td>
                    <td>${((c.completed / c.total) * 100).toFixed(1)}%</td>
                </tr>
            `).join("")}
        </table>
    `;
}

loadAdminDashboardStats();

