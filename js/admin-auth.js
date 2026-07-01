// js/admin-auth.js

async function checkAdminAccess() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        alert("Please log in as admin first.");
        window.location.href = "../index.html?admin=true";
        return;
    }

    const userId = sessionData.session.user.id;

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single();

    if (profileError || !profile) {
        alert("Profile not found.");
        await supabaseClient.auth.signOut();
        window.location.href = "../index.html?admin=true";
        return;
    }

    if (profile.role !== "admin") {
        alert("Access denied. Admins only.");
        window.location.href = "dashboard.html";
        return;
    }

    const adminName = document.getElementById("adminName");
    if (adminName) {
        adminName.textContent = profile.full_name || "Administrator";
    }
}

async function adminLogout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
        return;
    }

    alert("Admin logged out.");
    window.location.href = "../index.html";
}

checkAdminAccess();