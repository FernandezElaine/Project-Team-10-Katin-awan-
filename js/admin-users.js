// js/admin-users.js
import { supabase } from "./supabase.js";

let usersList = [];

document.addEventListener("DOMContentLoaded", () => {
    loadUsers();
});

export async function loadUsers() {
    const container = document.getElementById("usersContainer");
    if (!container) return;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">Failed to load users: ${error.message}</p>`;
        return;
    }

    usersList = data || [];
    renderUsers(usersList);
}

function renderUsers(list) {
    const container = document.getElementById("usersContainer");
    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = "<p>No users found.</p>";
        return;
    }

    list.forEach(user => {
        const div = document.createElement("div");
        div.classList.add("document-card");
        div.innerHTML = `
            <div>
                <h3>${user.full_name || user.username}</h3>
                <p><b>Email:</b> ${user.email}</p>
                <p><b>Role:</b> ${user.role || "Resident"}</p>
            </div>
            <div class="admin-card-actions">
                <button onclick="deleteUser('${user.id}')" class="danger-btn">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

export async function deleteUser(id) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);

    if (error) return alert(error.message);
    loadUsers();
}