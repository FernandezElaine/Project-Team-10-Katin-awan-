async function loadAdminDashboardStats() {
    await loadTotalUsers();
    await loadTotalProjects();
    await loadPendingFeedback();
    await loadOcrReviews();
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

function loadOcrReviews() {
    const el = document.getElementById("adminOcrReviews");
    if (!el) return;
    el.textContent = "2";
}

async function loadContractorAnalytics() {
    const el = document.getElementById("adminContractorAnalytics");
    if (!el) return;

    console.log("Analytics function started");

    const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("contractor, status");

        generateInsights(projects);

    console.log("Projects data:", projects);
    console.log("Supabase error:", error);

    loadKPI(projects);

    if (error || !projects || projects.length === 0) {
        el.innerHTML = "<p>No data available</p>";
        return;
    }

    const map = {};

    projects.forEach(p => {
        const contractor =
            p.contractor && p.contractor.trim()
                ? p.contractor
                : "Unassigned";

        if (!map[contractor]) {
            map[contractor] = {
                name: contractor,
                total: 0,
                completed: 0
            };
        }

        map[contractor].total++;

        if ((p.status || "").toLowerCase() === "completed") {
            map[contractor].completed++;
        }
    });

    const result = Object.values(map);

    // SAFE TOP CONTRACTOR (NO DIVISION BUG)
    const valid = result.filter(c => c.name !== "Unassigned");

    let top = null;
    if (valid.length > 0) {
        top = valid.sort((a, b) => {
            const aRate = a.total ? a.completed / a.total : 0;
            const bRate = b.total ? b.completed / b.total : 0;
            return bRate - aRate;
        })[0];
    }

    // Update the top contractor display in HTML (already styled via CSS)
    const topContractorEl = document.getElementById('topContractor');
    if (topContractorEl) {
        topContractorEl.textContent = top ? top.name : "No Data";
    }

    // TABLE UI - Using new styled classes
    const getPerfBadge = (rate) => {
        if (rate >= 80) return '<span class="perf-badge excellent">Excellent</span>';
        if (rate >= 60) return '<span class="perf-badge good">Good</span>';
        if (rate >= 40) return '<span class="perf-badge average">Average</span>';
        return '<span class="perf-badge poor">Poor</span>';
    };

    const tableHtml = `
        <div class="contractor-table-wrapper">
            <table class="contractor-table">
                <thead>
                    <tr>
                        <th>Contractor</th>
                        <th>Total Projects</th>
                        <th>Completed</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.map(c => {
                        const rate = c.total ? ((c.completed / c.total) * 100).toFixed(1) : 0;
                        return `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td>${c.total}</td>
                                <td>${c.completed}</td>
                                <td>${getPerfBadge(parseFloat(rate))} ${rate}%</td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;

    el.innerHTML = tableHtml;

    renderCharts(projects);
}

function renderCharts(projects) {
    const statusCount = {
        'Planned': 0,
        'Ongoing': 0,
        'Completed': 0
    };

    const contractorMap = {};

    projects.forEach(p => {
        const status = (p.status || "Unknown");
        statusCount[status] = (statusCount[status] || 0) + 1;

        const contractor = p.contractor && p.contractor.trim()
            ? p.contractor
            : "Unassigned";

        contractorMap[contractor] = (contractorMap[contractor] || 0) + 1;
    });

    // DESTROY OLD CHARTS (PREVENT DUPLICATES)
    if (window.statusChartInstance) window.statusChartInstance.destroy();
    if (window.contractorChartInstance) window.contractorChartInstance.destroy();

    // Enhanced Pie Chart with colors
    window.statusChartInstance = new Chart(
        document.getElementById("statusChart"),
        {
            type: "doughnut",
            data: {
                labels: Object.keys(statusCount),
                datasets: [{
                    data: Object.values(statusCount),
                    backgroundColor: ['#f59e0b', '#3b82f6', '#22c55e'],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 12,
                            usePointStyle: true,
                            font: { size: 10, weight: '600' }
                        }
                    }
                }
            }
        }
    );

    // Enhanced Bar Chart with colors
    window.contractorChartInstance = new Chart(
        document.getElementById("contractorChart"),
        {
            type: "bar",
            data: {
                labels: Object.keys(contractorMap),
                datasets: [{
                    label: "Projects",
                    data: Object.values(contractorMap),
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#1d4ed8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { size: 10 } },
                        grid: { color: '#e5eaf2' }
                    },
                    x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        }
    );

    // Update insights
    updateInsights(statusCount, projects.length);
}

function updateInsights(statusCount, totalProjects) {
    const insightBox = document.getElementById('insightBox');
    if (!insightBox) return;

    const completed = statusCount['Completed'] || 0;
    const ongoing = statusCount['Ongoing'] || 0;
    const planned = statusCount['Planned'] || 0;
    const completionRate = totalProjects > 0 ? ((completed / totalProjects) * 100).toFixed(1) : 0;

    let insightText = "";
    if (completionRate >= 70) {
        insightText = `Great progress! ${completionRate}% of projects are completed. Keep up the good work!`;
    } else if (completionRate >= 40) {
        insightText = `You're making progress with ${completionRate}% completion rate. Focus on completing ongoing projects.`;
    } else {
        insightText = `${ongoing} projects are still ongoing and ${planned} are planned. Prioritize completion to improve the ${completionRate}% rate.`;
    }

    insightBox.innerHTML = `
        <h4>💡 Key Insights</h4>
        <p>${insightText}</p>
    `;
}

function loadKPI(projects) {
    const total = projects.length;
    const completed = projects.filter(p => (p.status || "").toLowerCase() === "completed").length;
    const ongoing = projects.filter(p => (p.status || "").toLowerCase() === "ongoing").length;

    const rate = total ? ((completed / total) * 100).toFixed(1) : 0;

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiCompleted").textContent = completed;
    document.getElementById("kpiOngoing").textContent = ongoing;
    document.getElementById("kpiRate").textContent = rate + "%";
}

function generateInsights(projects) {
    const total = projects.length;
    const completed = projects.filter(p => (p.status || "").toLowerCase() === "completed").length;
    const ongoing = projects.filter(p => (p.status || "").toLowerCase() === "ongoing").length;

    const delayed = projects.filter(p =>
        (p.status || "").toLowerCase() === "planned"
    ).length;

    const insight = `
${ongoing} projects are ongoing, ${delayed} are planned.
Completion rate is ${((completed / total) * 100 || 0).toFixed(1)}%.
Focus on accelerating ongoing infrastructure projects.
    `;

    const el = document.getElementById("insightBox");
    if (el) {
        el.textContent = insight;
    }
}

loadAdminDashboardStats();