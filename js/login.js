document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        console.error('Login form with id="loginForm" was not found.');
        return;
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        try {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {
                alert("Login failed: " + error.message);
                return;
            }

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("role, full_name")
                    .eq("id", data.user.id)
                    .single();

            if (profileError || !profile) {
                await supabaseClient.auth.signOut();
                console.error(profileError);
                alert("User profile was not found.");
                return;
            }

            const role = profile.role?.toLowerCase();

            if (role === "admin") {
                alert("Welcome Admin!");
                window.location.href = "admin-dashboard.html";
            } else if (role === "resident") {
                alert("Welcome Resident!");
                window.location.href = "dashboard.html";
            } else {
                await supabaseClient.auth.signOut();
                alert("Invalid account role.");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("An unexpected login error occurred.");
        }
    });
});

const forgotPasswordLink =
    document.getElementById("forgotPasswordLink");

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async function (event) {
        event.preventDefault();

        const email = document
            .getElementById("email")
            .value
            .trim();

        if (!email) {
            alert(
                "Please enter your email address first, then click Forgot password."
            );
            return;
        }

        try {
            const resetPageUrl = new URL(
                "reset-password.html",
                window.location.href
            ).href;

            const { error } =
                await supabaseClient.auth.resetPasswordForEmail(
                    email,
                    {
                        redirectTo: resetPageUrl
                    }
                );

            if (error) {
                console.error("Password reset error:", error);
                alert("Unable to send reset email: " + error.message);
                return;
            }

            alert(
                "Password reset instructions have been sent to your email."
            );
        } catch (error) {
            console.error("Unexpected reset error:", error);
            alert("An unexpected error occurred.");
        }
    });
}