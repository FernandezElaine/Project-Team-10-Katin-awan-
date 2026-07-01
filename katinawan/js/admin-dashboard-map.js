// js/admin-dashboard-map.js

let adminMap;
let currentEditProject = null;
let activeMapElementId = null;
let addMarkerMode = false;

document.addEventListener("DOMContentLoaded", function () {
    loadAdminMap();
});

async function loadAdminMap() {
    const dashboardMap = document.getElementById("adminDashboardMap");
    const fullAdminMap = document.getElementById("adminMap");

    if (fullAdminMap) {
        activeMapElementId = "adminMap";
    } else if (dashboardMap) {
        activeMapElementId = "adminDashboardMap";
    } else {
        return;
    }

    if (adminMap) {
        adminMap.remove();
    }

    adminMap = L.map(activeMapElementId).setView([11.0517, 124.0055], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(adminMap);

    const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("id", { ascending: false });

    if (error) {
        console.error("Error loading project markers:", error);
        alert("Unable to load project markers.");
        return;
    }

    if (!projects || projects.length === 0) {
        L.marker([11.0517, 124.0055])
            .addTo(adminMap)
            .bindPopup("No project markers yet. Click the map to add one.");
    } else {
        projects.forEach(project => {
            addAdminMarker(project);
        });
    }

  adminMap.on("click", function (event) {
    if (!addMarkerMode) return;

    openProjectMapModal({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng
    });
});

    setTimeout(() => {
        adminMap.invalidateSize();
    }, 500);
}

function addAdminMarker(project) {
    const lat = Number(project.latitude);
    const lng = Number(project.longitude);

    if (!lat || !lng) return;

    const marker = L.marker([lat, lng]).addTo(adminMap);

    marker.bindPopup(`
        <div class="map-popup-card">
            <h3>${project.title || "Untitled Project"}</h3>
            <p>${project.description || "No description provided."}</p>
            <p><b>Status:</b> ${project.status || "Not specified"}</p>
            <p><b>Progress:</b> ${project.progress || 0}%</p>
            <p><b>Budget:</b> ${formatPeso(project.budget)}</p>
            <p><b>Location:</b> ${project.location || "Not specified"}</p>

            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="editMapProject(${project.id})" class="map-edit-btn">
                    Edit
                </button>

                <button onclick="deleteMapProject(${project.id})" class="map-delete-btn">
                    Delete
                </button>
            </div>
        </div>
    `);
}

async function editMapProject(projectId) {
    const { data: project, error } = await supabaseClient
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

    if (error) {
        alert("Failed to load project: " + error.message);
        return;
    }

    openProjectMapModal(project);
}

function openProjectMapModal(project = {}) {
    currentEditProject = project;

    let modal = document.getElementById("projectMapModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "projectMapModal";
        modal.className = "map-admin-modal";

        modal.innerHTML = `
            <div class="map-admin-content">
                <button class="map-admin-close" onclick="closeProjectMapModal()">X</button>

                <h2 id="mapModalTitle">Project Marker</h2>

                <label>Project Title</label>
                <input type="text" id="mapProjectTitle" placeholder="Project title">

                <label>Description</label>
                <textarea id="mapProjectDescription" rows="4" placeholder="Project description"></textarea>

                <label>Category</label>
                <input type="text" id="mapProjectCategory" placeholder="Infrastructure, Health, Education">

                <label>Status</label>
                <select id="mapProjectStatus">
                    <option value="Planned">Planned</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                </select>

                <label>Progress (%)</label>
                <input type="number" id="mapProjectProgress" min="0" max="100" placeholder="0-100">

                <label>Budget</label>
                <input type="number" id="mapProjectBudget" placeholder="Example: 850000">

                <label>Location</label>
                <input type="text" id="mapProjectLocation" placeholder="Barangay Proper">

                <label>Contractor</label>
                <input type="text" id="mapProjectContractor" placeholder="Contractor name">

                <label>Timeline</label>
                <input type="text" id="mapProjectTimeline" placeholder="July 2025 - Dec 2025">

                <label>Latitude</label>
                <input type="number" id="mapProjectLatitude" step="0.000001">

                <label>Longitude</label>
                <input type="number" id="mapProjectLongitude" step="0.000001">

                <label>Upload Photos</label>
                <input type="file" id="mapProjectPhotos" accept="image/*" multiple>

                <div id="existingPhotoList" class="existing-photo-list"></div>

                <button onclick="saveMapProject()" class="public-blue-btn">
                    Save Project Marker
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    document.getElementById("mapModalTitle").textContent = project.id
        ? "Edit Project Marker"
        : "Add Project Marker";

    document.getElementById("mapProjectTitle").value = project.title || "";
    document.getElementById("mapProjectDescription").value = project.description || "";
    document.getElementById("mapProjectCategory").value = project.category || "General";
    document.getElementById("mapProjectStatus").value = project.status || "Planned";
    document.getElementById("mapProjectProgress").value = project.progress || 0;
    document.getElementById("mapProjectBudget").value = project.budget || 0;
    document.getElementById("mapProjectLocation").value = project.location || "";
    document.getElementById("mapProjectContractor").value = project.contractor || "";
    document.getElementById("mapProjectTimeline").value = project.timeline || "";
    document.getElementById("mapProjectLatitude").value = project.latitude || "";
    document.getElementById("mapProjectLongitude").value = project.longitude || "";
    document.getElementById("mapProjectPhotos").value = "";

    displayExistingPhotos(project.photos);

    modal.style.display = "flex";
}

function closeProjectMapModal() {
    const modal = document.getElementById("projectMapModal");

    if (modal) {
        modal.style.display = "none";
    }
}

function displayExistingPhotos(photos) {
    const container = document.getElementById("existingPhotoList");
    if (!container) return;

    const photoList = normalizePhotos(photos);

    if (photoList.length === 0) {
        container.innerHTML = `<p class="muted-text">No photos uploaded yet.</p>`;
        return;
    }

    container.innerHTML = `<p><b>Existing Photos:</b></p>`;

    photoList.forEach(photo => {
        container.innerHTML += `
            <img src="${photo}" alt="Project photo">
        `;
    });
}

async function saveMapProject() {
    const title = document.getElementById("mapProjectTitle").value.trim();
    const description = document.getElementById("mapProjectDescription").value.trim();
    const category = document.getElementById("mapProjectCategory").value.trim();
    const status = document.getElementById("mapProjectStatus").value;
    const progress = Number(document.getElementById("mapProjectProgress").value);
    const budget = Number(document.getElementById("mapProjectBudget").value);
    const location = document.getElementById("mapProjectLocation").value.trim();
    const contractor = document.getElementById("mapProjectContractor").value.trim();
    const timeline = document.getElementById("mapProjectTimeline").value.trim();
    const latitude = Number(document.getElementById("mapProjectLatitude").value);
    const longitude = Number(document.getElementById("mapProjectLongitude").value);
    const fileInput = document.getElementById("mapProjectPhotos");

    if (!title || !description || !latitude || !longitude) {
        alert("Please enter title, description, latitude, and longitude.");
        return;
    }

    if (progress < 0 || progress > 100) {
        alert("Progress must be from 0 to 100.");
        return;
    }

    const existingPhotos = normalizePhotos(currentEditProject.photos);
    const uploadedPhotos = await uploadProjectPhotos(fileInput.files);
    const allPhotos = [...existingPhotos, ...uploadedPhotos];

    const projectData = {
        title,
        description,
        category: category || "General",
        status,
        progress,
        budget,
        location,
        contractor,
        bidder: contractor,
        timeline,
        latitude,
        longitude,
        photos: allPhotos
    };

    if (currentEditProject.id) {
        const { error } = await supabaseClient
            .from("projects")
            .update(projectData)
            .eq("id", currentEditProject.id);

        if (error) {
            alert("Update failed: " + error.message);
            return;
        }

        alert("Project marker updated successfully.");
    } else {
        const { error } = await supabaseClient
            .from("projects")
            .insert([projectData]);

        if (error) {
            alert("Insert failed: " + error.message);
            return;
        }

        alert("Project marker added successfully.");
    }

    closeProjectMapModal();
    loadAdminMap();
}

async function uploadProjectPhotos(files) {
    const urls = [];

    if (!files || files.length === 0) {
        return urls;
    }

    for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `projects/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("project-photos")
            .upload(filePath, file);

        if (uploadError) {
            console.error("Photo upload failed:", uploadError);
            alert("Photo upload failed: " + uploadError.message);
            continue;
        }

        const { data } = supabaseClient.storage
            .from("project-photos")
            .getPublicUrl(filePath);

        if (data && data.publicUrl) {
            urls.push(data.publicUrl);
        }
    }

    return urls;
}

async function deleteMapProject(projectId) {
    const confirmDelete = confirm("Are you sure you want to delete this project marker?");

    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from("projects")
        .delete()
        .eq("id", projectId);

    if (error) {
        alert("Delete failed: " + error.message);
        return;
    }

    alert("Project marker deleted successfully.");
    loadAdminMap();
}

function normalizePhotos(photos) {
    if (!photos) return [];

    if (Array.isArray(photos)) {
        return photos;
    }

    if (typeof photos === "string") {
        try {
            return JSON.parse(photos);
        } catch {
            return [];
        }
    }

    return [];
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}
function toggleAddMarkerMode() {
    addMarkerMode = !addMarkerMode;

    const button = document.getElementById("toggleAddMarkerBtn");
    const status = document.getElementById("addMarkerStatus");

    if (button) {
        button.textContent = addMarkerMode
            ? "Disable Add Marker Mode"
            : "Enable Add Marker Mode";
    }

    if (status) {
        status.textContent = addMarkerMode
            ? "Add marker mode is ON. Click the map to add a new project marker."
            : "Add marker mode is OFF. You can safely click markers to edit/delete.";
    }
}

// Admin Global Search
let adminSearchData = {
    projects: [],
    expenses: [],
    users: []
};

async function loadAdminSearchData() {
    // Load projects
    const { data: projects } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });
    adminSearchData.projects = projects || [];

    // Load expenses
    const { data: expenses } = await supabaseClient
        .from("expenses")
        .select("*")
        .order("id", { ascending: false });
    adminSearchData.expenses = expenses || [];

    // Load users
    const { data: users } = await supabaseClient
        .from("users")
        .select("*")
        .order("id", { ascending: false });
    adminSearchData.users = users || [];
}

function handleAdminGlobalSearch() {
    const input = document.getElementById("adminGlobalSearch");
    const results = document.getElementById("adminGlobalSearchResults");

    if (!input || !results) return;

    const keyword = input.value.toLowerCase().trim();

    if (keyword.length < 2) {
        results.classList.remove("active");
        results.innerHTML = "";
        return;
    }

    let searchResults = [];

    // Search projects
    const matchingProjects = adminSearchData.projects.filter(p =>
        String(p.title || "").toLowerCase().includes(keyword) ||
        String(p.description || "").toLowerCase().includes(keyword) ||
        String(p.category || "").toLowerCase().includes(keyword) ||
        String(p.location || "").toLowerCase().includes(keyword) ||
        String(p.status || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingProjects.forEach(p => {
        searchResults.push({
            type: "Project",
            title: p.title,
            desc: `${p.status} • ${formatPeso(p.budget)}`,
            link: "admin-projects.html"
        });
    });

    // Search expenses
    const matchingExpenses = adminSearchData.expenses.filter(e =>
        String(e.description || "").toLowerCase().includes(keyword) ||
        String(e.vendor || "").toLowerCase().includes(keyword) ||
        String(e.category || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingExpenses.forEach(e => {
        searchResults.push({
            type: "Expense",
            title: e.description,
            desc: `${e.vendor || "Unknown"} • ${formatPeso(e.amount)}`,
            link: "admin-expenses.html"
        });
    });

    // Search users
    const matchingUsers = adminSearchData.users.filter(u =>
        String(u.full_name || "").toLowerCase().includes(keyword) ||
        String(u.email || "").toLowerCase().includes(keyword) ||
        String(u.role || "").toLowerCase().includes(keyword)
    ).slice(0, 5);

    matchingUsers.forEach(u => {
        searchResults.push({
            type: "User",
            title: u.full_name || "Unknown",
            desc: `${u.email || "No email"} • ${u.role || "Resident"}`,
            link: "admin-users.html"
        });
    });

    // Display results
    if (searchResults.length === 0) {
        results.innerHTML = '<div class="search-no-results">No results found</div>';
    } else {
        results.innerHTML = searchResults.map(r => `
            <div class="search-result-item" onclick="window.location.href='${r.link}'">
                <span class="result-type">${r.type}</span>
                <h4>${r.title}</h4>
                <p>${r.desc}</p>
            </div>
        `).join("");
    }

    results.classList.add("active");
}

// Close search results when clicking outside
document.addEventListener("click", function(e) {
    const searchSection = document.querySelector(".search-bar-section");
    const results = document.getElementById("adminGlobalSearchResults");
    if (searchSection && !searchSection.contains(e.target) && results) {
        results.classList.remove("active");
    }
});

// Map Search Functionality
let mapSearchMarkers = [];

function searchMapProjects() {
    const searchInput = document.getElementById("mapProjectSearch");
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase().trim();
    const searchResults = document.getElementById("mapSearchResults");

    if (!searchResults) return;

    // Clear previous search markers
    mapSearchMarkers.forEach(m => adminMap.removeLayer(m));
    mapSearchMarkers = [];

    if (keyword.length < 2) {
        searchResults.innerHTML = "";
        searchResults.classList.remove("active");
        return;
    }

    // Get all project markers from the map
    const allMarkers = [];
    adminMap.eachLayer(function(layer) {
        if (layer instanceof L.Marker && layer._latlng) {
            allMarkers.push(layer);
        }
    });

    // Filter matching projects
    const matchingProjects = adminSearchData.projects.filter(p =>
        String(p.title || "").toLowerCase().includes(keyword) ||
        String(p.description || "").toLowerCase().includes(keyword) ||
        String(p.category || "").toLowerCase().includes(keyword) ||
        String(p.location || "").toLowerCase().includes(keyword) ||
        String(p.status || "").toLowerCase().includes(keyword)
    );

    if (matchingProjects.length === 0) {
        searchResults.innerHTML = '<div class="map-search-no-result">No projects found</div>';
        searchResults.classList.add("active");
        return;
    }

    // Display results
    searchResults.innerHTML = matchingProjects.slice(0, 8).map(p => `
        <div class="map-search-result-item" onclick="focusMapProject(${p.id}, ${p.latitude}, ${p.longitude})">
            <strong>${p.title}</strong>
            <span>${p.status} • ${p.location || "No location"}</span>
        </div>
    `).join("");

    searchResults.classList.add("active");
}

function focusMapProject(projectId, lat, lng) {
    // Clear search results
    const searchResults = document.getElementById("mapSearchResults");
    if (searchResults) {
        searchResults.innerHTML = "";
        searchResults.classList.remove("active");
    }

    // Clear search input
    const searchInput = document.getElementById("mapProjectSearch");
    if (searchInput) {
        searchInput.value = "";
    }

    // Zoom to the marker
    adminMap.setView([lat, lng], 16);

    // Find and open the marker's popup
    adminMap.eachLayer(function(layer) {
        if (layer instanceof L.Marker && layer._latlng) {
            const markerLat = layer._latlng.lat;
            const markerLng = layer._latlng.lng;

            // Check if this is the marker we're looking for (with small tolerance)
            if (Math.abs(markerLat - lat) < 0.0001 && Math.abs(markerLng - lng) < 0.0001) {
                layer.openPopup();
            }
        }
    });
}

// Initialize admin search data
loadAdminSearchData();