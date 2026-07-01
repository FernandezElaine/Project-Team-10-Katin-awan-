// js/auth-nav.js

// Run this after DOM content is loaded
window.addEventListener("DOMContentLoaded", async () => {
    const authArea = document.getElementById("authArea");
    if (!authArea) return;

    try {
        // Get current session
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error("Supabase session error:", error);
            authArea.innerHTML = `<a href="login.html" class="login-link">Login</a>`;
            return;
        }

        if (data?.session) {
            // User is logged in
            authArea.innerHTML = `<button onclick="logoutUser()" class="logout-btn">Logout</button>`;
        } else {
            // User not logged in
            authArea.innerHTML = `<a href="login.html" class="login-link">Login</a>`;
        }
    } catch (err) {
        console.error("Auth nav error:", err);
        authArea.innerHTML = `<a href="login.html" class="login-link">Login</a>`;
    }
});

// Logout function
async function logoutUser() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert("Logout failed: " + error.message);
            return;
        }
        alert("Logged out successfully.");
        window.location.href = "../index.html"; // redirect to landing page
    } catch (err) {
        console.error("Logout error:", err);
        alert("Logout failed.");
    }
}