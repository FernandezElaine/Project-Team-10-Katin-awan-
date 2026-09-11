// js/auth-nav.js

document.addEventListener("DOMContentLoaded", async function () {

    const authArea = document.getElementById("authArea");
    const accountAction = document.getElementById("accountAction");

    const heroPortalAction = document.getElementById("heroPortalAction");
    const heroLoginAction = document.getElementById("heroLoginAction");
    const heroRegisterAction = document.getElementById("heroRegisterAction");

    if (!authArea) {
        return;
    }

    /*
     * Determine whether the current page is inside /pages/
     */
    const isInsidePagesFolder =
        window.location.pathname.includes("/pages/");

    /*
     * Build correct paths depending on location.
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
     * Create a navigation link.
     */
    function createLink(text, href, className) {
        const link = document.createElement("a");

        link.textContent = text;
        link.href = href;
        link.className = className;

        return link;
    }

    /*
     * Create Logout button.
     */
    function createLogoutButton() {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "logout-btn";
        button.textContent = "Logout";

        button.addEventListener("click", logoutUser);

        return button;
    }

    /*
     * Configure the Login / Logout button
     * used on pages inside /pages/.
     */
    function configureInternalAccountButton(isLoggedIn) {

        if (!accountAction) {
            return;
        }

        /*
         * Clone the existing button so any old
         * click handlers are removed.
         */
        const replacement = accountAction.cloneNode(true);

        accountAction.replaceWith(replacement);

        replacement.disabled = false;

        if (isLoggedIn) {

            replacement.textContent = "Logout";
            replacement.className = "logout-btn";

            replacement.addEventListener(
                "click",
                logoutUser
            );

        } else {

            replacement.textContent = "Login";
            replacement.className = "login-link";

            replacement.addEventListener(
                "click",
                function () {
                    window.location.href =
                        getPagePath("login.html");
                }
            );
        }
    }

    /*
     * Navigation for logged-out visitors.
     */
    function showGuestNavigation() {

        if (isInsidePagesFolder) {

            configureInternalAccountButton(false);

            return;
        }

        authArea.innerHTML = "";

        if (heroPortalAction) {

            heroPortalAction.href =
                getPagePath("dashboard.html");

            heroPortalAction.textContent =
                "View Portal";
        }

        if (heroLoginAction) {
            heroLoginAction.hidden = false;
        }

        if (heroRegisterAction) {
            heroRegisterAction.hidden = false;
        }
    }

    /*
     * Navigation for residents.
     */
    function showResidentNavigation() {

        if (isInsidePagesFolder) {

            configureInternalAccountButton(true);

            return;
        }

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

        if (heroLoginAction) {
            heroLoginAction.hidden = true;
        }

        if (heroRegisterAction) {
            heroRegisterAction.hidden = true;
        }
    }

    /*
     * Navigation for administrators.
     */
    function showAdminNavigation() {

        if (isInsidePagesFolder) {

            configureInternalAccountButton(true);

            return;
        }

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

        if (heroLoginAction) {
            heroLoginAction.hidden = true;
        }

        if (heroRegisterAction) {
            heroRegisterAction.hidden = true;
        }
    }

    /*
     * Get the currently logged-in user
     * and update navigation.
     */
    async function renderAuthNavigation() {

        try {

            const {
                data: { session },
                error: sessionError
            } = await supabaseClient.auth.getSession();

            /*
             * If Supabase cannot retrieve the session,
             * treat the visitor as logged out.
             */
            if (sessionError) {

                console.error(
                    "Session retrieval error:",
                    sessionError
                );

                showGuestNavigation();

                return;
            }

            /*
             * No session = logged out.
             */
            if (!session) {

                showGuestNavigation();

                return;
            }

            /*
             * If we are inside /pages/,
             * we only need to show Logout.
             *
             * Individual protected pages such as
             * admin-ocr.html will perform their own
             * role checks.
             */
            if (isInsidePagesFolder) {

                configureInternalAccountButton(true);

                return;
            }

            /*
             * Landing page needs the user's role
             * so it can display the correct dashboard.
             */
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

                showGuestNavigation();

                return;
            }

            /*
             * No profile found.
             */
            if (!profile) {

                console.error(
                    "No profile found for authenticated user."
                );

                showGuestNavigation();

                return;
            }

            /*
             * Normalize role.
             */
            const role = String(profile.role || "")
                .trim()
                .toLowerCase();

            /*
             * Administrator.
             */
            if (role === "admin") {

                showAdminNavigation();

                return;
            }

            /*
             * Resident.
             */
            if (role === "resident") {

                showResidentNavigation();

                return;
            }

            /*
             * Unknown role.
             */
            console.error(
                "Invalid account role:",
                profile.role
            );

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
     * Logout user.
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

            /*
             * Return to homepage after logout.
             */
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

    /*
     * Initial authentication check.
     */
    await renderAuthNavigation();

    /*
     * Listen for authentication changes.
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
     * Clean up the authentication listener
     * when leaving the page.
     */
    window.addEventListener(
        "pagehide",
        function () {

            authListener?.subscription?.unsubscribe();

        }
    );

});