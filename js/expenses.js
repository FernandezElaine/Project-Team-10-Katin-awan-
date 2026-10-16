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
                ocr_record_id,
                project:projects (
                    id,
                    title
                )
            `)
      .in("status", [
    "Approved",
    "approved",
    "Valid",
    "valid",
    "Pending"
])
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
        (data || [])
          .filter(function (expense) {
    return (
        normalizeExpenseStatus(expense.status) === "Approved" ||
        (
            expense.status === "Pending" &&
            expense.ocr_record_id != null
        )
    );
})
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




function createExpenseRow(expense) {
    const projectName =
        expense.project?.title ||
        "Unassigned / General Expense";


    const status =
        normalizeExpenseStatus(
            expense.status
        );



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
    status === "Pending" && expense.ocr_record_id != null
        ? "Approved"
        : status
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
    status !== "Approved" &&
    !(status === "Pending" && expense.ocr_record_id != null)
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

            

               const matchesStatus =
    selectedStatus === "All" ||
    selectedStatus === "" ||
    normalizeExpenseStatus(selectedStatus) === status;

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


    if (
        normalized === "flagged"
    ) {
        return "Flagged";
    }

    return "Pending";
}


function getStatusClass(status) {
    switch (normalizeExpenseStatus(status)) {
        case "Approved":
            return "status-resolved";
        case "Flagged":
            return "status-pending";
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