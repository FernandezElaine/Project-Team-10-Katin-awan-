// js/admin-expenses.js

let adminExpenses = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("admin-expenses.js loaded");

    const form = document.getElementById("expenseForm");

    if (form) {
        form.addEventListener("submit", saveExpense);
    }

    loadExpenses();
});

async function loadExpenses() {
    const container = document.getElementById("expensesContainer");

    if (!container) {
        console.error("expensesContainer not found");
        return;
    }

    const { data, error } = await supabaseClient
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

    console.log("Expenses data:", data);
    console.log("Expenses error:", error);

    if (error) {
        container.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Failed to load expenses: ${error.message}</p>
            </div>
        `;
        return;
    }

    adminExpenses = data || [];

    updateExpenseSummary(adminExpenses);
    renderExpenses(adminExpenses);
}

function renderExpenses(expenses) {
    const container = document.getElementById("expensesContainer");

    if (!expenses || expenses.length === 0) {
        container.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No expenses found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    expenses.forEach(expense => {
        const card = document.createElement("div");
        card.classList.add("document-card");

        card.innerHTML = `
            <div class="doc-icon">💰</div>

            <div>
                <h3>${expense.title || "Untitled Expense"}</h3>
                <p><b>Category:</b> ${expense.category || "Other"}</p>
                <p><b>Amount:</b> ₱${Number(expense.amount || 0).toLocaleString()}</p>
                <p>${expense.description || "No description provided."}</p>
                <span>${expense.status || "Pending"}</span>
                <p><small>Added: ${formatDate(expense.created_at)}</small></p>
            </div>

            <div class="admin-card-actions">
                <button onclick="viewExpenseFile('${expense.file_url || ""}')">View File</button>
                <button onclick="editExpense(${expense.id})">Edit</button>
                <button onclick="deleteExpense(${expense.id})" class="danger-btn">Delete</button>
            </div>
        `;

        container.appendChild(card);
    });
}

async function saveExpense(e) {
    e.preventDefault();

    const id = document.getElementById("expenseId").value;
    const title = document.getElementById("expenseTitle").value.trim();
    const category = document.getElementById("expenseCategory").value;
    const amount = document.getElementById("expenseAmount").value;
    const status = document.getElementById("expenseStatus").value;
    const description = document.getElementById("expenseDescription").value.trim();
    const file_url = document.getElementById("expenseFileUrl").value.trim();

    if (!title || !category || !amount) {
        alert("Please fill in expense title, category, and amount.");
        return;
    }

    const payload = {
        title,
        category,
        amount: Number(amount),
        status,
        description,
        file_url
    };

    let result;

    if (id) {
        result = await supabaseClient
            .from("expenses")
            .update(payload)
            .eq("id", id);
    } else {
        result = await supabaseClient
            .from("expenses")
            .insert([payload]);
    }

    if (result.error) {
        alert(result.error.message);
        console.error(result.error);
        return;
    }

    await logAudit(
        id ? "Updated expense" : "Added expense",
        "Expenses",
        `${id ? "Updated" : "Added"} expense: ${title}`,
        true
    );

    alert(id ? "Expense updated successfully." : "Expense added successfully.");

    clearExpenseForm();
    loadExpenses();
}

function editExpense(id) {
    const expense = adminExpenses.find(item => item.id === id);

    if (!expense) {
        alert("Expense not found.");
        return;
    }

    document.getElementById("expenseId").value = expense.id;
    document.getElementById("expenseTitle").value = expense.title || "";
    document.getElementById("expenseCategory").value = expense.category || "Other";
    document.getElementById("expenseAmount").value = expense.amount || "";
    document.getElementById("expenseStatus").value = expense.status || "Pending";
    document.getElementById("expenseDescription").value = expense.description || "";
    document.getElementById("expenseFileUrl").value = expense.file_url || "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense?")) {
        return;
    }

    const expense = adminExpenses.find(item => item.id === id);

    const { error } = await supabaseClient
        .from("expenses")
        .delete()
        .eq("id", id);

    if (error) {
        alert(error.message);
        console.error(error);
        return;
    }

    await logAudit(
        "Deleted expense",
        "Expenses",
        `Deleted expense: ${expense ? expense.title : "Expense ID " + id}`,
        true
    );

    alert("Expense deleted successfully.");
    loadExpenses();
}

function clearExpenseForm() {
    document.getElementById("expenseId").value = "";
    document.getElementById("expenseTitle").value = "";
    document.getElementById("expenseCategory").value = "Infrastructure";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseStatus").value = "Pending";
    document.getElementById("expenseDescription").value = "";
    document.getElementById("expenseFileUrl").value = "";
}

function viewExpenseFile(fileUrl) {
    if (!fileUrl) {
        alert("No file URL available.");
        return;
    }

    window.open(fileUrl, "_blank");
}

function searchAdminExpenses() {
    const searchValue = document.getElementById("adminExpenseSearch").value.toLowerCase();

    const filtered = adminExpenses.filter(expense =>
        (expense.title || "").toLowerCase().includes(searchValue) ||
        (expense.category || "").toLowerCase().includes(searchValue) ||
        (expense.description || "").toLowerCase().includes(searchValue) ||
        (expense.status || "").toLowerCase().includes(searchValue)
    );

    renderExpenses(filtered);
}

function filterAdminExpenses() {
    const filterValue = document.getElementById("adminExpenseFilter").value;

    if (filterValue === "All") {
        renderExpenses(adminExpenses);
        return;
    }

    const filtered = adminExpenses.filter(expense => expense.status === filterValue);
    renderExpenses(filtered);
}

function updateExpenseSummary(expenses) {
    const totalAmount = expenses.reduce((sum, item) => {
        return sum + Number(item.amount || 0);
    }, 0);

    document.getElementById("totalExpenseAmount").textContent =
        `₱${totalAmount.toLocaleString()}`;

    document.getElementById("validExpenses").textContent =
        expenses.filter(item => item.status === "Valid").length;

    document.getElementById("pendingExpenses").textContent =
        expenses.filter(item => item.status === "Pending").length;

    document.getElementById("flaggedExpenses").textContent =
        expenses.filter(item => item.status === "Flagged").length;
}

function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

async function logAudit(action, module, details, publicVisible = true) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient
        .from("audit_logs")
        .insert([
            {
                user_id: user ? user.id : null,
                action,
                module,
                details,
                public_visible: publicVisible
            }
        ]);

    if (error) {
        console.warn("Audit log failed:", error.message);
    }
}