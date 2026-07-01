let projectData = [];

async function loadProjectsFromSupabase() {
    const { data, error } = await supabaseClient
        .from("projects")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Error loading projects:", error);
        projectData = [];
        loadProjectCards(projectData);
        updateProjectStats(projectData);
        return;
    }

    projectData = data || [];
    loadProjectCards(projectData);
    updateProjectStats(projectData);
}

function loadProjectCards(data = projectData) {
    const projectList = document.getElementById("projectList");

    if (!projectList) return;

    projectList.innerHTML = "";

    if (data.length === 0) {
        projectList.innerHTML = `
            <div class="project-full-card">
                <h3>No projects found</h3>
                <p>No project records are available.</p>
            </div>
        `;
        return;
    }

    data.forEach(project => {
        let badgeClass = "";

        if (project.status === "Ongoing") {
            badgeClass = "status-ongoing";
        } else if (project.status === "Completed") {
            badgeClass = "status-completed";
        } else {
            badgeClass = "status-planned";
        }

        projectList.innerHTML += `
            <div class="project-full-card">
                <span class="status-badge ${badgeClass}">
                    ${project.status || "Planned"}
                </span>

                <h3>${project.title}</h3>
                <p>${project.category || "General"}</p>

                <button class="view-details-btn" onclick="viewProjectDetails(${project.id})">
                    View Details
                </button>
            </div>
        `;
    });
}

function viewProjectDetails(projectId) {
    const project = projectData.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.getElementById("projectDetailsModal");
    if (!modal) return;

    document.getElementById("projectDetailsTitle").textContent = project.title || "Untitled Project";
    document.getElementById("projectDetailsStatus").textContent = project.status || "Planned";
    document.getElementById("projectDetailsCategory").textContent = project.category || "General";
    document.getElementById("projectDetailsDescription").textContent = project.description || "No description provided.";
    document.getElementById("projectDetailsBudget").textContent = formatPeso(project.budget);
    document.getElementById("projectDetailsLocation").textContent = project.location || "Not specified";
    document.getElementById("projectDetailsContractor").textContent = project.contractor || "Not specified";
    document.getElementById("projectDetailsBidder").textContent = project.bidder || "Not specified";
    document.getElementById("projectDetailsTimeline").textContent = project.timeline || "Not specified";
    document.getElementById("projectDetailsProgress").textContent = project.progress || 0;

    const progressBar = document.getElementById("projectDetailsProgressBar");
    if (progressBar) {
        progressBar.style.width = (project.progress || 0) + "%";
    }

    // Set status color
    const statusEl = document.getElementById("projectDetailsStatus");
    statusEl.className = "status-badge " + (project.status === "Ongoing" ? "status-ongoing" : project.status === "Completed" ? "status-completed" : "status-planned");

    modal.classList.add("active");
}

function closeProjectDetailsModal() {
    const modal = document.getElementById("projectDetailsModal");
    if (modal) {
        modal.classList.remove("active");
    }
}

// Close modal when clicking outside
document.addEventListener("click", function(e) {
    const modal = document.getElementById("projectDetailsModal");
    if (modal && e.target === modal) {
        modal.classList.remove("active");
    }
});

function searchProjects() {
    const searchInput = document.getElementById("projectSearch");

    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase();

    const filtered = projectData.filter(project =>
        String(project.title || "").toLowerCase().includes(keyword) ||
        String(project.category || "").toLowerCase().includes(keyword) ||
        String(project.location || "").toLowerCase().includes(keyword) ||
        String(project.contractor || "").toLowerCase().includes(keyword) ||
        String(project.bidder || "").toLowerCase().includes(keyword)
    );

    loadProjectCards(filtered);
    updateProjectStats(filtered);
}

function filterProjects() {
    const filter = document.getElementById("projectFilter");

    if (!filter) return;

    let filtered = projectData;

    if (filter.value !== "All") {
        filtered = projectData.filter(project =>
            project.status === filter.value
        );
    }

    loadProjectCards(filtered);
    updateProjectStats(filtered);
}

function updateProjectStats(data) {
    const total = data.length;
    const ongoing = data.filter(project => project.status === "Ongoing").length;
    const completed = data.filter(project => project.status === "Completed").length;
    const planned = data.filter(project => project.status === "Planned").length;

    const totalBox = document.getElementById("totalProjectsCount");
    const ongoingBox = document.getElementById("ongoingProjectsCount");
    const completedBox = document.getElementById("completedProjectsCount");
    const plannedBox = document.getElementById("plannedProjectsCount");

    if (totalBox) totalBox.textContent = total;
    if (ongoingBox) ongoingBox.textContent = ongoing;
    if (completedBox) completedBox.textContent = completed;
    if (plannedBox) plannedBox.textContent = planned;
}

function formatPeso(amount) {
    return "₱" + Number(amount || 0).toLocaleString("en-PH");
}

loadProjectsFromSupabase();