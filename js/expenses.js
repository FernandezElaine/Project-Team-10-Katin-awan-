// js/expenses.js

let publicExpenses = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("expenses.js loaded");
    loadExpenses();
});

async function loadExpenses() {
    const expenseTable = document.getElementById("expenseTable");

    if (!expenseTable) {
        console.error("expenseTable not found");
        return;
    }

    const { data, error } = await supabaseClient
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

    console.log("Public expenses data:", data);
    console.log("Public expenses error:", error);

    if (error) {
        expenseTable.innerHTML = `
            <tr>
                <td colspan="7" style="color:red;">
                    Failed to load expenses: ${error.message}
                </td>
            </tr>
        `;
        return;
    }

    publicExpenses = data || [];

    updateExpenseStats(publicExpenses);
    renderExpenses(publicExpenses);
}

function renderExpenses(expenses) {
    const expenseTable = document.getElementById("expenseTable");

    if (!expenses || expenses.length === 0) {
        expenseTable.innerHTML = `
            <tr>
                <td colspan="7">No expenses found.</td>
            </tr>
        `;
        return;
    }

    expenseTable.innerHTML = "";

    expenses.forEach(expense => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${expense.title || "Untitled Expense"}</td>
            <td>${expense.category || "Other"}</td>
            <td>₱${Number(expense.amount || 0).toLocaleString()}</td>
            <td>${expense.description || "No description provided."}</td>
            <td>${formatDate(expense.created_at)}</td>
            <td>
                <span class="${getStatusClass(expense.status)}">
                    ${expense.status || "Pending"}
                </span>
            </td>
            <td>
                ${
                    expense.file_url
                        ? `<button onclick="viewExpenseFile('${expense.file_url}')">View</button>`
                        : "No file"
                }
            </td>
        `;

        expenseTable.appendChild(row);
    });
}

function searchExpenses() {
    const searchInput = document.getElementById("expenseSearch");

    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase().trim();
    const selectedStatus = document.getElementById("expenseFilter")?.value || "All";

    let filtered = publicExpenses;

    if (selectedStatus !== "All") {
        filtered = filtered.filter(expense => expense.status === selectedStatus);
    }

    if (keyword) {
        filtered = filtered.filter(expense =>
            (expense.title || "").toLowerCase().includes(keyword) ||
            (expense.category || "").toLowerCase().includes(keyword) ||
            (expense.description || "").toLowerCase().includes(keyword) ||
            String(expense.amount || "").toLowerCase().includes(keyword) ||
            (expense.status || "").toLowerCase().includes(keyword)
        );
    }

    renderExpenses(filtered);
}

function filterExpenses() {
    searchExpenses();
}

function updateExpenseStats(expenses) {
    const totalAmount = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount || 0);
    }, 0);

    document.getElementById("totalExpenses").textContent =
        `₱${totalAmount.toLocaleString()}`;

    document.getElementById("validCount").textContent =
        expenses.filter(expense => expense.status === "Valid").length;

    document.getElementById("flaggedCount").textContent =
        expenses.filter(expense => expense.status === "Flagged").length;

    document.getElementById("pendingCount").textContent =
        expenses.filter(expense => expense.status === "Pending").length;
}

function viewExpenseFile(fileUrl) {
    if (!fileUrl) {
        alert("No file available.");
        return;
    }

    window.open(fileUrl, "_blank");
}

function getStatusClass(status) {
    switch (status) {
        case "Valid":
            return "status-resolved";
        case "Flagged":
            return "status-pending";
        case "Pending":
            return "status-review";
        default:
            return "status-review";
    }
}

function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}