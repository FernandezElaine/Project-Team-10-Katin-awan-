const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert("Login failed: " + error.message);
        return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single();

    if (profileError) {
        alert("Login successful, but user profile was not found.");
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirectPage = params.get("redirect");

    if (redirectPage) {
        window.location.href = redirectPage;
        return;
    }

    if (profile.role === "admin") {
        alert("Welcome Admin!");
        window.location.href = "dashboard.html";
    } else {
        alert("Welcome Resident!");
        window.location.href = "dashboard.html";
    }
});