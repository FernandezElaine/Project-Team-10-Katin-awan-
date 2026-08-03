// js/auth-nav.js

document.addEventListener("DOMContentLoaded", async function () {
    const authArea =
        document.getElementById("authArea");

    const accountAction =
        document.getElementById("accountAction");

    const heroPortalAction =
        document.getElementById("heroPortalAction");

    const heroLoginAction =
        document.getElementById("heroLoginAction");

    const heroRegisterAction =
        document.getElementById("heroRegisterAction");

    if (!authArea) {
        return;
    }

    const isInsidePagesFolder =
        window.location.pathname.includes("/pages/");

    function getPagePath(fileName) {
        return isInsidePagesFolder
            ? fileName
            : `pages/${fileName}`;
    }

    const homePage = isInsidePagesFolder
        ? "../index.html"
        : "index.html";

    function createLink(text, href, className) {
        const link = document.createElement("a");

        link.textContent = text;
        link.href = href;
        link.className = className;

        return link;
    }

    function createLogoutButton() {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "logout-btn";
        button.textContent = "Logout";

        button.addEventListener("click", logoutUser);

        return button;
    }

    /**
     * Configure the permanent account button used
     * inside dashboard, projects, expenses, and other pages.
     */
    function configureInternalAccountButton(isLoggedIn) {
        if (!accountAction) {
            return;
        }

        /*
         * Remove old click behavior by cloning the button.
         */
        const replacement =
            accountAction.cloneNode(true);

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

    /**
     * Landing-page navigation for visitors.
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

    /**
     * Landing-page navigation for residents.
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

    /**
     * Landing-page navigation for administrators.
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

    async function renderAuthNavigation() {
        try {
            const {
                data: { session },
                error: sessionError
            } = await supabaseClient.auth.getSession();

            if (sessionError) {
                console.error(
                    "Session retrieval error:",
                    sessionError
                );

                showGuestNavigation();
                return;
            }

            if (!session) {
                showGuestNavigation();
                return;
            }

            /*
             * Internal public pages only need to activate
             * the permanent Logout button.
             */
            if (isInsidePagesFolder) {
                configureInternalAccountButton(true);
                return;
            }

            /*
             * The landing page also checks the role so it
             * can display the correct dashboard link.
             */
            const {
                data: profile,
                error: profileError
            } = await supabaseClient
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .maybeSingle();

            if (profileError || !profile) {
                console.error(
                    "Profile retrieval error:",
                    profileError
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

    await renderAuthNavigation();

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

    window.addEventListener(
        "pagehide",
        function () {
            authListener?.subscription?.unsubscribe();
        }
    );
});