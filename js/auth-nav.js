// js/auth-nav.js

document.addEventListener("DOMContentLoaded", async function () {
    const authArea = document.getElementById("authArea");
    const heroPortalAction =
        document.getElementById("heroPortalAction");

    // Some pages do not contain authArea.
    if (!authArea) {
        return;
    }

    /*
     * Determine whether the current HTML page is inside
     * the /pages/ folder.
     */
    const isInsidePagesFolder =
        window.location.pathname.includes("/pages/");

    /*
     * Generate the correct path depending on the current page.
     *
     * From index.html:
     * pages/login.html
     *
     * From pages/dashboard.html:
     * login.html
     */
    function getPagePath(fileName) {
        return isInsidePagesFolder
            ? fileName
            : `pages/${fileName}`;
    }

    const homePage = isInsidePagesFolder
        ? "../index.html"
        : "index.html";

    /*
     * Create a normal navigation link.
     */
    function createLink(text, href, className) {
        const link = document.createElement("a");

        link.textContent = text;
        link.href = href;
        link.className = className;

        return link;
    }

    /*
     * Add the Logout button.
     */
    function createLogoutButton() {
        const logoutButton =
            document.createElement("button");

        logoutButton.type = "button";
        logoutButton.className = "logout-btn";
        logoutButton.textContent = "Logout";

        logoutButton.addEventListener(
            "click",
            logoutUser
        );

        return logoutButton;
    }

    /*
     * Navigation shown when no user is logged in.
     */
    function showGuestNavigation() {
        authArea.innerHTML = "";

        authArea.appendChild(
            createLink(
                "Login",
                getPagePath("login.html"),
                "login-link"
            )
        );

        authArea.appendChild(
            createLink(
                "Create Account",
                getPagePath("register.html"),
                "register-link"
            )
        );

        if (heroPortalAction) {
            heroPortalAction.href =
                getPagePath("dashboard.html");

            heroPortalAction.textContent =
                "View Portal";
        }
    }

    /*
     * Navigation shown to resident users.
     */
    function showResidentNavigation() {
        authArea.innerHTML = "";

        authArea.appendChild(
            createLink(
                "My Portal",
                getPagePath("dashboard.html"),
                "dashboard-link"
            )
        );

        authArea.appendChild(
            createLogoutButton()
        );

        if (heroPortalAction) {
            heroPortalAction.href =
                getPagePath("dashboard.html");

            heroPortalAction.textContent =
                "Open My Portal";
        }
    }

    /*
     * Navigation shown to administrators.
     */
    function showAdminNavigation() {
        authArea.innerHTML = "";

        authArea.appendChild(
            createLink(
                "Admin Dashboard",
                getPagePath("admin-dashboard.html"),
                "dashboard-link"
            )
        );

        authArea.appendChild(
            createLogoutButton()
        );

        if (heroPortalAction) {
            heroPortalAction.href =
                getPagePath("admin-dashboard.html");

            heroPortalAction.textContent =
                "Open Admin Dashboard";
        }
    }

    /*
     * Retrieve the authenticated user's session and role.
     */
    async function renderAuthNavigation() {
        try {
            const {
                data: { session },
                error: sessionError
            } = await supabaseClient.auth.getSession();

            if (sessionError) {
                console.error(
                    "Session error:",
                    sessionError
                );

                showGuestNavigation();
                return;
            }

            if (!session) {
                showGuestNavigation();
                return;
            }

            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "Profile retrieval error:",
                    profileError
                );

                await supabaseClient.auth.signOut();
                showGuestNavigation();
                return;
            }

            if (!profile) {
                console.error(
                    "Authenticated user has no profile record."
                );

                await supabaseClient.auth.signOut();
                showGuestNavigation();
                return;
            }

            const role = String(profile.role || "")
                .trim()
                .toLowerCase();

            if (role === "admin") {
                showAdminNavigation();
                return;
            }

            if (role === "resident") {
                showResidentNavigation();
                return;
            }

            console.error(
                "Invalid account role:",
                profile.role
            );

            await supabaseClient.auth.signOut();
            showGuestNavigation();
        } catch (error) {
            console.error(
                "Authentication navigation error:",
                error
            );

            showGuestNavigation();
        }
    }

    /*
     * Log the current user out.
     */
    async function logoutUser() {
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
                    "Logout error:",
                    error
                );

                alert(
                    "Logout failed: " +
                    error.message
                );

                return;
            }

            window.location.replace(homePage);
        } catch (error) {
            console.error(
                "Unexpected logout error:",
                error
            );

            alert(
                "An unexpected error occurred while logging out."
            );
        }
    }

    // Display the correct navigation when the page loads.
    await renderAuthNavigation();

    /*
     * Refresh the navigation when the authentication
     * state changes.
     */
    const {
        data: authListener
    } = supabaseClient.auth.onAuthStateChange(
        function (event) {
            if (
                event === "SIGNED_IN" ||
                event === "SIGNED_OUT" ||
                event === "TOKEN_REFRESHED" ||
                event === "USER_UPDATED"
            ) {
                setTimeout(
                    renderAuthNavigation,
                    0
                );
            }
        }
    );

    /*
     * Remove the Supabase listener when leaving the page.
     */
    window.addEventListener(
        "pagehide",
        function () {
            authListener?.subscription?.unsubscribe();
        }
    );
});