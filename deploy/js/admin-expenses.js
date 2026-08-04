// js/admin-expenses.js

let adminExpenses = [];
let adminProjects = [];
let filteredExpenses = [];

let removeExistingReceipt = false;

const EXPENSE_RECEIPT_BUCKET =
    "expense-receipts";

const MAX_RECEIPT_SIZE =
    5 * 1024 * 1024;

const ALLOWED_RECEIPT_TYPES =
    new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        const form =
            document.getElementById(
                "expenseForm"
            );

        const container =
            document.getElementById(
                "expensesContainer"
            );

        const receiptInput =
            document.getElementById(
                "expenseReceipt"
            );

        if (form) {
            form.addEventListener(
                "submit",
                saveExpense
            );
        }

        if (container) {
            container.addEventListener(
                "click",
                handleExpenseCardAction
            );
        }

        if (receiptInput) {
            receiptInput.addEventListener(
                "change",
                handleReceiptSelection
            );
        }

        await loadExpensePageData();
    }
);

async function loadExpensePageData() {
    const container =
        document.getElementById(
            "expensesContainer"
        );

    try {
        const [
            projectsResult,
            expensesResult
        ] = await Promise.all([
            supabaseClient
                .from("projects")
                .select(
                    "id, title, budget, status"
                )
                .order("title", {
                    ascending: true
                }),

            supabaseClient
                .from("expenses")
                .select("*")
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

        adminProjects =
            projectsResult.data || [];

        adminExpenses =
            (expensesResult.data || [])
                .map(function (expense) {
                    const project =
                        adminProjects.find(
                            function (item) {
                                return (
                                    Number(item.id) ===
                                    Number(
                                        expense.project_id
                                    )
                                );
                            }
                        );

                    return {
                        ...expense,
                        project: project || null
                    };
                });

        populateProjectSelector();
        updateExpenseSummary();
        applyExpenseFilters();
    } catch (error) {
        console.error(
            "Expense loading error:",
            error
        );

        if (container) {
            container.innerHTML = `
                <div class="public-panel">
                    <p class="red-text">
                        Failed to load expenses:
                        ${escapeHTML(error.message)}
                    </p>
                </div>
            `;
        }
    }
}

function populateProjectSelector() {
    const selector =
        document.getElementById(
            "expenseProject"
        );

    if (!selector) {
        return;
    }

    const previousValue =
        selector.value;

    selector.innerHTML = `
        <option value="">
            Unassigned / General Expense
        </option>
    `;

    adminProjects.forEach(
        function (project) {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(project.id);

            option.textContent =
                `${project.title || "Untitled Project"} • ` +
                `${formatPeso(project.budget)}`;

            selector.appendChild(option);
        }
    );

    const previousProjectExists =
        adminProjects.some(
            function (project) {
                return (
                    String(project.id) ===
                    String(previousValue)
                );
            }
        );

    if (previousProjectExists) {
        selector.value =
            previousValue;
    }
}

async function saveExpense(event) {
    event.preventDefault();

    const idValue =
        document.getElementById(
            "expenseId"
        ).value;

    const expenseId =
        idValue
            ? Number(idValue)
            : null;

    const projectValue =
        document.getElementById(
            "expenseProject"
        ).value;

    const projectId =
        projectValue
            ? Number(projectValue)
            : null;

    const title =
        document.getElementById(
            "expenseTitle"
        ).value.trim();

    const category =
        document.getElementById(
            "expenseCategory"
        ).value;

    const amount =
        Number(
            document.getElementById(
                "expenseAmount"
            ).value
        );

    let status =
        document.getElementById(
            "expenseStatus"
        ).value;

    const description =
        document.getElementById(
            "expenseDescription"
        ).value.trim();

    const receiptInput =
        document.getElementById(
            "expenseReceipt"
        );

    const selectedFile =
        receiptInput?.files?.[0] || null;

    if (
        !title ||
        !category ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        alert(
            "Please enter a title, category, and an amount greater than zero."
        );

        return;
    }

    if (selectedFile) {
        const validationError =
            validateReceiptFile(
                selectedFile
            );

        if (validationError) {
            alert(validationError);
            return;
        }
    }

    const relatedProject =
        adminProjects.find(
            function (project) {
                return (
                    Number(project.id) ===
                    Number(projectId)
                );
            }
        );

    if (
        relatedProject &&
        status === "Approved"
    ) {
        const existingApprovedSpending =
            adminExpenses.reduce(
                function (total, expense) {
                    const sameProject =
                        Number(
                            expense.project_id
                        ) === Number(projectId);

                    const approved =
                        normalizeExpenseStatus(
                            expense.status
                        ) === "Approved";

                    const currentExpense =
                        expenseId &&
                        Number(expense.id) ===
                        expenseId;

                    if (
                        sameProject &&
                        approved &&
                        !currentExpense
                    ) {
                        return (
                            total +
                            Number(
                                expense.amount || 0
                            )
                        );
                    }

                    return total;
                },
                0
            );

        const projectedSpending =
            existingApprovedSpending +
            amount;

        const projectBudget =
            Number(
                relatedProject.budget || 0
            );

        if (
            projectBudget > 0 &&
            projectedSpending >
                projectBudget
        ) {
            const saveAsFlagged =
                confirm(
                    `This expense exceeds the budget for "${relatedProject.title}".\n\n` +
                    `Project budget: ${formatPeso(projectBudget)}\n` +
                    `Projected spending: ${formatPeso(projectedSpending)}\n\n` +
                    `Save it as Flagged instead?`
                );

            if (!saveAsFlagged) {
                return;
            }

            status = "Flagged";
        }
    }

    const basePayload = {
        project_id: projectId,
        title,
        category,
        amount,
        status,
        description,
        updated_at:
            new Date().toISOString()
    };

    const existingExpense =
        adminExpenses.find(
            function (expense) {
                return (
                    Number(expense.id) ===
                    Number(expenseId)
                );
            }
        );

    const oldFilePath =
        existingExpense?.file_path || null;

    let savedExpenseId =
        expenseId;

    let uploadedPath = null;

    try {
        /*
         * Create the database record first so its ID
         * can be included in the storage folder.
         */
        if (!savedExpenseId) {
            const insertResult =
                await supabaseClient
                    .from("expenses")
                    .insert([basePayload])
                    .select("id")
                    .single();

            if (insertResult.error) {
                throw insertResult.error;
            }

            savedExpenseId =
                Number(
                    insertResult.data.id
                );
        }

        const finalPayload = {
            ...basePayload
        };

        if (selectedFile) {
            const uploadResult =
                await uploadExpenseReceipt(
                    savedExpenseId,
                    selectedFile
                );

            uploadedPath =
                uploadResult.path;

            finalPayload.file_path =
                uploadResult.path;

            finalPayload.file_name =
                selectedFile.name;

            finalPayload.file_type =
                selectedFile.type;

            finalPayload.file_size =
                selectedFile.size;

            /*
             * Remove any old pasted URL.
             */
            finalPayload.file_url =
                null;
        } else if (
            removeExistingReceipt
        ) {
            finalPayload.file_path =
                null;

            finalPayload.file_name =
                null;

            finalPayload.file_type =
                null;

            finalPayload.file_size =
                null;

            finalPayload.file_url =
                null;
        }

        const updateResult =
            await supabaseClient
                .from("expenses")
                .update(finalPayload)
                .eq(
                    "id",
                    savedExpenseId
                );

        if (updateResult.error) {
            throw updateResult.error;
        }

        if (
            selectedFile &&
            oldFilePath &&
            oldFilePath !== uploadedPath
        ) {
            await deleteReceiptFromStorage(
                oldFilePath
            );
        }

        if (
            removeExistingReceipt &&
            oldFilePath
        ) {
            await deleteReceiptFromStorage(
                oldFilePath
            );
        }

        await logAudit(
            expenseId
                ? "Updated expense"
                : "Added expense",
            "Expenses",
            `${expenseId ? "Updated" : "Added"} expense: ${title}`,
            true
        );

        alert(
            expenseId
                ? "Expense updated successfully."
                : "Expense added successfully."
        );

        clearExpenseForm();

        await loadExpensePageData();
    } catch (error) {
        console.error(
            "Expense save error:",
            error
        );

        if (uploadedPath) {
            await deleteReceiptFromStorage(
                uploadedPath
            );
        }

        if (
            !expenseId &&
            savedExpenseId
        ) {
            await supabaseClient
                .from("expenses")
                .delete()
                .eq(
                    "id",
                    savedExpenseId
                );
        }

        alert(
            "Expense could not be saved: " +
            error.message
        );
    }
}

async function uploadExpenseReceipt(
    expenseId,
    file
) {
    const safeName =
        createSafeFileName(file.name);

    const filePath =
        `expenses/${expenseId}/` +
        `${Date.now()}-${safeName}`;

    const { error } =
        await supabaseClient.storage
            .from(
                EXPENSE_RECEIPT_BUCKET
            )
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                }
            );

    if (error) {
        throw new Error(
            "Receipt upload failed: " +
            error.message
        );
    }

    return {
        path: filePath
    };
}

async function deleteReceiptFromStorage(
    filePath
) {
    if (!filePath) {
        return;
    }

    const { error } =
        await supabaseClient.storage
            .from(
                EXPENSE_RECEIPT_BUCKET
            )
            .remove([filePath]);

    if (error) {
        console.warn(
            "Receipt cleanup failed:",
            error.message
        );
    }
}

function validateReceiptFile(file) {
    if (
        !ALLOWED_RECEIPT_TYPES.has(
            file.type
        )
    ) {
        return (
            "Only PDF, JPG, PNG, " +
            "and WebP files are allowed."
        );
    }

    if (
        file.size >
        MAX_RECEIPT_SIZE
    ) {
        return (
            "The receipt file must not " +
            "be larger than 5 MB."
        );
    }

    return "";
}

function handleReceiptSelection() {
    const input =
        document.getElementById(
            "expenseReceipt"
        );

    const file =
        input?.files?.[0];

    const fileInfo =
        document.getElementById(
            "expenseSelectedFileInfo"
        );

    removeExistingReceipt = false;

    if (!fileInfo) {
        return;
    }

    if (!file) {
        fileInfo.textContent = "";
        fileInfo.hidden = true;
        return;
    }

    const validationError =
        validateReceiptFile(file);

    if (validationError) {
        alert(validationError);

        input.value = "";
        fileInfo.textContent = "";
        fileInfo.hidden = true;

        return;
    }

    fileInfo.textContent =
        `Selected: ${file.name} ` +
        `(${formatFileSize(file.size)})`;

    fileInfo.hidden = false;
}

function renderExpenses(expenses) {
    const container =
        document.getElementById(
            "expensesContainer"
        );

    if (!container) {
        return;
    }

    if (
        !expenses ||
        expenses.length === 0
    ) {
        container.innerHTML = `
            <div
                class="public-panel"
                style="grid-column: 1 / -1;"
            >
                <p>No expenses found.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        expenses
            .map(createExpenseCard)
            .join("");
}

function createExpenseCard(expense) {
    const project =
        expense.project;

    const projectBudget =
        Number(project?.budget || 0);

    const approvedSpending =
        getApprovedProjectSpending(
            expense.project_id
        );

    const remainingBudget =
        projectBudget -
        approvedSpending;

    const hasReceipt =
        Boolean(
            expense.file_path ||
            expense.file_url
        );

    const projectInformation =
        project
            ? `
                <p>
                    <b>Project:</b>
                    ${escapeHTML(
                        project.title ||
                        "Untitled Project"
                    )}
                </p>

                <p>
                    <b>Project Budget:</b>
                    ${formatPeso(projectBudget)}
                </p>

                <p>
                    <b>Approved Spending:</b>
                    ${formatPeso(
                        approvedSpending
                    )}
                </p>

                <p>
                    <b>Remaining:</b>

                    <span class="${
                        remainingBudget < 0
                            ? "red-text"
                            : "green-text"
                    }">
                        ${formatPeso(
                            remainingBudget
                        )}
                    </span>
                </p>
            `
            : `
                <p>
                    <b>Project:</b>
                    Unassigned / General Expense
                </p>
            `;

    return `
        <article class="document-card">
            <div class="doc-icon">
                💰
            </div>

            <div>
                <h3>
                    ${escapeHTML(
                        expense.title ||
                        "Untitled Expense"
                    )}
                </h3>

                ${projectInformation}

                <p>
                    <b>Category:</b>
                    ${escapeHTML(
                        expense.category ||
                        "Other"
                    )}
                </p>

                <p>
                    <b>Amount:</b>
                    ${formatPeso(
                        expense.amount
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        expense.description ||
                        "No description provided."
                    )}
                </p>

                <span class="${
                    getExpenseStatusClass(
                        expense.status
                    )
                }">
                    ${escapeHTML(
                        normalizeExpenseStatus(
                            expense.status
                        )
                    )}
                </span>

                <p>
                    <small>
                        Added:
                        ${formatDate(
                            expense.created_at
                        )}
                    </small>
                </p>

                <p>
                    <small>
                        Receipt:
                        ${escapeHTML(
                            expense.file_name ||
                            (
                                expense.file_url
                                    ? "Legacy link"
                                    : "None"
                            )
                        )}
                    </small>
                </p>
            </div>

            <div class="admin-card-actions">
                <button
                    type="button"
                    data-action="view-file"
                    data-expense-id="${
                        Number(expense.id)
                    }"
                    ${
                        hasReceipt
                            ? ""
                            : "disabled"
                    }
                >
                    ${
                        hasReceipt
                            ? "View Receipt"
                            : "No Receipt"
                    }
                </button>

                <button
                    type="button"
                    data-action="edit"
                    data-expense-id="${
                        Number(expense.id)
                    }"
                >
                    Edit
                </button>

                <button
                    type="button"
                    data-action="delete"
                    data-expense-id="${
                        Number(expense.id)
                    }"
                    class="danger-btn"
                >
                    Delete
                </button>
            </div>
        </article>
    `;
}

async function handleExpenseCardAction(
    event
) {
    const button =
        event.target.closest(
            "button[data-action]"
        );

    if (!button) {
        return;
    }

    const expenseId =
        Number(
            button.dataset.expenseId
        );

    if (
        button.dataset.action ===
        "view-file"
    ) {
        await viewExpenseReceiptById(
            expenseId
        );
    } else if (
        button.dataset.action ===
        "edit"
    ) {
        editExpense(expenseId);
    } else if (
        button.dataset.action ===
        "delete"
    ) {
        await deleteExpense(
            expenseId
        );
    }
}

function editExpense(id) {
    const expense =
        adminExpenses.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (!expense) {
        alert("Expense not found.");
        return;
    }

    document.getElementById(
        "expenseId"
    ).value = expense.id;

    document.getElementById(
        "expenseProject"
    ).value =
        expense.project_id || "";

    document.getElementById(
        "expenseTitle"
    ).value =
        expense.title || "";

    document.getElementById(
        "expenseCategory"
    ).value =
        expense.category || "Other";

    document.getElementById(
        "expenseAmount"
    ).value =
        expense.amount || "";

    document.getElementById(
        "expenseStatus"
    ).value =
        normalizeExpenseStatus(
            expense.status
        );

    document.getElementById(
        "expenseDescription"
    ).value =
        expense.description || "";

    document.getElementById(
        "expenseReceipt"
    ).value = "";

    removeExistingReceipt = false;

    updateExistingReceiptDisplay(
        expense
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function deleteExpense(id) {
    const expense =
        adminExpenses.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    const confirmed =
        confirm(
            `Delete the expense "${
                expense?.title ||
                "this expense"
            }"?`
        );

    if (!confirmed) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("expenses")
            .delete()
            .eq("id", id);

    if (error) {
        alert(
            "Expense could not be deleted: " +
            error.message
        );

        return;
    }

    if (expense?.file_path) {
        await deleteReceiptFromStorage(
            expense.file_path
        );
    }

    await logAudit(
        "Deleted expense",
        "Expenses",
        `Deleted expense: ${
            expense?.title ||
            "Expense ID " + id
        }`,
        true
    );

    alert(
        "Expense deleted successfully."
    );

    await loadExpensePageData();
}

function clearExpenseForm() {
    document.getElementById(
        "expenseId"
    ).value = "";

    document.getElementById(
        "expenseProject"
    ).value = "";

    document.getElementById(
        "expenseTitle"
    ).value = "";

    document.getElementById(
        "expenseCategory"
    ).value =
        "Infrastructure";

    document.getElementById(
        "expenseAmount"
    ).value = "";

    document.getElementById(
        "expenseStatus"
    ).value =
        "Pending";

    document.getElementById(
        "expenseDescription"
    ).value = "";

    document.getElementById(
        "expenseReceipt"
    ).value = "";

    removeExistingReceipt = false;

    const selectedInfo =
        document.getElementById(
            "expenseSelectedFileInfo"
        );

    if (selectedInfo) {
        selectedInfo.textContent = "";
        selectedInfo.hidden = true;
    }

    const existingBox =
        document.getElementById(
            "expenseExistingFileBox"
        );

    if (existingBox) {
        existingBox.hidden = true;
    }
}

function updateExistingReceiptDisplay(
    expense
) {
    const box =
        document.getElementById(
            "expenseExistingFileBox"
        );

    const name =
        document.getElementById(
            "expenseExistingFileName"
        );

    if (!box || !name) {
        return;
    }

    const hasReceipt =
        Boolean(
            expense?.file_path ||
            expense?.file_url
        );

    if (!hasReceipt) {
        box.hidden = true;
        name.textContent = "";
        return;
    }

    box.hidden = false;

    name.textContent =
        expense.file_name ||
        (
            expense.file_url
                ? "Legacy receipt link"
                : "Current receipt"
        );
}

async function viewCurrentExpenseReceipt() {
    const expenseId =
        Number(
            document.getElementById(
                "expenseId"
            ).value
        );

    if (!expenseId) {
        alert(
            "No saved receipt is available yet."
        );

        return;
    }

    await viewExpenseReceiptById(
        expenseId
    );
}

function removeCurrentExpenseReceipt() {
    const expenseId =
        Number(
            document.getElementById(
                "expenseId"
            ).value
        );

    if (!expenseId) {
        alert(
            "There is no saved receipt to remove."
        );

        return;
    }

    removeExistingReceipt = true;

    const box =
        document.getElementById(
            "expenseExistingFileBox"
        );

    const name =
        document.getElementById(
            "expenseExistingFileName"
        );

    if (box && name) {
        box.hidden = false;

        name.textContent =
            "Receipt will be removed when you save.";
    }
}

async function viewExpenseReceiptById(id) {
    const expense =
        adminExpenses.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (!expense) {
        alert("Expense not found.");
        return;
    }

    /*
     * New private Storage receipt.
     */
    if (expense.file_path) {
        const { data, error } =
            await supabaseClient.storage
                .from(
                    EXPENSE_RECEIPT_BUCKET
                )
                .createSignedUrl(
                    expense.file_path,
                    300
                );

        if (
            error ||
            !data?.signedUrl
        ) {
            alert(
                "Receipt could not be opened: " +
                (
                    error?.message ||
                    "Unknown error"
                )
            );

            return;
        }

        window.open(
            data.signedUrl,
            "_blank",
            "noopener,noreferrer"
        );

        return;
    }

    /*
     * Support old pasted links temporarily.
     */
    if (expense.file_url) {
        try {
            const url =
                new URL(
                    expense.file_url
                );

            if (
                url.protocol !== "https:" &&
                url.protocol !== "http:"
            ) {
                throw new Error(
                    "Invalid URL"
                );
            }

            window.open(
                url.href,
                "_blank",
                "noopener,noreferrer"
            );

            return;
        } catch {
            alert(
                "The legacy receipt link is invalid."
            );

            return;
        }
    }

    alert(
        "No receipt is attached to this expense."
    );
}

function searchAdminExpenses() {
    applyExpenseFilters();
}

function filterAdminExpenses() {
    applyExpenseFilters();
}

function applyExpenseFilters() {
    const keyword =
        document.getElementById(
            "adminExpenseSearch"
        )?.value
            .trim()
            .toLowerCase() || "";

    const statusFilter =
        document.getElementById(
            "adminExpenseFilter"
        )?.value || "All";

    filteredExpenses =
        adminExpenses.filter(
            function (expense) {
                const searchableText = [
                    expense.title,
                    expense.category,
                    expense.description,
                    expense.status,
                    expense.project?.title,
                    expense.file_name
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
                    normalizeExpenseStatus(
                        expense.status
                    ) === statusFilter;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );

    renderExpenses(
        filteredExpenses
    );
}

function updateExpenseSummary() {
    const totalAmount =
        adminExpenses.reduce(
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

    setText(
        "totalExpenseAmount",
        formatPeso(totalAmount)
    );

    setText(
        "approvedExpenses",
        adminExpenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Approved"
                );
            }
        ).length
    );

    setText(
        "pendingExpenses",
        adminExpenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Pending"
                );
            }
        ).length
    );

    setText(
        "flaggedExpenses",
        adminExpenses.filter(
            function (expense) {
                return (
                    normalizeExpenseStatus(
                        expense.status
                    ) === "Flagged"
                );
            }
        ).length
    );
}

function getApprovedProjectSpending(
    projectId
) {
    if (!projectId) {
        return 0;
    }

    return adminExpenses.reduce(
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
                    Number(
                        expense.amount || 0
                    )
                );
            }

            return total;
        },
        0
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

function getExpenseStatusClass(status) {
    const normalized =
        normalizeExpenseStatus(
            status
        );

    if (normalized === "Approved") {
        return "status-resolved";
    }

    if (normalized === "Flagged") {
        return "status-flagged";
    }

    return "status-pending";
}

function createSafeFileName(fileName) {
    const safeName =
        String(fileName || "receipt")
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "-"
            )
            .replace(/-+/g, "-")
            .slice(0, 120);

    return safeName || "receipt";
}

function formatFileSize(bytes) {
    const size =
        Number(bytes);

    if (!Number.isFinite(size)) {
        return "Unknown size";
    }

    if (size < 1024) {
        return `${size} B`;
    }

    if (
        size <
        1024 * 1024
    ) {
        return (
            `${(size / 1024).toFixed(1)} KB`
        );
    }

    return (
        `${(
            size /
            (1024 * 1024)
        ).toFixed(1)} MB`
    );
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    return new Date(
        dateValue
    ).toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
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

async function logAudit(
    action,
    module,
    details,
    publicVisible = true
) {
    const {
        data: { user }
    } =
        await supabaseClient.auth
            .getUser();

    if (!user) {
        console.warn(
            "Audit log skipped: no authenticated user."
        );

        return;
    }

    const { data: profile } =
        await supabaseClient
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();

    const { error } =
        await supabaseClient
            .from("audit_logs")
            .insert([
                {
                    user_id: user.id,
                    admin_name:
                        profile?.full_name ||
                        "Administrator",
                    action,
                    module,
                    details,
                    public_visible:
                        publicVisible
                }
            ]);

    if (error) {
        console.warn(
            "Audit log failed:",
            error.message
        );
    }
}