// js/landing.js

// Show/hide modals
function showAdminLogin() {
    const adminModal = document.getElementById("adminModal");
    if (adminModal) adminModal.style.display = "flex";
}

function showSignup() {
    const signupModal = document.getElementById("signupModal");
    if (signupModal) signupModal.style.display = "flex";
}

function closeModal() {
    const adminModal = document.getElementById("adminModal");
    const signupModal = document.getElementById("signupModal");
    if (adminModal) adminModal.style.display = "none";
    if (signupModal) signupModal.style.display = "none";
}

// Show admin login button only when URL has ?admin=true
window.addEventListener("DOMContentLoaded", function () {
    const adminButton = document.getElementById("adminLoginButton");
    if (adminButton && window.location.search.includes("admin=true")) {
        adminButton.style.display = "inline-block";
    }
});

// Admin login using Supabase
async function adminLogin() {
    const email = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPass").value.trim();

    if (!email || !password) {
        alert("Please enter admin email and password.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Login failed: " + error.message);
        return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    if (profileError || !profile) {
        alert("Login successful, but profile role was not found.");
        return;
    }

    if (profile.role === "admin") {
        alert("Admin login successful!");
        // redirect to admin dashboard page
        window.location.href = "pages/admin-dashboard.html";
    } else {
        alert("This account is not an admin account.");
        await supabaseClient.auth.signOut();
    }
}

// Admin account creation
async function createAdminAccount() {
    const fullName = document.getElementById("adminFullName").value.trim();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();

    if (!fullName || !email || !password) {
        alert("Please fill in all fields to create an admin account.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
                role: "admin"
            }
        }
    });

    if (error) {
        alert("Failed to create admin account: " + error.message);
        return;
    }

    alert("Admin account created successfully! You can now log in.");
    closeModal();
}

// Close modal when clicking outside
window.onclick = function (event) {
    const adminModal = document.getElementById("adminModal");
    const signupModal = document.getElementById("signupModal");
    if (event.target === adminModal || event.target === signupModal) {
        closeModal();
    }
};