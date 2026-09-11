let adminProjects = [];
let adminFilteredProjects = [];

let projectOrganizations = [];
let projectBarangays = [];


/* =========================================================
   LOAD PROJECTS
========================================================= */

async function loadAdminProjects() {

    const { data, error } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });

    if (error) {

        alert(
            "Error loading projects: " +
            error.message
        );

        return;
    }

    adminProjects = data || [];

    adminFilteredProjects = [
        ...adminProjects
    ];

    displayAdminProjects();

    updateProjectSummary();
}


/* =========================================================
   LOAD ORGANIZATIONS
========================================================= */

async function loadProjectOrganizations() {

    const organizationSelect =
        document.getElementById(
            "projectOrganization"
        );

    if (!organizationSelect) return;


    organizationSelect.innerHTML = `
        <option value="">
            Select City/Municipality
        </option>
    `;


    const { data, error } =
        await supabaseClient
            .from("organizations")
            .select("id, name, type")
            .eq("is_active", true)
            .order("name");


    if (error) {

        console.error(
            "Organization loading error:",
            error
        );

        organizationSelect.innerHTML = `
            <option value="">
                Unable to load organizations
            </option>
        `;

        return;
    }


    projectOrganizations =
        data || [];


    projectOrganizations.forEach(
        organization => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                organization.id;

            option.textContent =
                organization.name;

            organizationSelect.appendChild(
                option
            );
        }
    );
}


/* =========================================================
   LOAD BARANGAYS
========================================================= */

async function loadProjectBarangays(
    organizationId,
    selectedBarangayId = ""
) {

    const barangaySelect =
        document.getElementById(
            "projectBarangay"
        );

    if (!barangaySelect) return;


    barangaySelect.innerHTML = `
        <option value="">
            Select Barangay
        </option>
    `;

    barangaySelect.disabled = true;


    if (!organizationId) {

        barangaySelect.innerHTML = `
            <option value="">
                Select City/Municipality first
            </option>
        `;

        return;
    }


    const { data, error } =
        await supabaseClient
            .from("barangays")
            .select("id, name")
            .eq(
                "organization_id",
                organizationId
            )
            .eq("is_active", true)
            .order("name");


    if (error) {

        console.error(
            "Barangay loading error:",
            error
        );

        barangaySelect.innerHTML = `
            <option value="">
                Unable to load barangays
            </option>
        `;

        return;
    }


    projectBarangays =
        data || [];


    projectBarangays.forEach(
        barangay => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                barangay.id;

            option.textContent =
                barangay.name;


            if (
                String(barangay.id) ===
                String(selectedBarangayId)
            ) {

                option.selected = true;
            }


            barangaySelect.appendChild(
                option
            );
        }
    );


    barangaySelect.disabled = false;
}


/* =========================================================
   ORGANIZATION CHANGE
========================================================= */

const projectOrganizationSelect =
    document.getElementById(
        "projectOrganization"
    );


if (projectOrganizationSelect) {

    projectOrganizationSelect.addEventListener(
        "change",
        function () {

            loadProjectBarangays(
                this.value
            );
        }
    );
}


/* =========================================================
   SAVE PROJECT
========================================================= */

async function saveProject() {

    const id =
        document.getElementById(
            "projectId"
        ).value;


    const title =
        document.getElementById(
            "projectTitle"
        ).value.trim();


    const description =
        document.getElementById(
            "projectDescription"
        ).value.trim();


    const budget =
        Number(
            document.getElementById(
                "projectBudget"
            ).value
        );


    const timeline =
        document.getElementById(
            "projectTimeline"
        ).value.trim();


    const status =
        document.getElementById(
            "projectStatus"
        ).value;


    const progress =
        Number(
            document.getElementById(
                "projectProgress"
            ).value
        );


    const contractor =
        document.getElementById(
            "projectContractor"
        ).value.trim();


    const bidder =
        document.getElementById(
            "projectBidder"
        ).value.trim();


    const category =
        document.getElementById(
            "projectCategory"
        )?.value ||
        "General";


    const location =
        document.getElementById(
            "projectLocation"
        )?.value.trim() ||
        "Not specified";


    const organizationId =
        document.getElementById(
            "projectOrganization"
        )?.value ||
        null;


    const barangayId =
        document.getElementById(
            "projectBarangay"
        )?.value ||
        null;


    const latitudeValue =
        document.getElementById(
            "projectLatitude"
        )?.value;


    const longitudeValue =
        document.getElementById(
            "projectLongitude"
        )?.value;


    const photoInput =
        document.getElementById(
            "projectPhoto"
        );


    const selectedPhoto =
        photoInput?.files?.[0] ||
        null;


    let photoUrl =
        document.getElementById(
            "projectExistingPhotoUrl"
        )?.value ||
        "";


    const latitude =
        latitudeValue
            ? Number(latitudeValue)
            : null;


    const longitude =
        longitudeValue
            ? Number(longitudeValue)
            : null;


/* ---------------------------------------------------------
   VALIDATION
--------------------------------------------------------- */

    if (
        !title ||
        !description ||
        !budget ||
        !timeline ||
        !status ||
        progress < 0 ||
        progress > 100
    ) {

        alert(
            "Please complete all required fields correctly. " +
            "Progress must be 0 to 100."
        );

        return;
    }


    /*
       Existing projects may have no organization/barangay
       because those records were created before the new
       multi-barangay system.

       New projects can be assigned to a barangay.
    */

    if (
        organizationId &&
        !barangayId
    ) {

        alert(
            "Please select a Barangay for the selected City/Municipality."
        );

        return;
    }


/* ---------------------------------------------------------
   PHOTO VALIDATION
--------------------------------------------------------- */

    if (selectedPhoto) {

        const validationError =
            validateProjectPhoto(
                selectedPhoto
            );


        if (validationError) {

            alert(
                validationError
            );

            return;
        }
    }


/* ---------------------------------------------------------
   PHOTO UPLOAD
--------------------------------------------------------- */

    try {

        if (selectedPhoto) {

            photoUrl =
                await uploadProjectPhoto(
                    selectedPhoto
                );
        }

    } catch (uploadError) {

        console.error(
            "Project photo upload error:",
            uploadError
        );


        alert(
            "Project photo upload failed: " +
            uploadError.message
        );


        return;
    }


    const photos =
        photoUrl
            ? [photoUrl]
            : [];


/* ---------------------------------------------------------
   PROJECT DATA
--------------------------------------------------------- */

    const projectData = {

        title,

        description,

        budget,

        timeline,

        status,

        progress,

        contractor,

        bidder,

        category,

        location,

        latitude,

        longitude,

        photos,

        organization_id:
            organizationId,

        barangay_id:
            barangayId
    };


    let result;


/* ---------------------------------------------------------
   UPDATE
--------------------------------------------------------- */

    if (id) {

        result =
            await supabaseClient
                .from("projects")
                .update(projectData)
                .eq(
                    "id",
                    Number(id)
                );

    }


/* ---------------------------------------------------------
   INSERT
--------------------------------------------------------- */

    else {

        result =
            await supabaseClient
                .from("projects")
                .insert([
                    projectData
                ]);
    }


    if (result.error) {

        alert(
            id
                ? "Project update failed: " +
                  result.error.message
                : "Project insert failed: " +
                  result.error.message
        );

        return;
    }


/* ---------------------------------------------------------
   AUDIT
--------------------------------------------------------- */

    await logAudit(

        id
            ? "Updated project"
            : "Added project",

        "Projects",

        `${
            id
                ? "Updated"
                : "Added"
        } project: ${title}`,

        true
    );


    alert(
        id
            ? "Project updated successfully."
            : "Project added successfully."
    );


    clearProjectForm();

    await loadAdminProjects();
}


/* =========================================================
   DISPLAY PROJECTS
========================================================= */

function displayAdminProjects() {

    const list =
        document.getElementById(
            "adminProjectList"
        );

    if (!list) return;


    list.innerHTML = "";


    if (
        !adminFilteredProjects ||
        adminFilteredProjects.length === 0
    ) {

        list.innerHTML = `

            <div class="admin-project-simple-card">

                <div class="admin-project-simple-left">

                    <div class="doc-icon">
                        📭
                    </div>

                    <div>

                        <h3>
                            No projects found
                        </h3>

                        <span class="status-pending">
                            Empty
                        </span>

                    </div>

                </div>

            </div>
        `;

        return;
    }


    adminFilteredProjects.forEach(
        project => {

            const card =
                document.createElement(
                    "div"
                );


            card.classList.add(
                "admin-project-simple-card"
            );


            card.innerHTML = `

                <div class="admin-project-simple-left">

                    <div class="doc-icon">
                        🏗️
                    </div>

                    <div>

                        <h3>
                            ${escapeHTML(
                                project.title ||
                                "Untitled Project"
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                project.category ||
                                "General"
                            )}

                            •
                            
                            ${escapeHTML(
                                project.location ||
                                "No location"
                            )}
                        </p>

                        <span class="${getStatusClass(
                            project.status
                        )}">

                            ${escapeHTML(
                                project.status ||
                                "Planned"
                            )}

                        </span>

                    </div>

                </div>


                <button
                    class="view-details-btn"
                    onclick="viewAdminProjectDetails(${project.id})"
                >
                    View Details
                </button>

            `;


            list.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   VIEW PROJECT DETAILS
========================================================= */

function viewAdminProjectDetails(
    projectId
) {

    const project =
        adminProjects.find(
            p =>
                Number(p.id) ===
                Number(projectId)
        );


    if (!project) return;


    const modal =
        document.getElementById(
            "adminProjectDetailsModal"
        );


    if (!modal) return;


    document.getElementById(
        "adminProjectDetailsTitle"
    ).textContent =
        project.title ||
        "Untitled Project";


    document.getElementById(
        "adminProjectDetailsStatus"
    ).textContent =
        project.status ||
        "Planned";


    document.getElementById(
        "adminProjectDetailsCategory"
    ).textContent =
        project.category ||
        "General";


    document.getElementById(
        "adminProjectDetailsDescription"
    ).textContent =
        project.description ||
        "No description provided.";


    document.getElementById(
        "adminProjectDetailsBudget"
    ).textContent =
        formatPeso(
            project.budget
        );


    document.getElementById(
        "adminProjectDetailsLocation"
    ).textContent =
        project.location ||
        "Not specified";


    document.getElementById(
        "adminProjectDetailsContractor"
    ).textContent =
        project.contractor ||
        "Not specified";


    document.getElementById(
        "adminProjectDetailsBidder"
    ).textContent =
        project.bidder ||
        "Not specified";


    document.getElementById(
        "adminProjectDetailsTimeline"
    ).textContent =
        project.timeline ||
        "Not specified";


    document.getElementById(
        "adminProjectDetailsProgress"
    ).textContent =
        (project.progress || 0) +
        "%";


    const progressBar =
        document.getElementById(
            "adminProjectDetailsProgressBar"
        );


    if (progressBar) {

        progressBar.style.width =
            (project.progress || 0) +
            "%";
    }


    const statusEl =
        document.getElementById(
            "adminProjectDetailsStatus"
        );


    if (statusEl) {

        statusEl.className =
            "status-badge " +
            getStatusClass(
                project.status
            );
    }


    const editBtn =
        document.getElementById(
            "adminProjectEditBtn"
        );


    const deleteBtn =
        document.getElementById(
            "adminProjectDeleteBtn"
        );


    if (editBtn) {

        editBtn.onclick =
            function () {

                closeAdminProjectDetailsModal();

                editProject(
                    project.id
                );
            };
    }


    if (deleteBtn) {

        deleteBtn.onclick =
            function () {

                closeAdminProjectDetailsModal();

                deleteProject(
                    project.id
                );
            };
    }


    modal.classList.add(
        "active"
    );
}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeAdminProjectDetailsModal() {

    const modal =
        document.getElementById(
            "adminProjectDetailsModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );
    }
}


document.addEventListener(
    "click",
    function (e) {

        const modal =
            document.getElementById(
                "adminProjectDetailsModal"
            );


        if (
            modal &&
            e.target === modal
        ) {

            modal.classList.remove(
                "active"
            );
        }
    }
);


/* =========================================================
   EDIT PROJECT
========================================================= */

async function editProject(id) {

    const project =
        adminProjects.find(
            project =>
                Number(project.id) ===
                Number(id)
        );


    if (!project) return;


    document.getElementById(
        "projectId"
    ).value =
        project.id;


    document.getElementById(
        "projectTitle"
    ).value =
        project.title || "";


    document.getElementById(
        "projectDescription"
    ).value =
        project.description || "";


    document.getElementById(
        "projectBudget"
    ).value =
        project.budget || "";


    document.getElementById(
        "projectTimeline"
    ).value =
        project.timeline || "";


    document.getElementById(
        "projectStatus"
    ).value =
        project.status ||
        "Planned";


    document.getElementById(
        "projectProgress"
    ).value =
        project.progress || 0;


    document.getElementById(
        "projectContractor"
    ).value =
        project.contractor || "";


    document.getElementById(
        "projectBidder"
    ).value =
        project.bidder || "";


    if (
        document.getElementById(
            "projectCategory"
        )
    ) {

        document.getElementById(
            "projectCategory"
        ).value =
            project.category ||
            "General";
    }


    if (
        document.getElementById(
            "projectLocation"
        )
    ) {

        document.getElementById(
            "projectLocation"
        ).value =
            project.location ||
            "";
    }


    if (
        document.getElementById(
            "projectLatitude"
        )
    ) {

        document.getElementById(
            "projectLatitude"
        ).value =
            project.latitude ||
            "";
    }


    if (
        document.getElementById(
            "projectLongitude"
        )
    ) {

        document.getElementById(
            "projectLongitude"
        ).value =
            project.longitude ||
            "";
    }


/* ---------------------------------------------------------
   LOAD ORGANIZATION / BARANGAY
--------------------------------------------------------- */

    const organizationSelect =
        document.getElementById(
            "projectOrganization"
        );


    const barangaySelect =
        document.getElementById(
            "projectBarangay"
        );


    if (organizationSelect) {

        organizationSelect.value =
            project.organization_id ||
            "";


        if (
            project.organization_id
        ) {

            await loadProjectBarangays(

                project.organization_id,

                project.barangay_id ||
                ""
            );

        } else if (barangaySelect) {

            barangaySelect.innerHTML = `
                <option value="">
                    Select City/Municipality first
                </option>
            `;

            barangaySelect.disabled =
                true;
        }
    }


/* ---------------------------------------------------------
   PHOTO
--------------------------------------------------------- */

    const projectPhotos =
        getProjectPhotos(
            project
        );


    const existingPhotoUrl =
        projectPhotos[0] ||
        "";


    document.getElementById(
        "projectExistingPhotoUrl"
    ).value =
        existingPhotoUrl;


    showProjectPhotoPreview(
        existingPhotoUrl
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   DELETE PROJECT
========================================================= */

async function deleteProject(id) {

    const confirmDelete =
        confirm(
            "Are you sure you want to delete this project?"
        );


    if (!confirmDelete) return;


    const project =
        adminProjects.find(
            project =>
                Number(project.id) ===
                Number(id)
        );


    const { error } =
        await supabaseClient
            .from("projects")
            .delete()
            .eq(
                "id",
                Number(id)
            );


    if (error) {

        alert(
            "Project delete failed: " +
            error.message
        );

        return;
    }


    await logAudit(

        "Deleted project",

        "Projects",

        `Deleted project: ${
            project
                ? project.title
                : "Project ID " + id
        }`,

        true
    );


    alert(
        "Project deleted successfully."
    );


    loadAdminProjects();
}


/* =========================================================
   CLEAR FORM
========================================================= */

function clearProjectForm() {

    document.getElementById(
        "projectId"
    ).value = "";


    document.getElementById(
        "projectTitle"
    ).value = "";


    document.getElementById(
        "projectDescription"
    ).value = "";


    document.getElementById(
        "projectBudget"
    ).value = "";


    document.getElementById(
        "projectTimeline"
    ).value = "";


    document.getElementById(
        "projectStatus"
    ).value =
        "Planned";


    document.getElementById(
        "projectProgress"
    ).value =
        "0";


    document.getElementById(
        "projectContractor"
    ).value = "";


    document.getElementById(
        "projectBidder"
    ).value = "";


    if (
        document.getElementById(
            "projectCategory"
        )
    ) {

        document.getElementById(
            "projectCategory"
        ).value =
            "Infrastructure";
    }


    if (
        document.getElementById(
            "projectLocation"
        )
    ) {

        document.getElementById(
            "projectLocation"
        ).value = "";
    }


    if (
        document.getElementById(
            "projectLatitude"
        )
    ) {

        document.getElementById(
            "projectLatitude"
        ).value = "";
    }


    if (
        document.getElementById(
            "projectLongitude"
        )
    ) {

        document.getElementById(
            "projectLongitude"
        ).value = "";
    }


    if (
        document.getElementById(
            "projectOrganization"
        )
    ) {

        document.getElementById(
            "projectOrganization"
        ).value = "";
    }


    if (
        document.getElementById(
            "projectBarangay"
        )
    ) {

        document.getElementById(
            "projectBarangay"
        ).innerHTML = `
            <option value="">
                Select City/Municipality first
            </option>
        `;

        document.getElementById(
            "projectBarangay"
        ).disabled =
            true;
    }


    const photoInput =
        document.getElementById(
            "projectPhoto"
        );


    if (photoInput) {

        photoInput.value =
            "";
    }


    document.getElementById(
        "projectExistingPhotoUrl"
    ).value =
        "";


    showProjectPhotoPreview(
        ""
    );
}


/* =========================================================
   SUMMARY
========================================================= */

function updateProjectSummary() {

    const totalProjects =
        adminProjects.length;


    const ongoingProjects =
        adminProjects.filter(
            project =>
                project.status ===
                "Ongoing"
        ).length;


    const completedProjects =
        adminProjects.filter(
            project =>
                project.status ===
                "Completed"
        ).length;


    const totalBudget =
        adminProjects.reduce(
            (sum, project) =>
                sum +
                Number(
                    project.budget || 0
                ),
            0
        );


    document.getElementById(
        "totalProjects"
    ).textContent =
        totalProjects;


    document.getElementById(
        "ongoingProjects"
    ).textContent =
        ongoingProjects;


    document.getElementById(
        "completedProjects"
    ).textContent =
        completedProjects;


    document.getElementById(
        "totalBudget"
    ).textContent =
        formatPeso(
            totalBudget
        );
}


function updateProjectSummaryFiltered() {

    const totalProjects =
        adminFilteredProjects.length;


    const ongoingProjects =
        adminFilteredProjects.filter(
            project =>
                project.status ===
                "Ongoing"
        ).length;


    const completedProjects =
        adminFilteredProjects.filter(
            project =>
                project.status ===
                "Completed"
        ).length;


    const totalBudget =
        adminFilteredProjects.reduce(
            (sum, project) =>
                sum +
                Number(
                    project.budget || 0
                ),
            0
        );


    document.getElementById(
        "totalProjects"
    ).textContent =
        totalProjects;


    document.getElementById(
        "ongoingProjects"
    ).textContent =
        ongoingProjects;


    document.getElementById(
        "completedProjects"
    ).textContent =
        completedProjects;


    document.getElementById(
        "totalBudget"
    ).textContent =
        formatPeso(
            totalBudget
        );
}


/* =========================================================
   SEARCH
========================================================= */

function searchAdminProjects() {

    const searchInput =
        document.getElementById(
            "adminProjectSearch"
        );


    if (!searchInput) return;


    const keyword =
        searchInput.value.toLowerCase();


    const filterValue =
        document.getElementById(
            "adminProjectFilter"
        )?.value ||
        "All";


    adminFilteredProjects =
        adminProjects.filter(
            project => {

                const matchesSearch =

                    String(
                        project.title || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )

                    ||

                    String(
                        project.category || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )

                    ||

                    String(
                        project.location || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )

                    ||

                    String(
                        project.contractor || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )

                    ||

                    String(
                        project.bidder || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        )

                    ||

                    String(
                        project.description || ""
                    )
                        .toLowerCase()
                        .includes(
                            keyword
                        );


                const matchesFilter =
                    filterValue === "All" ||
                    project.status ===
                        filterValue;


                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );


    displayAdminProjects();

    updateProjectSummaryFiltered();
}


function filterAdminProjects() {

    searchAdminProjects();
}


/* =========================================================
   PHOTO VALIDATION
========================================================= */

function validateProjectPhoto(
    file
) {

    const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp"
    ];


    const maximumSize =
        5 * 1024 * 1024;


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        return (
            "Invalid file type. Please choose a JPG, PNG, " +
            "or WebP image."
        );
    }


    if (
        file.size >
        maximumSize
    ) {

        return (
            "The selected image is larger than 5 MB."
        );
    }


    return "";
}


/* =========================================================
   PHOTO UPLOAD
========================================================= */

async function uploadProjectPhoto(
    file
) {

    const {
        data: { user },
        error: userError
    } =
        await supabaseClient.auth.getUser();


    if (
        userError ||
        !user
    ) {

        throw new Error(
            "You must be logged in as an administrator."
        );
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const uniqueName =
        crypto.randomUUID() +
        "." +
        extension;


    const filePath =
        user.id +
        "/" +
        uniqueName;


    const {
        error: uploadError
    } =
        await supabaseClient.storage
            .from(
                "project-photos"
            )
            .upload(
                filePath,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false
                }
            );


    if (uploadError) {

        throw uploadError;
    }


    const {
        data: publicUrlData
    } =
        supabaseClient.storage
            .from(
                "project-photos"
            )
            .getPublicUrl(
                filePath
            );


    if (
        !publicUrlData?.publicUrl
    ) {

        throw new Error(
            "The uploaded photo URL could not be generated."
        );
    }


    return (
        publicUrlData.publicUrl
    );
}


/* =========================================================
   PHOTO PREVIEW
========================================================= */

function showProjectPhotoPreview(
    photoUrl
) {

    const container =
        document.getElementById(
            "projectPhotoPreviewContainer"
        );


    const preview =
        document.getElementById(
            "projectPhotoPreview"
        );


    if (
        !container ||
        !preview
    ) {

        return;
    }


    if (!photoUrl) {

        container.hidden =
            true;

        preview.removeAttribute(
            "src"
        );

        return;
    }


    preview.src =
        photoUrl;

    container.hidden =
        false;
}


/* =========================================================
   REMOVE PROJECT PHOTO
========================================================= */

function removeSelectedProjectPhoto() {

    const photoInput =
        document.getElementById(
            "projectPhoto"
        );


    if (photoInput) {

        photoInput.value =
            "";
    }


    document.getElementById(
        "projectExistingPhotoUrl"
    ).value =
        "";


    showProjectPhotoPreview(
        ""
    );
}


/* =========================================================
   GET PROJECT PHOTOS
========================================================= */

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

            return JSON.parse(
                project.photos
            );

        } catch {

            return [];
        }
    }


    return [];
}


/* =========================================================
   STATUS
========================================================= */

function getStatusClass(
    status
) {

    if (
        status ===
        "Completed"
    ) {

        return "status-resolved";
    }


    if (
        status ===
        "Ongoing"
    ) {

        return "status-review";
    }


    if (
        status ===
        "Pending"
    ) {

        return "status-pending";
    }


    if (
        status ===
        "Planned"
    ) {

        return "status-pending";
    }


    return "status-pending";
}


/* =========================================================
   PESO
========================================================= */

function formatPeso(
    amount
) {

    return (
        "₱" +
        Number(
            amount || 0
        ).toLocaleString(
            "en-PH"
        )
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

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


/* =========================================================
   AUDIT LOG
========================================================= */

async function logAudit(
    action,
    module,
    details,
    publicVisible = true
) {

    const {
        data: { user }
    } =
        await supabaseClient.auth.getUser();


    if (!user) {

        console.warn(
            "Audit log skipped: no logged-in user."
        );

        return;
    }


    const {
        data: profile,
        error: profileError
    } =
        await supabaseClient
            .from("profiles")
            .select(
                "full_name"
            )
            .eq(
                "id",
                user.id
            )
            .single();


    if (profileError) {

        console.warn(
            "Could not get admin profile:",
            profileError.message
        );
    }


    const adminName =
        profile?.full_name ||
        "Administrator";


    const { error } =
        await supabaseClient
            .from("audit_logs")
            .insert([
                {
                    user_id:
                        user.id,

                    admin_name:
                        adminName,

                    action,

                    module,

                    details,

                    public_visible:
                        publicVisible
                }
            ]);


    if (error) {

        console.warn(
            "Audit log failed:",
            error.message
        );
    }
}


/* =========================================================
   PHOTO INPUT
========================================================= */

const projectPhotoInput =
    document.getElementById(
        "projectPhoto"
    );


if (projectPhotoInput) {

    projectPhotoInput.addEventListener(
        "change",
        function () {

            const selectedFile =
                projectPhotoInput.files?.[0];


            if (!selectedFile) {

                showProjectPhotoPreview(
                    ""
                );

                return;
            }


            const validationError =
                validateProjectPhoto(
                    selectedFile
                );


            if (validationError) {

                alert(
                    validationError
                );

                projectPhotoInput.value =
                    "";

                showProjectPhotoPreview(
                    ""
                );

                return;
            }


            const temporaryPreviewUrl =
                URL.createObjectURL(
                    selectedFile
                );


            showProjectPhotoPreview(
                temporaryPreviewUrl
            );
        }
    );
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeAdminProjects() {

    await loadProjectOrganizations();

    await loadAdminProjects();
}


initializeAdminProjects();