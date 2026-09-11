// js/expenses.js

let publicExpenses = [];
let filteredPublicExpenses = [];

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        preparePublicExpenseFilters();
        await loadExpenses();
    }
);


/* =========================================================
   LOAD EXPENSES
   ========================================================= */

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
                Loading approved expense records...
            </td>
        </tr>
    `;

    /*
     * IMPORTANT:
     *
     * The database RLS policies are the real security layer.
     *
     * This query intentionally requests approved/valid
     * transparency records only.
     *
     * RLS additionally determines which rows the current
     * user is actually allowed to receive:
     *
     * - Public visitor:
     *   approved expenses
     *
     * - Legacy resident:
     *   approved public expenses
     *
     * - Verified resident:
     *   approved expenses from their own barangay
     *
     * - Pending/rejected resident:
     *   no protected expense records
     *
     * - Admin:
     *   all records through the admin policy
     *
     * The client-side status filter below is only a
     * consistency layer, NOT a security layer.
     */

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
            .in(
                "status",
                [
                    "Approved",
                    "approved",
                    "Valid",
                    "valid"
                ]
            )
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

    /*
     * Normalize the returned records.
     *
     * We still perform a client-side check so that only
     * approved/valid records are rendered if the database
     * contains an unexpected status value.
     */
    publicExpenses =
        (data || [])
            .filter(
                function (expense) {
                    return (
                        normalizeExpenseStatus(
                            expense.status
                        ) === "Approved"
                    );
                }
            )
            .map(
                function (expense) {
                    return {
                        ...expense,
                        normalized_status:
                            "Approved"
                    };
                }
            );

    updateExpenseStats(
        publicExpenses
    );

    applyExpenseFilters();
}


/* =========================================================
   PREPARE FILTER UI
   ========================================================= */

function preparePublicExpenseFilters() {
    const filterInput =
        document.getElementById(
            "expenseFilter"
        );

    if (!filterInput) {
        return;
    }

    /*
     * Residents should not have filters for Pending or
     * Flagged records because those records are not part
     * of the public transparency view.
     *
     * Remove those options if they still exist in the
     * current HTML.
     */

    Array.from(
        filterInput.options
    ).forEach(
        function (option) {
            const value =
                String(
                    option.value || ""
                )
                    .trim()
                    .toLowerCase();

            const text =
                String(
                    option.textContent || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                value === "flagged" ||
                value === "pending" ||
                text === "flagged" ||
                text === "pending"
            ) {
                option.remove();
            }
        }
    );

    /*
     * Make sure "All" exists as the default.
     *
     * If the existing HTML does not have an "All" option,
     * the script will still work normally.
     */

    const allOption =
        Array.from(
            filterInput.options
        ).find(
            function (option) {
                return (
                    String(
                        option.value || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "all"
                );
            }
        );

    if (allOption) {
        filterInput.value =
            allOption.value;
    } else {
        filterInput.value = "All";
    }
}


/* =========================================================
   RENDER EXPENSES
   ========================================================= */

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
                    No approved expenses found.
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


/* =========================================================
   CREATE EXPENSE ROW
   ========================================================= */

function createExpenseRow(expense) {
    const projectName =
        expense.project?.title ||
        "Unassigned / General Expense";

    /*
     * Residents only receive approved records.
     *
     * The status is still displayed for transparency,
     * but it should always be Approved in this view.
     */

    const status =
        normalizeExpenseStatus(
            expense.status
        );

    /*
     * Residents only see whether a supporting document
     * exists.
     *
     * Private storage paths and signed links are not
     * exposed to residents through the UI.
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
                <span class="${getStatusClass(
                    status
                )}">
                    ${escapeHTML(
                        status
                    )}
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


/* =========================================================
   SEARCH
   ========================================================= */

function searchExpenses() {
    applyExpenseFilters();
}


/* =========================================================
   FILTER
   ========================================================= */

function filterExpenses() {
    applyExpenseFilters();
}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

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
                /*
                 * Only approved records are allowed into
                 * the resident transparency list.
                 */

                const status =
                    normalizeExpenseStatus(
                        expense.status
                    );

                if (
                    status !== "Approved"
                ) {
                    return false;
                }

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

                /*
                 * "All" shows every approved record.
                 *
                 * If the user selects Approved, the same
                 * approved records are shown.
                 */

                const matchesStatus =
                    selectedStatus === "All" ||
                    selectedStatus === "" ||
                    normalizeExpenseStatus(
                        selectedStatus
                    ) === "Approved";

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


/* =========================================================
   EXPENSE STATISTICS
   ========================================================= */

function updateExpenseStats(expenses) {
    /*
     * Only approved expenses are supplied to this function.
     */

    const approvedExpenses =
        (expenses || []).filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Approved"
                );
            }
        );

    const totalAmount =
        approvedExpenses.reduce(
            function (
                sum,
                expense
            ) {
                return (
                    sum +
                    Number(
                        expense.amount ||
                        0
                    )
                );
            },
            0
        );

    const approvedCount =
        approvedExpenses.length;

    /*
     * Flagged and Pending are deliberately zero in the
     * public transparency view because those records are
     * not publicly exposed.
     */

    const flaggedCount = 0;
    const pendingCount = 0;

    setText(
        "totalExpenses",
        formatPeso(
            totalAmount
        )
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


/* =========================================================
   STATUS NORMALIZATION
   ========================================================= */

function normalizeExpenseStatus(
    status
) {
    const normalized =
        String(status || "")
            .trim()
            .toLowerCase();

    /*
     * Older records using "Valid" are displayed
     * as "Approved".
     */

    if (
        normalized === "approved" ||
        normalized === "valid"
    ) {
        return "Approved";
    }

    /*
     * These are retained for compatibility with existing
     * records/functions, although resident RLS should
     * prevent these records from being returned.
     */

    if (
        normalized === "flagged"
    ) {
        return "Flagged";
    }

    return "Pending";
}


/* =========================================================
   STATUS CSS CLASS
   ========================================================= */

function getStatusClass(
    status
) {
    switch (
        normalizeExpenseStatus(
            status
        )
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


/* =========================================================
   CURRENCY FORMAT
   ========================================================= */

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
        Number(
            amount || 0
        )
    );
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
    dateValue
) {
    if (!dateValue) {
        return "N/A";
    }

    const date =
        new Date(
            dateValue
        );

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


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            String(
                value ?? ""
            );
    }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
    value
) {
    return String(
        value || ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}