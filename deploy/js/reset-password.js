document.addEventListener("DOMContentLoaded", async function () {
    const resetForm =
        document.getElementById("resetPasswordForm");

    const statusElement =
        document.getElementById("resetStatus");

    const newPasswordInput =
        document.getElementById("newPassword");

    const confirmPasswordInput =
        document.getElementById("confirmPassword");

    const resetButton =
        document.getElementById("resetButton");

    if (
        !resetForm ||
        !statusElement ||
        !newPasswordInput ||
        !confirmPasswordInput
    ) {
        console.error(
            "Required password-reset elements were not found."
        );
        return;
    }

    function showResetForm() {
        statusElement.textContent =
            "Recovery link verified. Enter your new password.";

        resetForm.hidden = false;
    }

    function showInvalidLink(message) {
        statusElement.textContent =
            message ||
            "This password-reset link is invalid or has expired.";

        resetForm.hidden = true;
    }

    try {
        /*
         * Supports a PKCE recovery URL containing ?code=...
         */
        const currentUrl =
            new URL(window.location.href);

        const recoveryCode =
            currentUrl.searchParams.get("code");

        if (recoveryCode) {
            const {
                error: exchangeError
            } = await supabaseClient.auth
                .exchangeCodeForSession(recoveryCode);

            if (exchangeError) {
                console.error(
                    "Recovery-code exchange error:",
                    exchangeError
                );
            } else {
                /*
                 * Remove the temporary recovery code
                 * from the address bar.
                 */
                currentUrl.searchParams.delete("code");

                window.history.replaceState(
                    {},
                    document.title,
                    currentUrl.pathname
                );
            }
        }

        /*
         * Check whether Supabase already created a
         * recovery session from the email link.
         */
        const {
            data: { session },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            console.error(
                "Recovery-session error:",
                sessionError
            );
        }

        if (session) {
            showResetForm();
        } else {
            statusElement.textContent =
                "Waiting for recovery-link verification...";
        }
    } catch (error) {
        console.error(
            "Password-reset initialization error:",
            error
        );

        showInvalidLink(
            "The password-reset link could not be verified."
        );
    }

    /*
     * Supabase sends PASSWORD_RECOVERY after a valid
     * recovery link creates an authenticated session.
     */
    const {
        data: authListener
    } = supabaseClient.auth.onAuthStateChange(
        function (event, session) {
            console.log(
                "Password-reset auth event:",
                event
            );

            if (
                event === "PASSWORD_RECOVERY" ||
                (
                    event === "SIGNED_IN" &&
                    session
                )
            ) {
                showResetForm();
            }
        }
    );

    resetForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;

            if (newPassword.length < 8) {
                alert(
                    "Your password must contain at least 8 characters."
                );

                newPasswordInput.focus();
                return;
            }

            if (newPassword !== confirmPassword) {
                alert("The passwords do not match.");

                confirmPasswordInput.focus();
                return;
            }

            resetButton.disabled = true;
            resetButton.textContent =
                "Updating Password...";

            try {
                /*
                 * Confirm a valid recovery session still exists.
                 */
                const {
                    data: { session },
                    error: sessionError
                } = await supabaseClient.auth.getSession();

                if (sessionError || !session) {
                    console.error(
                        "No recovery session:",
                        sessionError
                    );

                    alert(
                        "Your password-reset link is invalid or has expired. Request a new reset email."
                    );

                    return;
                }

                const {
                    error: updateError
                } = await supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (updateError) {
                    console.error(
                        "Password update error:",
                        updateError
                    );

                    alert(
                        "Password update failed: " +
                        updateError.message
                    );

                    return;
                }

                alert(
                    "Your password has been updated successfully. Please log in using your new password."
                );

                await supabaseClient.auth.signOut();

                window.location.href =
                    "login.html";
            } catch (error) {
                console.error(
                    "Unexpected password-update error:",
                    error
                );

                alert(
                    "An unexpected error occurred while updating your password."
                );
            } finally {
                resetButton.disabled = false;
                resetButton.textContent =
                    "Update Password";
            }
        }
    );

    window.addEventListener("beforeunload", function () {
        authListener?.subscription?.unsubscribe();
    });
});