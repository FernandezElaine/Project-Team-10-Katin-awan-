// js/admin-dashboard-map.js

let adminMap = null;
let adminMapProjects = [];
let activeMapElementId = null;
let mapActionMode = null;

let movingProjectId = null;
let currentMapProjectPhotos = [];

const DEFAULT_MAP_CENTER = [
    11.0517,
    124.0055
];

const DEFAULT_MAP_ZOOM = 13;

const PHILIPPINES_BOUNDS = [
    [4.5, 116],
    [21.5, 127]
];
let adminSearchData = {
    projects: [],
    expenses: [],
    users: []
};

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        try {
            await loadAdminMap();
            await loadAdminSearchData();

            const projectSelector =
                document.getElementById(
                    "mapProjectSelector"
                );

            if (projectSelector) {
                projectSelector.addEventListener(
                    "change",
                    focusSelectedProject
                );
            }
                        const mapProjectForm =
                document.getElementById(
                    "mapProjectForm"
                );

            if (mapProjectForm) {

                mapProjectForm.addEventListener(
                    "submit",
                    saveMapProject
                );
            }

        } catch (error) {
            console.error(
                "Admin map initialization failed:",
                error
            );
        }
    }
);

async function loadAdminMap() {
    const dashboardMap =
        document.getElementById(
            "adminDashboardMap"
        );

    const fullAdminMap =
        document.getElementById("adminMap");

    if (fullAdminMap) {
        activeMapElementId = "adminMap";
    } else if (dashboardMap) {
        activeMapElementId =
            "adminDashboardMap";
    } else {
        return;
    }

    if (typeof L === "undefined") {
        console.error(
            "Leaflet did not load."
        );

        alert(
            "The map library could not be loaded."
        );

        return;
    }

    if (adminMap) {
        adminMap.remove();
        adminMap = null;
    }

   adminMap = L.map(
    activeMapElementId,
    {
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        minZoom: 6,
        maxBounds: PHILIPPINES_BOUNDS,
        maxBoundsViscosity: 1
    }
);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "© OpenStreetMap contributors"
        }
    ).addTo(adminMap);

    const {
        data: projects,
        error
    } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", {
            ascending: false
        });

    if (error) {
        console.error(
            "Error loading project markers:",
            error
        );

        alert(
            "Unable to load project map records: " +
            error.message
        );

        return;
    }

    /*
     * Store every project, including projects that do
     * not have map coordinates yet.
     */
    adminMapProjects = projects || [];

    adminSearchData.projects = [
        ...adminMapProjects
    ];

    populateMapProjectSelector();

    const mappedProjects =
        adminMapProjects.filter(
            hasValidProjectCoordinates
        );

   mappedProjects.forEach(
    function (project) {
        addAdminMarker(project);
    }
);

/*
 * Always open directly around Bogo City.
 */
adminMap.setView(
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM
);

    /*
     * Clicking the map assigns a location only when
     * Assign Location Mode is enabled.
     */
adminMap.on(
    "click",
    async function (event) {
        const latitude =
            event.latlng.lat;

        const longitude =
            event.latlng.lng;

        /*
         * CREATE MODE:
         * Clicking the map opens the new-project form.
         */
        if (mapActionMode === "create") {
            openNewMapProjectForm(
                latitude,
                longitude
            );

            return;
        }

        /*
         * MOVE MODE:
         * Clicking the map moves an existing project.
         */
        if (mapActionMode === "move") {
            await assignSelectedProjectLocation(
                latitude,
                longitude
            );
        }
    }
);

    setTimeout(
        function () {
            adminMap.invalidateSize(true);
        },
        250
    );

    setTimeout(
        function () {
            adminMap.invalidateSize(true);
        },
        1000
    );
}

function populateMapProjectSelector() {
    const selector =
        document.getElementById(
            "mapProjectSelector"
        );

    if (!selector) {
        return;
    }

    const previousValue =
        selector.value;

    selector.innerHTML = `
        <option value="">
            Select a project...
        </option>
    `;

    if (adminMapProjects.length === 0) {
        const emptyOption =
            document.createElement("option");

        emptyOption.textContent =
            "No projects available";

        emptyOption.disabled = true;

        selector.appendChild(
            emptyOption
        );

        return;
    }

    adminMapProjects.forEach(
        function (project) {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(project.id);

            const locationLabel =
                hasValidProjectCoordinates(
                    project
                )
                    ? "Location assigned"
                    : "No location";

            option.textContent =
                (project.title ||
                    "Untitled Project") +
                " • " +
                locationLabel;

            selector.appendChild(option);
        }
    );

    const previousProjectStillExists =
        adminMapProjects.some(
            function (project) {
                return (
                    String(project.id) ===
                    String(previousValue)
                );
            }
        );

    if (previousProjectStillExists) {
        selector.value =
            previousValue;
    }
}

function focusSelectedProject() {
    const selector =
        document.getElementById(
            "mapProjectSelector"
        );

    const projectId =
        Number(selector?.value);

    if (!projectId || !adminMap) {
        return;
    }

    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    projectId
                );
            }
        );

    if (
        !project ||
        !hasValidProjectCoordinates(
            project
        )
    ) {
        return;
    }

    const latitude =
        Number(project.latitude);

    const longitude =
        Number(project.longitude);

    adminMap.setView(
        [latitude, longitude],
        16
    );

    openProjectMarkerPopup(
        latitude,
        longitude
    );
}

function addAdminMarker(project) {
    if (!hasValidProjectCoordinates(project)) {
        return;
    }

    const latitude = Number(project.latitude);
    const longitude = Number(project.longitude);

    const progress =
        normalizeProgress(project.progress);

    const photoUrl =
        getPrimaryProjectPhoto(project);

    const photoMarkup = photoUrl
        ? `
            <img
                class="admin-map-project-photo"
                src="${escapeHTML(photoUrl)}"
                alt="${escapeHTML(
                    project.title || "Project photo"
                )}"
            >
        `
        : `
            <div class="admin-map-photo-placeholder">
                <span>🏗️</span>
                <p>No project photo uploaded</p>
            </div>
        `;

    

const controls =
    activeMapElementId === "adminMap"
        ? `
            <div class="admin-map-popup-actions">

                <button
                    type="button"
                    onclick="openMapPhotoGallery(${Number(project.id)})"
                    class="map-gallery-btn"
                >
                    View Photos
                </button>

                <button
                    type="button"
                    onclick="openEditMapProjectForm(${Number(project.id)})"
                    class="public-blue-btn"
                >
                    Update Project
                </button>

                <button
                    type="button"
                    onclick="editMapProject(${Number(project.id)})"
                    class="map-edit-btn"
                >
                    Move Location
                </button>

                <button
                    type="button"
                    onclick="deleteMapProject(${Number(project.id)})"
                    class="map-delete-btn"
                >
                    Remove Marker
                </button>

            </div>
        `
        : "";



    const marker =
        L.marker([
            latitude,
            longitude
        ]).addTo(adminMap);

    marker.bindPopup(`
        <div class="map-popup-card admin-map-popup-card">
            ${photoMarkup}

            <h3>
                ${escapeHTML(
                    project.title ||
                    "Untitled Project"
                )}
            </h3>

            <p>
                ${escapeHTML(
                    project.description ||
                    "No description provided."
                )}
            </p>

            <p>
                <b>Status:</b>
                ${escapeHTML(
                    project.status ||
                    "Not specified"
                )}
            </p>

            <p>
                <b>Progress:</b>
                ${progress}%
            </p>

            <p>
                <b>Budget:</b>
                ${formatPeso(project.budget)}
            </p>

            <p>
                <b>Location:</b>
                ${escapeHTML(
                    project.location ||
                    "Not specified"
                )}
            </p>

            <p>
                <b>Contractor:</b>
                ${escapeHTML(
                    project.contractor ||
                    "Not specified"
                )}
            </p>

            <p>
                <b>Winning Bidder:</b>
                ${escapeHTML(
                    project.bidder ||
                    "Not specified"
                )}
            </p>

            ${controls}
        </div>
    `);
}

async function assignSelectedProjectLocation(
    latitude,
    longitude
) {
    if (
    !hasValidProjectCoordinates({
        latitude,
        longitude
    })
) {
    alert(
        "Please select a location within the Philippines."
    );

    adminMap.setView(
        DEFAULT_MAP_CENTER,
        DEFAULT_MAP_ZOOM
    );

    return;
}

    const selector =
        document.getElementById(
            "mapProjectSelector"
        );

    const selectedProjectId =
        Number(selector?.value);

    if (!selectedProjectId) {
        alert(
            "Please select an existing project first."
        );

        return;
    }

    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    selectedProjectId
                );
            }
        );

    if (!project) {
        alert(
            "The selected project could not be found."
        );

        return;
    }

    const alreadyHasLocation =
        hasValidProjectCoordinates(
            project
        );

    const message =
        alreadyHasLocation
            ? `Move the marker for "${project.title}" to this location?`
            : `Assign this location to "${project.title}"?`;

    if (!confirm(message)) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("projects")
            .update({
                latitude,
                longitude
            })
            .eq(
                "id",
                selectedProjectId
            );

    if (error) {
        console.error(
            "Location update error:",
            error
        );

        alert(
            "Location could not be saved: " +
            error.message
        );

        return;
    }

    alert(
        alreadyHasLocation
            ? "Project marker moved successfully."
            : "Project location assigned successfully."
    );
mapActionMode = null;
movingProjectId = null;

updateAddMarkerModeDisplay();

    await loadAdminMap();
}

function editMapProject(projectId) {
    const selector =
        document.getElementById(
            "mapProjectSelector"
        );

    if (!selector) {
        return;
    }

    selector.value =
        String(projectId);

  mapActionMode = "move";
movingProjectId = Number(projectId);

updateAddMarkerModeDisplay();

    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(projectId)
                );
            }
        );

    alert(
        `Click the new map location for "${
            project?.title ||
            "this project"
        }".`
    );
}

async function deleteMapProject(
    projectId
) {
    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(projectId)
                );
            }
        );

    const confirmed =
        confirm(
            `Remove the map marker for "${
                project?.title ||
                "this project"
            }"? The project record will remain.`
        );

    if (!confirmed) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("projects")
            .update({
                latitude: null,
                longitude: null
            })
            .eq(
                "id",
                projectId
            );

    if (error) {
        console.error(
            "Marker removal error:",
            error
        );

        alert(
            "Removing the marker failed: " +
            error.message
        );

        return;
    }

    alert(
        "Project marker removed. The project record was not deleted."
    );

   mapActionMode = null;
movingProjectId = null;

updateAddMarkerModeDisplay();

    await loadAdminMap();
}

function toggleAddMarkerMode() {


    if (mapActionMode !== null) {
        mapActionMode = null;
        movingProjectId = null;

        updateAddMarkerModeDisplay();
        return;
    }

   
    mapActionMode = "create";
    movingProjectId = null;

    updateAddMarkerModeDisplay();

    alert(
        "Click the location on the map where you want to add the new project."
    );
}
function openNewMapProjectForm(
    latitude,
    longitude
) {
    /*
     * Make sure the selected coordinates
     * are inside the Philippines.
     */
    if (
        !hasValidProjectCoordinates({
            latitude,
            longitude
        })
    ) {
        alert(
            "Please select a location within the Philippines."
        );

        return;
    }

    const modal =
        document.getElementById(
            "mapProjectModal"
        );

    const latitudeInput =
        document.getElementById(
            "mapProjectLatitude"
        );

    const longitudeInput =
        document.getElementById(
            "mapProjectLongitude"
        );

    if (
        !modal ||
        !latitudeInput ||
        !longitudeInput
    ) {
        console.error(
            "New-project map modal could not be found."
        );

        return;
    }

    /*
     * Store the clicked coordinates.
     */
    latitudeInput.value =
        latitude;

    longitudeInput.value =
        longitude;

    /*
     * Reset the form before showing it.
     */
    const form =
        document.getElementById(
            "mapProjectForm"
        );

    if (form) {
        form.reset();
    }


    const projectIdInput =
    document.getElementById(
        "mapProjectId"
    );

if (projectIdInput) {
    projectIdInput.value = "";
}

currentMapProjectPhotos = [];

const modalTitle =
    document.getElementById(
        "mapProjectModalTitle"
    );

if (modalTitle) {
    modalTitle.textContent =
        "Add New Project";
}

const saveButton =
    document.getElementById(
        "saveMapProjectBtn"
    );

if (saveButton) {
    saveButton.textContent =
        "Save Project";
}

    /*
     * Resetting the form also clears the
     * hidden coordinates, so restore them.
     */
    latitudeInput.value =
        latitude;

    longitudeInput.value =
        longitude;

    setProjectProgressUI(0);

    const preview =
        document.getElementById(
            "mapProjectPhotoPreview"
        );

    if (preview) {
        preview.innerHTML = "";
    }

    modal.style.display =
        "flex";

    /*
     * Stop map-create mode while the
     * administrator fills out the form.
     */
    mapActionMode = null;

    updateAddMarkerModeDisplay();
}
            const mapProjectStatus =
                document.getElementById(
                    "mapProjectStatus"
                );


            if (mapProjectStatus) {

                mapProjectStatus.addEventListener(
                    "change",
                    function () {

                        if (
                            mapProjectStatus.value ===
                            "Completed"
                        ) {

                            setProjectProgressUI(
                                100
                            );

                        } else if (
                            mapProjectStatus.value ===
                                "Planned" ||
                            mapProjectStatus.value ===
                                "Pending"
                        ) {

                            setProjectProgressUI(
                                0
                            );
                        }
                    }
                );
            }
            

            function openEditMapProjectForm(
    projectId
) {

    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(projectId)
                );
            }
        );

    if (!project) {
        alert(
            "The project could not be found."
        );

        return;
    }

    const modal =
        document.getElementById(
            "mapProjectModal"
        );

    if (!modal) {
        return;
    }

    document.getElementById(
        "mapProjectId"
    ).value =
        project.id;

    document.getElementById(
        "mapProjectTitle"
    ).value =
        project.title || "";

    document.getElementById(
        "mapProjectDescription"
    ).value =
        project.description || "";

    document.getElementById(
        "mapProjectCategory"
    ).value =
        project.category || "General";

    document.getElementById(
        "mapProjectLocation"
    ).value =
        project.location || "";

    document.getElementById(
        "mapProjectBudget"
    ).value =
        project.budget || "";

    document.getElementById(
        "mapProjectTimeline"
    ).value =
        project.timeline || "";

    document.getElementById(
        "mapProjectStatus"
    ).value =
        project.status || "Planned";

    document.getElementById(
        "mapProjectContractor"
    ).value =
        project.contractor || "";

    document.getElementById(
        "mapProjectBidder"
    ).value =
        project.bidder || "";

    document.getElementById(
        "mapProjectLatitude"
    ).value =
        project.latitude ?? "";

    document.getElementById(
        "mapProjectLongitude"
    ).value =
        project.longitude ?? "";

    setProjectProgressUI(
        project.progress || 0
    );

    currentMapProjectPhotos =
        normalizeProjectPhotos(
            project.photos
        );

    const photoInput =
        document.getElementById(
            "mapProjectPhotos"
        );

    if (photoInput) {
        photoInput.value = "";
    }

    previewMapProjectPhotos(
        []
    );

    const modalTitle =
        document.getElementById(
            "mapProjectModalTitle"
        );

    if (modalTitle) {
        modalTitle.textContent =
            "Update Project";
    }

    const saveButton =
        document.getElementById(
            "saveMapProjectBtn"
        );

    if (saveButton) {
        saveButton.textContent =
            "Update Project";
    }

    modal.style.display =
        "flex";
}

function closeMapProjectModal() {
    const modal =
        document.getElementById(
            "mapProjectModal"
        );

    if (!modal) {
        return;
    }

    modal.style.display =
        "none";

    const form =
        document.getElementById(
            "mapProjectForm"
        );

    if (form) {
        form.reset();
    }

    const preview =
        document.getElementById(
            "mapProjectPhotoPreview"
        );

    if (preview) {
        preview.innerHTML = "";
    }
}
document.addEventListener(
    "change",
    function (event) {

        if (
            event.target.id !==
            "mapProjectPhotos"
        ) {
            return;
        }

        previewMapProjectPhotos(
            event.target.files
        );
    }
);


function previewMapProjectPhotos(files) {

    const preview =
        document.getElementById(
            "mapProjectPhotoPreview"
        );

    if (!preview) {
        return;
    }

    preview.innerHTML = "";

    /*
     * EXISTING PHOTOS
     */
    currentMapProjectPhotos.forEach(
        function (photoUrl) {

            if (
                !isSafeProjectPhotoUrl(
                    photoUrl
                )
            ) {
                return;
            }

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "map-photo-preview-item";

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                photoUrl;

            image.alt =
                "Existing project photo";

            const label =
                document.createElement(
                    "small"
                );

            label.textContent =
                "Existing photo";

            wrapper.append(
                image,
                label
            );

            preview.appendChild(
                wrapper
            );
        }
    );

    /*
     * NEW PHOTOS
     */
    const selectedFiles =
        Array.from(
            files || []
        );

    selectedFiles.forEach(
        function (file) {

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {
                return;
            }

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "map-photo-preview-item";

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                URL.createObjectURL(
                    file
                );

            image.alt =
                file.name;

            const label =
                document.createElement(
                    "small"
                );

            label.textContent =
                "New photo";

            wrapper.append(
                image,
                label
            );

            preview.appendChild(
                wrapper
            );
        }
    );
}
// ==========================================
// MAP PROJECT PHOTO VALIDATION
// ==========================================

function validateMapProjectPhoto(file) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const maximumSize =
        5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        return (
            `${file.name}: Only JPG, PNG, and WebP images are allowed.`
        );
    }

    if (file.size > maximumSize) {
        return (
            `${file.name}: Image must not exceed 5 MB.`
        );
    }

    return "";
}


// ==========================================
// UPLOAD MAP PROJECT PHOTOS
// ==========================================

async function uploadMapProjectPhotos(files) {

    const {
        data: { user },
        error: userError
    } =
        await supabaseClient.auth
            .getUser();

    if (userError || !user) {
        throw new Error(
            "You must be logged in as an administrator."
        );
    }

    const selectedFiles =
        Array.from(files || []);

    const uploadedPhotos = [];


    // Validate everything first
    for (const file of selectedFiles) {

        const validationError =
            validateMapProjectPhoto(file);

        if (validationError) {
            throw new Error(
                validationError
            );
        }
    }


    try {

        for (const file of selectedFiles) {

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
                    .from("project-photos")
                    .upload(
                        filePath,
                        file,
                        {
                            cacheControl:
                                "3600",
                            upsert: false
                        }
                    );


            if (uploadError) {
                throw uploadError;
            }


            const {
                data: publicUrlData
            } =
                supabaseClient.storage
                    .from("project-photos")
                    .getPublicUrl(
                        filePath
                    );


            if (!publicUrlData?.publicUrl) {
                throw new Error(
                    "Unable to generate the project photo URL."
                );
            }


            uploadedPhotos.push({
                path: filePath,
                url:
                    publicUrlData.publicUrl
            });
        }


        return uploadedPhotos;

    } catch (error) {

        /*
         * If one upload fails after previous
         * photos were uploaded, remove them.
         */
        const paths =
            uploadedPhotos.map(
                photo => photo.path
            );


        if (paths.length > 0) {

            await supabaseClient.storage
                .from("project-photos")
                .remove(paths);
        }


        throw error;
    }
}

// ==========================================
// SAVE NEW PROJECT FROM MAP
// ==========================================

async function saveMapProject(event) {

    if (event) {
        event.preventDefault();
    }

const projectId =
    document.getElementById(
        "mapProjectId"
    )?.value || "";

    const saveButton =
        document.getElementById(
            "saveMapProjectBtn"
        );


    // -------------------------
    // GET FORM VALUES
    // -------------------------

    const title =
        document.getElementById(
            "mapProjectTitle"
        )?.value.trim() || "";


    const description =
        document.getElementById(
            "mapProjectDescription"
        )?.value.trim() || "";


    const category =
        document.getElementById(
            "mapProjectCategory"
        )?.value || "General";


    const location =
        document.getElementById(
            "mapProjectLocation"
        )?.value.trim() || "";


    const budget =
        Number(
            document.getElementById(
                "mapProjectBudget"
            )?.value
        );


    const timeline =
        document.getElementById(
            "mapProjectTimeline"
        )?.value.trim() || "";


    const status =
        document.getElementById(
            "mapProjectStatus"
        )?.value || "Planned";


    let progress =
        Number(
            document.getElementById(
                "mapProjectProgress"
            )?.value || 0
        );


    const contractor =
        document.getElementById(
            "mapProjectContractor"
        )?.value.trim() || "";


    const bidder =
        document.getElementById(
            "mapProjectBidder"
        )?.value.trim() || "";


    const latitude =
        Number(
            document.getElementById(
                "mapProjectLatitude"
            )?.value
        );


    const longitude =
        Number(
            document.getElementById(
                "mapProjectLongitude"
            )?.value
        );


    const photoInput =
        document.getElementById(
            "mapProjectPhotos"
        );


    const selectedPhotos =
        Array.from(
            photoInput?.files || []
        );


    // -------------------------
    // VALIDATION
    // -------------------------

    if (!title) {

        alert(
            "Please enter a project title."
        );

        return;
    }


    if (!description) {

        alert(
            "Please enter a project description."
        );

        return;
    }


    if (!location) {

        alert(
            "Please enter the project location."
        );

        return;
    }


    if (
        !Number.isFinite(budget) ||
        budget <= 0
    ) {

        alert(
            "Please enter a valid project budget."
        );

        return;
    }


    if (!timeline) {

        alert(
            "Please enter the project timeline."
        );

        return;
    }


    if (
        !hasValidProjectCoordinates({
            latitude,
            longitude
        })
    ) {

        alert(
            "The selected map location is invalid."
        );

        return;
    }


    // -------------------------
    // STATUS / PROGRESS
    // -------------------------

    if (status === "Completed") {

        progress = 100;

    } else if (
        status === "Planned" ||
        status === "Pending"
    ) {

        progress = 0;
    }


    progress =
        normalizeProgress(
            progress
        );


    let uploadedPhotos = [];


    try {

        // Disable button while saving
        if (saveButton) {

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";
        }


        // -------------------------
        // UPLOAD PHOTOS
        // -------------------------

        if (
            selectedPhotos.length > 0
        ) {

            uploadedPhotos =
                await uploadMapProjectPhotos(
                    selectedPhotos
                );
        }

const newPhotoUrls =
    uploadedPhotos.map(
        photo => photo.url
    );

const photoUrls = [
    ...currentMapProjectPhotos,
    ...newPhotoUrls
];

        // -------------------------
        // PROJECT DATA
        // -------------------------

        const projectData = {

            title,

            description,

            category,

            budget,

            timeline,

            status,

            progress,

            location,

            contractor,

            bidder,

            latitude,

            longitude,

            photos:
                photoUrls
        };

// -------------------------
// SAVE TO SUPABASE
// -------------------------

let saveResult;

if (projectId) {

    /*
     * EXISTING PROJECT:
     * Update the same project record.
     */
    saveResult =
        await supabaseClient
            .from("projects")
            .update(projectData)
            .eq(
                "id",
                Number(projectId)
            )
            .select()
            .single();

} else {

    /*
     * NEW PROJECT:
     * Create a new project record.
     */
    saveResult =
        await supabaseClient
            .from("projects")
            .insert([
                projectData
            ])
            .select()
            .single();
}


const savedProject =
    saveResult.data;

const saveError =
    saveResult.error;


if (saveError) {

    /*
     * If the database save failed,
     * remove only the NEW photos
     * uploaded during this attempt.
     */
    const paths =
        uploadedPhotos.map(
            photo => photo.path
        );


    if (paths.length > 0) {

        await supabaseClient.storage
            .from("project-photos")
            .remove(paths);
    }


    throw saveError;
}

        // -------------------------
        // AUDIT LOG
        // -------------------------

        await logMapProjectAudit(
    savedProject,
    Boolean(projectId)
);

alert(
    projectId
        ? "Project updated successfully. Existing photos were kept and new photos were added."
        : "Project added successfully."
);

        // Close form
        closeMapProjectModal();


        // Reload markers
        await loadAdminMap();


        // Focus newly added marker
        if (
            savedProject &&
            hasValidProjectCoordinates(
                savedProject
            )
        ) {

            const lat =
                Number(
                    savedProject.latitude
                );

            const lng =
                Number(
                    savedProject.longitude
                );


            adminMap.setView(
                [lat, lng],
                16
            );


            openProjectMarkerPopup(
                lat,
                lng
            );
        }


    } catch (error) {

        console.error(
            "Map project save error:",
            error
        );


        alert(
            "Project could not be saved: " +
            error.message
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Project";
        }
    }
}

// ==========================================
// MAP PROJECT AUDIT LOG
// ==========================================

async function logMapProjectAudit(
    project,
    isUpdate = false

) {

    try {

        const {
            data: { user }
        } =
            await supabaseClient.auth
                .getUser();


        if (!user) {
            return;
        }


        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("full_name")
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (profileError) {

            console.warn(
                "Admin profile lookup failed:",
                profileError.message
            );
        }


        const adminName =
            profile?.full_name ||
            "Administrator";


        const {
            error
        } =
            await supabaseClient
                .from("audit_logs")
                .insert([
                    {
                        user_id:
                            user.id,

                        admin_name:
                            adminName,

                      action:
    isUpdate
        ? "Updated project"
        : "Added project",


                        module:
                            "Projects",
details:
    isUpdate
        ? `Updated project from map: ${project.title}`
        : `Added project from map: ${project.title}`,
                        public_visible:
                            true
                    }
                ]);


        if (error) {

            console.warn(
                "Map project audit failed:",
                error.message
            );
        }


    } catch (error) {

        console.warn(
            "Map project audit error:",
            error
        );
    }
}


function updateAddMarkerModeDisplay() {
    const button =
        document.getElementById(
            "toggleAddMarkerBtn"
        );

    const status =
        document.getElementById(
            "addMarkerStatus"
        );

    if (button) {

        if (mapActionMode === "create") {
            button.textContent =
                "Cancel Add Project";
        }

        else if (mapActionMode === "move") {
            button.textContent =
                "Cancel Move Marker";
        }

        else {
            button.textContent =
                "Add New Project on Map";
        }
    }

    if (status) {

        if (mapActionMode === "create") {
            status.textContent =
                "Add Project mode is ON. Click the project location on the map.";
        }

        else if (mapActionMode === "move") {
            status.textContent =
                "Move Marker mode is ON. Click the new project location.";
        }

        else {
            status.textContent =
                "Add a new project or select an existing marker to manage its location.";
        }
    }

    if (adminMap) {
        adminMap
            .getContainer()
            .style.cursor =
                mapActionMode
                    ? "crosshair"
                    : "";
    }
}

function hasValidProjectCoordinates(
    project
) {
    if (
        !project ||
        project.latitude === null ||
        project.latitude === "" ||
        project.longitude === null ||
        project.longitude === ""
    ) {
        return false;
    }

    const latitude =
        Number(project.latitude);

    const longitude =
        Number(project.longitude);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        return false;
    }

    /*
     * Only accept coordinates inside the Philippines.
     */
    return (
        latitude >= 4.5 &&
        latitude <= 21.5 &&
        longitude >= 116 &&
        longitude <= 127
    );
}
function openProjectMarkerPopup(
    latitude,
    longitude
) {
    if (!adminMap) {
        return;
    }

    adminMap.eachLayer(
        function (layer) {
            if (
                !(layer instanceof L.Marker) ||
                !layer.getLatLng
            ) {
                return;
            }

            const markerCoordinates =
                layer.getLatLng();

            const sameLatitude =
                Math.abs(
                    markerCoordinates.lat -
                    latitude
                ) < 0.000001;

            const sameLongitude =
                Math.abs(
                    markerCoordinates.lng -
                    longitude
                ) < 0.000001;

            if (
                sameLatitude &&
                sameLongitude
            ) {
                layer.openPopup();
            }
        }
    );
}

async function loadAdminSearchData() {
    const searchInput =
        document.getElementById(
            "adminGlobalSearch"
        );

    /*
     * Do not make extra queries when the current page
     * has no global-search box.
     */
    if (!searchInput) {
        return;
    }

    const [
        expensesResult,
        usersResult
    ] = await Promise.all([
        supabaseClient
            .from("expenses")
            .select("*")
            .order("id", {
                ascending: false
            }),

        supabaseClient
            .from("profiles")
            .select(
                "id, full_name, role"
            )
            .order("created_at", {
                ascending: false
            })
    ]);

    if (expensesResult.error) {
        console.warn(
            "Expenses search data error:",
            expensesResult.error
        );
    }

    if (usersResult.error) {
        console.warn(
            "User search data error:",
            usersResult.error
        );
    }

    adminSearchData.expenses =
        expensesResult.data || [];

    adminSearchData.users =
        usersResult.data || [];
}

function handleAdminGlobalSearch() {
    const input =
        document.getElementById(
            "adminGlobalSearch"
        );

    const results =
        document.getElementById(
            "adminGlobalSearchResults"
        );

    if (!input || !results) {
        return;
    }

    const keyword =
        input.value
            .trim()
            .toLowerCase();

    if (keyword.length < 2) {
        results.classList.remove(
            "active"
        );

        results.innerHTML = "";

        return;
    }

    const matches = [];

    adminSearchData.projects
        .filter(
            function (project) {
                return [
                    project.title,
                    project.description,
                    project.category,
                    project.location,
                    project.status
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword);
            }
        )
        .slice(0, 5)
        .forEach(
            function (project) {
                matches.push({
                    type: "Project",
                    title:
                        project.title ||
                        "Untitled Project",
                    description:
                        (project.status ||
                            "No status") +
                        " • " +
                        formatPeso(
                            project.budget
                        ),
                    link:
                        "admin-projects.html"
                });
            }
        );

    adminSearchData.expenses
        .filter(
            function (expense) {
                return [
                    expense.description,
                    expense.vendor,
                    expense.category
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword);
            }
        )
        .slice(0, 5)
        .forEach(
            function (expense) {
                matches.push({
                    type: "Expense",
                    title:
                        expense.description ||
                        "Expense",
                    description:
                        (expense.vendor ||
                            "Unknown vendor") +
                        " • " +
                        formatPeso(
                            expense.amount
                        ),
                    link:
                        "admin-expenses.html"
                });
            }
        );

    adminSearchData.users
        .filter(
            function (user) {
                return [
                    user.full_name,
                    user.role
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword);
            }
        )
        .slice(0, 5)
        .forEach(
            function (user) {
                matches.push({
                    type: "User",
                    title:
                        user.full_name ||
                        "Unknown user",
                    description:
                        user.role ||
                        "resident",
                    link:
                        "admin-users.html"
                });
            }
        );

    if (matches.length === 0) {
        results.innerHTML = `
            <div class="search-no-results">
                No results found
            </div>
        `;
    } else {
        results.innerHTML =
            matches
                .map(
                    function (result) {
                        return `
                            <div
                                class="search-result-item"
                                onclick="window.location.href='${result.link}'"
                            >
                                <span class="result-type">
                                    ${escapeHTML(result.type)}
                                </span>

                                <h4>
                                    ${escapeHTML(result.title)}
                                </h4>

                                <p>
                                    ${escapeHTML(result.description)}
                                </p>
                            </div>
                        `;
                    }
                )
                .join("");
    }

    results.classList.add("active");
}

document.addEventListener(
    "click",
    function (event) {
        const searchSection =
            document.querySelector(
                ".search-bar-section"
            );

        const results =
            document.getElementById(
                "adminGlobalSearchResults"
            );

        if (
            searchSection &&
            results &&
            !searchSection.contains(
                event.target
            )
        ) {
            results.classList.remove(
                "active"
            );
        }
    }
);

// ==========================================
// PROJECT PHOTO GALLERY
// ==========================================

function openMapPhotoGallery(projectId) {

    const project =
        adminMapProjects.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(projectId)
                );
            }
        );

    if (!project) {
        alert(
            "The project could not be found."
        );

        return;
    }


    const modal =
        document.getElementById(
            "mapPhotoGalleryModal"
        );

    const title =
        document.getElementById(
            "mapPhotoGalleryTitle"
        );

    const count =
        document.getElementById(
            "mapPhotoGalleryCount"
        );

    const gallery =
        document.getElementById(
            "mapPhotoGalleryImages"
        );


    if (
        !modal ||
        !title ||
        !gallery
    ) {
        console.error(
            "Photo gallery modal elements are missing."
        );

        return;
    }


    /*
     * Get every saved photo for this project.
     */
    const photos =
        normalizeProjectPhotos(
            project.photos
        ).filter(
            function (photo) {
                return isSafeProjectPhotoUrl(
                    photo
                );
            }
        );


    title.textContent =
        project.title ||
        "Project Photos";


    if (count) {

        count.textContent =
            photos.length === 1
                ? "1 photo"
                : `${photos.length} photos`;
    }


    gallery.innerHTML = "";


    if (photos.length === 0) {

        gallery.innerHTML = `
            <div class="map-gallery-empty">
                <p>
                    No photos have been uploaded
                    for this project yet.
                </p>
            </div>
        `;

    } else {

        photos.forEach(
            function (photoUrl, index) {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "map-gallery-item";


                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    photoUrl;

                image.alt =
                    `${project.title || "Project"} photo ${index + 1}`;


                const label =
                    document.createElement(
                        "span"
                    );

                label.textContent =
                    `Photo ${index + 1}`;


                item.append(
                    image,
                    label
                );


                gallery.appendChild(
                    item
                );
            }
        );
    }


    modal.style.display =
        "flex";
}


function closeMapPhotoGallery() {

    const modal =
        document.getElementById(
            "mapPhotoGalleryModal"
        );

    if (modal) {

        modal.style.display =
            "none";
    }
}


// ==========================================
// NORMALIZE PROJECT PHOTOS
// ==========================================

function normalizeProjectPhotos(photos) {

    if (!photos) {
        return [];
    }

    /*
     * Supabase may already return the photos
     * column as an array.
     */
    if (Array.isArray(photos)) {
        return photos;
    }

    /*
     * If photos are stored as JSON text,
     * convert them back into an array.
     */
    if (typeof photos === "string") {

        try {

            const parsed =
                JSON.parse(photos);

            if (Array.isArray(parsed)) {
                return parsed;
            }

        } catch (error) {

            /*
             * If it is just one URL instead
             * of JSON, preserve it as one photo.
             */
            const trimmed =
                photos.trim();

            return trimmed
                ? [trimmed]
                : [];
        }
    }

    return [];
}

function getPrimaryProjectPhoto(project) {

    const photos =
        normalizeProjectPhotos(
            project?.photos
        ).filter(
            function (photo) {
                return isSafeProjectPhotoUrl(
                    photo
                );
            }
        );


    if (photos.length === 0) {

        return "";
    }


    /*
     * Last photo in the array =
     * newest uploaded progress photo.
     */
    return photos[
        photos.length - 1
    ];
}

function isSafeProjectPhotoUrl(value) {
    if (
        !value ||
        typeof value !== "string"
    ) {
        return false;
    }

    try {
        const url =
            new URL(
                value,
                window.location.origin
            );

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );
    } catch {
        return false;
    }
}

function normalizeProgress(value) {
    const progress =
        Number(value);

    if (!Number.isFinite(progress)) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(progress)
        )
    );
}

function formatPeso(amount) {
    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(
        Number(amount || 0)
    );
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll(
            "'",
            "&#039;"
        );
    }
// =========================
// PROJECT PROGRESS DISPLAY
// =========================
function setProjectProgressUI(value) {

    let progress =
        Number(value);

    if (!Number.isFinite(progress)) {
        progress = 0;
    }

    progress =
        Math.min(
            100,
            Math.max(
                0,
                Math.round(progress)
            )
        );

    const slider =
        document.getElementById(
            "mapProjectProgress"
        );

    const numberInput =
        document.getElementById(
            "mapProjectProgressNumber"
        );

    if (slider) {

        slider.value =
            progress;

        slider.style.background =
            `linear-gradient(
                to right,
                #2563eb 0%,
                #2563eb ${progress}%,
                #dbe3ef ${progress}%,
                #dbe3ef 100%
            )`;
    }

    if (numberInput) {
        numberInput.value =
            progress;
    }
}

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id ===
            "mapProjectProgress"
        ) {

            setProjectProgressUI(
                event.target.value
            );

            return;
        }

        if (
            event.target.id ===
            "mapProjectProgressNumber"
        ) {

            setProjectProgressUI(
                event.target.value
            );
        }
    }
);

window.toggleAddMarkerMode =
    toggleAddMarkerMode;

window.closeMapProjectModal =
    closeMapProjectModal;

window.openEditMapProjectForm =
    openEditMapProjectForm;

window.openMapPhotoGallery =
    openMapPhotoGallery;

window.closeMapPhotoGallery =
    closeMapPhotoGallery;
