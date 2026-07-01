// js/dashboard.js

let dashboardProjects = [];
let dashboardExpenses = [];
let dashboardDocuments = [];
let dashboardLogs = [];

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
});

async function loadDashboardData() {
    await Promise.all([
        loadDashboardProjects(),
        loadDashboardExpenses(),
        loadDashboardDocuments(),
        loadDashboardLogs()
    ]);

    updateDashboardBudgetStats();
    updateDashboardProjectStats(dashboardProjects);
    renderDashboardProjectOverview(dashboardProjects);
    renderDashboardBudgetCategories();
    renderDashboardRecentActivity();
    renderBudgetChart();
renderProjectStatusChart();
renderBudgetAlert();
}

/* =========================
   LOAD DATA FROM SUPABASE
========================= */

async function loadDashboardProjects() {
    const { data, error } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Error loading dashboard projects:", error);
        dashboardProjects = [];
        showDashboardProjectError();
        return;
    }

    dashboardProjects = data || [];
}

async function loadDashboardExpenses() {
    const { data, error } = await supabaseClient
        .from("expenses")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.log("Expenses table error:", error.message);
        dashboardExpenses = [];
        return;
    }

    dashboardExpenses = data || [];
}

async function loadDashboardDocuments() {
    const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.log("Documents table error:", error.message);
        dashboardDocuments = [];
        return;
    }

    dashboardDocuments = data || [];
}

async function loadDashboardLogs() {
    const { data, error } = await supabaseClient
        .from("audit_logs")
        .select("*")
        .eq("public_visible", true)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.log("Audit logs table error:", error.message);
        dashboardLogs = [];
        return;
    }

    dashboardLogs = data || [];
}

/* =========================
   BUDGET STATS
========================= */

function updateDashboardBudgetStats() {
    const totalBudget = dashboardProjects.reduce((sum, project) => {
        return sum + Number(project.budget || 0);
    }, 0);

    const fundsUsed = dashboardExpenses.reduce((sum, expense) => {
        return sum + Number(expense.amount || 0);
    }, 0);

    const remainingFunds = totalBudget - fundsUsed;

    const usedPercent = totalBudget > 0
        ? ((fundsUsed / totalBudget) * 100).toFixed(1)
        : 0;

    const remainingPercent = totalBudget > 0
        ? ((remainingFunds / totalBudget) * 100).toFixed(1)
        : 0;

    const totalBudgetEl = document.getElementById("dashboardTotalBudget");
    const fundsUsedEl = document.getElementById("dashboardFundsUsed");
    const remainingFundsEl = document.getElementById("dashboardRemainingFunds");

    const budgetSummaryEl = document.getElementById("dashboardBudgetSummary");
    const fundsUsedSummaryEl = document.getElementById("dashboardFundsUsedSummary");
    const remainingSummaryEl = document.getElementById("dashboardRemainingSummary");

    if (totalBudgetEl) totalBudgetEl.textContent = formatPeso(totalBudget);
    if (fundsUsedEl) fundsUsedEl.textContent = formatPeso(fundsUsed);
    if (remainingFundsEl) remainingFundsEl.textContent = formatPeso(remainingFunds);

    if (budgetSummaryEl) {
        budgetSummaryEl.textContent = `${dashboardProjects.length} project budget records`;
    }

    if (fundsUsedSummaryEl) {
        fundsUsedSummaryEl.textContent = `${usedPercent}% of total budget`;
    }

    if (remainingSummaryEl) {
        remainingSummaryEl.textContent = `${remainingPercent}% remaining`;
    }
}

/* =========================
   PROJECT STATS
========================= */

function updateDashboardProjectStats(data) {
    const totalBox = document.getElementById("dashboardActiveProjects");
    const summaryBox = document.getElementById("dashboardProjectSummary");

    const total = data.length;
    const ongoing = data.filter(p => p.status === "Ongoing").length;
    const completed = data.filter(p => p.status === "Completed").length;
    const planned = data.filter(p => p.status === "Planned").length;

    if (totalBox) totalBox.textContent = total;
    if (summaryBox) {
        summaryBox.textContent = `${ongoing} ongoing, ${planned} planned, ${completed} completed`;
    }
}

/* =========================
   PROJECT OVERVIEW
========================= */

function renderDashboardProjectOverview(projects) {
    const container = document.getElementById("dashboardProjectOverview");
    if (!container) return;

    container.innerHTML = "";

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="public-project-card blue-line">
                <h3>No projects found</h3>
                <p>No project records are available yet.</p>
                <div class="project-footer">
                    <span>Projects</span>
                    <button onclick="window.location.href='projects.html'">View Projects</button>
                </div>
            </div>
        `;
        return;
    }

    projects.slice(0, 3).forEach(project => {
        const lineClass = getProjectLineClass(project.status);
        const statusClass = getStatusClass(project.status);

        container.innerHTML += `
            <div class="public-project-card ${lineClass}">
                <div class="project-top">
                    <span class="status ${statusClass}">${project.status || "Planned"}</span>
                    <small>${project.timeline || "Timeline not set"}</small>
                </div>

                <h3>${project.title || "Untitled Project"}</h3>
                <p>${project.description || "No description provided."}</p>
                <p><b>Budget:</b> ${formatPeso(project.budget)}</p>

                <div class="public-progress">
                    <div style="width:${project.progress || 0}%"></div>
                </div>

                <div class="project-footer">
                    <span>${project.category || "General"}</span>
                    <button onclick="window.location.href='projects.html'">View Details</button>
                </div>
            </div>
        `;
    });
}

function showDashboardProjectError() {
    const container = document.getElementById("dashboardProjectOverview");
    if (!container) return;

    container.innerHTML = `
        <div class="public-project-card blue-line">
            <h3>Unable to load projects</h3>
            <p>Please check your Supabase connection or project table policies.</p>
        </div>
    `;
}

/* =========================
   BUDGET ALLOCATION BY CATEGORY
========================= */

function renderDashboardBudgetCategories() {
    const list = document.querySelector(".public-budget-list");
    if (!list) return;

    const categoryTotals = {};

    dashboardProjects.forEach(project => {
        const category = project.category || "General";
        categoryTotals[category] = (categoryTotals[category] || 0) + Number(project.budget || 0);
    });

    if (Object.keys(categoryTotals).length === 0) {
        list.innerHTML = `
            <div><span class="c-gray"></span> No budget records yet <b>₱0</b></div>
        `;
        return;
    }

    const colorClasses = ["c-blue", "c-green", "c-orange", "c-red", "c-gray"];

    list.innerHTML = Object.entries(categoryTotals).map(([category, amount], index) => {
        const colorClass = colorClasses[index % colorClasses.length];

        return `
            <div>
                <span class="${colorClass}"></span>
                ${category}
                <b>${formatPeso(amount)}</b>
            </div>
        `;
    }).join("");
}

/* =========================
   RECENT ACTIVITY
========================= */

function renderDashboardRecentActivity() {
    const activityPanel = document.querySelector(".dashboard-extra .public-panel:not(.alert-panel)");
    if (!activityPanel) return;

    let html = `<h3>Recent Activity</h3>`;

    if (!dashboardLogs || dashboardLogs.length === 0) {
        html += `
            <div class="report-item">
                <b>No recent public activity</b>
                <p>New updates will appear here once records are added.</p>
            </div>
        `;

        activityPanel.innerHTML = html;
        return;
    }

    dashboardLogs.slice(0, 3).forEach(log => {
        html += `
            <div class="report-item">
                <b>${log.action || "System activity"}</b>
                <p>${log.details || "No details provided."}</p>
            </div>
        `;
    });

    activityPanel.innerHTML = html;
}

/* =========================
   GLOBAL SEARCH
========================= */

function handleGlobalSearch() {
    const input = document.getElementById("globalSearch");
    const results = document.getElementById("globalSearchResults");

    if (!input || !results) return;

    const keyword = input.value.toLowerCase().trim();

    if (keyword.length < 2) {
        results.classList.remove("active");
        results.innerHTML = "";
        return;
    }

    let searchResults = [];

    const matchingProjects = dashboardProjects.filter(p =>
        String(p.title || "").toLowerCase().includes(keyword) ||
        String(p.description || "").toLowerCase().includes(keyword) ||
        String(p.category || "").toLowerCase().includes(keyword) ||
        String(p.location || "").toLowerCase().includes(keyword) ||
        String(p.status || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingProjects.forEach(p => {
        searchResults.push({
            type: "Project",
            title: p.title || "Untitled Project",
            desc: `${p.status || "Planned"} • ${formatPeso(p.budget)}`,
            link: "projects.html"
        });
    });

    const matchingExpenses = dashboardExpenses.filter(e =>
        String(e.title || "").toLowerCase().includes(keyword) ||
        String(e.description || "").toLowerCase().includes(keyword) ||
        String(e.category || "").toLowerCase().includes(keyword) ||
        String(e.status || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingExpenses.forEach(e => {
        searchResults.push({
            type: "Expense",
            title: e.title || "Untitled Expense",
            desc: `${e.category || "Other"} • ${formatPeso(e.amount)}`,
            link: "expenses.html"
        });
    });

    const matchingDocuments = dashboardDocuments.filter(d =>
        String(d.title || "").toLowerCase().includes(keyword) ||
        String(d.description || "").toLowerCase().includes(keyword) ||
        String(d.category || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingDocuments.forEach(d => {
        searchResults.push({
            type: "Document",
            title: d.title || "Untitled Document",
            desc: d.category || "Document",
            link: "documents.html"
        });
    });

    if (searchResults.length === 0) {
        results.innerHTML = '<div class="search-no-results">No results found</div>';
    } else {
        results.innerHTML = searchResults.map(r => `
            <div class="search-result-item" onclick="window.location.href='${r.link}'">
                <span class="result-type">${r.type}</span>
                <h4>${r.title}</h4>
                <p>${r.desc}</p>
            </div>
        `).join("");
    }

    results.classList.add("active");
}

document.addEventListener("click", function(e) {
    const searchSection = document.querySelector(".search-bar-section");
    const results = document.getElementById("globalSearchResults");

    if (searchSection && !searchSection.contains(e.target) && results) {
        results.classList.remove("active");
    }
});

/* =========================
   HELPERS
========================= */

function getProjectLineClass(status) {
    if (status === "Completed") return "orange-line";
    if (status === "Ongoing") return "blue-line";
    if (status === "Planned") return "green-line";
    return "blue-line";
}

function getStatusClass(status) {
    if (status === "Completed") return "completed";
    if (status === "Ongoing") return "ongoing";
    return "ongoing";
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}
function renderBudgetChart() {
    const canvas = document.getElementById("budgetCategoryChart");
    if (!canvas) return;

    const categoryTotals = {};

    dashboardProjects.forEach(project => {
        const category = project.category || "General";
        const budget = Number(project.budget || 0);

        if (budget > 0) {
            categoryTotals[category] =
                (categoryTotals[category] || 0) + budget;
        }
    });

    if (window.budgetChartInstance) {
        window.budgetChartInstance.destroy();
    }

    window.budgetChartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    "#3b82f6",
                    "#22c55e",
                    "#f97316",
                    "#ef4444",
                    "#8b5cf6",
                    "#14b8a6",
                    "#facc15"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "55%",
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function renderProjectStatusChart() {
    const canvas = document.getElementById("projectStatusChart");
    if (!canvas) return;

    const statusTotals = {
        Planned: dashboardProjects.filter(
            p => (p.status || "").toLowerCase() === "planned"
        ).length,

        Ongoing: dashboardProjects.filter(
            p => (p.status || "").toLowerCase() === "ongoing"
        ).length,

        Completed: dashboardProjects.filter(
            p => (p.status || "").toLowerCase() === "completed"
        ).length
    };

    if (window.projectChartInstance) {
        window.projectChartInstance.destroy();
    }

    window.projectChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: Object.keys(statusTotals),
            datasets: [{
                label: "Projects",
                data: Object.values(statusTotals),
                backgroundColor: [
                    "#3b82f6",
                    "#f59e0b",
                    "#22c55e"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}
function renderBudgetAlert() {
    const alertPanel = document.querySelector(".alert-panel");
    if (!alertPanel) return;

    const totalBudget = dashboardProjects.reduce((sum, project) => sum + Number(project.budget || 0), 0);
    const fundsUsed = dashboardExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const usedPercent = totalBudget > 0 ? (fundsUsed / totalBudget) * 100 : 0;

    let title = "Budget Alert";
    let message = "Budget utilization is currently within a safe range.";
    let value = usedPercent.toFixed(1) + "%";

    if (usedPercent >= 100) {
        title = "Critical Budget Alert";
        message = "Expenses have exceeded the total allocated project budget.";
    } else if (usedPercent >= 80) {
        title = "High Budget Usage";
        message = "Expenses have reached more than 80% of the total allocated budget.";
    } else if (usedPercent >= 60) {
        title = "Moderate Budget Usage";
        message = "Expenses have passed 60% of the total allocated budget.";
    }

    alertPanel.innerHTML = `
        <h3>⚠️ ${title}</h3>
        <p>${message}</p>
        <h2>${value}</h2>
        <small>Based on total expenses vs project budget</small>
    `;
}