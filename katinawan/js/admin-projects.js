let adminProjects = [];
let adminFilteredProjects = [];

async function loadAdminProjects() {
    const { data, error } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        alert("Error loading projects: " + error.message);
        return;
    }

    adminProjects = data || [];
    adminFilteredProjects = [...adminProjects];

    displayAdminProjects();
    updateProjectSummary();
}

async function saveProject() {
    const id = document.getElementById("projectId").value;
    const title = document.getElementById("projectTitle").value.trim();
    const description = document.getElementById("projectDescription").value.trim();
    const budget = Number(document.getElementById("projectBudget").value);
    const timeline = document.getElementById("projectTimeline").value.trim();
    const status = document.getElementById("projectStatus").value;
    const progress = Number(document.getElementById("projectProgress").value);
    const contractor = document.getElementById("projectContractor").value.trim();

    const category = document.getElementById("projectCategory")?.value || "General";
    const location = document.getElementById("projectLocation")?.value.trim() || "Not specified";
    const latitudeValue = document.getElementById("projectLatitude")?.value;
    const longitudeValue = document.getElementById("projectLongitude")?.value;
    const photoUrl = document.getElementById("projectPhotoUrl")?.value.trim();

    const latitude = latitudeValue ? Number(latitudeValue) : null;
    const longitude = longitudeValue ? Number(longitudeValue) : null;

    if (!title || !description || !budget || !timeline || !status || progress < 0 || progress > 100) {
        alert("Please complete all required fields correctly. Progress must be 0 to 100.");
        return;
    }

    const photos = photoUrl ? [photoUrl] : [];

    const projectData = {
        title,
        description,
        budget,
        timeline,
        status,
        progress,
        contractor,
        bidder: contractor,
        category,
        location,
        latitude,
        longitude,
        photos
    };

    let result;

    if (id) {
        result = await supabaseClient
            .from("projects")
            .update(projectData)
            .eq("id", Number(id));
    } else {
        result = await supabaseClient
            .from("projects")
            .insert([projectData]);
    }

    if (result.error) {
        alert(id ? "Project update failed: " + result.error.message : "Project insert failed: " + result.error.message);
        return;
    }

    await logAudit(
        id ? "Updated project" : "Added project",
        "Projects",
        `${id ? "Updated" : "Added"} project: ${title}`,
        true
    );

    alert(id ? "Project updated successfully." : "Project added successfully.");

    clearProjectForm();
    loadAdminProjects();
}

function displayAdminProjects() {
    const list = document.getElementById("adminProjectList");
    if (!list) return;

    list.innerHTML = "";

    if (!adminFilteredProjects || adminFilteredProjects.length === 0) {
        list.innerHTML = `
            <div class="admin-project-simple-card">
                <div class="admin-project-simple-left">
                    <div class="doc-icon">📭</div>
                    <div>
                        <h3>No projects found</h3>
                        <span class="status-pending">Empty</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    adminFilteredProjects.forEach(project => {
        const card = document.createElement("div");
        card.classList.add("admin-project-simple-card");

        card.innerHTML = `
            <div class="admin-project-simple-left">
                <div class="doc-icon">🏗️</div>
                <div>
                    <h3>${escapeHTML(project.title || "Untitled Project")}</h3>
                    <p>${escapeHTML(project.category || "General")} • ${escapeHTML(project.location || "No location")}</p>
                    <span class="${getStatusClass(project.status)}">
                        ${escapeHTML(project.status || "Planned")}
                    </span>
                </div>
            </div>

            <button class="view-details-btn" onclick="viewAdminProjectDetails(${project.id})">
                View Details
            </button>
        `;

        list.appendChild(card);
    });
}

function viewAdminProjectDetails(projectId) {
    const project = adminProjects.find(p => Number(p.id) === Number(projectId));
    if (!project) return;

    const modal = document.getElementById("adminProjectDetailsModal");
    if (!modal) return;

    document.getElementById("adminProjectDetailsTitle").textContent = project.title || "Untitled Project";
    document.getElementById("adminProjectDetailsStatus").textContent = project.status || "Planned";
    document.getElementById("adminProjectDetailsCategory").textContent = project.category || "General";
    document.getElementById("adminProjectDetailsDescription").textContent = project.description || "No description provided.";
    document.getElementById("adminProjectDetailsBudget").textContent = formatPeso(project.budget);
    document.getElementById("adminProjectDetailsLocation").textContent =
        `${project.location || "Not specified"}${project.latitude && project.longitude ? ` (${project.latitude}, ${project.longitude})` : ""}`;
    document.getElementById("adminProjectDetailsContractor").textContent = project.contractor || "Not specified";
    document.getElementById("adminProjectDetailsBidder").textContent = project.bidder || "Not specified";
    document.getElementById("adminProjectDetailsTimeline").textContent = project.timeline || "Not specified";
    document.getElementById("adminProjectDetailsProgress").textContent = (project.progress || 0) + "%";

    const progressBar = document.getElementById("adminProjectDetailsProgressBar");
    if (progressBar) progressBar.style.width = (project.progress || 0) + "%";

    const statusEl = document.getElementById("adminProjectDetailsStatus");
    if (statusEl) statusEl.className = "status-badge " + getStatusClass(project.status);

    const editBtn = document.getElementById("adminProjectEditBtn");
    const deleteBtn = document.getElementById("adminProjectDeleteBtn");

    if (editBtn) {
        editBtn.onclick = function () {
            closeAdminProjectDetailsModal();
            editProject(project.id);
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = function () {
            closeAdminProjectDetailsModal();
            deleteProject(project.id);
        };
    }

    modal.classList.add("active");
}

function closeAdminProjectDetailsModal() {
    const modal = document.getElementById("adminProjectDetailsModal");
    if (modal) modal.classList.remove("active");
}

document.addEventListener("click", function (e) {
    const modal = document.getElementById("adminProjectDetailsModal");
    if (modal && e.target === modal) modal.classList.remove("active");
});

function editProject(id) {
    const project = adminProjects.find(project => Number(project.id) === Number(id));
    if (!project) return;

    document.getElementById("projectId").value = project.id;
    document.getElementById("projectTitle").value = project.title || "";
    document.getElementById("projectDescription").value = project.description || "";
    document.getElementById("projectBudget").value = project.budget || "";
    document.getElementById("projectTimeline").value = project.timeline || "";
    document.getElementById("projectStatus").value = project.status || "Planned";
    document.getElementById("projectProgress").value = project.progress || 0;
    document.getElementById("projectContractor").value = project.contractor || "";

    if (document.getElementById("projectCategory")) {
        document.getElementById("projectCategory").value = project.category || "General";
    }

    if (document.getElementById("projectLocation")) {
        document.getElementById("projectLocation").value = project.location || "";
    }

    if (document.getElementById("projectLatitude")) {
        document.getElementById("projectLatitude").value = project.latitude || "";
    }

    if (document.getElementById("projectLongitude")) {
        document.getElementById("projectLongitude").value = project.longitude || "";
    }

    if (document.getElementById("projectPhotoUrl")) {
        const photos = getProjectPhotos(project);
        document.getElementById("projectPhotoUrl").value = photos[0] || "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProject(id) {
    const confirmDelete = confirm("Are you sure you want to delete this project?");
    if (!confirmDelete) return;

    const project = adminProjects.find(project => Number(project.id) === Number(id));

    const { error } = await supabaseClient
        .from("projects")
        .delete()
        .eq("id", Number(id));

    if (error) {
        alert("Project delete failed: " + error.message);
        return;
    }

    await logAudit(
        "Deleted project",
        "Projects",
        `Deleted project: ${project ? project.title : "Project ID " + id}`,
        true
    );

    alert("Project deleted successfully.");
    loadAdminProjects();
}

function clearProjectForm() {
    document.getElementById("projectId").value = "";
    document.getElementById("projectTitle").value = "";
    document.getElementById("projectDescription").value = "";
    document.getElementById("projectBudget").value = "";
    document.getElementById("projectTimeline").value = "";
    document.getElementById("projectStatus").value = "Planned";
    document.getElementById("projectProgress").value = "";
    document.getElementById("projectContractor").value = "";

    if (document.getElementById("projectCategory")) document.getElementById("projectCategory").value = "Infrastructure";
    if (document.getElementById("projectLocation")) document.getElementById("projectLocation").value = "";
    if (document.getElementById("projectLatitude")) document.getElementById("projectLatitude").value = "";
    if (document.getElementById("projectLongitude")) document.getElementById("projectLongitude").value = "";
    if (document.getElementById("projectPhotoUrl")) document.getElementById("projectPhotoUrl").value = "";
}

function updateProjectSummary() {
    const totalProjects = adminProjects.length;
    const ongoingProjects = adminProjects.filter(project => project.status === "Ongoing").length;
    const completedProjects = adminProjects.filter(project => project.status === "Completed").length;
    const totalBudget = adminProjects.reduce((sum, project) => sum + Number(project.budget || 0), 0);

    document.getElementById("totalProjects").textContent = totalProjects;
    document.getElementById("ongoingProjects").textContent = ongoingProjects;
    document.getElementById("completedProjects").textContent = completedProjects;
    document.getElementById("totalBudget").textContent = formatPeso(totalBudget);
}

function updateProjectSummaryFiltered() {
    const totalProjects = adminFilteredProjects.length;
    const ongoingProjects = adminFilteredProjects.filter(project => project.status === "Ongoing").length;
    const completedProjects = adminFilteredProjects.filter(project => project.status === "Completed").length;
    const totalBudget = adminFilteredProjects.reduce((sum, project) => sum + Number(project.budget || 0), 0);

    document.getElementById("totalProjects").textContent = totalProjects;
    document.getElementById("ongoingProjects").textContent = ongoingProjects;
    document.getElementById("completedProjects").textContent = completedProjects;
    document.getElementById("totalBudget").textContent = formatPeso(totalBudget);
}

function searchAdminProjects() {
    const searchInput = document.getElementById("adminProjectSearch");
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase();
    const filterValue = document.getElementById("adminProjectFilter")?.value || "All";

    adminFilteredProjects = adminProjects.filter(project => {
        const matchesSearch =
            String(project.title || "").toLowerCase().includes(keyword) ||
            String(project.category || "").toLowerCase().includes(keyword) ||
            String(project.location || "").toLowerCase().includes(keyword) ||
            String(project.contractor || "").toLowerCase().includes(keyword) ||
            String(project.bidder || "").toLowerCase().includes(keyword) ||
            String(project.description || "").toLowerCase().includes(keyword);

        const matchesFilter =
            filterValue === "All" || project.status === filterValue;

        return matchesSearch && matchesFilter;
    });

    displayAdminProjects();
    updateProjectSummaryFiltered();
}

function filterAdminProjects() {
    searchAdminProjects();
}

function getProjectPhotos(project) {
    if (!project || !project.photos) return [];

    if (Array.isArray(project.photos)) return project.photos;

    if (typeof project.photos === "string") {
        try {
            return JSON.parse(project.photos);
        } catch {
            return [];
        }
    }

    return [];
}

function getStatusClass(status) {
    if (status === "Completed") return "status-resolved";
    if (status === "Ongoing") return "status-review";
    if (status === "Pending") return "status-pending";
    if (status === "Planned") return "status-pending";
    return "status-pending";
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function logAudit(action, module, details, publicVisible = true) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        console.warn("Audit log skipped: no logged-in user.");
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

    if (profileError) {
        console.warn("Could not get admin profile:", profileError.message);
    }

    const adminName = profile?.full_name || "Administrator";

    const { error } = await supabaseClient
        .from("audit_logs")
        .insert([{
            user_id: user.id,
            admin_name: adminName,
            action,
            module,
            details,
            public_visible: publicVisible
        }]);

    if (error) {
        console.warn("Audit log failed:", error.message);
    }
}

loadAdminProjects();