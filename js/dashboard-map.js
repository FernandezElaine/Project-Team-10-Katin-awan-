// js/dashboard-map.js

window.addEventListener("load", async function () {
    const mapDiv = document.getElementById("dashboardMap");
    if (!mapDiv) {
        console.log("Map container not found.");
        return;
    }

    const map = L.map("dashboardMap", {
        center: [11.0517, 124.0055],
        zoom: 13,
        scrollWheelZoom: false
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    // Fetch projects dynamically from Supabase
    const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("id", { ascending: false });

    if (error) {
        console.error("Error loading projects:", error);
        alert("Failed to load project markers.");
        return;
    }

    if (!projects || projects.length === 0) {
        L.marker([11.0517, 124.0055])
            .addTo(map)
            .bindPopup("No project markers available yet.");
        return;
    }

    // Add markers
    projects.forEach(project => {
        const lat = Number(project.latitude);
        const lng = Number(project.longitude);
        if (!lat || !lng) return;

        // Use first photo or placeholder if available
        const photo = Array.isArray(project.photos) && project.photos.length > 0
            ? project.photos[0]
            : "https://via.placeholder.com/150";

        const popup = `
            <div class="map-popup-card">
                <img src="${photo}" alt="${project.title || "Project"}">
                <h4>${project.title || "Untitled Project"}</h4>
                <p>${project.description || "No description provided."}</p>
                <p><b>Status:</b> ${project.status || "Not specified"}</p>
                <p><b>Progress:</b> ${project.progress || 0}%</p>
                <p><b>Budget:</b> ${project.budget ? "₱" + Number(project.budget).toLocaleString("en-PH") : "Not set"}</p>
            </div>
        `;

        L.marker([lat, lng])
            .addTo(map)
            .bindPopup(popup);
    });

    // Fix map size after load
    setTimeout(() => map.invalidateSize(true), 1000);
    setTimeout(() => map.invalidateSize(true), 2000);
});