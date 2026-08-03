// js/auth-nav.js

document.addEventListener("DOMContentLoaded", async function () {
    const authArea =
        document.getElementById("authArea");

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
     * Guest users:
     * No Login or Create Account links in the header.
     * Those buttons remain in the hero section.
     */
    function showGuestNavigation() {
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
     * Resident navigation.
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

        if (heroLoginAction) {
            heroLoginAction.hidden = true;
        }

        if (heroRegisterAction) {
            heroRegisterAction.hidden = true;
        }
    }

    /*
     * Administrator navigation.
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