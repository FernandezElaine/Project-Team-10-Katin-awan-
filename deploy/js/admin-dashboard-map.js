// js/admin-dashboard-map.js

let adminMap = null;
let adminMapProjects = [];
let activeMapElementId = null;
let addMarkerMode = false;
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
            if (!addMarkerMode) {
                return;
            }

            await assignSelectedProjectLocation(
                event.latlng.lat,
                event.latlng.lng
            );
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
                        onclick="editMapProject(${Number(project.id)})"
                        class="map-edit-btn"
                    >
                        Move Marker
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

    addMarkerMode = false;

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

    addMarkerMode = true;

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

    addMarkerMode = false;

    updateAddMarkerModeDisplay();

    await loadAdminMap();
}

function toggleAddMarkerMode() {
    const selector =
        document.getElementById(
            "mapProjectSelector"
        );

    if (
        !addMarkerMode &&
        !selector?.value
    ) {
        alert(
            "Please select an existing project first."
        );

        return;
    }

    addMarkerMode =
        !addMarkerMode;

    updateAddMarkerModeDisplay();
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
        button.textContent =
            addMarkerMode
                ? "Cancel Assign Location Mode"
                : "Enable Assign Location Mode";
    }

    if (status) {
        status.textContent =
            addMarkerMode
                ? "Location mode is ON. Click the project location on the map."
                : "Select a project, enable location mode, then click its location on the map.";
    }

    if (adminMap) {
        adminMap
            .getContainer()
            .style.cursor =
                addMarkerMode
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

function getPrimaryProjectPhoto(project) {
    const photos =
        normalizeProjectPhotos(project?.photos);

    const validPhoto =
        photos.find(function (photo) {
            return isSafeProjectPhotoUrl(photo);
        });

    return validPhoto || "";
}

function normalizeProjectPhotos(photos) {
    if (!photos) {
        return [];
    }

    if (Array.isArray(photos)) {
        return photos;
    }

    if (typeof photos === "string") {
        try {
            const parsed =
                JSON.parse(photos);

            return Array.isArray(parsed)
                ? parsed
                : [];
        } catch {
            return photos.trim()
                ? [photos.trim()]
                : [];
        }
    }

    return [];
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