"use strict";

/*
|--------------------------------------------------------------------------
| ADMIN FEEDBACK MANAGEMENT
|--------------------------------------------------------------------------
| Uses the global supabaseClient created in ../js/supabase.js
*/

let adminFeedbackRecords = [];
let filteredAdminFeedback = [];
let adminFeedbackLoading = false;

document.addEventListener("DOMContentLoaded", () => {
    loadAdminFeedback();
});

/*
|--------------------------------------------------------------------------
| LOAD FEEDBACK
|--------------------------------------------------------------------------
*/

async function loadAdminFeedback() {
    if (adminFeedbackLoading) return;

    const container =
        document.getElementById("feedbackContainer");

    if (!container) return;

    adminFeedbackLoading = true;

    showAdminFeedbackMessage(
        "Loading feedback records..."
    );

    try {
        const { data, error } = await supabaseClient
            .from("feedback")
            .select(`
                id,
                user_id,
                subject,
                description,
                category,
                status,
                is_anonymous,
                is_public,
                admin_response,
                created_at,
                updated_at
            `)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        adminFeedbackRecords =
            Array.isArray(data) ? data : [];

        updateAdminFeedbackStats(
            adminFeedbackRecords
        );

        applyAdminFeedbackFilters();

    } catch (error) {
        console.error(
            "Failed to load admin feedback:",
            error
        );

        adminFeedbackRecords = [];
        filteredAdminFeedback = [];

        updateAdminFeedbackStats([]);

        const message =
            String(error?.message || "");

        if (
            message
                .toLowerCase()
                .includes("row-level security")
        ) {
            showAdminFeedbackMessage(
                "Admin access was blocked by the feedback " +
                "table's Row Level Security policy."
            );
        } else {
            showAdminFeedbackMessage(
                "Failed to load feedback: " +
                (message || "Unknown error.")
            );
        }
    } finally {
        adminFeedbackLoading = false;
    }
}

/*
|--------------------------------------------------------------------------
| SEARCH AND FILTER
|--------------------------------------------------------------------------
*/

function searchAdminFeedback() {
    applyAdminFeedbackFilters();
}

function filterAdminFeedback() {
    applyAdminFeedbackFilters();
}

function applyAdminFeedbackFilters() {
    const searchInput =
        document.getElementById(
            "adminFeedbackSearch"
        );

    const filterInput =
        document.getElementById(
            "adminFeedbackFilter"
        );

    const searchTerm =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();

    const selectedStatus =
        String(filterInput?.value || "All")
            .trim()
            .toLowerCase();

    filteredAdminFeedback =
        adminFeedbackRecords.filter(record => {
            const searchableText = [
                record.subject,
                record.description,
                record.category,
                record.status,
                record.admin_response
            ]
                .map(value =>
                    String(value || "")
                        .toLowerCase()
                )
                .join(" ");

            const matchesSearch =
                !searchTerm ||
                searchableText.includes(searchTerm);

            const matchesStatus =
                selectedStatus === "all" ||
                normalizeAdminFeedbackStatus(
                    record.status
                ) === selectedStatus;

            return (
                matchesSearch &&
                matchesStatus
            );
        });

    renderAdminFeedback(
        filteredAdminFeedback
    );
}

/*
|--------------------------------------------------------------------------
| STATISTICS
|--------------------------------------------------------------------------
*/

function updateAdminFeedbackStats(records) {
    const total = records.length;

    const resolved = records.filter(record =>
        normalizeAdminFeedbackStatus(
            record.status
        ) === "resolved"
    ).length;

    const underReview = records.filter(record =>
        normalizeAdminFeedbackStatus(
            record.status
        ) === "under review"
    ).length;

    const pending = records.filter(record =>
        normalizeAdminFeedbackStatus(
            record.status
        ) === "pending"
    ).length;

    setAdminFeedbackText(
        "totalFeedback",
        total
    );

    setAdminFeedbackText(
        "resolvedFeedback",
        resolved
    );

    setAdminFeedbackText(
        "reviewFeedback",
        underReview
    );

    setAdminFeedbackText(
        "pendingFeedback",
        pending
    );
}

/*
|--------------------------------------------------------------------------
| RENDER ADMIN FEEDBACK
|--------------------------------------------------------------------------
*/

function renderAdminFeedback(records) {
    const container =
        document.getElementById(
            "feedbackContainer"
        );

    if (!container) return;

    container.replaceChildren();

    if (!records.length) {
        const message =
            adminFeedbackRecords.length
                ? "No feedback matches your search or filter."
                : "No feedback submissions are available yet.";

        showAdminFeedbackMessage(message);
        return;
    }

    records.forEach(record => {
        const card =
            createAdminFeedbackCard(record);

        container.appendChild(card);
    });
}

function createAdminFeedbackCard(record) {
    const card =
        document.createElement("article");

    card.className =
        "document-card admin-feedback-card";

    card.dataset.feedbackId =
        String(record.id);

    /*
     * Header
     */
    const header =
        document.createElement("div");

    header.className =
        "feedback-item-top";

    const title =
        document.createElement("h3");

    title.textContent =
        record.subject ||
        "Untitled feedback";

    const statusBadge =
        document.createElement("span");

    statusBadge.className =
        getAdminFeedbackStatusClass(
            record.status
        );

    statusBadge.textContent =
        record.status ||
        "Pending";

    header.append(
        title,
        statusBadge
    );

    /*
     * Category
     */
    const category =
        document.createElement("p");

    const categoryLabel =
        document.createElement("b");

    categoryLabel.textContent =
        "Category: ";

    category.append(
        categoryLabel,
        document.createTextNode(
            record.category || "General"
        )
    );

    /*
     * Description
     */
    const description =
        document.createElement("p");

    description.textContent =
        record.description ||
        "No description was provided.";

    /*
     * Metadata
     */
    const metadata =
        document.createElement("small");

    const authorLabel =
        record.is_anonymous === false
            ? "Signed-in resident"
            : "Anonymous";

    metadata.textContent =
        `${authorLabel} · ` +
        `${formatAdminFeedbackDate(record.created_at)}`;

    /*
     * Status selector
     */
    const statusLabel =
        document.createElement("label");

    statusLabel.textContent =
        "Feedback Status";

    const statusSelect =
        document.createElement("select");

    statusSelect.className =
        "feedback-status-select";

    [
        "Pending",
        "Under Review",
        "Resolved"
    ].forEach(statusValue => {
        const option =
            document.createElement("option");

        option.value = statusValue;
        option.textContent = statusValue;

        option.selected =
            normalizeAdminFeedbackStatus(
                record.status
            ) ===
            normalizeAdminFeedbackStatus(
                statusValue
            );

        statusSelect.appendChild(option);
    });

    /*
     * Public visibility checkbox
     */
    const visibilityLabel =
        document.createElement("label");

    visibilityLabel.style.display = "flex";
    visibilityLabel.style.alignItems = "center";
    visibilityLabel.style.gap = "8px";
    visibilityLabel.style.marginTop = "12px";

    const publicCheckbox =
        document.createElement("input");

    publicCheckbox.type = "checkbox";

    publicCheckbox.className =
        "feedback-public-checkbox";

    publicCheckbox.checked =
        record.is_public === true;

    const visibilityText =
        document.createElement("span");

    visibilityText.textContent =
        "Show this feedback on the resident page";

    visibilityLabel.append(
        publicCheckbox,
        visibilityText
    );

    /*
     * Admin response
     */
    const responseLabel =
        document.createElement("label");

    responseLabel.textContent =
        "Administrator Response";

    responseLabel.style.display = "block";
    responseLabel.style.marginTop = "12px";

    const responseTextarea =
        document.createElement("textarea");

    responseTextarea.className =
        "feedback-admin-response-input";

    responseTextarea.rows = 4;

    responseTextarea.placeholder =
        "Write a response or resolution note...";

    responseTextarea.value =
        record.admin_response || "";

    responseTextarea.style.width = "100%";
    responseTextarea.style.boxSizing = "border-box";
    responseTextarea.style.marginTop = "6px";

    /*
     * Action buttons
     */
    const actions =
        document.createElement("div");

    actions.className =
        "admin-card-actions";

    actions.style.marginTop = "14px";

    const saveButton =
        document.createElement("button");

    saveButton.type = "button";
    saveButton.textContent = "Save Changes";

    const deleteButton =
        document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.className = "danger-btn";

    const resultMessage =
        document.createElement("small");

    resultMessage.className =
        "feedback-save-message";

    resultMessage.style.display = "block";
    resultMessage.style.marginTop = "10px";

    saveButton.addEventListener(
        "click",
        () => {
            updateAdminFeedback(
                record.id,
                statusSelect.value,
                publicCheckbox.checked,
                responseTextarea.value,
                saveButton,
                resultMessage
            );
        }
    );

    deleteButton.addEventListener(
        "click",
        () => {
            deleteAdminFeedback(
                record.id,
                deleteButton
            );
        }
    );

    actions.append(
        saveButton,
        deleteButton
    );

    card.append(
        header,
        category,
        description,
        metadata,
        document.createElement("hr"),
        statusLabel,
        statusSelect,
        visibilityLabel,
        responseLabel,
        responseTextarea,
        actions,
        resultMessage
    );

    return card;
}

/*
|--------------------------------------------------------------------------
| UPDATE FEEDBACK
|--------------------------------------------------------------------------
*/

async function updateAdminFeedback(
    feedbackId,
    newStatus,
    isPublic,
    adminResponse,
    saveButton,
    resultMessage
) {
    if (!feedbackId) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    resultMessage.textContent = "";

    try {
        const updatedAt =
            new Date().toISOString();

        const { error } = await supabaseClient
            .from("feedback")
            .update({
                status: newStatus,
                is_public: isPublic,
                admin_response:
                    adminResponse.trim() || null,
                updated_at: updatedAt
            })
            .eq("id", feedbackId);

        if (error) {
            throw error;
        }

        const recordIndex =
            adminFeedbackRecords.findIndex(
                record =>
                    String(record.id) ===
                    String(feedbackId)
            );

        if (recordIndex !== -1) {
            adminFeedbackRecords[recordIndex] = {
                ...adminFeedbackRecords[recordIndex],
                status: newStatus,
                is_public: isPublic,
                admin_response:
                    adminResponse.trim() || null,
                updated_at: updatedAt
            };
        }

        updateAdminFeedbackStats(
            adminFeedbackRecords
        );

        resultMessage.style.color =
            "#166534";

        resultMessage.textContent =
            "Changes saved successfully.";

        /*
         * Reapply filter because changing status may
         * remove the card from the current status filter.
         */
        window.setTimeout(() => {
            applyAdminFeedbackFilters();
        }, 700);

    } catch (error) {
        console.error(
            "Failed to update feedback:",
            error
        );

        resultMessage.style.color =
            "#b91c1c";

        resultMessage.textContent =
            "Save failed: " +
            (error?.message || "Unknown error.");

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}

/*
|--------------------------------------------------------------------------
| DELETE FEEDBACK
|--------------------------------------------------------------------------
*/

async function deleteAdminFeedback(
    feedbackId,
    deleteButton
) {
    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this feedback?"
    );

    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    try {
        const { error } = await supabaseClient
            .from("feedback")
            .delete()
            .eq("id", feedbackId);

        if (error) {
            throw error;
        }

        adminFeedbackRecords =
            adminFeedbackRecords.filter(
                record =>
                    String(record.id) !==
                    String(feedbackId)
            );

        updateAdminFeedbackStats(
            adminFeedbackRecords
        );

        applyAdminFeedbackFilters();

    } catch (error) {
        console.error(
            "Failed to delete feedback:",
            error
        );

        alert(
            "Delete failed: " +
            (error?.message || "Unknown error.")
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "Delete";
    }
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function showAdminFeedbackMessage(message) {
    const container =
        document.getElementById(
            "feedbackContainer"
        );

    if (!container) return;

    container.replaceChildren();

    const card =
        document.createElement("div");

    card.className = "document-card";

    const paragraph =
        document.createElement("p");

    paragraph.textContent = message;

    card.appendChild(paragraph);
    container.appendChild(card);
}

function normalizeAdminFeedbackStatus(status) {
    return String(status || "")
        .trim()
        .toLowerCase();
}

function getAdminFeedbackStatusClass(status) {
    const normalized =
        normalizeAdminFeedbackStatus(status);

    if (normalized === "resolved") {
        return "status-resolved";
    }

    if (normalized === "under review") {
        return "status-review";
    }

    return "status-pending";
}

function formatAdminFeedbackDate(value) {
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
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function setAdminFeedbackText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(value);
    }
}

/*
 * Make functions available to the HTML onclick attributes.
 */
window.loadAdminFeedback =
    loadAdminFeedback;

window.searchAdminFeedback =
    searchAdminFeedback;

window.filterAdminFeedback =
    filterAdminFeedback;