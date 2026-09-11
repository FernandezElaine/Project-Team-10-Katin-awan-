// =========================================================
// KATIN-AWAN
// js/projects.js
//
// RESIDENT / PUBLIC PROJECTS MODULE
//
// ACCESS MODEL:
//
// PUBLIC:
//     All project records are visible.
//
// ADMIN:
//     All project records are visible.
//
// LEGACY RESIDENT:
//     Existing old account.
//     Can continue viewing all projects while transitioning.
//
// VERIFIED RESIDENT:
//     Supabase RLS limits projects to their own barangay.
//
// PENDING / REJECTED:
//     No resident-specific project access.
//
// IMPORTANT:
//     Security is enforced by Supabase RLS.
//     JavaScript does NOT replace RLS.
// =========================================================


let projectData = [];
let filteredProjectData = [];

let currentUser = null;
let currentProfile = null;


// =========================================================
// INITIALIZE PAGE
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeProjectsPage
);


async function initializeProjectsPage() {

    const searchInput =
        document.getElementById(
            "projectSearch"
        );

    const filterSelect =
        document.getElementById(
            "projectFilter"
        );

    const projectList =
        document.getElementById(
            "projectList"
        );

    const modal =
        document.getElementById(
            "projectDetailsModal"
        );

    const closeButton =
        document.getElementById(
            "closeProjectDetailsModal"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyProjectFilters
        );

    }


    if (filterSelect) {

        filterSelect.addEventListener(
            "change",
            applyProjectFilters
        );

    }


    if (projectList) {

        projectList.addEventListener(
            "click",
            function (event) {

                const detailsButton =
                    event.target.closest(
                        ".view-details-btn"
                    );


                if (!detailsButton) {
                    return;
                }


                const projectId =
                    Number(
                        detailsButton.dataset.projectId
                    );


                viewProjectDetails(
                    projectId
                );

            }
        );

    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeProjectDetailsModal
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === modal
                ) {

                    closeProjectDetailsModal();

                }

            }
        );

    }


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape"
            ) {

                closeProjectDetailsModal();

            }

        }
    );


    /*
     * Load the current account first.
     */
    await loadCurrentUserContext();


    /*
     * Then load projects.
     *
     * Supabase RLS determines which rows
     * this particular account is allowed to see.
     */
    await loadProjectsFromSupabase();

}


// =========================================================
// LOAD CURRENT USER CONTEXT
// =========================================================

async function loadCurrentUserContext() {

    currentUser = null;
    currentProfile = null;


    try {

        const {
            data: {
                user
            },
            error
        } =
            await supabaseClient.auth.getUser();


        /*
         * A visitor who is not logged in is still allowed
         * to browse public projects.
         */

        if (
            error ||
            !user
        ) {

            updateProjectScopeDisplay(
                "public"
            );

            return;

        }


        currentUser =
            user;


        /*
         * Load the authenticated user's profile.
         */

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    `
                    id,
                    full_name,
                    role,
                    verification_status,
                    organization_id,
                    barangay_id
                    `
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "Error loading profile:",
                profileError
            );

            updateProjectScopeDisplay(
                "profile-error"
            );

            return;

        }


        if (!profile) {

            console.error(
                "No profile found for authenticated user."
            );

            updateProjectScopeDisplay(
                "profile-error"
            );

            return;

        }


        currentProfile =
            profile;


        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toLowerCase();


        const verificationStatus =
            String(
                profile.verification_status || ""
            )
                .trim()
                .toLowerCase();


        /*
         * ADMIN
         */

        if (
            role === "admin"
        ) {

            updateProjectScopeDisplay(
                "admin"
            );

            return;

        }


        /*
         * RESIDENT
         */

        if (
            role === "resident"
        ) {

            if (
                verificationStatus ===
                "legacy"
            ) {

                updateProjectScopeDisplay(
                    "legacy"
                );

                return;

            }


            if (
                verificationStatus ===
                "verified"
            ) {

                updateProjectScopeDisplay(
                    "resident"
                );

                return;

            }


            if (
                verificationStatus ===
                "pending"
            ) {

                updateProjectScopeDisplay(
                    "pending"
                );

                return;

            }


            if (
                verificationStatus ===
                "rejected"
            ) {

                updateProjectScopeDisplay(
                    "rejected"
                );

                return;

            }


            updateProjectScopeDisplay(
                "restricted"
            );

            return;

        }


        /*
         * Unknown/non-standard role.
         */

        updateProjectScopeDisplay(
            "public"
        );


    } catch (error) {

        console.error(
            "Unexpected account-context error:",
            error
        );

        updateProjectScopeDisplay(
            "public"
        );

    }

}


// =========================================================
// PROJECT SCOPE MESSAGE
// =========================================================

function updateProjectScopeDisplay(
    scope
) {

    /*
     * Optional element.
     *
     * If projects.html does not contain
     * #projectScopeMessage, nothing happens.
     */

    const element =
        document.getElementById(
            "projectScopeMessage"
        );


    if (!element) {
        return;
    }


    element.hidden =
        false;


    switch (scope) {

        case "admin":

            element.textContent =
                "Administrator view — showing projects from all barangays.";

            break;


        case "legacy":

            element.textContent =
                "Legacy account — showing public project information. Complete your profile and barangay assignment to receive barangay-specific access.";

            break;


        case "resident":

            element.textContent =
                "Showing projects assigned to your barangay.";

            break;


        case "pending":

            element.textContent =
                "Your account is awaiting verification. Barangay-specific project access will be available after verification.";

            break;


        case "rejected":

            element.textContent =
                "Your account has not been verified. Please contact the administrator if you believe this is an error.";

            break;


        case "restricted":

            element.textContent =
                "Project access is currently unavailable for this account.";

            break;


        case "profile-error":

            element.textContent =
                "Your account profile could not be loaded.";

            break;


        case "public":

        default:

            element.textContent =
                "Showing public projects from participating barangays.";

            break;

    }

}


// =========================================================
// LOAD PROJECTS FROM SUPABASE
// =========================================================

async function loadProjectsFromSupabase() {

    const projectList =
        document.getElementById(
            "projectList"
        );


    try {

        /*
         * DO NOT add a client-side barangay restriction here.
         *
         * Supabase RLS is responsible for determining
         * which projects the current user is allowed to see.
         *
         * Therefore this same query works for:
         *
         *     Public
         *     Admin
         *     Legacy resident
         *     Verified resident
         *
         * The database decides which rows are returned.
         */

        const {
            data,
            error
        } =
            await supabaseClient
                .from("projects")
                .select("*")
                .order(
                    "id",
                    {
                        ascending: false
                    }
                );


        if (error) {

            throw error;

        }


        projectData =
            data || [];


        applyProjectFilters();


    } catch (error) {

        console.error(
            "Error loading projects:",
            error
        );


        projectData =
            [];

        filteredProjectData =
            [];


        if (projectList) {

            projectList.innerHTML = `
                <div class="project-full-card">

                    <div class="project-empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Projects could not be loaded
                    </h3>

                    <p>
                        Please refresh the page or try again later.
                    </p>

                </div>
            `;

        }


        updateProjectStats(
            []
        );

    }

}


// =========================================================
// SEARCH + STATUS FILTER
// =========================================================

function applyProjectFilters() {

    const searchInput =
        document.getElementById(
            "projectSearch"
        );


    const filterSelect =
        document.getElementById(
            "projectFilter"
        );


    const keyword =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        filterSelect?.value ||
        "All";


    filteredProjectData =
        projectData.filter(
            function (project) {

                const searchableText = [

                    project.title,

                    project.description,

                    project.category,

                    project.location,

                    project.contractor,

                    project.bidder

                ]
                    .map(
                        function (value) {

                            return String(
                                value || ""
                            )
                                .toLowerCase();

                        }
                    )
                    .join(" ");


                const matchesSearch =
                    !keyword ||
                    searchableText.includes(
                        keyword
                    );


                const matchesStatus =
                    selectedStatus === "All" ||
                    project.status ===
                        selectedStatus;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    loadProjectCards(
        filteredProjectData
    );


    updateProjectStats(
        filteredProjectData
    );

}


// =========================================================
// PROJECT CARDS
// =========================================================

function loadProjectCards(
    data = filteredProjectData
) {

    const projectList =
        document.getElementById(
            "projectList"
        );


    if (!projectList) {
        return;
    }


    if (!data.length) {

        let message =
            "No project records match your search or selected status.";


        /*
         * Legacy accounts still have access to public
         * project information.
         */

        if (
            currentProfile &&
            currentProfile.role ===
                "resident" &&
            currentProfile.verification_status ===
                "legacy"
        ) {

            message =
                "There are currently no public project records.";

        }


        /*
         * Verified residents are limited to their barangay.
         */

        if (
            currentProfile &&
            currentProfile.role ===
                "resident" &&
            currentProfile.verification_status ===
                "verified"
        ) {

            message =
                "There are currently no project records assigned to your barangay.";

        }


        /*
         * Pending accounts.

         */

        if (
            currentProfile &&
            currentProfile.role ===
                "resident" &&
            currentProfile.verification_status ===
                "pending"
        ) {

            message =
                "Your account is still awaiting verification.";

        }


        /*
         * Rejected accounts.
         */

        if (
            currentProfile &&
            currentProfile.role ===
                "resident" &&
            currentProfile.verification_status ===
                "rejected"
        ) {

            message =
                "Your account has not been verified, so barangay-specific project access is unavailable.";

        }


        projectList.innerHTML = `
            <div class="project-full-card">

                <div class="project-empty-icon">
                    📭
                </div>

                <h3>
                    No projects found
                </h3>

                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>

            </div>
        `;


        return;

    }


    projectList.innerHTML =
        data
            .map(
                createProjectCard
            )
            .join("");

}


// =========================================================
// CREATE PROJECT CARD
// =========================================================

function createProjectCard(
    project
) {

    const progress =
        normalizeProgress(
            project.progress
        );


    const photoUrl =
        getPrimaryProjectPhoto(
            project
        );


    const status =
        project.status ||
        "Planned";


    const statusClass =
        getProjectStatusClass(
            status
        );


    const photoMarkup =
        photoUrl
            ? `
                <div class="project-card-photo">

                    <img
                        src="${escapeHTML(
                            photoUrl
                        )}"
                        alt="${escapeHTML(
                            project.title ||
                            "Barangay project"
                        )}"
                        loading="lazy"
                    >

                </div>
            `
            : `
                <div class="project-card-photo project-card-placeholder">

                    <span>
                        🏗️
                    </span>

                    <p>
                        No project photo
                    </p>

                </div>
            `;


    return `
        <article class="project-full-card">

            ${photoMarkup}


            <div class="project-card-content">

                <div class="project-card-top">

                    <span
                        class="status-badge ${statusClass}"
                    >
                        ${escapeHTML(
                            status
                        )}
                    </span>


                    <span
                        class="project-card-category"
                    >
                        ${escapeHTML(
                            project.category ||
                            "General"
                        )}
                    </span>

                </div>


                <h3>
                    ${escapeHTML(
                        project.title ||
                        "Untitled Project"
                    )}
                </h3>


                <p class="project-card-location">

                    📍

                    ${escapeHTML(
                        project.location ||
                        "Location not specified"
                    )}

                </p>


                <p class="project-card-description">

                    ${escapeHTML(
                        shortenText(
                            project.description ||
                            "No project description provided.",
                            130
                        )
                    )}

                </p>


                <div class="project-card-details">

                    <div>

                        <small>
                            Budget
                        </small>

                        <strong>
                            ${formatPeso(
                                project.budget
                            )}
                        </strong>

                    </div>


                    <div>

                        <small>
                            Target Date
                        </small>

                        <strong>
                            ${escapeHTML(
                                formatTimeline(
                                    project.timeline
                                )
                            )}
                        </strong>

                    </div>

                </div>


                <div class="project-card-progress">

                    <div
                        class="project-progress-heading"
                    >

                        <span>
                            Progress
                        </span>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>


                    <div class="public-progress">

                        <div
                            style="width: ${progress}%"
                        ></div>

                    </div>

                </div>


                <button
                    type="button"
                    class="view-details-btn"
                    data-project-id="${Number(
                        project.id
                    )}"
                >
                    View Details
                </button>

            </div>

        </article>
    `;

}


// =========================================================
// PROJECT DETAILS MODAL
// =========================================================

function viewProjectDetails(
    projectId
) {

    const project =
        projectData.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(projectId)
                );

            }
        );


    if (!project) {
        return;
    }


    const modal =
        document.getElementById(
            "projectDetailsModal"
        );


    if (!modal) {
        return;
    }


    const progress =
        normalizeProgress(
            project.progress
        );


    setText(
        "projectDetailsTitle",
        project.title ||
        "Untitled Project"
    );


    setText(
        "projectDetailsStatus",
        project.status ||
        "Planned"
    );


    setText(
        "projectDetailsCategory",
        project.category ||
        "General"
    );


    setText(
        "projectDetailsDescription",
        project.description ||
        "No description provided."
    );


    setText(
        "projectDetailsBudget",
        formatPeso(
            project.budget
        )
    );


    setText(
        "projectDetailsLocation",
        project.location ||
        "Not specified"
    );


    setText(
        "projectDetailsContractor",
        project.contractor ||
        "Not specified"
    );


    setText(
        "projectDetailsBidder",
        project.bidder ||
        "Not specified"
    );


    setText(
        "projectDetailsTimeline",
        formatTimeline(
            project.timeline
        )
    );


    setText(
        "projectDetailsProgress",
        progress + "%"
    );


    setText(
        "projectDetailsProgressLabel",
        progress + "%"
    );


    const progressBar =
        document.getElementById(
            "projectDetailsProgressBar"
        );


    if (progressBar) {

        progressBar.style.width =
            progress + "%";

    }


    const statusElement =
        document.getElementById(
            "projectDetailsStatus"
        );


    if (statusElement) {

        statusElement.className =
            "status-badge " +
            getProjectStatusClass(
                project.status
            );

    }


    displayProjectPhoto(
        project
    );


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );

}


// =========================================================
// DISPLAY PROJECT PHOTO
// =========================================================

function displayProjectPhoto(
    project
) {

    const photoContainer =
        document.getElementById(
            "projectDetailsPhotoContainer"
        );


    const photo =
        document.getElementById(
            "projectDetailsPhoto"
        );


    if (
        !photoContainer ||
        !photo
    ) {

        return;

    }


    const photoUrl =
        getPrimaryProjectPhoto(
            project
        );


    if (!photoUrl) {

        photoContainer.hidden =
            true;

        photo.removeAttribute(
            "src"
        );

        photo.alt =
            "";

        return;

    }


    photo.src =
        photoUrl;


    photo.alt =
        project.title
            ? `${project.title} project photo`
            : "Barangay project photo";


    photoContainer.hidden =
        false;

}


// =========================================================
// CLOSE PROJECT MODAL
// =========================================================

function closeProjectDetailsModal() {

    const modal =
        document.getElementById(
            "projectDetailsModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );

}


// =========================================================
// PROJECT STATISTICS
// =========================================================

function updateProjectStats(
    data
) {

    const total =
        data.length;


    const ongoing =
        data.filter(
            function (project) {

                return (
                    project.status ===
                    "Ongoing"
                );

            }
        ).length;


    const completed =
        data.filter(
            function (project) {

                return (
                    project.status ===
                    "Completed"
                );

            }
        ).length;


    const planned =
        data.filter(
            function (project) {

                return (
                    project.status ===
                    "Planned"
                );

            }
        ).length;


    setText(
        "totalProjectsCount",
        total
    );


    setText(
        "ongoingProjectsCount",
        ongoing
    );


    setText(
        "completedProjectsCount",
        completed
    );


    setText(
        "plannedProjectsCount",
        planned
    );

}


// =========================================================
// PHOTO HELPERS
// =========================================================

function getPrimaryProjectPhoto(
    project
) {

    const photos =
        getProjectPhotos(
            project
        );


    const firstPhoto =
        photos.find(
            function (photo) {

                return isSafeImageUrl(
                    photo
                );

            }
        );


    return firstPhoto || "";

}


function getProjectPhotos(
    project
) {

    if (
        !project ||
        !project.photos
    ) {

        return [];

    }


    if (
        Array.isArray(
            project.photos
        )
    ) {

        return project.photos;

    }


    if (
        typeof project.photos ===
        "string"
    ) {

        try {

            const parsed =
                JSON.parse(
                    project.photos
                );


            return Array.isArray(
                parsed
            )
                ? parsed
                : [];

        } catch {

            return project.photos.trim()
                ? [
                    project.photos.trim()
                ]
                : [];

        }

    }


    return [];

}


function isSafeImageUrl(
    value
) {

    if (
        !value ||
        typeof value !== "string"
    ) {

        return false;

    }


    try {

        const parsedUrl =
            new URL(
                value,
                window.location.origin
            );


        return (
            parsedUrl.protocol ===
                "https:" ||
            parsedUrl.protocol ===
                "http:"
        );

    } catch {

        return false;

    }

}


// =========================================================
// GENERAL HELPERS
// =========================================================

function normalizeProgress(
    value
) {

    const numericValue =
        Number(value);


    if (
        !Number.isFinite(
            numericValue
        )
    ) {

        return 0;

    }


    return Math.min(
        100,
        Math.max(
            0,
            Math.round(
                numericValue
            )
        )
    );

}


function getProjectStatusClass(
    status
) {

    switch (status) {

        case "Completed":

            return "status-completed";


        case "Ongoing":

            return "status-ongoing";


        case "Pending":

            return "status-pending";


        case "Planned":

        default:

            return "status-planned";

    }

}


function formatTimeline(
    value
) {

    if (!value) {

        return "Not specified";

    }


    const datePattern =
        /^\d{4}-\d{2}-\d{2}$/;


    if (
        !datePattern.test(
            value
        )
    ) {

        return String(value);

    }


    const [
        year,
        month,
        day
    ] =
        value
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    return date.toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

}


function formatPeso(
    amount
) {

    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(
        Number(
            amount || 0
        )
    );

}


function shortenText(
    value,
    maximumLength
) {

    const text =
        String(
            value || ""
        );


    if (
        text.length <=
        maximumLength
    ) {

        return text;

    }


    return (
        text.slice(
            0,
            maximumLength - 3
        ) +
        "..."
    );

}


function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            String(
                value ?? ""
            );

    }

}


function escapeHTML(
    value
) {

    return String(
        value || ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}