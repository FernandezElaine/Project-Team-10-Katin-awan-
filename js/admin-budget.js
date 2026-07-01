// js/admin-budget.js

let budgets = [];
let expenses = [];
let filteredBudgets = [];

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("budgetForm");

    if (form) {
        form.addEventListener("submit", saveBudget);
    }

    loadBudgets();
});

async function loadBudgets() {
    const list = document.getElementById("budgetList");
    if (!list) return;

    const { data: projectData, error: projectError } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });

    if (projectError) {
        list.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">Error loading budgets: ${projectError.message}</p>
            </div>
        `;
        return;
    }

    const { data: expenseData, error: expenseError } = await supabaseClient
        .from("expenses")
        .select("*")
        .order("id", { ascending: false });

    if (expenseError) {
        console.warn("Expenses could not be loaded:", expenseError.message);
        expenses = [];
    } else {
        expenses = expenseData || [];
    }

    budgets = projectData || [];
    filteredBudgets = [...budgets];

    renderBudgets(filteredBudgets);
    updateBudgetSummary();
}

function renderBudgets(items) {
    const list = document.getElementById("budgetList");
    if (!list) return;

    list.innerHTML = "";

    if (!items || items.length === 0) {
        list.innerHTML = `
            <div class="public-panel" style="grid-column: 1 / -1;">
                <p>No budget records found.</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const div = document.createElement("div");
        div.classList.add("document-card", "budget-card");

        div.innerHTML = `
            <div class="doc-icon">💰</div>

            <div>
                <h3>${item.title || "Untitled Project"}</h3>
                <p><b>Allocated Budget:</b> ${formatPeso(item.budget)}</p>
                <p><b>Status:</b> <span class="${getStatusClass(item.status)}">${item.status || "Planned"}</span></p>
                <p>${item.description || "No description provided."}</p>
            </div>

            <div class="admin-card-actions">
                <button onclick="editBudget(${item.id})">Edit</button>
                <button onclick="deleteBudget(${item.id})" class="danger-btn">Delete</button>
            </div>
        `;

        list.appendChild(div);
    });
}

async function saveBudget(e) {
    e.preventDefault();

    const id = document.getElementById("budgetId").value;
    const title = document.getElementById("budgetProject").value.trim();
    const budget = Number(document.getElementById("budgetAmount").value);
    const status = document.getElementById("budgetStatus").value;
    const description = document.getElementById("budgetDescription").value.trim();

    if (!title || !budget) {
        alert("Please fill in project name and allocated amount.");
        return;
    }

    const payload = {
        title,
        budget,
        status,
        description,
        category: "General",
        progress: status === "Completed" ? 100 : 0,
        timeline: "Not specified",
        contractor: "Not specified",
        bidder: "Not specified",
        location: "Not specified"
    };

    let result;

    if (id) {
        result = await supabaseClient
            .from("projects")
            .update(payload)
            .eq("id", Number(id));
    } else {
        result = await supabaseClient
            .from("projects")
            .insert([payload]);
    }

    if (result.error) {
        alert(result.error.message);
        return;
    }

    await logAudit(
        id ? "Updated budget allocation" : "Added budget allocation",
        "Budget",
        `${id ? "Updated" : "Added"} budget allocation: ${title}`,
        true
    );

    alert(id ? "Budget updated successfully." : "Budget added successfully.");

    clearBudgetForm();
    loadBudgets();
}

function editBudget(id) {
    const budget = budgets.find(b => b.id === id);
    if (!budget) return alert("Budget not found.");

    document.getElementById("budgetId").value = budget.id;
    document.getElementById("budgetProject").value = budget.title || "";
    document.getElementById("budgetAmount").value = budget.budget || "";
    document.getElementById("budgetStatus").value = budget.status || "Planned";
    document.getElementById("budgetDescription").value = budget.description || "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function deleteBudget(id) {
    if (!confirm("Delete this budget/project record?")) return;

    const budget = budgets.find(b => b.id === id);

    const { error } = await supabaseClient
        .from("projects")
        .delete()
        .eq("id", id);

    if (error) {
        alert(error.message);
        return;
    }

    await logAudit(
        "Deleted budget allocation",
        "Budget",
        `Deleted budget allocation: ${budget ? budget.title : "Budget ID " + id}`,
        true
    );

    alert("Budget record deleted successfully.");
    loadBudgets();
}

function clearBudgetForm() {
    document.getElementById("budgetId").value = "";
    document.getElementById("budgetProject").value = "";
    document.getElementById("budgetAmount").value = "";
    document.getElementById("budgetStatus").value = "Planned";
    document.getElementById("budgetDescription").value = "";
}

function updateBudgetSummary() {
    const totalBudget = budgets.reduce((sum, item) => {
        return sum + Number(item.budget || 0);
    }, 0);

    const totalExpenses = expenses.reduce((sum, item) => {
        return sum + Number(item.amount || 0);
    }, 0);

    const remainingBudget = totalBudget - totalExpenses;

    const completed = budgets.filter(b => b.status === "Completed").length;

    document.getElementById("totalBudget").textContent = formatPeso(totalBudget);
    document.getElementById("totalExpenses").textContent = formatPeso(totalExpenses);
    document.getElementById("remainingBudget").textContent = formatPeso(remainingBudget);
    document.getElementById("completedBudget").textContent = completed;
}

function searchBudgets() {
    const keyword = document.getElementById("budgetSearch").value.toLowerCase().trim();
    const status = document.getElementById("budgetFilter")?.value || "All";

    filteredBudgets = budgets.filter(item => {
        const matchesSearch =
            String(item.title || "").toLowerCase().includes(keyword) ||
            String(item.description || "").toLowerCase().includes(keyword) ||
            String(item.status || "").toLowerCase().includes(keyword);

        const matchesStatus =
            status === "All" || item.status === status;

        return matchesSearch && matchesStatus;
    });

    renderBudgets(filteredBudgets);
}

function filterBudgets() {
    searchBudgets();
}

function getStatusClass(status) {
    if (status === "Completed") return "status-resolved";
    if (status === "Ongoing") return "status-review";
    if (status === "Pending") return "status-pending";
    if (status === "Planned") return "status-pending";
    return "status-pending";
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}

async function logAudit(action, module, details, publicVisible = true) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        console.warn("Audit log skipped: no logged-in user.");
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

    if (profileError) {
        console.warn("Could not get admin profile:", profileError.message);
    }

    const adminName = profile?.full_name || "Administrator";

    const { error } = await supabaseClient
        .from("audit_logs")
        .insert([{
            user_id: user.id,
            admin_name: adminName,
            action,
            module,
            details,
            public_visible: publicVisible
        }]);

    if (error) {
        console.warn("Audit log failed:", error.message);
    }
}