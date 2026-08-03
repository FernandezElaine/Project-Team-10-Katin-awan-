document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const rememberMeCheckbox = document.getElementById("rememberMe");
    const forgotPasswordLink = document.getElementById(
        "forgotPasswordLink"
    );
    const loginButton = document.getElementById("loginButton");

    /*
     * Stop the script when the login form is not present.
     * This prevents errors when login.js is accidentally loaded
     * on another page.
     */
    if (!loginForm) {
        console.error(
            'Login form with id="loginForm" was not found.'
        );
        return;
    }

    /*
     * Pages that each role is allowed to access after login.
     * This protects the redirect query parameter.
     */
    const allowedRedirects = {
        admin: [
            "admin-dashboard.html",
            "admin-budget.html",
            "admin-expenses.html",
            "admin-projects.html",
            "admin-documents.html",
            "admin-map.html",
            "admin-feedback.html",
            "admin-audit.html",
            "admin-users.html"
        ],

        resident: [
            "dashboard.html",
            "projects.html",
            "expenses.html",
            "documents.html",
            "map.html",
            "uploads.html",
            "chatbot.html",
            "feedback.html"
        ]
    };

    /*
     * Default dashboard for each role.
     */
    const defaultPages = {
        admin: "admin-dashboard.html",
        resident: "dashboard.html"
    };

    /*
     * Restore the email saved by Remember Me.
     * Only the email is stored. The password is never stored.
     */
    const rememberedEmail = localStorage.getItem(
        "katinawanRememberedEmail"
    );

    if (rememberedEmail) {
        emailInput.value = rememberedEmail;

        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }

    /*
     * Returns a safe redirect page.
     * Residents cannot be redirected to admin pages.
     * External website redirects are also rejected.
     */
    function getSafeRedirect(role) {
        const params = new URLSearchParams(
            window.location.search
        );

        const requestedRedirect = params.get("redirect");

        if (!requestedRedirect) {
            return defaultPages[role];
        }

        /*
         * Remove folders, query strings, and fragments.
         *
         * Example:
         * ../pages/projects.html?id=2
         * becomes:
         * projects.html
         */
        const pageName = requestedRedirect
            .replace(/\\/g, "/")
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop();

        const rolePages = allowedRedirects[role] || [];

        if (rolePages.includes(pageName)) {
            return pageName;
        }

        return defaultPages[role];
    }

    /*
     * Main login process.
     */
    loginForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const email = emailInput.value.trim();

            /*
             * Do not trim the password because spaces can be
             * legitimate password characters.
             */
            const password = passwordInput.value;

            if (!email || !password) {
                alert("Please enter your email and password.");
                return;
            }

            /*
             * Prevent the user from clicking Log In repeatedly.
             */
            if (loginButton) {
                loginButton.disabled = true;
                loginButton.textContent = "Logging in...";
            }

            try {
                /*
                 * Authenticate the email and password through
                 * Supabase Auth.
                 */
                const { data, error } =
                    await supabaseClient.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) {
                    console.error(
                        "Authentication error:",
                        error
                    );

                    alert("Login failed: " + error.message);
                    return;
                }

                if (!data?.user) {
                    alert(
                        "Login failed because user information was not returned."
                    );
                    return;
                }

                /*
                 * Retrieve the role and name from the profiles table.
                 *
                 * maybeSingle() is used instead of single().
                 * It avoids a 406 response when no profile is found.
                 */
                const {
                    data: profile,
                    error: profileError
                } = await supabaseClient
                    .from("profiles")
                    .select("role, full_name")
                    .eq("id", data.user.id)
                    .maybeSingle();

                if (profileError) {
                    console.error(
                        "Profile retrieval error:",
                        profileError
                    );

                    await supabaseClient.auth.signOut();

                    alert(
                        "The system could not retrieve your user profile."
                    );
                    return;
                }

                if (!profile) {
                    await supabaseClient.auth.signOut();

                    alert(
                        "Your authentication account exists, but no profile record was found. Please contact the administrator."
                    );
                    return;
                }

                /*
                 * Normalize the role to avoid differences such as:
                 * Admin, ADMIN, admin, or spaces.
                 */
                const role = String(profile.role || "")
                    .trim()
                    .toLowerCase();

                if (
                    role !== "admin" &&
                    role !== "resident"
                ) {
                    console.error(
                        "Invalid profile role:",
                        profile.role
                    );

                    await supabaseClient.auth.signOut();

                    alert(
                        "Your account has an invalid role. Please contact the administrator."
                    );
                    return;
                }

                /*
                 * Remember only the email address.
                 * Never store the password in localStorage.
                 */
                if (rememberMeCheckbox?.checked) {
                    localStorage.setItem(
                        "katinawanRememberedEmail",
                        email
                    );
                } else {
                    localStorage.removeItem(
                        "katinawanRememberedEmail"
                    );
                }

                const destination =
                    getSafeRedirect(role);

                const displayName =
                    profile.full_name?.trim() || "User";

                if (role === "admin") {
                    alert(
                        `Welcome, Administrator ${displayName}!`
                    );
                } else {
                    alert(`Welcome, ${displayName}!`);
                }

                window.location.href = destination;
            } catch (unexpectedError) {
                console.error(
                    "Unexpected login error:",
                    unexpectedError
                );

                alert(
                    "An unexpected error occurred while logging in. Please try again."
                );
            } finally {
                /*
                 * Restore the login button when the process ends.
                 */
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = "Log In";
                }
            }
        }
    );

    /*
     * Forgot Password process.
     */
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener(
            "click",
            async function (event) {
                event.preventDefault();

                const email = emailInput.value.trim();

                if (!email) {
                    alert(
                        "Enter your email address first, then click Forgot password."
                    );

                    emailInput.focus();
                    return;
                }

                /*
                 * The recovery email will redirect the user to:
                 * pages/reset-password.html
                 */
               const resetPageUrl =
    window.location.origin +
    "/pages/reset-password.html";

console.log("Password reset redirect URL:", resetPageUrl);

                forgotPasswordLink.style.pointerEvents =
                    "none";

                forgotPasswordLink.textContent =
                    "Sending...";

                try {
                    const { error } =
                        await supabaseClient.auth
                            .resetPasswordForEmail(
                                email,
                                {
                                    redirectTo:
                                        resetPageUrl
                                }
                            );

                    if (error) {
                        console.error(
                            "Password reset error:",
                            error
                        );

                        alert(
                            "Unable to send the password reset email: " +
                            error.message
                        );

                        return;
                    }

                    alert(
                        "Password reset instructions have been sent. Please check your email inbox and spam folder."
                    );
                } catch (unexpectedError) {
                    console.error(
                        "Unexpected password reset error:",
                        unexpectedError
                    );

                    alert(
                        "An unexpected error occurred while sending the reset email."
                    );
                } finally {
                    forgotPasswordLink.style.pointerEvents =
                        "auto";

                    forgotPasswordLink.textContent =
                        "Forgot password?";
                }
            }
        );
    }
});