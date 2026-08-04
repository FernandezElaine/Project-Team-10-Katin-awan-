const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!fullName || !email || !password) {
        alert("Please complete all fields.");
        return;
    }

    const { error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
                role: "resident"
            }
        }
    });

    if (error) {
        alert("Signup failed: " + error.message);
        return;
    }

    alert("Account created successfully! You can now log in.");
    window.location.href = "login.html";
});