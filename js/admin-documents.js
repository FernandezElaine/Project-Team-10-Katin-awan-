// js/admin-documents.js

let adminDocuments = [];
let adminOCRRecords = [];
let currentOCRReviewRecord = null;

const PUBLIC_DOCUMENT_BUCKET = "documents";
const PRIVATE_OCR_BUCKET = "ocr-files";

const MAX_PUBLIC_DOCUMENT_SIZE =
    10 * 1024 * 1024;

const MAX_CORRECTED_PDF_SIZE =
    5 * 1024 * 1024;

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        const form =
            document.getElementById(
                "addDocumentForm"
            );

        const correctedPdfInput =
            document.getElementById(
                "ocrCorrectedPdfFile"
            );

        if (form) {
            form.addEventListener(
                "submit",
                saveDocument
            );
        }

        if (correctedPdfInput) {
            correctedPdfInput.addEventListener(
                "change",
                handleCorrectedPdfSelection
            );
        }

        await loadDocumentsAndOCR();
    }
);

/* =====================================
   LOAD RECORDS
===================================== */

async function loadDocumentsAndOCR() {
    const [
        documentsResult,
        ocrResult
    ] = await Promise.all([
        supabaseClient
            .from("documents")
            .select("*")
            .order("created_at", {
                ascending: false
            }),

        supabaseClient
            .from("ocr_records")
            .select("*")
            .order("created_at", {
                ascending: false
            })
    ]);

    if (documentsResult.error) {
        console.error(
            "Documents load error:",
            documentsResult.error
        );

        adminDocuments = [];
    } else {
        adminDocuments =
            documentsResult.data || [];
    }

    if (ocrResult.error) {
        console.error(
            "OCR records load error:",
            ocrResult.error
        );

        adminOCRRecords = [];
    } else {
        adminOCRRecords =
            ocrResult.data || [];
    }

    renderAllRecords();
}

/* =====================================
   RENDER DOCUMENTS AND OCR
===================================== */

function renderAllRecords() {
    const container =
        document.getElementById(
            "documentsContainer"
        );

    if (!container) {
        return;
    }

    const search =
        document.getElementById(
            "adminDocumentSearch"
        )?.value
            .trim()
            .toLowerCase() || "";

    const filter =
        document.getElementById(
            "adminDocumentFilter"
        )?.value || "All";

    const records = [];

    adminDocuments.forEach(
        function (documentRecord) {
            records.push({
                type: "Document",
                id: documentRecord.id,
                title:
                    documentRecord.title ||
                    "Untitled Document",
                category:
                    documentRecord.category ||
                    "Other",
                description:
                    documentRecord.description ||
                    "",
                fileUrl:
                    documentRecord.file_url ||
                    "",
                createdAt:
                    documentRecord.created_at
            });
        }
    );

    adminOCRRecords.forEach(
        function (ocrRecord) {
            records.push({
                type: "OCR",
                id: ocrRecord.id,
                title:
                    ocrRecord.file_name ||
                    "OCR Record",
                category: "OCR Record",
                description:
                    ocrRecord.review_notes ||
                    ocrRecord.message ||
                    "",
                status:
                    ocrRecord.review_status ||
                    ocrRecord.status ||
                    "Pending",
                vendor:
                    ocrRecord.detected_vendor ||
                    "Unknown Vendor",
                amount:
                    ocrRecord.detected_amount,
                confidence:
                    ocrRecord.confidence,
                createdAt:
                    ocrRecord.created_at,
                source: ocrRecord
            });
        }
    );

    const filteredRecords =
        records.filter(
            function (record) {
                const searchableText = [
                    record.title,
                    record.category,
                    record.description,
                    record.status,
                    record.vendor
                ]
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );

                const matchesFilter =
                    filter === "All" ||
                    record.category === filter ||
                    (
                        filter === "Receipt" &&
                        record.type === "OCR"
                    );

                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );

    updateDocumentSummary();

    if (filteredRecords.length === 0) {
        container.innerHTML = `
            <div
                class="public-panel"
                style="grid-column: 1 / -1;"
            >
                <p>
                    No document or OCR records found.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        filteredRecords
            .map(function (record) {
                return record.type === "OCR"
                    ? createOCRCard(record)
                    : createDocumentCard(record);
            })
            .join("");
}

function createDocumentCard(record) {
    const hasFile =
        Boolean(record.fileUrl);

    return `
        <article class="document-card">
            <div class="doc-icon">
                📄
            </div>

            <div>
                <h3>
                    ${escapeHTML(record.title)}
                </h3>

                <p>
                    <b>Category:</b>
                    ${escapeHTML(record.category)}
                </p>

                <p>
                    ${escapeHTML(
                        record.description ||
                        "No description provided."
                    )}
                </p>

                <p>
                    <small>
                        Uploaded:
                        ${formatDate(record.createdAt)}
                    </small>
                </p>
            </div>

            <div class="admin-card-actions">
                <button
                    type="button"
                    onclick="viewDocumentById(${Number(record.id)})"
                    ${hasFile ? "" : "disabled"}
                >
                    ${hasFile ? "View File" : "No File"}
                </button>

                <button
                    type="button"
                    onclick="editDocument(${Number(record.id)})"
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="deleteDocument(${Number(record.id)})"
                    class="danger-btn"
                >
                    Delete
                </button>
            </div>
        </article>
    `;
}

function createOCRCard(record) {
    const source =
        record.source;

    const hasOriginal =
        hasOCRFile(source, "original");

    const hasOCRReport =
        hasOCRFile(source, "ocr");

    const hasCorrected =
        hasOCRFile(source, "corrected");

    return `
        <article class="document-card">
            <div class="doc-icon">
                🔍
            </div>

            <div>
                <h3>
                    ${escapeHTML(record.title)}
                </h3>

                <p>
                    <b>Type:</b>
                    OCR Record
                </p>

                <p>
                    <b>Status:</b>

                    <span class="${getOCRStatusClass(
                        record.status
                    )}">
                        ${escapeHTML(record.status)}
                    </span>
                </p>

                <p>
                    <b>Vendor:</b>
                    ${escapeHTML(record.vendor)}
                </p>

                <p>
                    <b>Amount:</b>
                    ${
                        record.amount !== null &&
                        record.amount !== ""
                            ? formatPeso(record.amount)
                            : "Not detected"
                    }
                </p>

                <p>
                    <b>Confidence:</b>
                    ${Number(
                        record.confidence || 0
                    ).toFixed(2)}%
                </p>

                <p>
                    <small>
                        Uploaded:
                        ${formatDate(record.createdAt)}
                    </small>
                </p>

                <div class="admin-file-links">
                    <span>
                        Original:
                        ${hasOriginal
                            ? "Available"
                            : "Not available"}
                    </span>

                    <span>
                        OCR PDF:
                        ${hasOCRReport
                            ? "Available"
                            : "Not available"}
                    </span>

                    <span>
                        Corrected PDF:
                        ${hasCorrected
                            ? "Available"
                            : "Not available"}
                    </span>
                </div>
            </div>

            <div class="admin-card-actions">
                <button
                    type="button"
                    onclick="openOCRReviewModal(${Number(record.id)})"
                >
                    Review / Edit
                </button>

                <button
                    type="button"
                    onclick="quickMarkOCR(
                        ${Number(record.id)},
                        'Validated Expense'
                    )"
                >
                    Mark Valid
                </button>

                <button
                    type="button"
                    onclick="quickMarkOCR(
                        ${Number(record.id)},
                        'Flagged for Review'
                    )"
                    class="danger-btn"
                >
                    Flag
                </button>

                <button
                    type="button"
                    onclick="deleteOCRRecord(${Number(record.id)})"
                    class="danger-btn"
                >
                    Delete OCR
                </button>
            </div>
        </article>
    `;
}

/* =====================================
   PUBLIC DOCUMENT CRUD
===================================== */

async function saveDocument(event) {
    event.preventDefault();

    const idValue =
        document.getElementById(
            "docId"
        ).value;

    const documentId =
        idValue
            ? Number(idValue)
            : null;

    const title =
        document.getElementById(
            "docTitle"
        ).value.trim();

    const category =
        document.getElementById(
            "docCategory"
        ).value;

    const description =
        document.getElementById(
            "docDescription"
        ).value.trim();

    const fileInput =
        document.getElementById(
            "docFile"
        );

    const selectedFile =
        fileInput?.files?.[0] || null;

    const existingUrl =
        document.getElementById(
            "existingDocFileUrl"
        )?.value || "";

    if (!title || !category) {
        alert(
            "Please enter the document title and category."
        );

        return;
    }

    if (
        !selectedFile &&
        !existingUrl
    ) {
        alert(
            "Please upload a document file."
        );

        return;
    }

    if (selectedFile) {
        const validationError =
            validatePublicDocumentFile(
                selectedFile
            );

        if (validationError) {
            alert(validationError);
            return;
        }
    }

    let newFileUrl =
        existingUrl;

    let newFilePath =
        null;

    const oldFilePath =
        extractStoragePathFromPublicUrl(
            existingUrl,
            PUBLIC_DOCUMENT_BUCKET
        );

    try {
        if (selectedFile) {
            const upload =
                await uploadPublicDocument(
                    selectedFile
                );

            newFileUrl =
                upload.publicUrl;

            newFilePath =
                upload.path;
        }

        const payload = {
            title,
            category,
            description,
            file_url: newFileUrl
        };

        const result =
            documentId
                ? await supabaseClient
                    .from("documents")
                    .update(payload)
                    .eq("id", documentId)
                : await supabaseClient
                    .from("documents")
                    .insert([payload]);

        if (result.error) {
            throw result.error;
        }

        if (
            selectedFile &&
            oldFilePath &&
            oldFilePath !== newFilePath
        ) {
            await removeStorageFiles(
                PUBLIC_DOCUMENT_BUCKET,
                [oldFilePath]
            );
        }

        await logAudit(
            documentId
                ? "Updated document"
                : "Added document",
            "Documents",
            `${documentId ? "Updated" : "Added"} document: ${title}`,
            true
        );

        alert(
            documentId
                ? "Document updated successfully."
                : "Document added successfully."
        );

        clearDocumentForm();

        await loadDocumentsAndOCR();
    } catch (error) {
        console.error(
            "Document save error:",
            error
        );

        if (newFilePath) {
            await removeStorageFiles(
                PUBLIC_DOCUMENT_BUCKET,
                [newFilePath]
            );
        }

        alert(
            "Document could not be saved: " +
            error.message
        );
    }
}

async function uploadPublicDocument(file) {
    const safeFileName =
        createSafeFileName(file.name);

    const filePath =
        `public-documents/` +
        `${Date.now()}-${safeFileName}`;

    const { error } =
        await supabaseClient.storage
            .from(PUBLIC_DOCUMENT_BUCKET)
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                }
            );

    if (error) {
        throw new Error(
            "File upload failed: " +
            error.message
        );
    }

    const { data } =
        supabaseClient.storage
            .from(PUBLIC_DOCUMENT_BUCKET)
            .getPublicUrl(filePath);

    if (!data?.publicUrl) {
        throw new Error(
            "The public document URL could not be generated."
        );
    }

    return {
        path: filePath,
        publicUrl: data.publicUrl
    };
}

function editDocument(id) {
    const documentRecord =
        adminDocuments.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (!documentRecord) {
        alert("Document not found.");
        return;
    }

    document.getElementById(
        "docId"
    ).value =
        documentRecord.id;

    document.getElementById(
        "docTitle"
    ).value =
        documentRecord.title || "";

    document.getElementById(
        "docCategory"
    ).value =
        documentRecord.category || "Other";

    document.getElementById(
        "docDescription"
    ).value =
        documentRecord.description || "";

    document.getElementById(
        "existingDocFileUrl"
    ).value =
        documentRecord.file_url || "";

    document.getElementById(
        "docFile"
    ).value = "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function deleteDocument(id) {
    const documentRecord =
        adminDocuments.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    const confirmed =
        confirm(
            `Delete "${
                documentRecord?.title ||
                "this document"
            }"?`
        );

    if (!confirmed) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("documents")
            .delete()
            .eq("id", Number(id));

    if (error) {
        alert(
            "Document deletion failed: " +
            error.message
        );

        return;
    }

    const filePath =
        extractStoragePathFromPublicUrl(
            documentRecord?.file_url,
            PUBLIC_DOCUMENT_BUCKET
        );

    if (filePath) {
        await removeStorageFiles(
            PUBLIC_DOCUMENT_BUCKET,
            [filePath]
        );
    }

    await logAudit(
        "Deleted document",
        "Documents",
        `Deleted document: ${
            documentRecord?.title ||
            "Document ID " + id
        }`,
        true
    );

    alert(
        "Document deleted successfully."
    );

    await loadDocumentsAndOCR();
}

function viewDocumentById(id) {
    const documentRecord =
        adminDocuments.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (
        !documentRecord ||
        !documentRecord.file_url
    ) {
        alert(
            "No document file is available."
        );

        return;
    }

    openSafeURL(
        documentRecord.file_url
    );
}

function clearDocumentForm() {
    setInputValue("docId", "");
    setInputValue("docTitle", "");
    setInputValue(
        "docCategory",
        "Financial Report"
    );
    setInputValue(
        "docDescription",
        ""
    );
    setInputValue("docFile", "");
    setInputValue(
        "existingDocFileUrl",
        ""
    );
}

/* =====================================
   OCR REVIEW MODAL
===================================== */

function openOCRReviewModal(id) {
    const record =
        adminOCRRecords.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (!record) {
        alert(
            "OCR record not found."
        );

        return;
    }

    currentOCRReviewRecord =
        record;

    setInputValue(
        "ocrReviewId",
        record.id
    );

    setText(
        "ocrReviewFileName",
        record.file_name || "Unknown"
    );

    setText(
        "ocrReviewVendor",
        record.detected_vendor ||
        "Unknown Vendor"
    );

    setText(
        "ocrReviewAmount",
        record.detected_amount !== null &&
        record.detected_amount !== ""
            ? formatPeso(
                record.detected_amount
            )
            : "Not detected"
    );

    setText(
        "ocrReviewConfidence",
        `${Number(
            record.confidence || 0
        ).toFixed(2)}%`
    );

    setInputValue(
        "ocrCorrectedText",
        record.corrected_text ||
        record.extracted_text ||
        ""
    );

    setInputValue(
        "ocrReviewNotes",
        record.review_notes || ""
    );

    setInputValue(
        "ocrReviewStatus",
        record.review_status ||
        record.status ||
        "Needs Admin Review"
    );

    setInputValue(
        "ocrCorrectedPdfFile",
        ""
    );

    const correctedInfo =
        document.getElementById(
            "ocrCorrectedPdfInfo"
        );

    if (correctedInfo) {
        correctedInfo.textContent = "";
        correctedInfo.hidden = true;
    }

    updateOCRFileButtons(record);

    const modal =
        document.getElementById(
            "ocrReviewModal"
        );

    if (modal) {
        modal.classList.add(
            "active"
        );
    }
}

function closeOCRReviewModal() {
    const modal =
        document.getElementById(
            "ocrReviewModal"
        );

    if (modal) {
        modal.classList.remove(
            "active"
        );
    }

    currentOCRReviewRecord = null;
}

function updateOCRFileButtons(record) {
    setButtonAvailability(
        "ocrViewOriginalBtn",
        hasOCRFile(record, "original")
    );

    setButtonAvailability(
        "ocrDownloadOriginalBtn",
        hasOCRFile(record, "original")
    );

    setButtonAvailability(
        "ocrDownloadReportBtn",
        hasOCRFile(record, "ocr")
    );

    setButtonAvailability(
        "ocrDownloadCorrectedBtn",
        hasOCRFile(record, "corrected")
    );
}

function setButtonAvailability(
    buttonId,
    available
) {
    const button =
        document.getElementById(
            buttonId
        );

    if (button) {
        button.disabled =
            !available;

        button.title =
            available
                ? ""
                : "File not available";
    }
}

function handleCorrectedPdfSelection() {
    const input =
        document.getElementById(
            "ocrCorrectedPdfFile"
        );

    const info =
        document.getElementById(
            "ocrCorrectedPdfInfo"
        );

    const file =
        input?.files?.[0];

    if (!info) {
        return;
    }

    if (!file) {
        info.hidden = true;
        info.textContent = "";
        return;
    }

    const validationError =
        validateCorrectedPDF(file);

    if (validationError) {
        alert(validationError);

        input.value = "";
        info.hidden = true;
        info.textContent = "";

        return;
    }

    info.hidden = false;

    info.textContent =
        `Selected: ${file.name} ` +
        `(${formatFileSize(file.size)})`;
}

/* =====================================
   OCR VIEW AND DOWNLOAD
===================================== */

async function viewOCRFile(type) {
    if (!currentOCRReviewRecord) {
        alert(
            "No OCR record is currently selected."
        );

        return;
    }

    await openOrDownloadOCRFile(
        currentOCRReviewRecord,
        type,
        false
    );
}

async function downloadOCRFile(type) {
    if (!currentOCRReviewRecord) {
        alert(
            "No OCR record is currently selected."
        );

        return;
    }

    await openOrDownloadOCRFile(
        currentOCRReviewRecord,
        type,
        true
    );
}

async function openOrDownloadOCRFile(
    record,
    type,
    download
) {
    const reference =
        getOCRFileReference(
            record,
            type
        );

    if (
        !reference.path &&
        !reference.url
    ) {
        alert(
            "The requested file is not available."
        );

        return;
    }

    let pendingWindow = null;

    if (!download) {
        pendingWindow =
            window.open(
                "",
                "_blank"
            );
    }

    try {
        let fileUrl = "";

        if (reference.path) {
            const options =
                download
                    ? {
                        download:
                            reference.fileName
                    }
                    : {};

            const { data, error } =
                await supabaseClient.storage
                    .from(PRIVATE_OCR_BUCKET)
                    .createSignedUrl(
                        reference.path,
                        300,
                        options
                    );

            if (
                error ||
                !data?.signedUrl
            ) {
                throw new Error(
                    error?.message ||
                    "Signed URL could not be created."
                );
            }

            fileUrl =
                data.signedUrl;
        } else {
            fileUrl =
                validateExternalURL(
                    reference.url
                );
        }

        if (download) {
            const link =
                document.createElement(
                    "a"
                );

            link.href =
                fileUrl;

            link.download =
                reference.fileName;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();
        } else if (pendingWindow) {
            pendingWindow.location.href =
                fileUrl;
        }
    } catch (error) {
        if (pendingWindow) {
            pendingWindow.close();
        }

        console.error(
            "OCR file access error:",
            error
        );

        alert(
            "The file could not be opened: " +
            error.message
        );
    }
}

function getOCRFileReference(
    record,
    type
) {
    const baseName =
        makeBaseName(
            record.file_name ||
            "ocr-document"
        );

    if (type === "original") {
        return {
            path:
                record.original_file_path ||
                "",
            url:
                record.file_url ||
                "",
            fileName:
                record.file_name ||
                "original-document"
        };
    }

    if (type === "ocr") {
        return {
            path:
                record.ocr_pdf_path ||
                "",
            url:
                record.ocr_pdf_url ||
                "",
            fileName:
                `${baseName}-OCR-report.pdf`
        };
    }

    return {
        path:
            record.corrected_pdf_path ||
            "",
        url:
            record.corrected_pdf_url ||
            "",
        fileName:
            `${baseName}-corrected.pdf`
    };
}

function hasOCRFile(record, type) {
    const reference =
        getOCRFileReference(
            record,
            type
        );

    return Boolean(
        reference.path ||
        reference.url
    );
}

/* =====================================
   SAVE OCR REVIEW
===================================== */

async function saveOCRReview() {
    if (!currentOCRReviewRecord) {
        alert(
            "No OCR record is selected."
        );

        return;
    }

    const record =
        currentOCRReviewRecord;

    const correctedText =
        document.getElementById(
            "ocrCorrectedText"
        ).value.trim();

    const reviewStatus =
        document.getElementById(
            "ocrReviewStatus"
        ).value;

    const reviewNotes =
        document.getElementById(
            "ocrReviewNotes"
        ).value.trim();

    const correctedPdfInput =
        document.getElementById(
            "ocrCorrectedPdfFile"
        );

    const selectedPdf =
        correctedPdfInput
            ?.files?.[0] || null;

    if (selectedPdf) {
        const validationError =
            validateCorrectedPDF(
                selectedPdf
            );

        if (validationError) {
            alert(validationError);
            return;
        }
    }

    const {
        data: { user }
    } =
        await supabaseClient.auth
            .getUser();

    if (!user) {
        alert(
            "Your admin session has expired. Please log in again."
        );

        return;
    }

    const oldCorrectedPath =
        record.corrected_pdf_path ||
        null;

    let newCorrectedPath =
        null;

    try {
        let correctedPdfFile =
            selectedPdf;

        /*
         * When text was corrected but no manually edited
         * PDF was selected, generate a corrected PDF.
         */
        const correctedTextChanged =
            correctedText !==
            String(
                record.corrected_text ||
                record.extracted_text ||
                ""
            ).trim();

        if (
            !correctedPdfFile &&
            correctedText &&
            (
                correctedTextChanged ||
                !hasOCRFile(
                    record,
                    "corrected"
                )
            )
        ) {
            correctedPdfFile =
                createOCRPDF({
                    title:
                        "Corrected OCR Text Report",
                    fileName:
                        record.file_name ||
                        `ocr-record-${record.id}`,
                    vendor:
                        record.detected_vendor ||
                        "Unknown Vendor",
                    amount:
                        record.detected_amount,
                    confidence:
                        record.confidence,
                    status:
                        reviewStatus,
                    text:
                        correctedText
                });
        }

        const payload = {
            corrected_text:
                correctedText || null,
            review_status:
                reviewStatus,
            review_notes:
                reviewNotes || null,

            /*
             * Keep the old status fields compatible.
             */
            status:
                reviewStatus,
            message:
                buildOCRReviewMessage(
                    reviewStatus
                ),

            reviewed_by:
                user.id,
            reviewed_at:
                new Date().toISOString()
        };

        if (correctedPdfFile) {
            const upload =
                await uploadPrivateOCRFile(
                    correctedPdfFile,
                    record,
                    "corrected-reports"
                );

            newCorrectedPath =
                upload.path;

            payload.corrected_pdf_path =
                newCorrectedPath;

            /*
             * Stop using the legacy public URL.
             */
            payload.corrected_pdf_url =
                null;
        }

        const { error } =
            await supabaseClient
                .from("ocr_records")
                .update(payload)
                .eq(
                    "id",
                    Number(record.id)
                );

        if (error) {
            throw error;
        }

        if (
            newCorrectedPath &&
            oldCorrectedPath &&
            newCorrectedPath !==
                oldCorrectedPath
        ) {
            await removeStorageFiles(
                PRIVATE_OCR_BUCKET,
                [oldCorrectedPath]
            );
        }

        await logAudit(
            "Reviewed OCR record",
            "Documents/OCR",
            `${reviewStatus}: ${
                record.file_name ||
                "OCR Record ID " +
                record.id
            }`,
            true
        );

        alert(
            "OCR review saved successfully."
        );

        closeOCRReviewModal();

        await loadDocumentsAndOCR();
    } catch (error) {
        console.error(
            "OCR review save error:",
            error
        );

        if (newCorrectedPath) {
            await removeStorageFiles(
                PRIVATE_OCR_BUCKET,
                [newCorrectedPath]
            );
        }

        alert(
            "OCR review could not be saved: " +
            error.message
        );
    }
}

async function uploadPrivateOCRFile(
    file,
    record,
    folder
) {
    const ownerFolder =
        record.user_id ||
        "unassigned";

    const safeFileName =
        createSafeFileName(
            file.name
        );

    const filePath =
        `${ownerFolder}/${folder}/` +
        `${record.id}/` +
        `${Date.now()}-${safeFileName}`;

    const { error } =
        await supabaseClient.storage
            .from(PRIVATE_OCR_BUCKET)
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                }
            );

    if (error) {
        throw new Error(
            "Corrected PDF upload failed: " +
            error.message
        );
    }

    return {
        path: filePath
    };
}

function buildOCRReviewMessage(status) {
    if (status === "Validated Expense") {
        return (
            "The OCR record was manually validated by the administrator."
        );
    }

    if (status === "Flagged for Review") {
        return (
            "The OCR record was flagged by the administrator for further review."
        );
    }

    return (
        "The OCR record still needs administrator review."
    );
}

/* =====================================
   QUICK OCR ACTIONS
===================================== */

async function quickMarkOCR(
    id,
    status
) {
    const record =
        adminOCRRecords.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    if (!record) {
        alert(
            "OCR record not found."
        );

        return;
    }

    const {
        data: { user }
    } =
        await supabaseClient.auth
            .getUser();

    const { error } =
        await supabaseClient
            .from("ocr_records")
            .update({
                status,
                review_status:
                    status,
                message:
                    buildOCRReviewMessage(
                        status
                    ),
                reviewed_by:
                    user?.id || null,
                reviewed_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                Number(id)
            );

    if (error) {
        alert(
            "OCR status update failed: " +
            error.message
        );

        return;
    }

    await logAudit(
        status === "Validated Expense"
            ? "Validated OCR record"
            : "Flagged OCR record",
        "Documents/OCR",
        `${status}: ${
            record.file_name ||
            "OCR Record"
        }`,
        true
    );

    alert(
        "OCR status updated."
    );

    await loadDocumentsAndOCR();
}

async function deleteOCRRecord(id) {
    const record =
        adminOCRRecords.find(
            function (item) {
                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );

    const confirmed =
        confirm(
            `Delete "${
                record?.file_name ||
                "this OCR record"
            }"? This cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    const { error } =
        await supabaseClient
            .from("ocr_records")
            .delete()
            .eq(
                "id",
                Number(id)
            );

    if (error) {
        alert(
            "OCR record deletion failed: " +
            error.message
        );

        return;
    }

    const privatePaths = [
        record?.original_file_path,
        record?.ocr_pdf_path,
        record?.corrected_pdf_path
    ].filter(Boolean);

    if (privatePaths.length > 0) {
        await removeStorageFiles(
            PRIVATE_OCR_BUCKET,
            privatePaths
        );
    }

    /*
     * Clean up legacy OCR files that were stored
     * publicly in the documents bucket.
     */
    const legacyPaths = [
        record?.file_url,
        record?.ocr_pdf_url,
        record?.corrected_pdf_url
    ]
        .map(function (url) {
            return extractStoragePathFromPublicUrl(
                url,
                PUBLIC_DOCUMENT_BUCKET
            );
        })
        .filter(Boolean);

    if (legacyPaths.length > 0) {
        await removeStorageFiles(
            PUBLIC_DOCUMENT_BUCKET,
            legacyPaths
        );
    }

    await logAudit(
        "Deleted OCR record",
        "Documents/OCR",
        `Deleted OCR record: ${
            record?.file_name ||
            "OCR Record ID " + id
        }`,
        true
    );

    alert(
        "OCR record deleted successfully."
    );

    await loadDocumentsAndOCR();
}

/* =====================================
   PDF CREATION
===================================== */

function createOCRPDF(info) {
    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {
        throw new Error(
            "PDF generator is not available."
        );
    }

    const {
        jsPDF
    } = window.jspdf;

    const pdf =
        new jsPDF();

    pdf.setFontSize(16);

    pdf.text(
        info.title ||
        "OCR Text Report",
        15,
        20
    );

    pdf.setFontSize(10);

    pdf.text(
        `File: ${
            info.fileName ||
            "Unknown"
        }`,
        15,
        32
    );

    pdf.text(
        `Detected Vendor: ${
            info.vendor ||
            "N/A"
        }`,
        15,
        39
    );

    pdf.text(
        `Detected Amount: ${
            info.amount !== null &&
            info.amount !== ""
                ? formatPeso(info.amount)
                : "Not detected"
        }`,
        15,
        46
    );

    pdf.text(
        `OCR Confidence: ${Number(
            info.confidence || 0
        ).toFixed(2)}%`,
        15,
        53
    );

    pdf.text(
        `Status: ${
            info.status ||
            "Pending"
        }`,
        15,
        60
    );

    pdf.setFontSize(12);

    pdf.text(
        "Corrected Text:",
        15,
        75
    );

    const lines =
        pdf.splitTextToSize(
            info.text ||
            "No text available.",
            180
        );

    pdf.setFontSize(10);

    let y = 85;

    lines.forEach(
        function (line) {
            if (y > 280) {
                pdf.addPage();
                y = 20;
            }

            pdf.text(
                line,
                15,
                y
            );

            y += 6;
        }
    );

    const baseName =
        makeBaseName(
            info.fileName ||
            "ocr-document"
        );

    const blob =
        pdf.output("blob");

    return new File(
        [blob],
        `${baseName}-corrected.pdf`,
        {
            type: "application/pdf"
        }
    );
}

/* =====================================
   VALIDATION
===================================== */

function validatePublicDocumentFile(
    file
) {
    const allowedExtensions = [
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "jpg",
        "jpeg",
        "png",
        "webp"
    ];

    const extension =
        getFileExtension(
            file.name
        );

    if (
        !allowedExtensions.includes(
            extension
        )
    ) {
        return (
            "Only PDF, Word, Excel, JPG, PNG, and WebP files are allowed."
        );
    }

    if (
        file.size >
        MAX_PUBLIC_DOCUMENT_SIZE
    ) {
        return (
            "The public document must not be larger than 10 MB."
        );
    }

    return "";
}

function validateCorrectedPDF(file) {
    const extension =
        getFileExtension(
            file.name
        );

    if (
        extension !== "pdf" ||
        file.type !==
            "application/pdf"
    ) {
        return (
            "The corrected file must be a PDF."
        );
    }

    if (
        file.size >
        MAX_CORRECTED_PDF_SIZE
    ) {
        return (
            "The corrected PDF must not be larger than 5 MB."
        );
    }

    return "";
}

/* =====================================
   STORAGE HELPERS
===================================== */

async function removeStorageFiles(
    bucket,
    paths
) {
    const validPaths =
        [...new Set(
            paths.filter(Boolean)
        )];

    if (validPaths.length === 0) {
        return;
    }

    const { error } =
        await supabaseClient.storage
            .from(bucket)
            .remove(validPaths);

    if (error) {
        console.warn(
            `Storage cleanup failed for ${bucket}:`,
            error.message
        );
    }
}

function extractStoragePathFromPublicUrl(
    fileUrl,
    bucket
) {
    if (!fileUrl) {
        return "";
    }

    try {
        const url =
            new URL(fileUrl);

        const marker =
            `/storage/v1/object/public/${bucket}/`;

        const index =
            url.pathname.indexOf(
                marker
            );

        if (index === -1) {
            return "";
        }

        return decodeURIComponent(
            url.pathname.slice(
                index +
                marker.length
            )
        );
    } catch {
        return "";
    }
}

function validateExternalURL(value) {
    const url =
        new URL(value);

    if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {
        throw new Error(
            "Invalid file URL."
        );
    }

    return url.href;
}

function openSafeURL(value) {
    try {
        const url =
            validateExternalURL(
                value
            );

        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );
    } catch {
        alert(
            "The document URL is invalid."
        );
    }
}

/* =====================================
   FILTERS AND SUMMARY
===================================== */

function searchAdminDocuments() {
    renderAllRecords();
}

function filterAdminDocuments() {
    renderAllRecords();
}

function updateDocumentSummary() {
    setText(
        "totalDocuments",
        adminDocuments.length +
        adminOCRRecords.length
    );

    setText(
        "financialReports",
        adminDocuments.filter(
            function (documentRecord) {
                return (
                    documentRecord.category ===
                    "Financial Report"
                );
            }
        ).length
    );

    setText(
        "receiptDocuments",
        adminDocuments.filter(
            function (documentRecord) {
                return (
                    documentRecord.category ===
                    "Receipt"
                );
            }
        ).length +
        adminOCRRecords.length
    );

    setText(
        "projectDocuments",
        adminDocuments.filter(
            function (documentRecord) {
                return (
                    documentRecord.category ===
                    "Project Document"
                );
            }
        ).length
    );
}

/* =====================================
   GENERAL HELPERS
===================================== */

function getOCRStatusClass(status) {
    const value =
        String(status || "")
            .toLowerCase();

    if (
        value.includes("valid")
    ) {
        return "status-resolved";
    }

    if (
        value.includes("flag")
    ) {
        return "status-flagged";
    }

    return "status-review";
}

function createSafeFileName(fileName) {
    const safeName =
        String(
            fileName ||
            "document"
        )
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "-"
            )
            .replace(
                /-+/g,
                "-"
            )
            .slice(
                0,
                120
            );

    return (
        safeName ||
        "document"
    );
}

function getFileExtension(fileName) {
    return String(
        fileName || ""
    )
        .split(".")
        .pop()
        .toLowerCase();
}

function makeBaseName(fileName) {
    return String(
        fileName || "document"
    )
        .replace(
            /\.[^/.]+$/,
            ""
        )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
        );
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    const date =
        new Date(dateValue);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
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

function formatFileSize(bytes) {
    const size =
        Number(bytes);

    if (!Number.isFinite(size)) {
        return "Unknown size";
    }

    if (size < 1024) {
        return `${size} B`;
    }

    if (
        size <
        1024 * 1024
    ) {
        return (
            `${(
                size / 1024
            ).toFixed(1)} KB`
        );
    }

    return (
        `${(
            size /
            (1024 * 1024)
        ).toFixed(1)} MB`
    );
}

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            String(
                value ?? ""
            );
    }
}

function setInputValue(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value ?? "";
    }
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

/* =====================================
   AUDIT LOG
===================================== */

async function logAudit(
    action,
    module,
    details,
    publicVisible = true
) {
    const {
        data: { user }
    } =
        await supabaseClient.auth
            .getUser();

    if (!user) {
        console.warn(
            "Audit log skipped: no logged-in user."
        );

        return;
    }

    const { data: profile } =
        await supabaseClient
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();

    const { error } =
        await supabaseClient
            .from("audit_logs")
            .insert([
                {
                    user_id:
                        user.id,
                    admin_name:
                        profile?.full_name ||
                        "Administrator",
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