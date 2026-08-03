const resetPasswordForm =
    document.getElementById("resetPasswordForm");

if (!resetPasswordForm) {
    console.error("Reset-password form was not found.");
} else {
    resetPasswordForm.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const newPassword =
                document.getElementById("newPassword").value;

            const confirmPassword =
                document.getElementById("confirmPassword").value;

            if (newPassword.length < 8) {
                alert(
                    "Your password must contain at least 8 characters."
                );
                return;
            }

            if (newPassword !== confirmPassword) {
                alert("The passwords do not match.");
                return;
            }

            try {
                const { error } =
                    await supabaseClient.auth.updateUser({
                        password: newPassword
                    });

                if (error) {
                    console.error(
                        "Password update error:",
                        error
                    );

                    alert(
                        "Password update failed: " +
                        error.message
                    );

                    return;
                }

                alert(
                    "Your password has been updated successfully."
                );

                await supabaseClient.auth.signOut();

                window.location.href = "login.html";
            } catch (error) {
                console.error(
                    "Unexpected password-update error:",
                    error
                );

                alert(
                    "An unexpected error occurred while updating your password."
                );
            }
        }
    );
}