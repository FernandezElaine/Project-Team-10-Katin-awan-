// js/admin-auth.js

document.addEventListener("DOMContentLoaded", async function () {
    /*
     * Keep the administrator page hidden until access
     * has been verified.
     */
    document.documentElement.classList.add(
        "admin-auth-pending"
    );

    /**
     * Redirects to the shared login page.
     * The current administrator page is included so a verified
     * admin can return after logging in.
     */
    function redirectToLogin() {
        const currentPage =
            window.location.pathname
                .split("/")
                .pop() || "admin-dashboard.html";

        const loginUrl =
            "login.html?redirect=" +
            encodeURIComponent(currentPage);

        window.location.replace(loginUrl);
    }

    /**
     * Displays the administrator page after successful
     * authentication and role verification.
     */
    function showAdminPage() {
        document.documentElement.classList.remove(
            "admin-auth-pending"
        );

        document.documentElement.classList.add(
            "admin-auth-verified"
        );
    }

    /**
     * Checks whether the current authenticated account
     * has an administrator profile.
     */
    async function checkAdminAccess() {
        try {
            /*
             * getUser() verifies the user through Supabase Auth
             * instead of relying only on locally stored session data.
             */
            const {
                data: { user },
                error: userError
            } = await supabaseClient.auth.getUser();

            if (userError || !user) {
                console.error(
                    "Administrator authentication error:",
                    userError
                );

                redirectToLogin();
                return false;
            }

            /*
             * Retrieve the corresponding application profile.
             */
            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("role, full_name")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "Administrator profile error:",
                    profileError
                );

                await supabaseClient.auth.signOut();

                alert(
                    "The system could not verify your account profile."
                );

                redirectToLogin();
                return false;
            }

            if (!profile) {
                console.error(
                    "No profile exists for authenticated user:",
                    user.id
                );

                await supabaseClient.auth.signOut();

                alert(
                    "Your authentication account has no profile record. Please contact the system administrator."
                );

                redirectToLogin();
                return false;
            }

            const role = String(profile.role || "")
                .trim()
                .toLowerCase();

            /*
             * Keep residents logged in, but redirect them to
             * the resident dashboard.
             */
            if (role !== "admin") {
                console.warn(
                    "Non-admin attempted administrator access:",
                    {
                        userId: user.id,
                        role
                    }
                );

                alert(
                    "Access denied. This page is for administrators only."
                );

                window.location.replace("dashboard.html");
                return false;
            }

            /*
             * Display the administrator's name when the current
             * page contains an element with id="adminName".
             */
            const adminName =
                document.getElementById("adminName");

            if (adminName) {
                adminName.textContent =
                    profile.full_name?.trim() ||
                    user.email ||
                    "Administrator";
            }

            showAdminPage();
            return true;
        } catch (unexpectedError) {
            console.error(
                "Unexpected administrator-access error:",
                unexpectedError
            );

            alert(
                "An unexpected error occurred while verifying administrator access."
            );

            redirectToLogin();
            return false;
        }
    }

    /**
     * Administrator logout.
     */
    async function adminLogout() {
        const confirmed = window.confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmed) {
            return;
        }

        try {
            const { error } =
                await supabaseClient.auth.signOut();

            if (error) {
                console.error(
                    "Administrator logout error:",
                    error
                );

                alert(
                    "Logout failed: " +
                    error.message
                );

                return;
            }

            sessionStorage.removeItem(
                "katinawanAuthDisplay"
            );

            window.location.replace("../index.html");
        } catch (unexpectedError) {
            console.error(
                "Unexpected administrator logout error:",
                unexpectedError
            );

            alert(
                "An unexpected error occurred while logging out."
            );
        }
    }

    /*
     * Make adminLogout available to existing HTML buttons
     * that use onclick="adminLogout()".
     */
    window.adminLogout = adminLogout;

    await checkAdminAccess();
});