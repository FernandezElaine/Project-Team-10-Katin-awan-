// js/admin-budget.js

let budgetProjects = [];
let budgetExpenses = [];
let filteredBudgetProjects = [];

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        await loadBudgetMonitoring();
    }
);

async function loadBudgetMonitoring() {
    const list =
        document.getElementById(
            "budgetList"
        );

    try {
        const [
            projectsResult,
            expensesResult
        ] = await Promise.all([
            supabaseClient
                .from("projects")
                .select(
                    "id, title, description, category, status, progress, budget"
                )
                .order("title", {
                    ascending: true
                }),

            supabaseClient
                .from("expenses")
                .select(
                    "id, project_id, title, amount, status"
                )
                .order("created_at", {
                    ascending: false
                })
        ]);

        if (projectsResult.error) {
            throw projectsResult.error;
        }

        if (expensesResult.error) {
            throw expensesResult.error;
        }

        budgetProjects =
            projectsResult.data || [];

        budgetExpenses =
            expensesResult.data || [];

        updateBudgetSummary();
        renderBudgetAlerts();
        applyBudgetFilters();
    } catch (error) {
        console.error(
            "Budget monitoring error:",
            error
        );

        if (list) {
            list.innerHTML = `
                <div
                    class="public-panel"
                    style="grid-column: 1 / -1;"
                >
                    <p class="red-text">
                        Failed to load budget records:
                        ${escapeHTML(error.message)}
                    </p>
                </div>
            `;
        }
    }
}

function updateBudgetSummary() {
    const totalBudget =
        budgetProjects.reduce(
            function (total, project) {
                return (
                    total +
                    Number(project.budget || 0)
                );
            },
            0
        );

    const approvedExpenses =
        budgetExpenses.reduce(
            function (total, expense) {
                const approved =
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Approved";

                const assignedToProject =
                    expense.project_id !== null &&
                    expense.project_id !== "";

                if (
                    approved &&
                    assignedToProject
                ) {
                    return (
                        total +
                        Number(expense.amount || 0)
                    );
                }

                return total;
            },
            0
        );

    const remainingFunds =
        totalBudget -
        approvedExpenses;

    const warningCount =
        budgetProjects.filter(
            function (project) {
                const condition =
                    getBudgetCondition(project);

                return (
                    condition.key === "Warning" ||
                    condition.key === "Danger" ||
                    condition.key === "NoAllocation"
                );
            }
        ).length;

    setText(
        "totalBudget",
        formatPeso(totalBudget)
    );

    setText(
        "totalExpenses",
        formatPeso(approvedExpenses)
    );

    setText(
        "remainingBudget",
        formatPeso(remainingFunds)
    );

    setText(
        "warningProjectCount",
        warningCount
    );

    const remainingElement =
        document.getElementById(
            "remainingBudget"
        );

    if (remainingElement) {
        remainingElement.classList.toggle(
            "red-text",
            remainingFunds < 0
        );

        remainingElement.classList.toggle(
            "green-text",
            remainingFunds >= 0
        );
    }
}

function renderBudgetAlerts() {
    const container =
        document.getElementById(
            "budgetAlerts"
        );

    if (!container) {
        return;
    }

    const alerts = [];

    budgetProjects.forEach(
        function (project) {
            const budget =
                Number(project.budget || 0);

            const spending =
                getApprovedProjectSpending(
                    project.id
                );

            const condition =
                getBudgetCondition(project);

            if (
                condition.key ===
                "NoAllocation"
            ) {
                alerts.push({
                    type: "danger",
                    title:
                        project.title ||
                        "Untitled Project",
                    message:
                        `${formatPeso(spending)} has been approved, but the project has no budget allocation.`
                });
            } else if (
                condition.key === "Danger"
            ) {
                alerts.push({
                    type: "danger",
                    title:
                        project.title ||
                        "Untitled Project",
                    message:
                        `This project is over budget by ${formatPeso(spending - budget)}.`
                });
            } else if (
                condition.key === "Warning"
            ) {
                alerts.push({
                    type: "warning",
                    title:
                        project.title ||
                        "Untitled Project",
                    message:
                        `${calculateUsagePercentage(
                            budget,
                            spending
                        ).toFixed(1)}% of the project budget has been used.`
                });
            }
        }
    );

    const unassignedApprovedExpenses =
        budgetExpenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Approved" &&
                    (
                        expense.project_id === null ||
                        expense.project_id === ""
                    )
                );
            }
        );

    if (
        unassignedApprovedExpenses.length > 0
    ) {
        const unassignedTotal =
            unassignedApprovedExpenses.reduce(
                function (total, expense) {
                    return (
                        total +
                        Number(
                            expense.amount || 0
                        )
                    );
                },
                0
            );

        alerts.push({
            type: "warning",
            title:
                "Unassigned Approved Expenses",
            message:
                `${unassignedApprovedExpenses.length} approved expense record(s), totaling ${formatPeso(unassignedTotal)}, are not linked to a project.`
        });
    }

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="budget-alert budget-alert-success">
                <strong>
                    ✅ No budget warnings
                </strong>

                <p>
                    All linked project expenses are within
                    their current budgets.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        alerts
            .map(
                function (alert) {
                    return `
                        <div
                            class="budget-alert budget-alert-${alert.type}"
                        >
                            <strong>
                                ${
                                    alert.type === "danger"
                                        ? "🚨"
                                        : "⚠️"
                                }

                                ${escapeHTML(alert.title)}
                            </strong>

                            <p>
                                ${escapeHTML(alert.message)}
                            </p>
                        </div>
                    `;
                }
            )
            .join("");
}

function renderBudgetProjects(projects) {
    const list =
        document.getElementById(
            "budgetList"
        );

    if (!list) {
        return;
    }

    if (
        !projects ||
        projects.length === 0
    ) {
        list.innerHTML = `
            <div
                class="public-panel"
                style="grid-column: 1 / -1;"
            >
                <p>
                    No project budget records found.
                </p>
            </div>
        `;

        return;
    }

    list.innerHTML =
        projects
            .map(createBudgetCard)
            .join("");
}

function createBudgetCard(project) {
    const allocatedBudget =
        Number(project.budget || 0);

    const approvedSpending =
        getApprovedProjectSpending(
            project.id
        );

    const remainingFunds =
        allocatedBudget -
        approvedSpending;

    const usagePercentage =
        calculateUsagePercentage(
            allocatedBudget,
            approvedSpending
        );

    const condition =
        getBudgetCondition(project);

    const progressWidth =
        Math.min(
            Math.max(
                usagePercentage,
                0
            ),
            100
        );

    return `
        <article class="document-card budget-card">
            <div class="doc-icon">
                💰
            </div>

            <div>
                <h3>
                    ${escapeHTML(
                        project.title ||
                        "Untitled Project"
                    )}
                </h3>

                <p>
                    <b>Category:</b>
                    ${escapeHTML(
                        project.category ||
                        "General"
                    )}
                </p>

                <p>
                    <b>Project Status:</b>
                    ${escapeHTML(
                        project.status ||
                        "Planned"
                    )}
                </p>

                <p>
                    <b>Project Progress:</b>
                    ${normalizeProgress(
                        project.progress
                    )}%
                </p>

                <p>
                    <b>Allocated Budget:</b>
                    ${formatPeso(
                        allocatedBudget
                    )}
                </p>

                <p>
                    <b>Approved Expenses:</b>
                    ${formatPeso(
                        approvedSpending
                    )}
                </p>

                <p>
                    <b>Remaining Funds:</b>

                    <span class="${
                        remainingFunds < 0
                            ? "red-text"
                            : "green-text"
                    }">
                        ${formatPeso(
                            remainingFunds
                        )}
                    </span>
                </p>

                <p>
                    <b>Budget Used:</b>
                    ${usagePercentage.toFixed(1)}%
                </p>

                <div class="budget-progress-track">
                    <div
                        class="budget-progress-fill ${condition.className}"
                        style="width: ${progressWidth}%;"
                    ></div>
                </div>

                <span
                    class="budget-health-badge ${condition.className}"
                >
                    ${escapeHTML(
                        condition.label
                    )}
                </span>

                <p>
                    ${escapeHTML(
                        project.description ||
                        "No description provided."
                    )}
                </p>
            </div>

            <div class="admin-card-actions">
                <a
                    href="admin-projects.html"
                    class="public-blue-btn"
                >
                    Manage Project
                </a>

                <a
                    href="admin-expenses.html"
                    class="public-green-btn"
                >
                    Manage Expenses
                </a>
            </div>
        </article>
    `;
}

function getApprovedProjectSpending(
    projectId
) {
    return budgetExpenses.reduce(
        function (total, expense) {
            const sameProject =
                Number(expense.project_id) ===
                Number(projectId);

            const approved =
                normalizeExpenseStatus(
                    expense.status
                ) === "Approved";

            if (
                sameProject &&
                approved
            ) {
                return (
                    total +
                    Number(expense.amount || 0)
                );
            }

            return total;
        },
        0
    );
}

function calculateUsagePercentage(
    allocatedBudget,
    approvedSpending
) {
    const budget =
        Number(allocatedBudget || 0);

    const spending =
        Number(approvedSpending || 0);

    if (budget <= 0) {
        return spending > 0
            ? 100
            : 0;
    }

    return (
        spending /
        budget
    ) * 100;
}

function getBudgetCondition(project) {
    const budget =
        Number(project.budget || 0);

    const spending =
        getApprovedProjectSpending(
            project.id
        );

    const percentage =
        calculateUsagePercentage(
            budget,
            spending
        );

    if (
        budget <= 0 &&
        spending > 0
    ) {
        return {
            key:
                "NoAllocation",
            label:
                "No Budget Allocation",
            className:
                "budget-danger"
        };
    }

    if (spending > budget) {
        return {
            key:
                "Danger",
            label:
                "Over Budget",
            className:
                "budget-danger"
        };
    }

    if (percentage >= 80) {
        return {
            key:
                "Warning",
            label:
                "Near Budget Limit",
            className:
                "budget-warning"
        };
    }

    return {
        key:
            "Safe",
        label:
            "Within Budget",
        className:
            "budget-safe"
    };
}

function searchBudgets() {
    applyBudgetFilters();
}

function filterBudgets() {
    applyBudgetFilters();
}

function applyBudgetFilters() {
    const keyword =
        document.getElementById(
            "budgetSearch"
        )?.value
            .trim()
            .toLowerCase() || "";

    const statusFilter =
        document.getElementById(
            "budgetFilter"
        )?.value || "All";

    const healthFilter =
        document.getElementById(
            "budgetHealthFilter"
        )?.value || "All";

    filteredBudgetProjects =
        budgetProjects.filter(
            function (project) {
                const searchableText = [
                    project.title,
                    project.description,
                    project.category,
                    project.status
                ]
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !keyword ||
                    searchableText.includes(
                        keyword
                    );

                const matchesStatus =
                    statusFilter === "All" ||
                    project.status ===
                        statusFilter;

                const condition =
                    getBudgetCondition(
                        project
                    );

                const matchesHealth =
                    healthFilter === "All" ||
                    condition.key ===
                        healthFilter;

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesHealth
                );
            }
        );

    renderBudgetProjects(
        filteredBudgetProjects
    );
}

function normalizeExpenseStatus(status) {
    const normalized =
        String(status || "")
            .trim()
            .toLowerCase();

    if (
        normalized === "approved" ||
        normalized === "valid"
    ) {
        return "Approved";
    }

    if (normalized === "flagged") {
        return "Flagged";
    }

    return "Pending";
}

function normalizeProgress(value) {
    const progress =
        Number(value);

    if (!Number.isFinite(progress)) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(progress)
        )
    );
}

function formatPeso(amount) {
    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(
        Number(amount || 0)
    );
}

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(value ?? "");
    }
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll(
            "'",
            "&#039;"
        );
}