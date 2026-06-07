// admin-documents.js - browser-compatible

let adminDocuments = [];

document.addEventListener("DOMContentLoaded", () => {
    console.log("admin-documents.js loaded");

    const form = document.getElementById("addDocumentForm");

    if (form) {
        form.addEventListener("submit", saveDocument);
    }

    loadDocuments();
});

// Load all documents
async function loadDocuments() {
    const container = document.getElementById("documentsContainer");

    if (!container) {
        console.error("documentsContainer not found");
        return;
    }

    const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    console.log("Documents data:", data);
    console.log("Documents error:", error);

    if (error) {
        container.innerHTML = `<p style="color:red;">Failed to load documents: ${error.message}</p>`;
        return;
    }

    adminDocuments = data || [];
    updateDocumentSummary(adminDocuments);
    renderDocuments(adminDocuments);
}

function renderDocuments(documents) {
    const container = document.getElementById("documentsContainer");

    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="public-panel">
                <p>No documents found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    documents.forEach(doc => {
        const div = document.createElement("div");
        div.classList.add("document-card");

        div.innerHTML = `
            <div class="doc-icon">📄</div>

            <div>
                <h3>${doc.title || "Untitled Document"}</h3>
                <p><b>Category:</b> ${doc.category || "Other"}</p>
                <p>${doc.description || "No description provided."}</p>
                <p><small>Uploaded: ${formatDate(doc.created_at)}</small></p>
                <p>
                    <a href="${doc.file_url || "#"}" target="_blank">
                        View File
                    </a>
                </p>
            </div>

            <div class="admin-card-actions">
                <button onclick="viewDocument('${doc.file_url || ""}')">View</button>
                <button onclick="editDocument(${doc.id})">Edit</button>
                <button onclick="deleteDocument(${doc.id})" class="danger-btn">Delete</button>
            </div>
        `;

        container.appendChild(div);
    });
}

// Save / update document
async function saveDocument(e) {
    e.preventDefault();

    const id = document.getElementById("docId").value;
    const title = document.getElementById("docTitle").value.trim();
    const category = document.getElementById("docCategory").value;
    const description = document.getElementById("docDescription").value.trim();
    const file_url = document.getElementById("docFile").value.trim();

    if (!title || !category || !file_url) {
        alert("Please fill in Title, Category, and File URL.");
        return;
    }

    const payload = {
        title,
        category,
        description,
        file_url
    };

    let result;

    if (id) {
        result = await supabaseClient
            .from("documents")
            .update(payload)
            .eq("id", id);
    } else {
        result = await supabaseClient
            .from("documents")
            .insert([payload]);
    }

    if (result.error) {
        alert(result.error.message);
        console.error(result.error);
        return;
    }

    await logAudit(
        id ? "Updated document" : "Added document",
        `${id ? "Updated" : "Added"} document: ${title}`
    );

    alert(id ? "Document updated successfully." : "Document added successfully.");

    clearDocumentForm();
    loadDocuments();
}

// Edit document
function editDocument(id) {
    const doc = adminDocuments.find(d => d.id === id);

    if (!doc) {
        alert("Document not found.");
        return;
    }

    document.getElementById("docId").value = doc.id;
    document.getElementById("docTitle").value = doc.title || "";
    document.getElementById("docCategory").value = doc.category || "Other";
    document.getElementById("docDescription").value = doc.description || "";
    document.getElementById("docFile").value = doc.file_url || "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// Delete document
async function deleteDocument(id) {
    if (!confirm("Are you sure you want to delete this document?")) {
        return;
    }

    const doc = adminDocuments.find(d => d.id === id);

    const { error } = await supabaseClient
        .from("documents")
        .delete()
        .eq("id", id);

    if (error) {
        alert(error.message);
        console.error(error);
        return;
    }

    await logAudit(
        "Deleted document",
        `Deleted document: ${doc ? doc.title : "Document ID " + id}`
    );

    alert("Document deleted successfully.");
    loadDocuments();
}

// View document
function viewDocument(fileUrl) {
    if (!fileUrl) {
        alert("No file URL available.");
        return;
    }

    window.open(fileUrl, "_blank");
}

// Clear form
function clearDocumentForm() {
    document.getElementById("docId").value = "";
    document.getElementById("docTitle").value = "";
    document.getElementById("docCategory").value = "Financial Report";
    document.getElementById("docDescription").value = "";
    document.getElementById("docFile").value = "";
}

// Search documents
function searchAdminDocuments() {
    const searchValue = document.getElementById("adminDocumentSearch").value.toLowerCase();

    const filtered = adminDocuments.filter(doc =>
        (doc.title || "").toLowerCase().includes(searchValue) ||
        (doc.category || "").toLowerCase().includes(searchValue) ||
        (doc.description || "").toLowerCase().includes(searchValue)
    );

    renderDocuments(filtered);
}

// Filter documents
function filterAdminDocuments() {
    const filterValue = document.getElementById("adminDocumentFilter").value;

    if (filterValue === "All") {
        renderDocuments(adminDocuments);
        return;
    }

    const filtered = adminDocuments.filter(doc => doc.category === filterValue);
    renderDocuments(filtered);
}

// Update summary
function updateDocumentSummary(documents) {
    document.getElementById("totalDocuments").textContent = documents.length;

    document.getElementById("financialReports").textContent =
        documents.filter(doc => doc.category === "Financial Report").length;

    document.getElementById("receiptDocuments").textContent =
        documents.filter(doc => doc.category === "Receipt").length;

    document.getElementById("projectDocuments").textContent =
        documents.filter(doc => doc.category === "Project Document").length;
}

// Format date
function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// Audit logging
async function logAudit(action, details) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient
        .from("audit_logs")
        .insert([
            {
                user_id: user ? user.id : null,
                action,
                details

            }
        ]);

    if (error) {
        console.warn("Audit log failed:", error.message);
    }
}