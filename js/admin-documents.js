// js/admin-documents.js

let adminDocuments = [];
let adminOCRRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("addDocumentForm");
    if (form) form.addEventListener("submit", saveDocument);

    loadDocumentsAndOCR();
});

async function loadDocumentsAndOCR() {
    await loadDocuments();
    await loadOCRRecords();
    renderAllRecords();
}

async function loadDocuments() {
    const { data, error } = await supabaseClient
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Documents load error:", error.message);
        adminDocuments = [];
        return;
    }

    adminDocuments = data || [];
}

async function loadOCRRecords() {
    const { data, error } = await supabaseClient
        .from("ocr_records")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("OCR load error:", error.message);
        adminOCRRecords = [];
        return;
    }

    adminOCRRecords = data || [];
}

function renderAllRecords() {
    const container = document.getElementById("documentsContainer");
    if (!container) return;

    const search = document.getElementById("adminDocumentSearch")?.value.toLowerCase() || "";
    const filter = document.getElementById("adminDocumentFilter")?.value || "All";

    let records = [];

    adminDocuments.forEach(doc => {
        records.push({
            type: "Document",
            id: doc.id,
            title: doc.title || "Untitled Document",
            category: doc.category || "Other",
            description: doc.description || "",
            file_url: doc.file_url || "",
            created_at: doc.created_at
        });
    });

    adminOCRRecords.forEach(ocr => {
        records.push({
            type: "OCR",
            id: ocr.id,
            title: ocr.file_name || "OCR Record",
            category: "OCR Record",
            status: ocr.status || "Pending",
            description: ocr.message || "",
            vendor: ocr.detected_vendor || "Unknown Vendor",
            amount: ocr.detected_amount,
            confidence: ocr.confidence,
            file_url: ocr.file_url || "",
            ocr_pdf_url: ocr.ocr_pdf_url || "",
            corrected_pdf_url: ocr.corrected_pdf_url || "",
            created_at: ocr.created_at
        });
    });

    records = records.filter(item => {
        const matchesSearch =
            item.title.toLowerCase().includes(search) ||
            item.category.toLowerCase().includes(search) ||
            item.description.toLowerCase().includes(search);

        const matchesFilter =
            filter === "All" ||
            item.category === filter ||
            (filter === "Receipt" && item.type === "OCR");

        return matchesSearch && matchesFilter;
    });

    updateDocumentSummary();

    if (records.length === 0) {
        container.innerHTML = `
            <div class="public-panel">
                <p>No document or OCR records found.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(item => {
        if (item.type === "OCR") {
            return `
                <div class="document-card">
                    <div class="doc-icon">🔍</div>

                    <div>
                        <h3>${escapeHTML(item.title)}</h3>
                        <p><b>Type:</b> OCR Record</p>
                        <p><b>Status:</b> ${escapeHTML(item.status)}</p>
                        <p><b>Vendor:</b> ${escapeHTML(item.vendor)}</p>
                        <p><b>Amount:</b> ${item.amount ? formatPeso(item.amount) : "Not detected"}</p>
                        <p><b>Confidence:</b> ${Number(item.confidence || 0).toFixed(2)}%</p>
                        <p><small>Uploaded: ${formatDate(item.created_at)}</small></p>

                        <div class="admin-file-links">
                            ${item.file_url ? `<a href="${escapeHTML(item.file_url)}" target="_blank">View Original File</a>` : ""}
                            ${item.ocr_pdf_url ? `<a href="${escapeHTML(item.ocr_pdf_url)}" target="_blank">Download OCR PDF</a>` : ""}
                            ${item.corrected_pdf_url ? `<a href="${escapeHTML(item.corrected_pdf_url)}" target="_blank">Download Corrected PDF</a>` : ""}
                        </div>
                    </div>

                    <div class="admin-card-actions">
                        <button onclick="openOCRReviewModal(${item.id})">Review / Edit</button>
                        <button onclick="quickMarkOCR(${item.id}, 'Validated Expense')">Mark Valid</button>
                        <button onclick="quickMarkOCR(${item.id}, 'Flagged for Review')" class="danger-btn">Flag</button>
                        <button onclick="deleteOCRRecord(${item.id})" class="danger-btn">Delete OCR</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="document-card">
                <div class="doc-icon">📄</div>

                <div>
                    <h3>${escapeHTML(item.title)}</h3>
                    <p><b>Category:</b> ${escapeHTML(item.category)}</p>
                    <p>${escapeHTML(item.description || "No description provided.")}</p>
                    <p><small>Uploaded: ${formatDate(item.created_at)}</small></p>
                    <p><a href="${escapeHTML(item.file_url || "#")}" target="_blank">View File</a></p>
                </div>

                <div class="admin-card-actions">
                    <button onclick="viewDocument('${escapeHTML(item.file_url || "")}')">View</button>
                    <button onclick="editDocument(${item.id})">Edit</button>
                    <button onclick="deleteDocument(${item.id})" class="danger-btn">Delete</button>
                </div>
            </div>
        `;
    }).join("");
}

/* DOCUMENT CRUD */

async function saveDocument(e) {
    e.preventDefault();

    const id = document.getElementById("docId").value;
    const title = document.getElementById("docTitle").value.trim();
    const category = document.getElementById("docCategory").value;
    const description = document.getElementById("docDescription").value.trim();
    const fileInput = document.getElementById("docFile");
    const existingUrl = document.getElementById("existingDocFileUrl")?.value || "";

    if (!title || !category) {
        alert("Please fill in Title and Category.");
        return;
    }

    let file_url = existingUrl;

    if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        const safeFileName = file.name.replaceAll(" ", "_");
        const filePath = `documents/${Date.now()}_${safeFileName}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from("documents")
            .upload(filePath, file);

        if (uploadError) {
            alert("File upload failed: " + uploadError.message);
            return;
        }

        const { data: urlData } = supabaseClient
            .storage
            .from("documents")
            .getPublicUrl(filePath);

        file_url = urlData.publicUrl;
    }

    if (!file_url) {
        alert("Please upload a document file.");
        return;
    }

    const payload = {
        title,
        category,
        description,
        file_url
    };

    const result = id
        ? await supabaseClient.from("documents").update(payload).eq("id", Number(id))
        : await supabaseClient.from("documents").insert([payload]);

    if (result.error) {
        alert(result.error.message);
        return;
    }

    await logAudit(
        id ? "Updated document" : "Added document",
        "Documents",
        `${id ? "Updated" : "Added"} document: ${title}`,
        true
    );

    alert(id ? "Document updated successfully." : "Document added successfully.");
    clearDocumentForm();
    loadDocumentsAndOCR();
}

function editDocument(id) {
    const doc = adminDocuments.find(d => Number(d.id) === Number(id));
    if (!doc) return alert("Document not found.");

    document.getElementById("docId").value = doc.id;
    document.getElementById("docTitle").value = doc.title || "";
    document.getElementById("docCategory").value = doc.category || "Other";
    document.getElementById("docDescription").value = doc.description || "";

    if (document.getElementById("existingDocFileUrl")) {
        document.getElementById("existingDocFileUrl").value = doc.file_url || "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteDocument(id) {
    if (!confirm("Delete this document?")) return;

    const doc = adminDocuments.find(d => Number(d.id) === Number(id));

    const { error } = await supabaseClient
        .from("documents")
        .delete()
        .eq("id", Number(id));

    if (error) {
        alert("Document delete failed: " + error.message);
        return;
    }

    await logAudit(
        "Deleted document",
        "Documents",
        `Deleted document: ${doc ? doc.title : "Document ID " + id}`,
        true
    );

    alert("Document deleted successfully.");
    loadDocumentsAndOCR();
}

/* OCR REVIEW */

function openOCRReviewModal(id) {
    const record = adminOCRRecords.find(r => Number(r.id) === Number(id));
    if (!record) return alert("OCR record not found.");

    document.getElementById("ocrReviewId").value = record.id;
    document.getElementById("ocrReviewFileName").textContent = record.file_name || "Unknown";
    document.getElementById("ocrReviewVendor").textContent = record.detected_vendor || "Unknown Vendor";
    document.getElementById("ocrReviewAmount").textContent = record.detected_amount ? formatPeso(record.detected_amount) : "Not detected";
    document.getElementById("ocrReviewConfidence").textContent = Number(record.confidence || 0).toFixed(2) + "%";
    document.getElementById("ocrCorrectedText").value = record.corrected_text || record.extracted_text || "";
    document.getElementById("ocrReviewStatus").value = record.status || "Needs Admin Review";

    document.getElementById("ocrReviewModal").classList.add("active");
}

function closeOCRReviewModal() {
    document.getElementById("ocrReviewModal").classList.remove("active");
}

async function saveOCRReview() {
    const id = Number(document.getElementById("ocrReviewId").value);
    const correctedText = document.getElementById("ocrCorrectedText").value.trim();
    const status = document.getElementById("ocrReviewStatus").value;

    const { data: { user } } = await supabaseClient.auth.getUser();

    let correctedPdfUrl = "";

    if (correctedText) {
        const record = adminOCRRecords.find(r => Number(r.id) === Number(id));

        const pdfFile = createOCRPDF({
            title: "Corrected OCR Text Report",
            fileName: record ? record.file_name : `ocr_record_${id}`,
            vendor: record ? record.detected_vendor : "Unknown Vendor",
            amount: record ? record.detected_amount : null,
            confidence: record ? record.confidence : 0,
            status,
            text: correctedText
        });

        const pdfUpload = await uploadFileToStorage(pdfFile, "corrected_pdfs");
        correctedPdfUrl = pdfUpload.publicUrl;
    }

    const message = status === "Validated Expense"
        ? "OCR record was manually validated by the administrator."
        : status === "Flagged for Review"
            ? "OCR record was flagged by the administrator for further review."
            : "OCR record needs admin review.";

    const { data, error } = await supabaseClient
        .from("ocr_records")
        .update({
            corrected_text: correctedText,
            corrected_pdf_url: correctedPdfUrl,
            status,
            message,
            reviewed_by: user ? user.id : null,
            reviewed_at: new Date().toISOString()
        })
        .eq("id", id)
        .select();

    if (error) {
        alert("OCR review failed: " + error.message);
        return;
    }

    if (!data || data.length === 0) {
        alert("No OCR record updated. Check your RLS update policy.");
        return;
    }

    await logAudit(
        "Reviewed OCR record",
        "Documents/OCR",
        `${status}: OCR Record ID ${id}`,
        true
    );

    alert("OCR review saved.");
    closeOCRReviewModal();
    loadDocumentsAndOCR();
}

async function quickMarkOCR(id, status) {
    const record = adminOCRRecords.find(r => Number(r.id) === Number(id));

    const message = status === "Validated Expense"
        ? "OCR record was manually validated by the administrator."
        : "OCR record was flagged by the administrator for further review.";

    const { error } = await supabaseClient
        .from("ocr_records")
        .update({
            status,
            message,
            reviewed_at: new Date().toISOString()
        })
        .eq("id", Number(id));

    if (error) {
        alert("OCR update failed: " + error.message);
        return;
    }

    await logAudit(
        status === "Validated Expense" ? "Validated OCR record" : "Flagged OCR record",
        "Documents/OCR",
        `${status}: ${record ? record.file_name : "OCR Record"}`,
        true
    );

    alert("OCR status updated.");
    loadDocumentsAndOCR();
}

async function deleteOCRRecord(id) {
    if (!confirm("Delete this OCR record? This cannot be undone.")) return;

    const record = adminOCRRecords.find(r => Number(r.id) === Number(id));

    const { error } = await supabaseClient
        .from("ocr_records")
        .delete()
        .eq("id", Number(id));

    if (error) {
        alert("OCR delete failed: " + error.message);
        return;
    }

    await logAudit(
        "Deleted OCR record",
        "Documents/OCR",
        `Deleted OCR record: ${record ? record.file_name : "OCR Record ID " + id}`,
        true
    );

    alert("OCR record deleted successfully.");
    loadDocumentsAndOCR();
}

/* FILE + PDF HELPERS */

async function uploadFileToStorage(file, folder) {
    const safeFileName = file.name.replaceAll(" ", "_");
    const filePath = `${folder}/${Date.now()}_${safeFileName}`;

    const { error } = await supabaseClient
        .storage
        .from("documents")
        .upload(filePath, file);

    if (error) throw new Error(error.message);

    const { data } = supabaseClient
        .storage
        .from("documents")
        .getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: data.publicUrl
    };
}

function createOCRPDF(info) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(info.title || "OCR Text Report", 15, 20);

    doc.setFontSize(10);
    doc.text(`File: ${info.fileName || "Unknown"}`, 15, 32);
    doc.text(`Detected Vendor: ${info.vendor || "N/A"}`, 15, 39);
    doc.text(`Detected Amount: ${info.amount ? formatPeso(info.amount) : "Not detected"}`, 15, 46);
    doc.text(`OCR Confidence: ${Number(info.confidence || 0).toFixed(2)}%`, 15, 53);
    doc.text(`Status: ${info.status || "Pending"}`, 15, 60);

    doc.setFontSize(12);
    doc.text("Text:", 15, 75);

    const lines = doc.splitTextToSize(info.text || "No text available.", 180);
    doc.setFontSize(10);

    let y = 85;
    lines.forEach(line => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        doc.text(line, 15, y);
        y += 6;
    });

    const fileName = `${Date.now()}_OCR_Report.pdf`;
    const blob = doc.output("blob");

    return new File([blob], fileName, { type: "application/pdf" });
}

/* HELPERS */

function viewDocument(fileUrl) {
    if (!fileUrl) return alert("No file available.");
    window.open(fileUrl, "_blank");
}

function clearDocumentForm() {
    document.getElementById("docId").value = "";
    document.getElementById("docTitle").value = "";
    document.getElementById("docCategory").value = "Financial Report";
    document.getElementById("docDescription").value = "";

    if (document.getElementById("docFile")) {
        document.getElementById("docFile").value = "";
    }

    if (document.getElementById("existingDocFileUrl")) {
        document.getElementById("existingDocFileUrl").value = "";
    }
}

function searchAdminDocuments() {
    renderAllRecords();
}

function filterAdminDocuments() {
    renderAllRecords();
}

function updateDocumentSummary() {
    document.getElementById("totalDocuments").textContent =
        adminDocuments.length + adminOCRRecords.length;

    document.getElementById("financialReports").textContent =
        adminDocuments.filter(doc => doc.category === "Financial Report").length;

    document.getElementById("receiptDocuments").textContent =
        adminDocuments.filter(doc => doc.category === "Receipt").length + adminOCRRecords.length;

    document.getElementById("projectDocuments").textContent =
        adminDocuments.filter(doc => doc.category === "Project Document").length;
}

function formatDate(dateValue) {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
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