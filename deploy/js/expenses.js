// js/expenses.js

let publicExpenses = [];
let filteredPublicExpenses = [];

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        await loadExpenses();
    }
);

async function loadExpenses() {
    const expenseTable =
        document.getElementById(
            "expenseTable"
        );

    if (!expenseTable) {
        console.error(
            "expenseTable not found"
        );
        return;
    }

    expenseTable.innerHTML = `
        <tr>
            <td colspan="8">
                Loading expense records...
            </td>
        </tr>
    `;

    const { data, error } =
        await supabaseClient
            .from("expenses")
            .select(`
                id,
                project_id,
                title,
                category,
                amount,
                status,
                description,
                file_url,
                file_path,
                file_name,
                created_at,
                project:projects (
                    id,
                    title
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {
        console.error(
            "Public expenses error:",
            error
        );

        expenseTable.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="red-text"
                >
                    Failed to load expenses:
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        return;
    }

    publicExpenses =
        (data || []).map(
            function (expense) {
                return {
                    ...expense,
                    normalized_status:
                        normalizeExpenseStatus(
                            expense.status
                        )
                };
            }
        );

    updateExpenseStats(
        publicExpenses
    );

    applyExpenseFilters();
}

function renderExpenses(expenses) {
    const expenseTable =
        document.getElementById(
            "expenseTable"
        );

    if (!expenseTable) {
        return;
    }

    if (
        !expenses ||
        expenses.length === 0
    ) {
        expenseTable.innerHTML = `
            <tr>
                <td colspan="8">
                    No expenses found.
                </td>
            </tr>
        `;

        return;
    }

    expenseTable.innerHTML =
        expenses
            .map(createExpenseRow)
            .join("");
}

function createExpenseRow(expense) {
    const projectName =
        expense.project?.title ||
        "Unassigned / General Expense";

    const status =
        normalizeExpenseStatus(
            expense.status
        );

    /*
     * Residents only see whether a supporting
     * document exists. Private storage paths
     * and signed links are not exposed.
     */
    const hasSupportingFile =
        Boolean(
            expense.file_path ||
            expense.file_url
        );

    const fileLabel =
        hasSupportingFile
            ? "Available"
            : "Not provided";

    return `
        <tr>
            <td>
                ${escapeHTML(
                    expense.title ||
                    "Untitled Expense"
                )}
            </td>

            <td>
                ${escapeHTML(
                    projectName
                )}
            </td>

            <td>
                ${escapeHTML(
                    expense.category ||
                    "Other"
                )}
            </td>

            <td>
                ${formatPeso(
                    expense.amount
                )}
            </td>

            <td>
                ${escapeHTML(
                    expense.description ||
                    "No description provided."
                )}
            </td>

            <td>
                ${formatDate(
                    expense.created_at
                )}
            </td>

            <td>
                <span class="${
                    getStatusClass(status)
                }">
                    ${escapeHTML(status)}
                </span>
            </td>

            <td>
                <span class="${
                    hasSupportingFile
                        ? "green-text"
                        : ""
                }">
                    ${fileLabel}
                </span>
            </td>
        </tr>
    `;
}

function searchExpenses() {
    applyExpenseFilters();
}

function filterExpenses() {
    applyExpenseFilters();
}

function applyExpenseFilters() {
    const searchInput =
        document.getElementById(
            "expenseSearch"
        );

    const filterInput =
        document.getElementById(
            "expenseFilter"
        );

    const keyword =
        searchInput?.value
            .trim()
            .toLowerCase() || "";

    const selectedStatus =
        filterInput?.value || "All";

    filteredPublicExpenses =
        publicExpenses.filter(
            function (expense) {
                const status =
                    normalizeExpenseStatus(
                        expense.status
                    );

                const projectName =
                    expense.project?.title ||
                    "Unassigned General Expense";

                const searchableText = [
                    expense.title,
                    projectName,
                    expense.category,
                    expense.description,
                    expense.amount,
                    status,
                    expense.file_name
                ]
                    .join(" ")
                    .toLowerCase();

                const matchesKeyword =
                    !keyword ||
                    searchableText.includes(
                        keyword
                    );

                const matchesStatus =
                    selectedStatus === "All" ||
                    status === selectedStatus;

                return (
                    matchesKeyword &&
                    matchesStatus
                );
            }
        );

    renderExpenses(
        filteredPublicExpenses
    );
}

function updateExpenseStats(expenses) {
    const totalAmount =
        expenses.reduce(
            function (sum, expense) {
                return (
                    sum +
                    Number(
                        expense.amount || 0
                    )
                );
            },
            0
        );

    const approvedCount =
        expenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Approved"
                );
            }
        ).length;

    const flaggedCount =
        expenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Flagged"
                );
            }
        ).length;

    const pendingCount =
        expenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Pending"
                );
            }
        ).length;

    setText(
        "totalExpenses",
        formatPeso(totalAmount)
    );

    setText(
        "approvedCount",
        approvedCount
    );

    setText(
        "flaggedCount",
        flaggedCount
    );

    setText(
        "pendingCount",
        pendingCount
    );
}

function normalizeExpenseStatus(status) {
    const normalized =
        String(status || "")
            .trim()
            .toLowerCase();

    /*
     * Older records using Valid are displayed
     * as Approved.
     */
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

function getStatusClass(status) {
    switch (
        normalizeExpenseStatus(status)
    ) {
        case "Approved":
            return "status-resolved";

        case "Flagged":
            return "status-pending";

        case "Pending":
        default:
            return "status-review";
    }
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

function formatDate(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    const date =
        new Date(dateValue);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
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