// js/admin-users.js

let usersList = [];
let filteredUsers = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadAdminProfile();
    await loadUsers();
});

async function loadAdminProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) return;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

    if (error) {
        console.warn("Profile load failed:", error.message);
        return;
    }

    const input = document.getElementById("adminDisplayName");
    if (input) input.value = data?.full_name || "";
}

async function saveAdminDisplayName() {
    const input = document.getElementById("adminDisplayName");
    const name = input.value.trim();

    if (!name) {
        alert("Please enter your display name.");
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("You must be logged in.");
        return;
    }

    const { error } = await supabaseClient
        .from("profiles")
        .update({ full_name: name })
        .eq("id", user.id);

    if (error) {
        alert("Failed to save profile: " + error.message);
        return;
    }

    await supabaseClient
        .from("audit_logs")
        .update({ admin_name: name })
        .eq("user_id", user.id)
        .or("admin_name.is.null,admin_name.eq.Administrator");

    alert("Admin display name saved. Future logs will show: " + name);
}

async function loadUsers() {
    const container = document.getElementById("usersContainer");
    if (!container) return;

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">Failed to load users: ${escapeHTML(error.message)}</p>`;
        return;
    }

    usersList = data || [];
    filteredUsers = [...usersList];

    renderUsers(filteredUsers);
    updateUserSummary(usersList);
}

function renderUsers(list) {
    const container = document.getElementById("usersContainer");
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="document-card">
                <div>
                    <h3>No users found</h3>
                    <p>No matching user records.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(user => {
        const displayName = user.full_name || user.username || "Unnamed User";
        const role = user.role || "resident";
        const status = user.status || "active";

        return `
            <div class="document-card">
                <div class="doc-icon">${role === "admin" ? "🛠️" : "🏠"}</div>

                <div>
                    <h3>${escapeHTML(displayName)}</h3>
                    <p><b>Role:</b> ${escapeHTML(role)}</p>
                    <p><b>Status:</b> ${escapeHTML(status)}</p>
                    <span>${formatDate(user.created_at)}</span>
                </div>

                <div class="admin-card-actions">
                    <button onclick="changeUserRole('${user.id}', '${role === "admin" ? "resident" : "admin"}')">
                        Make ${role === "admin" ? "Resident" : "Admin"}
                    </button>
                    <button onclick="deleteUser('${user.id}')" class="danger-btn">Delete</button>
                </div>
            </div>
        `;
    }).join("");
}

function searchAdminUsers() {
    const keyword = document.getElementById("adminUserSearch").value.toLowerCase().trim();
    const roleFilter = document.getElementById("adminUserFilter").value;

    filteredUsers = usersList.filter(user => {
        const displayName = user.full_name || user.username || "";
        const role = user.role || "resident";
        const status = user.status || "active";

        const matchesSearch =
            String(displayName).toLowerCase().includes(keyword) ||
            String(role).toLowerCase().includes(keyword) ||
            String(status).toLowerCase().includes(keyword);

        const matchesRole =
            roleFilter === "All" || role === roleFilter;

        return matchesSearch && matchesRole;
    });

    renderUsers(filteredUsers);
    updateUserSummary(filteredUsers);
}

function filterAdminUsers() {
    searchAdminUsers();
}

async function changeUserRole(id, newRole) {
    if (!confirm(`Change this user's role to ${newRole}?`)) return;

    const { error } = await supabaseClient
        .from("profiles")
        .update({ role: newRole })
        .eq("id", id);

    if (error) {
        alert("Role update failed: " + error.message);
        return;
    }

    await logAudit(
        "Updated user role",
        "Users",
        `Changed user role to ${newRole}`,
        false
    );

    alert("User role updated.");
    await loadUsers();
}

async function deleteUser(id) {
    if (!confirm("Are you sure you want to delete this user profile?")) return;

    const userRecord = usersList.find(user => String(user.id) === String(id));

    const { error } = await supabaseClient
        .from("profiles")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Delete failed: " + error.message);
        return;
    }

    await logAudit(
        "Deleted user profile",
        "Users",
        `Deleted user profile: ${userRecord ? userRecord.full_name || userRecord.username || id : id}`,
        false
    );

    alert("User profile deleted.");
    await loadUsers();
}

function updateUserSummary(list) {
    const totalUsers = list.length;
    const admins = list.filter(user => user.role === "admin").length;
    const residents = list.filter(user => user.role === "resident" || !user.role).length;
    const inactive = list.filter(user => user.status === "inactive" || user.is_active === false).length;

    document.getElementById("totalUsers").textContent = totalUsers;
    document.getElementById("adminUsers").textContent = admins;
    document.getElementById("residentUsers").textContent = residents;
    document.getElementById("inactiveUsers").textContent = inactive;
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

function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}