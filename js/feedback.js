let feedbackData = [];

// Check if user is logged in
async function isUserLoggedIn() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session !== null;
}

// Redirect to login page
function redirectToLogin() {
    alert("Please log in first before submitting feedback.");
    // Optionally send the page they came from so they return here after login
    window.location.href = "login.html?redirect=feedback.html";
}

async function loadFeedback() {
    try {
        const response = await fetch("../data/feedback.json");
        feedbackData = await response.json();
        displayFeedback(feedbackData);
    } catch (error) {
        console.error("Error loading feedback:", error);
        feedbackData = [];
    }

    const success = document.getElementById("feedbackSuccess");
    if (success) {
        success.style.display = "none";
    }
}

function displayFeedback(data) {
    const list = document.getElementById("feedbackList");
    if (!list) return;

    list.innerHTML = "";

    data.forEach(item => {
        const status = item.status.toLowerCase();

        let statusClass = "status-pending";

        if (status === "reviewed" || status === "under review") {
            statusClass = "status-review";
        }

        if (status === "resolved") {
            statusClass = "status-resolved";
        }

        list.innerHTML += `
            <div class="feedback-item">
                <div class="feedback-item-top">
                    <b>${item.subject}</b>
                    <span class="${statusClass}">${item.status}</span>
                </div>

                <p>${item.message}</p>

                <small>
                    Category: ${item.category} · ${item.author} · ${item.date}
                </small>
            </div>
        `;
    });
}

// Updated submitFeedback to require login
async function submitFeedback() {
    const loggedIn = await isUserLoggedIn();

    if (!loggedIn) {
        redirectToLogin();
        return; // Stop submission if not logged in
    }

    const subject = document.getElementById("feedbackSubject").value.trim();
    const category = document.getElementById("feedbackCategory").value;
    const message = document.getElementById("feedbackMessage").value.trim();
    const anonymous = document.getElementById("feedbackAnonymous").checked;
    const success = document.getElementById("feedbackSuccess");

    if (!subject || !category || !message) {
        alert("Please fill in all required fields.");
        return;
    }

    const newFeedback = {
        subject: subject,
        category: category,
        message: message,
        author: anonymous ? "Anonymous" : "Resident",
        date: new Date().toLocaleDateString("en-US"),
        status: "Pending"
    };

    feedbackData.unshift(newFeedback);
    displayFeedback(feedbackData);

    document.getElementById("feedbackSubject").value = "";
    document.getElementById("feedbackCategory").value = "";
    document.getElementById("feedbackMessage").value = "";
    document.getElementById("feedbackAnonymous").checked = true;

    if (success) {
        success.style.display = "block";

        setTimeout(() => {
            success.style.display = "none";
        }, 3000);
    }
}

loadFeedback();