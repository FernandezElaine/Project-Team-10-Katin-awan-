"use strict";

/*
|--------------------------------------------------------------------------
| RESIDENT FEEDBACK
|--------------------------------------------------------------------------
| Uses the global supabaseClient created in ../js/supabase.js
*/

let publicFeedbackRecords = [];
let feedbackSubmitting = false;

document.addEventListener("DOMContentLoaded", () => {
    hideFeedbackSuccess();
    loadPublicFeedback();
});

/*
|--------------------------------------------------------------------------
| SUBMIT FEEDBACK
|--------------------------------------------------------------------------
*/

async function submitFeedback() {
    if (feedbackSubmitting) return;

    const subjectInput =
        document.getElementById("feedbackSubject");

    const categoryInput =
        document.getElementById("feedbackCategory");

    const messageInput =
        document.getElementById("feedbackMessage");

    const anonymousInput =
        document.getElementById("feedbackAnonymous");

    const submitButton =
        document.getElementById("feedbackSubmitButton");

    if (
        !subjectInput ||
        !categoryInput ||
        !messageInput ||
        !anonymousInput
    ) {
        alert("The feedback form could not be loaded correctly.");
        return;
    }

    const subject = subjectInput.value.trim();
    const category = categoryInput.value.trim();
    const description = messageInput.value.trim();
    const isAnonymous = anonymousInput.checked;

    if (!subject || !category || !description) {
        alert("Please complete all required fields.");
        return;
    }

    if (subject.length < 3) {
        alert("Please enter a clearer feedback subject.");
        subjectInput.focus();
        return;
    }

    if (description.length < 10) {
        alert("Please provide a more detailed feedback message.");
        messageInput.focus();
        return;
    }

    feedbackSubmitting = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {
        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData?.session || null;

        /*
         * A resident may submit anonymously without logging in.
         * A non-anonymous submission requires a logged-in account.
         */
        if (!isAnonymous && !session?.user) {
            alert(
                "Please log in before submitting non-anonymous feedback, " +
                "or select “Submit anonymously.”"
            );

            window.location.href =
                "login.html?redirect=feedback.html";

            return;
        }

        const feedbackRecord = {
            user_id: isAnonymous
                ? null
                : session.user.id,

            subject: subject,
            description: description,
            category: category,
            status: "Pending",
            is_anonymous: isAnonymous,
            is_public: false,
            admin_response: null
        };

        const { error } = await supabaseClient
            .from("feedback")
            .insert([feedbackRecord]);

        if (error) {
            throw error;
        }

        clearFeedbackForm();
        showFeedbackSuccess();

        /*
         * It will not appear publicly yet because is_public is false.
         * An administrator must approve it first.
         */
        await loadPublicFeedback();

    } catch (error) {
        console.error("Feedback submission failed:", error);

        const message =
            String(error?.message || "").toLowerCase();

        if (message.includes("row-level security")) {
            alert(
                "Submission was blocked by the feedback table's " +
                "Row Level Security policy."
            );
        } else if (message.includes("column")) {
            alert(
                "The feedback database columns do not match the code. " +
                "Check that description, is_anonymous, is_public, " +
                "and admin_response exist."
            );
        } else {
            alert(
                "Feedback submission failed: " +
                (error?.message || "Unknown error.")
            );
        }
    } finally {
        feedbackSubmitting = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Feedback";
        }
    }
}

/*
|--------------------------------------------------------------------------
| LOAD APPROVED PUBLIC FEEDBACK
|--------------------------------------------------------------------------
*/

async function loadPublicFeedback() {
    const container =
        document.getElementById("feedbackList");

    if (!container) return;

    showPublicFeedbackMessage(
        "Loading approved community feedback..."
    );

    try {
        const { data, error } = await supabaseClient
            .from("feedback")
            .select(`
                id,
                subject,
                description,
                category,
                status,
                is_anonymous,
                admin_response,
                created_at
            `)
            .eq("is_public", true)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        publicFeedbackRecords =
            Array.isArray(data) ? data : [];

        updatePublicFeedbackStats(
            publicFeedbackRecords
        );

        renderPublicFeedback(
            publicFeedbackRecords
        );

    } catch (error) {
        console.error(
            "Failed to load public feedback:",
            error
        );

        publicFeedbackRecords = [];

        updatePublicFeedbackStats([]);

        showPublicFeedbackMessage(
            "Community feedback could not be loaded right now."
        );
    }
}

/*
|--------------------------------------------------------------------------
| PUBLIC FEEDBACK STATISTICS
|--------------------------------------------------------------------------
*/

function updatePublicFeedbackStats(records) {
    const total = records.length;

    const resolved = records.filter(record =>
        normalizeFeedbackStatus(record.status) ===
        "resolved"
    ).length;

    const underReview = records.filter(record =>
        normalizeFeedbackStatus(record.status) ===
        "under review"
    ).length;

    const pending = records.filter(record =>
        normalizeFeedbackStatus(record.status) ===
        "pending"
    ).length;

    setFeedbackText(
        "residentTotalFeedback",
        total
    );

    setFeedbackText(
        "residentResolvedFeedback",
        resolved
    );

    setFeedbackText(
        "residentReviewFeedback",
        underReview
    );

    setFeedbackText(
        "residentPendingFeedback",
        pending
    );
}

/*
|--------------------------------------------------------------------------
| RENDER PUBLIC FEEDBACK
|--------------------------------------------------------------------------
*/

function renderPublicFeedback(records) {
    const container =
        document.getElementById("feedbackList");

    if (!container) return;

    container.replaceChildren();

    if (!records.length) {
        showPublicFeedbackMessage(
            "No community feedback has been approved " +
            "for public display yet."
        );

        return;
    }

    records.forEach(record => {
        const item =
            createPublicFeedbackCard(record);

        container.appendChild(item);
    });
}

function createPublicFeedbackCard(record) {
    const item =
        document.createElement("article");

    item.className = "feedback-item";

    const top =
        document.createElement("div");

    top.className = "feedback-item-top";

    const title =
        document.createElement("b");

    title.textContent =
        record.subject ||
        "Untitled feedback";

    const status =
        document.createElement("span");

    status.className =
        getFeedbackStatusClass(record.status);

    status.textContent =
        record.status ||
        "Pending";

    top.append(title, status);

    const description =
        document.createElement("p");

    description.textContent =
        record.description ||
        "No description was provided.";

    const details =
        document.createElement("small");

    const authorLabel =
        record.is_anonymous === false
            ? "Verified resident"
            : "Anonymous";

    details.textContent =
        `Category: ${record.category || "General"} · ` +
        `${authorLabel} · ` +
        `${formatFeedbackDate(record.created_at)}`;

    item.append(
        top,
        description,
        details
    );

    if (record.admin_response) {
        const responseBox =
            document.createElement("div");

        responseBox.className =
            "feedback-admin-response";

        const responseTitle =
            document.createElement("strong");

        responseTitle.textContent =
            "Barangay response";

        const responseText =
            document.createElement("p");

        responseText.textContent =
            record.admin_response;

        responseBox.append(
            responseTitle,
            responseText
        );

        item.appendChild(responseBox);
    }

    return item;
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function showPublicFeedbackMessage(message) {
    const container =
        document.getElementById("feedbackList");

    if (!container) return;

    container.replaceChildren();

    const item =
        document.createElement("div");

    item.className = "feedback-item";

    const paragraph =
        document.createElement("p");

    paragraph.textContent = message;

    item.appendChild(paragraph);
    container.appendChild(item);
}

function clearFeedbackForm() {
    const subject =
        document.getElementById("feedbackSubject");

    const category =
        document.getElementById("feedbackCategory");

    const message =
        document.getElementById("feedbackMessage");

    const anonymous =
        document.getElementById("feedbackAnonymous");

    if (subject) subject.value = "";
    if (category) category.value = "";
    if (message) message.value = "";
    if (anonymous) anonymous.checked = true;
}

function getFeedbackStatusClass(status) {
    const normalized =
        normalizeFeedbackStatus(status);

    if (normalized === "resolved") {
        return "status-resolved";
    }

    if (normalized === "under review") {
        return "status-review";
    }

    return "status-pending";
}

function normalizeFeedbackStatus(status) {
    return String(status || "")
        .trim()
        .toLowerCase();
}

function formatFeedbackDate(value) {
    if (!value) {
        return "Date unavailable";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function setFeedbackText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(value);
    }
}

function showFeedbackSuccess() {
    const success =
        document.getElementById("feedbackSuccess");

    if (!success) return;

    success.hidden = false;

    window.setTimeout(() => {
        success.hidden = true;
    }, 5000);
}

function hideFeedbackSuccess() {
    const success =
        document.getElementById("feedbackSuccess");

    if (success) {
        success.hidden = true;
    }
}

/*
 * Make the function available to the HTML onclick attribute.
 */
window.submitFeedback = submitFeedback;