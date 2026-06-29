// js/map.js

let mapInstance = null;

document.addEventListener("DOMContentLoaded", async function () {
    const fullMapBox = document.getElementById("fullMap");
    if (!fullMapBox) return;

    mapInstance = L.map("fullMap").setView([11.0517, 124.0055], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(mapInstance);

    const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("id", { ascending: false });

    if (error) {
        console.error("Error loading map projects:", error);
        alert("Unable to load project map records.");
        return;
    }

    if (!projects || projects.length === 0) {
        L.marker([11.0517, 124.0055])
            .addTo(mapInstance)
            .bindPopup(`
                <b>No project markers yet</b><br>
                Project locations will appear here once added by the admin.
            `);

        return;
    }

    window.mapLocations = projects;

    projects.forEach((project, index) => {
        const lat = Number(project.latitude);
        const lng = Number(project.longitude);

        if (!lat || !lng) return;

        L.marker([lat, lng])
            .addTo(mapInstance)
            .bindPopup(`
                <div class="map-popup-card">
                    <h3>${project.title || "Untitled Project"}</h3>
                    <p>${project.description || "No description provided."}</p>
                    <p><b>Status:</b> ${project.status || "Not specified"}</p>
                    <p><b>Progress:</b> ${project.progress || 0}%</p>
                    <p><b>Budget:</b> ${formatPeso(project.budget)}</p>
                    <p><b>Location:</b> ${project.location || "Not specified"}</p>
                    <br>
                    <button onclick="openGallery(${index})">View Photos</button>
                </div>
            `);
    });

    setTimeout(() => {
        mapInstance.invalidateSize();
    }, 500);
});

// Map Search Function
function searchMapLocations() {
    const input = document.getElementById("mapSearchInput");
    const results = document.getElementById("mapSearchResults");

    if (!input || !results || !window.mapLocations) return;

    const keyword = input.value.toLowerCase().trim();

    if (keyword.length < 2) {
        results.classList.remove("active");
        results.innerHTML = "";
        return;
    }

    const matching = window.mapLocations.filter(p =>
        String(p.title || "").toLowerCase().includes(keyword) ||
        String(p.location || "").toLowerCase().includes(keyword) ||
        String(p.description || "").toLowerCase().includes(keyword) ||
        String(p.status || "").toLowerCase().includes(keyword)
    );

    if (matching.length === 0) {
        results.innerHTML = '<div class="search-no-results">No locations found</div>';
    } else {
        results.innerHTML = matching.map((p, idx) => {
            const originalIndex = window.mapLocations.indexOf(p);
            const statusClass = p.status === "Ongoing" ? "status-ongoing" :
                              p.status === "Completed" ? "status-completed" : "status-planned";
            return `
                <div class="map-search-item" onclick="focusMapLocation(${originalIndex})">
                    <span class="map-result-status ${statusClass}">${p.status || "Planned"}</span>
                    <h4>${p.title}</h4>
                    <p>${p.location || "Location not specified"}</p>
                </div>
            `;
        }).join("");
    }

    results.classList.add("active");
}

function focusMapLocation(index) {
    const project = window.mapLocations[index];
    if (!project || !mapInstance) return;

    const lat = Number(project.latitude);
    const lng = Number(project.longitude);

    if (lat && lng) {
        mapInstance.setView([lat, lng], 16);
        document.getElementById("mapSearchResults").classList.remove("active");
        document.getElementById("mapSearchInput").value = project.title;
    }
}

// Close search results when clicking outside
document.addEventListener("click", function(e) {
    const searchSection = document.querySelector(".map-search-section");
    const results = document.getElementById("mapSearchResults");
    if (searchSection && !searchSection.contains(e.target) && results) {
        results.classList.remove("active");
    }
});

function openGallery(index) {
    const project = window.mapLocations[index];

    if (!project) return;

    document.getElementById("galleryTitle").innerText =
        project.title || "Project Photos";

    document.getElementById("galleryDescription").innerText =
        project.description || "No description provided.";

    const gallery = document.getElementById("galleryImages");
    gallery.innerHTML = "";

    let photos = [];

    if (Array.isArray(project.photos)) {
        photos = project.photos;
    } else if (typeof project.photos === "string") {
        try {
            photos = JSON.parse(project.photos);
        } catch {
            photos = [];
        }
    }

    if (!photos || photos.length === 0) {
        gallery.innerHTML = `
            <div style="padding: 30px; background: #f8fafc; border-radius: 14px; text-align: center;">
                <p>No photos uploaded for this project yet.</p>
            </div>
        `;
    } else {
        photos.forEach(photo => {
            gallery.innerHTML += `
                <img src="${photo}" alt="${project.title || "Project Photo"}">
            `;
        });
    }

    document.getElementById("galleryModal").style.display = "flex";
}

function closeGallery() {
    document.getElementById("galleryModal").style.display = "none";
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}