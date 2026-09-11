

const OCR_BUCKET = "ocr-files";

const MAX_OCR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;

const OCR_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "jpg",
    "jpeg",
    "png",
    "webp"
];

const DOCUMENT_EXTENSIONS = [
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

let adminOCRRecords = [];
let adminDocumentRecords = [];

let currentOCRRecord = null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

    console.log("Katin-awan Admin Documents/OCR starting...");

    const allowed = await verifyAdminAccess();

    if (!allowed) {
        return;
    }

    setupAdminEvents();

    await loadAdminOCRRecords();

    await loadAdminDocuments();

    console.log("Katin-awan Admin Documents/OCR ready.");

});


/* =========================================================
   ADMIN ACCESS
   ========================================================= */

async function verifyAdminAccess() {

    try {

        const {
            data: { session },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw new Error(sessionError.message);
        }

        if (!session) {

            showAdminAccessError(
                "Please log in with an administrator account."
            );

            return false;
        }


        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

        if (profileError) {
            throw new Error(profileError.message);
        }

        if (!profile) {

            showAdminAccessError(
                "Your administrator profile could not be found."
            );

            return false;
        }


        const role = String(profile.role || "")
            .trim()
            .toLowerCase();

        if (role !== "admin") {

            showAdminAccessError(
                "Access denied. Documents/OCR is available to administrators only."
            );

            return false;
        }

        return true;

    } catch (error) {

        console.error("Admin access error:", error);

        showAdminAccessError(
            "Unable to verify administrator access."
        );

        return false;
    }
}


/* =========================================================
   ACCESS ERROR
   ========================================================= */

function showAdminAccessError(message) {

    const container =
        document.querySelector(
            ".admin-documents-container"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <section class="ocr-upload-card">

            <h2>🔒 Access Restricted</h2>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                type="button"
                class="public-blue-btn"
                onclick="window.location.href='login.html'"
            >
                Log In
            </button>

        </section>
    `;
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupAdminEvents() {

    const ocrButton =
        document.getElementById(
            "runOCRButton"
        );

    if (ocrButton) {

        ocrButton.addEventListener(
            "click",
            runAdminOCR
        );
    }


    const documentForm =
        document.getElementById(
            "addDocumentForm"
        );

    if (documentForm) {

        documentForm.addEventListener(
            "submit",
            handleDocumentFormSubmit
        );
    }
}


/* =========================================================
   CURRENT ADMIN
   ========================================================= */

async function getCurrentAdmin() {

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {

        console.error(
            "Current admin error:",
            error
        );

        return null;
    }

    return user || null;
}


/* =========================================================
   ADMIN OCR
   ========================================================= */

async function runAdminOCR() {

    const admin =
        await getCurrentAdmin();

    if (!admin) {

        alert(
            "Please log in as an administrator."
        );

        return;
    }


    const fileInput =
        document.getElementById(
            "ocrFile"
        );

    const progress =
        document.getElementById(
            "ocrProgress"
        );

    const resultBox =
        document.getElementById(
            "ocrResult"
        );

    const button =
        document.getElementById(
            "runOCRButton"
        );

    const file =
        fileInput?.files?.[0];


    if (!file) {

        alert(
            "Please select a document first."
        );

        return;
    }


    const validation =
        validateOCRFile(file);

    if (validation) {

        alert(validation);

        fileInput.value = "";

        return;
    }


    if (button) {

        button.disabled = true;

        button.textContent =
            "Processing...";
    }


    if (progress) {

        progress.textContent =
            "Preparing secure upload...";
    }


    if (resultBox) {

        resultBox.innerHTML = `
            <p class="muted-text">
                Processing document...
            </p>
        `;
    }


    let originalPath = null;
    let ocrPdfPath = null;


    try {

        /* -------------------------------------------------
           UPLOAD ORIGINAL
        ------------------------------------------------- */

        if (progress) {
            progress.textContent =
                "Uploading original document...";
        }

        const upload =
            await uploadOCRFile(
                file,
                admin.id,
                "originals"
            );

        originalPath =
            upload.path;


        /* -------------------------------------------------
           FILE INFORMATION
        ------------------------------------------------- */

        const fileType =
            getFileType(file);

        const isImage =
            isOCRImage(file);


        let extractedText = "";

        let confidence = 0;

        let detectedVendor =
            "Not scanned";

        let detectedAmount = null;


        let validation = {
            status:
                "Needs Admin Review",

            message:
                "Document uploaded successfully and requires administrator review."
        };


        /* -------------------------------------------------
           IMAGE OCR
        ------------------------------------------------- */

        if (isImage) {

            if (!window.Tesseract) {

                throw new Error(
                    "Tesseract OCR is not loaded. Make sure the Tesseract script is included in admin-documents.html."
                );
            }


            if (progress) {

                progress.textContent =
                    "Starting OCR...";
            }


            const result =
                await Tesseract.recognize(
                    file,
                    "eng",
                    {
                        logger: function (message) {

                            if (
                                message.status ===
                                "recognizing text"
                            ) {

                                const percent =
                                    Math.round(
                                        (
                                            message.progress ||
                                            0
                                        ) * 100
                                    );

                                if (progress) {

                                    progress.textContent =
                                        `OCR Progress: ${percent}%`;
                                }
                            }
                        }
                    }
                );


            extractedText =
                String(
                    result?.data?.text || ""
                ).trim();


            confidence =
                Number(
                    result?.data?.confidence || 0
                );


            detectedAmount =
                extractAmount(
                    extractedText
                );


            detectedVendor =
                extractVendor(
                    extractedText
                );


            validation =
                validateOCRResult(
                    extractedText,
                    detectedAmount,
                    confidence
                );


            /* -------------------------------------------------
               CREATE OCR PDF
            ------------------------------------------------- */

            if (progress) {

                progress.textContent =
                    "Creating OCR PDF...";
            }


            const ocrPDF =
                createOCRPDF({

                    title:
                        "OCR Extracted Text Report",

                    fileName:
                        file.name,

                    fileType,

                    vendor:
                        detectedVendor,

                    amount:
                        detectedAmount,

                    confidence,

                    status:
                        validation.status,

                    text:
                        extractedText
                });


            const reportUpload =
                await uploadOCRFile(
                    ocrPDF,
                    admin.id,
                    "ocr-reports"
                );


            ocrPdfPath =
                reportUpload.path;
        }


        /* -------------------------------------------------
           PDF / WORD
        ------------------------------------------------- */

        else {

            extractedText = "";

            confidence = 0;

            detectedVendor =
                "Not scanned";

            detectedAmount =
                null;

            validation = {

                status:
                    "Needs Admin Review",

                message:
                    "The document was uploaded successfully. Automatic browser OCR is performed on image files only. Administrator review is required."
            };
        }


        /* -------------------------------------------------
           SAVE OCR DATABASE RECORD
        ------------------------------------------------- */

        if (progress) {

            progress.textContent =
                "Saving OCR record...";
        }


        const saved =
            await saveOCRRecord({

                userId:
                    admin.id,

                fileName:
                    file.name,

                fileType,

                originalFilePath:
                    originalPath,

                ocrPdfPath,

                extractedText,

                detectedVendor,

                detectedAmount,

                confidence,

                validation
            });


        /* -------------------------------------------------
           DISPLAY RESULT
        ------------------------------------------------- */

        if (resultBox) {

            resultBox.innerHTML =
                buildOCRResultHTML(
                    saved
                );
        }


        if (progress) {

            progress.textContent =
                isImage
                    ? "Upload and OCR completed successfully."
                    : "Document uploaded successfully. Administrator review is required.";
        }


        fileInput.value = "";


        await loadAdminOCRRecords();

        await loadAdminDocuments();


    } catch (error) {

        console.error(
            "ADMIN OCR ERROR:",
            error
        );


        await removeOCRFiles(
            [
                originalPath,
                ocrPdfPath
            ].filter(Boolean)
        );


        if (progress) {

            progress.textContent =
                "Upload / OCR failed.";
        }


        if (resultBox) {

            resultBox.innerHTML = `
                <div class="ocr-summary ocr-flagged">

                    <h4>
                        Upload / OCR Failed
                    </h4>

                    <p>
                        ${escapeHTML(
                            error.message ||
                            "Unknown error."
                        )}
                    </p>

                </div>
            `;
        }


        alert(
            "Upload / OCR failed:\n\n" +
            (
                error.message ||
                "Unknown error."
            )
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Upload / Run OCR Analysis";
        }
    }
}


/* =========================================================
   OCR FILE UPLOAD
   ========================================================= */

async function uploadOCRFile(
    file,
    userId,
    folder
) {

    const safeName =
        createSafeFileName(
            file.name
        );


    const path =
        `${userId}/${folder}/` +
        `${Date.now()}-` +
        `${createRandomToken()}-` +
        `${safeName}`;


    const {
        error
    } =
        await supabaseClient.storage
            .from(OCR_BUCKET)
            .upload(
                path,
                file,
                {
                    cacheControl:
                        "3600",

                    upsert:
                        false,

                    contentType:
                        getUploadMimeType(file)
                }
            );


    if (error) {

        throw new Error(
            "File upload failed: " +
            error.message
        );
    }


    return {
        path
    };
}


/* =========================================================
   REMOVE OCR FILES
   ========================================================= */

async function removeOCRFiles(paths) {

    const validPaths =
        [
            ...new Set(
                paths.filter(Boolean)
            )
        ];


    if (!validPaths.length) {
        return;
    }


    const { error } =
        await supabaseClient.storage
            .from(OCR_BUCKET)
            .remove(validPaths);


    if (error) {

        console.warn(
            "File cleanup failed:",
            error.message
        );
    }
}


/* =========================================================
   SAVE OCR RECORD
   ========================================================= */

async function saveOCRRecord(record) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("ocr_records")
            .insert([
                {

                    user_id:
                        record.userId,

                    file_name:
                        record.fileName,

                    file_type:
                        record.fileType,

                    extracted_text:
                        record.extractedText || "",

                    corrected_text:
                        null,

                    detected_vendor:
                        record.detectedVendor ||
                        "Not detected",

                    detected_amount:
                        record.detectedAmount,

                    confidence:
                        Number(
                            record.confidence || 0
                        ),

                    status:
                        record.validation.status,

                    review_status:
                        record.validation.status,

                    message:
                        record.validation.message,

                    review_notes:
                        null,

                    original_file_path:
                        record.originalFilePath,

                    ocr_pdf_path:
                        record.ocrPdfPath,

                    corrected_pdf_path:
                        null,

                    is_public:
                        false,

                    file_url:
                        null,

                    ocr_pdf_url:
                        null,

                    corrected_pdf_url:
                        null
                }
            ])
            .select("*")
            .single();


    if (error) {

        throw new Error(
            "OCR record could not be saved: " +
            error.message
        );
    }


    return data;
}


/* =========================================================
   LOAD OCR RECORDS
   ========================================================= */

async function loadAdminOCRRecords() {

    const container =
        document.getElementById(
            "adminOCRHistory"
        );




 if (container) {

    container.innerHTML = `
        <p class="muted-text">
            Loading OCR records...
        </p>
    `;

}


    const {
        data,
        error
    } =
        await supabaseClient
            .from("ocr_records")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "OCR records loading error:",
            error
        );


if (container) {

    container.innerHTML = `
        <div class="document-card">

            <h3>
                Unable to load OCR records
            </h3>

            <p class="red-text">
                ${escapeHTML(
                    error.message
                )}
            </p>

        </div>
    `;

}

        return;
    }


    adminOCRRecords =
        data || [];

if (container) {

    renderAdminOCRRecords();

}

renderAdminDocumentRecords();

updateDocumentCounts();
}


/* =========================================================
   RENDER OCR RECORDS
   ========================================================= */

function renderAdminOCRRecords() {

    const container =
        document.getElementById(
            "adminOCRHistory"
        );


    if (!container) {
        return;
    }


    if (
        adminOCRRecords.length === 0
    ) {

        container.innerHTML = `
            <div class="document-card">

                <div class="doc-icon">
                    📄
                </div>

                <div>

                    <h3>
                        No OCR records yet
                    </h3>

                    <p>
                        Uploaded documents processed by OCR will appear here.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    container.innerHTML =
        adminOCRRecords
            .map(
                createAdminOCRCard
            )
            .join("");
}


/* =========================================================
   OCR CARD
   ========================================================= */

function createAdminOCRCard(record) {

    const status =
        record.review_status ||
        record.status ||
        "Pending";


    const hasOriginal =
        Boolean(
            record.original_file_path ||
            record.file_url
        );


    const hasOCR =
        Boolean(
            record.ocr_pdf_path ||
            record.ocr_pdf_url
        );


    const hasCorrected =
        Boolean(
            record.corrected_pdf_path ||
            record.corrected_pdf_url
        );


    return `
        <article class="document-card">

            <div class="doc-icon">
                ${getOCRStatusIcon(status)}
            </div>

            <div>

                <h3>
                    ${escapeHTML(
                        record.file_name ||
                        "OCR Document"
                    )}
                </h3>

                <p>
                    <b>Type:</b>
                    ${escapeHTML(
                        record.file_type ||
                        "Document"
                    )}
                </p>

                <p>
                    <b>Vendor:</b>
                    ${escapeHTML(
                        record.detected_vendor ||
                        "Not detected"
                    )}
                </p>

                <p>
                    <b>Amount:</b>
                    ${
                        record.detected_amount !== null &&
                        record.detected_amount !== ""
                            ? formatPeso(
                                record.detected_amount
                            )
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
                    <b>Status:</b>
                    <span class="${
                        getOCRStatusClass(
                            status
                        )
                    }">
                        ${escapeHTML(status)}
                    </span>
                </p>

                <p>
                    <small>
                        Uploaded:
                        ${formatDate(
                            record.created_at
                        )}
                    </small>
                </p>

                <div class="admin-card-actions">

                    <button
                        type="button"
                        onclick="openOCRReview(${Number(record.id)})"
                    >
                        Review / Correct
                    </button>

                    <button
                        type="button"
                        onclick="openOCRRecordFile(${Number(record.id)}, 'original', false)"
                        ${hasOriginal ? "" : "disabled"}
                    >
                        View Original
                    </button>

                    <button
                        type="button"
                        onclick="openOCRRecordFile(${Number(record.id)}, 'original', true)"
                        ${hasOriginal ? "" : "disabled"}
                    >
                        Download Original
                    </button>

                    <button
                        type="button"
                        onclick="openOCRRecordFile(${Number(record.id)}, 'ocr', true)"
                        ${hasOCR ? "" : "disabled"}
                    >
                        Download OCR PDF
                    </button>

                    <button
                        type="button"
                        onclick="openOCRRecordFile(${Number(record.id)}, 'corrected', true)"
                        ${hasCorrected ? "" : "disabled"}
                    >
                        Download Corrected PDF
                    </button>

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   OCR REVIEW
   ========================================================= */

function openOCRReview(id) {

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


    currentOCRRecord =
        record;


    const modal =
        document.getElementById(
            "ocrReviewModal"
        );


    if (!modal) {

        alert(
            "OCR review modal was not found in admin-documents.html."
        );

        return;
    }


    document.getElementById(
        "ocrReviewId"
    ).value =
        record.id;


    document.getElementById(
        "ocrReviewFileName"
    ).textContent =
        record.file_name ||
        "Document";


    document.getElementById(
        "ocrReviewVendor"
    ).textContent =
        record.detected_vendor ||
        "Not detected";


    document.getElementById(
        "ocrReviewAmount"
    ).textContent =
        record.detected_amount !== null &&
        record.detected_amount !== ""
            ? formatPeso(
                record.detected_amount
            )
            : "Not detected";


    document.getElementById(
        "ocrReviewConfidence"
    ).textContent =
        `${Number(
            record.confidence || 0
        ).toFixed(2)}%`;


    document.getElementById(
        "ocrCorrectedText"
    ).value =
        record.corrected_text ||
        record.extracted_text ||
        "";


    document.getElementById(
        "ocrReviewNotes"
    ).value =
        record.review_notes ||
        record.message ||
        "";


    document.getElementById(
        "ocrReviewStatus"
    ).value =
        record.review_status ||
        record.status ||
        "Needs Admin Review";


    const correctedInfo =
        document.getElementById(
            "ocrCorrectedPdfInfo"
        );


    if (correctedInfo) {

        correctedInfo.hidden =
            !record.corrected_pdf_path;

        correctedInfo.textContent =
            record.corrected_pdf_path
                ? "A corrected PDF already exists. Saving the review again will update it."
                : "";
    }


    const originalButton =
        document.getElementById(
            "ocrViewOriginalBtn"
        );

    const originalDownload =
        document.getElementById(
            "ocrDownloadOriginalBtn"
        );

    const ocrDownload =
        document.getElementById(
            "ocrDownloadReportBtn"
        );

    const correctedDownload =
        document.getElementById(
            "ocrDownloadCorrectedBtn"
        );


    if (originalButton) {
        originalButton.disabled =
            !(
                record.original_file_path ||
                record.file_url
            );
    }


    if (originalDownload) {
        originalDownload.disabled =
            !(
                record.original_file_path ||
                record.file_url
            );
    }


    if (ocrDownload) {
        ocrDownload.disabled =
            !(
                record.ocr_pdf_path ||
                record.ocr_pdf_url
            );
    }


    if (correctedDownload) {
        correctedDownload.disabled =
            !(
                record.corrected_pdf_path ||
                record.corrected_pdf_url
            );
    }


    modal.style.display =
        "flex";
}


/* =========================================================
   CLOSE OCR REVIEW
   ========================================================= */

function closeOCRReviewModal() {

    const modal =
        document.getElementById(
            "ocrReviewModal"
        );

    if (modal) {

        modal.style.display =
            "none";
    }

    currentOCRRecord =
        null;
}


/* =========================================================
   SAVE OCR REVIEW
   ========================================================= */

async function saveOCRReview() {

    if (!currentOCRRecord) {

        alert(
            "No OCR record is currently selected."
        );

        return;
    }


    const correctedText =
        document.getElementById(
            "ocrCorrectedText"
        ).value.trim();


    const notes =
        document.getElementById(
            "ocrReviewNotes"
        ).value.trim();


    const status =
        document.getElementById(
            "ocrReviewStatus"
        ).value;


    const manualPDFInput =
        document.getElementById(
            "ocrCorrectedPdfFile"
        );


    const manualPDF =
        manualPDFInput?.files?.[0] ||
        null;


    try {

        const admin =
            await getCurrentAdmin();


        if (!admin) {

            throw new Error(
                "Administrator session is no longer available."
            );
        }


        let correctedPDFPath =
            currentOCRRecord.corrected_pdf_path ||
            null;


        /* -------------------------------------------------
           MANUALLY UPLOADED CORRECTED PDF
        ------------------------------------------------- */

        if (manualPDF) {

            if (
                manualPDF.size >
                MAX_OCR_FILE_SIZE
            ) {

                throw new Error(
                    "Corrected PDF must not exceed 5 MB."
                );
            }


            if (
                getFileExtension(
                    manualPDF.name
                ) !== "pdf"
            ) {

                throw new Error(
                    "The corrected file must be a PDF."
                );
            }


            if (
                correctedPDFPath
            ) {

                await removeOCRFiles(
                    [
                        correctedPDFPath
                    ]
                );
            }


            const upload =
                await uploadOCRFile(
                    manualPDF,
                    admin.id,
                    "corrected"
                );


            correctedPDFPath =
                upload.path;
        }


        /* -------------------------------------------------
           AUTOMATIC CORRECTED PDF
           WHEN TEXT WAS EDITED
        ------------------------------------------------- */

        else if (
            correctedText
        ) {

            const correctedPDF =
                createCorrectedOCRPDF({

                    fileName:
                        currentOCRRecord.file_name,

                    fileType:
                        currentOCRRecord.file_type,

                    vendor:
                        currentOCRRecord.detected_vendor,

                    amount:
                        currentOCRRecord.detected_amount,

                    confidence:
                        currentOCRRecord.confidence,

                    status,

                    text:
                        correctedText
                });


            if (
                correctedPDFPath
            ) {

                await removeOCRFiles(
                    [
                        correctedPDFPath
                    ]
                );
            }


            const upload =
                await uploadOCRFile(
                    correctedPDF,
                    admin.id,
                    "corrected"
                );


            correctedPDFPath =
                upload.path;
        }


        /* -------------------------------------------------
           UPDATE DATABASE
        ------------------------------------------------- */

        const {
            data,
            error
        } =
            await supabaseClient
                .from("ocr_records")
                .update({

                    corrected_text:
                        correctedText ||
                        null,

                    review_status:
                        status,

                    status:
                        status,

                    review_notes:
                        notes ||
                        null,

                    corrected_pdf_path:
                        correctedPDFPath,

                    corrected_pdf_url:
                        null
                })
                .eq(
                    "id",
                    currentOCRRecord.id
                )
                .select("*")
                .single();


        if (error) {

            throw new Error(
                "OCR review could not be saved: " +
                error.message
            );
        }


        alert(
            "OCR review and correction saved successfully."
        );


        closeOCRReviewModal();


        await loadAdminOCRRecords();

        await loadAdminDocuments();


    } catch (error) {

        console.error(
            "OCR review save error:",
            error
        );


        alert(
            "Unable to save OCR review:\n\n" +
            error.message
        );
    }
}


/* =========================================================
   VIEW / DOWNLOAD OCR FILE
   ========================================================= */

async function openOCRRecordFile(
    id,
    type,
    download
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


    let path = "";
    let externalURL = "";
    let fileName =
        record.file_name ||
        "document";


    if (type === "original") {

        path =
            record.original_file_path ||
            "";

        externalURL =
            record.file_url ||
            "";

        fileName =
            record.file_name ||
            "original-document";

    }


    else if (type === "ocr") {

        path =
            record.ocr_pdf_path ||
            "";

        externalURL =
            record.ocr_pdf_url ||
            "";

        fileName =
            `${makeBaseName(
                record.file_name
            )}-OCR-report.pdf`;

    }


    else if (type === "corrected") {

        path =
            record.corrected_pdf_path ||
            "";

        externalURL =
            record.corrected_pdf_url ||
            "";

        fileName =
            `${makeBaseName(
                record.file_name
            )}-corrected.pdf`;
    }


    if (!path && !externalURL) {

        alert(
            "The requested file is not available yet."
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

        let url = "";


        if (path) {

            const {
                data,
                error
            } =
                await supabaseClient.storage
                    .from(OCR_BUCKET)
                    .createSignedUrl(
                        path,
                        300,
                        download
                            ? {
                                download:
                                    fileName
                            }
                            : {}
                    );


            if (
                error ||
                !data?.signedUrl
            ) {

                throw new Error(
                    error?.message ||
                    "Temporary file URL could not be created."
                );
            }


            url =
                data.signedUrl;

        }


        else {

            url =
                validateExternalURL(
                    externalURL
                );
        }


        if (download) {

            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;

            link.download =
                fileName;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";


            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

        }


        else if (
            pendingWindow
        ) {

            pendingWindow.location.href =
                url;
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
            "The file could not be opened:\n\n" +
            error.message
        );
    }
}


/* =========================================================
   DOCUMENT FORM
   ========================================================= */

async function handleDocumentFormSubmit(
    event
) {

    event.preventDefault();


    const admin =
        await getCurrentAdmin();


    if (!admin) {

        alert(
            "Please log in as an administrator."
        );

        return;
    }


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


    const docId =
        document.getElementById(
            "docId"
        ).value;


    const fileInput =
        document.getElementById(
            "docFile"
        );


    const file =
        fileInput?.files?.[0] ||
        null;


    if (!title) {

        alert(
            "Please enter a document title."
        );

        return;
    }


    try {

        if (file) {

            const error =
                validateDocumentFile(
                    file
                );

            if (error) {

                alert(error);

                return;
            }
        }


        let filePath = "";


        /* -------------------------------------------------
           UPDATE EXISTING DOCUMENT
        ------------------------------------------------- */

        if (docId) {

            const existing =
                adminDocumentRecords.find(
                    function (item) {

                        return (
                            Number(item.id) ===
                            Number(docId)
                        );
                    }
                );


            filePath =
                existing?.file_path ||
                "";


            if (file) {

                if (filePath) {

                    await removeOCRFiles(
                        [
                            filePath
                        ]
                    );
                }


                const upload =
                    await uploadOCRFile(
                        file,
                        admin.id,
                        "official-documents"
                    );


                filePath =
                    upload.path;
            }


            const {
                error
            } =
                await supabaseClient
                    .from("documents")
                    .update({

                        title,

                        category,

                        description,

                        file_path:
                            filePath ||
                            null
                    })
                    .eq(
                        "id",
                        docId
                    );


            if (error) {

                throw new Error(
                    "Document could not be updated: " +
                    error.message
                );
            }


            alert(
                "Official document updated successfully."
            );
        }


        /* -------------------------------------------------
           CREATE NEW DOCUMENT
        ------------------------------------------------- */

        else {

            if (!file) {

                throw new Error(
                    "Please select an official document file."
                );
            }


            const upload =
                await uploadOCRFile(
                    file,
                    admin.id,
                    "official-documents"
                );


            filePath =
                upload.path;


            const {
                error
            } =
                await supabaseClient
                    .from("documents")
                    .insert([
                        {

                            title,

                            category,

                            description,

                            file_path:
                                filePath,

                            is_public:
                                false
                        }
                    ]);


            if (error) {

                await removeOCRFiles(
                    [
                        filePath
                    ]
                );

                throw new Error(
                    "Document could not be saved: " +
                    error.message
                );
            }


            alert(
                "Official document saved successfully."
            );
        }


        clearDocumentForm();

        await loadAdminDocuments();

        updateDocumentCounts();


    } catch (error) {

        console.error(
            "Document save error:",
            error
        );


        alert(
            "Document could not be saved:\n\n" +
            error.message
        );
    }
}


/* =========================================================
   LOAD OFFICIAL DOCUMENTS
   ========================================================= */

async function loadAdminDocuments() {

    const container =
        document.getElementById(
            "documentsContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <p class="muted-text">
            Loading records...
        </p>
    `;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("documents")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Documents loading error:",
            error
        );


        container.innerHTML = `
            <div class="document-card">

                <h3>
                    Unable to load documents
                </h3>

                <p class="red-text">
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>
        `;

        return;
    }


    adminDocumentRecords =
        data || [];


    renderAdminDocumentRecords();

    updateDocumentCounts();
}


/* =========================================================
   RENDER ALL DOCUMENT + OCR RECORDS
   ========================================================= */

function renderAdminDocumentRecords() {

    const container =
        document.getElementById(
            "documentsContainer"
        );


    if (!container) {
        return;
    }


    const searchInput =
        document.getElementById(
            "adminDocumentSearch"
        );


    const filterInput =
        document.getElementById(
            "adminDocumentFilter"
        );


    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const filter =
        filterInput?.value ||
        "All";


    const combined = [];


    /* -------------------------------------------------
       OFFICIAL DOCUMENTS
    ------------------------------------------------- */

    adminDocumentRecords.forEach(
        function (doc) {

            combined.push({

                type:
                    "DOCUMENT",

                id:
                    doc.id,

                title:
                    doc.title ||
                    "Untitled Document",

                category:
                    doc.category ||
                    "Other",

                description:
                    doc.description ||
                    "",

                createdAt:
                    doc.created_at,

                isPublic:
                    Boolean(
                        doc.is_public
                    ),

                source:
                    doc
            });
        }
    );


    /* -------------------------------------------------
       OCR RECORDS
    ------------------------------------------------- */

    adminOCRRecords.forEach(
        function (ocr) {

            combined.push({

                type:
                    "OCR",

                id:
                    ocr.id,

                title:
                    ocr.file_name ||
                    "OCR Record",

                category:
                    "OCR Record",

                description:
                    [
                        ocr.detected_vendor,
                        ocr.review_status,
                        ocr.review_notes
                    ]
                        .filter(Boolean)
                        .join(" "),

                vendor:
                    ocr.detected_vendor ||
                    "",

                createdAt:
                    ocr.created_at,

          isPublic:
    Boolean(
        ocr.is_public
    ),

                source:
                    ocr
            });
        }
    );


    const filtered =
        combined.filter(
            function (record) {

                const text =
                    [
                        record.title,
                        record.category,
                        record.description,
                        record.vendor
                    ]
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    text.includes(
                        search
                    );


                const matchesFilter =
                    filter === "All" ||
                    record.category ===
                        filter;


                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );


    if (
        filtered.length === 0
    ) {

        container.innerHTML = `
            <div
                class="public-panel"
                style="grid-column:1/-1;"
            >

                <p>
                    No document or OCR records found.
                </p>

            </div>
        `;

        return;
    }


container.innerHTML =
    filtered
        .map(
            function (record) {

                if (
                    record.type ===
                    "OCR"
                ) {

                    return createAdminOCRCard(
                        record.source
                    );

                }

                return createDocumentCard(
                    record.source
                );

            }
        )
        .join("");
}


/* =========================================================
   DOCUMENT CARD
   ========================================================= */

function createDocumentCard(
    record
) {

    const hasFile =
        Boolean(
            record.file_path ||
            record.file_url
        );


    return `
        <article class="document-card">

            <div class="doc-icon">
                📄
            </div>

            <div>

                <h3>
                    ${escapeHTML(
                        record.title ||
                        "Untitled Document"
                    )}
                </h3>

                <p>
                    <b>Category:</b>
                    ${escapeHTML(
                        record.category ||
                        "Other"
                    )}
                </p>

                <p>
                    ${escapeHTML(
                        record.description ||
                        "No description provided."
                    )}
                </p>

                <p>
                    <b>Visibility:</b>
                    ${
                        record.is_public
                            ? "Published"
                            : "Private"
                    }
                </p>

                <p>
                    <small>
                        Uploaded:
                        ${formatDate(
                            record.created_at
                        )}
                    </small>
                </p>

            </div>

            <div class="admin-card-actions">

                <button
                    type="button"
                    onclick="viewOfficialDocument(${Number(record.id)})"
                    ${hasFile ? "" : "disabled"}
                >
                    View File
                </button>

                <button
                    type="button"
                    onclick="downloadOfficialDocument(${Number(record.id)})"
                    ${hasFile ? "" : "disabled"}
                >
                    Download
                </button>

                <button
                    type="button"
                    onclick="editDocument(${Number(record.id)})"
                >
                    Edit
                </button>

                <button
                    type="button"
                    onclick="toggleDocumentPublication(${Number(record.id)})"
                >
                    ${
                        record.is_public
                            ? "Unpublish"
                            : "Publish"
                    }
                </button>

                <button
                    type="button"
                    class="danger-btn"
                    onclick="deleteDocument(${Number(record.id)})"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   COMBINED OCR CARD
   ========================================================= */

function createCombinedOCRCard(
    record
) {

    const status =
        record.review_status ||
        record.status ||
        "Pending";


    const hasOriginal =
        Boolean(
            record.original_file_path
        );


    const hasOCR =
        Boolean(
            record.ocr_pdf_path
        );


    const hasCorrected =
        Boolean(
            record.corrected_pdf_path
        );


    return `
        <article class="document-card">

            <div class="doc-icon">
                ${getOCRStatusIcon(status)}
            </div>

            <div>

                <h3>
                    ${escapeHTML(
                        record.file_name ||
                        "OCR Record"
                    )}
                </h3>

                <p>
                    <b>Category:</b>
                    OCR Record
                </p>

                <p>
                    <b>Vendor:</b>
                    ${escapeHTML(
                        record.detected_vendor ||
                        "Not detected"
                    )}
                </p>

                <p>
                    <b>Amount:</b>
                    ${
                        record.detected_amount !== null &&
                        record.detected_amount !== ""
                            ? formatPeso(
                                record.detected_amount
                            )
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
                    <b>Status:</b>
                    ${escapeHTML(status)}
                </p>

            </div>

            <div class="admin-card-actions">

                <button
                    type="button"
                    onclick="openOCRReview(${Number(record.id)})"
                >
                    Review / Correct
                </button>

                <button
    type="button"
    onclick="toggleOCRPublication(${Number(record.id)})"
>
    ${
        record.is_public
            ? "Unpublish"
            : "Publish"
    }
</button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'original', false)"
                    ${hasOriginal ? "" : "disabled"}
                >
                    View Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'original', true)"
                    ${hasOriginal ? "" : "disabled"}
                >
                    Download Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'ocr', true)"
                    ${hasOCR ? "" : "disabled"}
                >
                    Download OCR PDF
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'corrected', true)"
                    ${hasCorrected ? "" : "disabled"}
                >
                    Download Corrected PDF
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   OFFICIAL DOCUMENT FILE ACCESS
   ========================================================= */

async function openOfficialDocumentFile(
    record,
    download
) {

    const path =
        record.file_path ||
        "";


    const externalURL =
        record.file_url ||
        "";


    if (!path && !externalURL) {

        alert(
            "This document does not have a file."
        );

        return;
    }


    let url = "";


    try {

        if (path) {

            const {
                data,
                error
            } =
                await supabaseClient.storage
                    .from(OCR_BUCKET)
                    .createSignedUrl(
                        path,
                        300,
                        download
                            ? {
                                download:
                                    record.title ||
                                    "document"
                            }
                            : {}
                    );


            if (
                error ||
                !data?.signedUrl
            ) {

                throw new Error(
                    error?.message ||
                    "Could not create temporary file link."
                );
            }


            url =
                data.signedUrl;

        } else {

            url =
                validateExternalURL(
                    externalURL
                );
        }


        if (download) {

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                url;

            link.download =
                record.title ||
                "document";

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";


            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

        } else {

            window.open(
                url,
                "_blank"
            );
        }


    } catch (error) {

        console.error(
            "Official document file error:",
            error
        );


        alert(
            "The document could not be opened:\n\n" +
            error.message
        );
    }
}


async function viewOfficialDocument(id) {

    const record =
        adminDocumentRecords.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );


    if (!record) {

        alert(
            "Document not found."
        );

        return;
    }


    await openOfficialDocumentFile(
        record,
        false
    );
}


async function downloadOfficialDocument(id) {

    const record =
        adminDocumentRecords.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );


    if (!record) {

        alert(
            "Document not found."
        );

        return;
    }


    await openOfficialDocumentFile(
        record,
        true
    );
}


/* =========================================================
   EDIT DOCUMENT
   ========================================================= */

function editDocument(id) {

    const record =
        adminDocumentRecords.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );


    if (!record) {

        alert(
            "Document not found."
        );

        return;
    }


    document.getElementById(
        "docId"
    ).value =
        record.id;


    document.getElementById(
        "docTitle"
    ).value =
        record.title ||
        "";


    document.getElementById(
        "docCategory"
    ).value =
        record.category ||
        "Other";


    document.getElementById(
        "docDescription"
    ).value =
        record.description ||
        "";


    document.getElementById(
        "existingDocFileUrl"
    ).value =
        record.file_path ||
        record.file_url ||
        "";


    window.scrollTo({

        top:
            document.getElementById(
                "addDocumentForm"
            ).getBoundingClientRect().top +
            window.scrollY -
            100,

        behavior:
            "smooth"
    });
}


/* =========================================================
   CLEAR DOCUMENT FORM
   ========================================================= */

function clearDocumentForm() {

    const form =
        document.getElementById(
            "addDocumentForm"
        );


    if (form) {

        form.reset();
    }


    const docId =
        document.getElementById(
            "docId"
        );


    if (docId) {

        docId.value = "";
    }


    const existing =
        document.getElementById(
            "existingDocFileUrl"
        );


    if (existing) {

        existing.value = "";
    }
}


/* =========================================================
   PUBLISH / UNPUBLISH DOCUMENT
   ========================================================= */

async function toggleDocumentPublication(
    id
) {

    const record =
        adminDocumentRecords.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );


    if (!record) {

        alert(
            "Document not found."
        );

        return;
    }


    const newValue =
        !Boolean(
            record.is_public
        );


    const action =
        newValue
            ? "publish"
            : "unpublish";


    if (
        !confirm(
            `Are you sure you want to ${action} this document?`
        )
    ) {

        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("documents")
            .update({

                is_public:
                    newValue

            })
            .eq(
                "id",
                record.id
            );


    if (error) {

        console.error(
            "Publication update error:",
            error
        );


        alert(
            "Could not update publication status:\n\n" +
            error.message
        );

        return;
    }


    alert(
        newValue
            ? "Document published. Residents can now see it on the Documents page."
            : "Document unpublished. Residents can no longer see it."
    );


    await loadAdminDocuments();
}


/* =========================================================
   DELETE DOCUMENT
   ========================================================= */

async function deleteDocument(id) {

    const record =
        adminDocumentRecords.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(id)
                );
            }
        );


    if (!record) {

        alert(
            "Document not found."
        );

        return;
    }


    if (
        !confirm(
            "Delete this official document?"
        )
    ) {

        return;
    }


    try {

        if (record.file_path) {

            await removeOCRFiles(
                [
                    record.file_path
                ]
            );
        }


        const {
            error
        } =
            await supabaseClient
                .from("documents")
                .delete()
                .eq(
                    "id",
                    record.id
                );


        if (error) {

            throw new Error(
                error.message
            );
        }


        alert(
            "Document deleted successfully."
        );


        await loadAdminDocuments();


    } catch (error) {

        console.error(
            "Document deletion error:",
            error
        );


        alert(
            "Document could not be deleted:\n\n" +
            error.message
        );
    }
}


/* =========================================================
   SEARCH
   ========================================================= */

function searchAdminDocuments() {

    renderAdminDocumentRecords();
}


function filterAdminDocuments() {

    renderAdminDocumentRecords();
}


/* =========================================================
   COUNTS
   ========================================================= */

function updateDocumentCounts() {

    const total =
        document.getElementById(
            "totalDocuments"
        );


    const financial =
        document.getElementById(
            "financialReports"
        );


    const receipts =
        document.getElementById(
            "receiptDocuments"
        );


    const projects =
        document.getElementById(
            "projectDocuments"
        );


    const ocr =
        document.getElementById(
            "ocrRecordsCount"
        );


    if (total) {

        total.textContent =
            adminDocumentRecords.length;
    }


    if (financial) {

        financial.textContent =
            adminDocumentRecords.filter(
                function (item) {

                    return (
                        item.category ===
                        "Financial Report"
                    );
                }
            ).length;
    }


    if (receipts) {

        receipts.textContent =
            adminDocumentRecords.filter(
                function (item) {

                    return (
                        item.category ===
                        "Receipt"
                    );
                }
            ).length;
    }


    if (projects) {

        projects.textContent =
            adminDocumentRecords.filter(
                function (item) {

                    return (
                        item.category ===
                        "Project Document"
                    );
                }
            ).length;
    }


    if (ocr) {

        ocr.textContent =
            adminOCRRecords.length;
    }
}


/* =========================================================
   OCR RESULT
   ========================================================= */

function buildOCRResultHTML(record) {

    const status =
        record.review_status ||
        record.status ||
        "Pending";


    const displayText =
        record.corrected_text ||
        record.extracted_text ||
        "No text extracted.";


    const hasOriginal =
        Boolean(
            record.original_file_path ||
            record.file_url
        );


    const hasOCR =
        Boolean(
            record.ocr_pdf_path ||
            record.ocr_pdf_url
        );


    const hasCorrected =
        Boolean(
            record.corrected_pdf_path ||
            record.corrected_pdf_url
        );


    return `
        <div class="ocr-summary ${
            getOCRStatusClass(status)
        }">

            <h4>
                ${escapeHTML(status)}
            </h4>

            <p>
                ${escapeHTML(
                    record.review_notes ||
                    record.message ||
                    "Administrator review required."
                )}
            </p>

        </div>


        <div class="ocr-details">

            <p>
                <b>File:</b>
                ${escapeHTML(
                    record.file_name ||
                    "Document"
                )}
            </p>

            <p>
                <b>File Type:</b>
                ${escapeHTML(
                    record.file_type ||
                    "Document"
                )}
            </p>

            <p>
                <b>Detected Vendor:</b>
                ${escapeHTML(
                    record.detected_vendor ||
                    "Not detected"
                )}
            </p>

            <p>
                <b>Detected Amount:</b>
                ${
                    record.detected_amount !== null &&
                    record.detected_amount !== ""
                        ? formatPeso(
                            record.detected_amount
                        )
                        : "Not detected"
                }
            </p>

            <p>
                <b>OCR Confidence:</b>
                ${Number(
                    record.confidence || 0
                ).toFixed(2)}%
            </p>


            <div class="ocr-result-actions">

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'original', false)"
                    ${hasOriginal ? "" : "disabled"}
                >
                    View Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'original', true)"
                    ${hasOriginal ? "" : "disabled"}
                >
                    Download Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'ocr', true)"
                    ${hasOCR ? "" : "disabled"}
                >
                    Download OCR PDF
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(${Number(record.id)}, 'corrected', true)"
                    ${hasCorrected ? "" : "disabled"}
                >
                    Download Corrected PDF
                </button>

                <button
                    type="button"
                    onclick="openOCRReview(${Number(record.id)})"
                >
                    Review / Correct
                </button>

            </div>

        </div>


        <h4>
            ${
                record.corrected_text
                    ? "Administrator-Corrected Text"
                    : "Extracted Text"
            }
        </h4>


        <pre class="ocr-text">${escapeHTML(
            displayText
        )}</pre>
    `;
}


/* =========================================================
   OCR PDF
   ========================================================= */

function createOCRPDF(info) {

    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        throw new Error(
            "jsPDF is not loaded."
        );
    }


    const {
        jsPDF
    } =
        window.jspdf;


    const pdf =
        new jsPDF();


    pdf.setFontSize(16);

    pdf.text(
        info.title ||
        "OCR Extracted Text Report",
        15,
        20
    );


    pdf.setFontSize(10);


    pdf.text(
        `File: ${info.fileName}`,
        15,
        32
    );


    pdf.text(
        `File Type: ${info.fileType}`,
        15,
        39
    );


    pdf.text(
        `Detected Vendor: ${
            info.vendor ||
            "Not detected"
        }`,
        15,
        46
    );


    pdf.text(
        `Detected Amount: ${
            info.amount !== null &&
            info.amount !== ""
                ? formatPeso(
                    info.amount
                )
                : "Not detected"
        }`,
        15,
        53
    );


    pdf.text(
        `OCR Confidence: ${Number(
            info.confidence || 0
        ).toFixed(2)}%`,
        15,
        60
    );


    pdf.text(
        `Status: ${
            info.status ||
            "Pending"
        }`,
        15,
        67
    );


    pdf.setFontSize(12);


    pdf.text(
        "Extracted Text:",
        15,
        80
    );


    const lines =
        pdf.splitTextToSize(
            info.text ||
            "No text extracted.",
            180
        );


    pdf.setFontSize(10);


    let y = 90;


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


    const base =
        makeBaseName(
            info.fileName
        );


    const blob =
        pdf.output(
            "blob"
        );


    return new File(

        [blob],

        `${base}-OCR-report.pdf`,

        {
            type:
                "application/pdf"
        }
    );
}


/* =========================================================
   CORRECTED PDF
   ========================================================= */

function createCorrectedOCRPDF(info) {

    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        throw new Error(
            "jsPDF is not loaded."
        );
    }


    const {
        jsPDF
    } =
        window.jspdf;


    const pdf =
        new jsPDF();


    pdf.setFontSize(16);

    pdf.text(
        "Corrected OCR Document",
        15,
        20
    );


    pdf.setFontSize(10);


    pdf.text(
        `Original File: ${
            info.fileName ||
            "Document"
        }`,
        15,
        32
    );


    pdf.text(
        `File Type: ${
            info.fileType ||
            "Document"
        }`,
        15,
        39
    );


    pdf.text(
        `Vendor: ${
            info.vendor ||
            "Not detected"
        }`,
        15,
        46
    );


    pdf.text(
        `Amount: ${
            info.amount !== null &&
            info.amount !== ""
                ? formatPeso(
                    info.amount
                )
                : "Not detected"
        }`,
        15,
        53
    );


    pdf.text(
        `OCR Confidence: ${Number(
            info.confidence || 0
        ).toFixed(2)}%`,
        15,
        60
    );


    pdf.text(
        `Review Status: ${
            info.status ||
            "Reviewed"
        }`,
        15,
        67
    );


    pdf.setFontSize(12);


    pdf.text(
        "Corrected Text:",
        15,
        80
    );


    const lines =
        pdf.splitTextToSize(
            info.text ||
            "No corrected text.",
            180
        );


    pdf.setFontSize(10);


    let y = 90;


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


    const base =
        makeBaseName(
            info.fileName
        );


    const blob =
        pdf.output(
            "blob"
        );


    return new File(

        [blob],

        `${base}-corrected.pdf`,

        {
            type:
                "application/pdf"
        }
    );
}


/* =========================================================
   OCR VALIDATION
   ========================================================= */

function validateOCRResult(
    text,
    amount,
    confidence
) {

    if (
        !String(text || "").trim()
    ) {

        return {

            status:
                "Flagged for Review",

            message:
                "No readable text was extracted. Manual administrator review is required."
        };
    }


    if (
        Number(confidence) < 60
    ) {

        return {

            status:
                "Flagged for Review",

            message:
                "OCR confidence is low. Manual administrator checking is required."
        };
    }


    if (
        Number(confidence) >= 80 &&
        amount !== null
    ) {

        return {

            status:
                "Needs Admin Review",

            message:
                "Text and an amount were extracted. Administrator confirmation is recommended."
        };
    }


    return {

        status:
            "Needs Admin Review",

        message:
            "OCR information was extracted successfully. Administrator review is required."
    };
}


/* =========================================================
   AMOUNT EXTRACTION
   ========================================================= */

function extractAmount(text) {

    const source =
        String(text || "");


    const patterns = [

        /(?:₱|PHP)\s*([\d,]+(?:\.\d{1,2})?)/gi,

        /(?:TOTAL|AMOUNT DUE|GRAND TOTAL)\s*:?\s*₱?\s*([\d,]+(?:\.\d{1,2})?)/gi

    ];


    const values = [];


    patterns.forEach(
        function (pattern) {

            const matches =
                [
                    ...source.matchAll(
                        pattern
                    )
                ];


            matches.forEach(
                function (match) {

                    const number =
                        Number(
                            String(
                                match[1]
                            )
                                .replaceAll(
                                    ",",
                                    ""
                                )
                        );


                    if (
                        Number.isFinite(
                            number
                        )
                    ) {

                        values.push(
                            number
                        );
                    }
                }
            );
        }
    );


    return values.length
        ? Math.max(
            ...values
        )
        : null;
}


/* =========================================================
   VENDOR EXTRACTION
   ========================================================= */

function extractVendor(text) {

    const lines =
        String(text || "")
            .split("\n")
            .map(
                function (line) {

                    return line.trim();
                }
            )
            .filter(
                function (line) {

                    return (
                        line.length >= 3 &&
                        !/^\d+$/.test(
                            line
                        )
                    );
                }
            );


    return (
        lines[0] ||
        "Unknown Vendor"
    );
}


/* =========================================================
   FILE VALIDATION
   ========================================================= */

function validateOCRFile(file) {

    const extension =
        getFileExtension(
            file.name
        );


    if (
        !OCR_EXTENSIONS.includes(
            extension
        )
    ) {

        return (
            "Only PDF, Word, JPG, PNG, and WebP files are allowed."
        );
    }


    if (
        file.size >
        MAX_OCR_FILE_SIZE
    ) {

        return (
            "The OCR file must not exceed 5 MB."
        );
    }


    return "";
}


function validateDocumentFile(file) {

    const extension =
        getFileExtension(
            file.name
        );


    if (
        !DOCUMENT_EXTENSIONS.includes(
            extension
        )
    ) {

        return (
            "Unsupported document type."
        );
    }


    if (
        file.size >
        MAX_DOCUMENT_FILE_SIZE
    ) {

        return (
            "The document must not exceed 10 MB."
        );
    }


    return "";
}


/* =========================================================
   FILE HELPERS
   ========================================================= */

function isOCRImage(file) {

    return [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ].includes(
        getFileExtension(
            file.name
        )
    );
}


function getFileType(file) {

    const extension =
        getFileExtension(
            file.name
        );


    if (
        isOCRImage(file)
    ) {

        return "Image Document";
    }


    if (
        extension === "pdf"
    ) {

        return "PDF Document";
    }


    if (
        extension === "doc" ||
        extension === "docx"
    ) {

        return "Word Document";
    }


    return "Document";
}


function getUploadMimeType(file) {

    if (file.type) {

        return file.type;
    }


    const extension =
        getFileExtension(
            file.name
        );


    const types = {

        pdf:
            "application/pdf",

        doc:
            "application/msword",

        docx:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        xls:
            "application/vnd.ms-excel",

        xlsx:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

        jpg:
            "image/jpeg",

        jpeg:
            "image/jpeg",

        png:
            "image/png",

        webp:
            "image/webp"
    };


    return (
        types[extension] ||
        "application/octet-stream"
    );
}


/* =========================================================
   DISPLAY HELPERS
   ========================================================= */

function getOCRStatusIcon(status) {

    const value =
        String(status || "")
            .toLowerCase();


    if (
        value.includes("valid")
    ) {

        return "✅";
    }


    if (
        value.includes("flag")
    ) {

        return "⚠️";
    }


    return "⏳";
}


function getOCRStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();


    if (
        value.includes("valid")
    ) {

        return "ocr-valid";
    }


    if (
        value.includes("flag")
    ) {

        return "ocr-flagged";
    }


    return "ocr-warning";
}


function formatDate(value) {

    if (!value) {
        return "N/A";
    }


    const date =
        new Date(value);


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
            year:
                "numeric",

            month:
                "short",

            day:
                "numeric"
        }
    );
}


function formatPeso(amount) {

    return new Intl.NumberFormat(
        "en-PH",
        {
            style:
                "currency",

            currency:
                "PHP",

            minimumFractionDigits:
                0,

            maximumFractionDigits:
                2
        }
    ).format(
        Number(
            amount || 0
        )
    );
}


function createSafeFileName(
    fileName
) {

    return String(
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
}


function createRandomToken() {

    return Math.random()
        .toString(36)
        .slice(2, 10);
}


function getFileExtension(
    fileName
) {

    return String(
        fileName ||
        ""
    )
        .split(".")
        .pop()
        .toLowerCase();
}


function makeBaseName(
    fileName
) {

    return String(
        fileName ||
        "document"
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


function validateExternalURL(
    value
) {

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


function escapeHTML(value) {

    return String(
        value || ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

async function toggleOCRPublication(id) {

    const record =
        adminOCRRecords.find(
            function(item) {
                return Number(item.id) === Number(id);
            }
        );


    if (!record) {

        alert("OCR record not found.");
        return;

    }


    const newValue =
        !Boolean(record.is_public);


    const action =
        newValue
            ? "publish"
            : "unpublish";


    if (
        !confirm(
            `Are you sure you want to ${action} this OCR record?`
        )
    ) {

        return;

    }


    const {
        error
    } =
        await supabaseClient
            .from("ocr_records")
            .update({

                is_public:
                    newValue

            })
            .eq(
                "id",
                record.id
            );


    if (error) {

        console.error(
            "OCR publication error:",
            error
        );


        alert(
            "Could not update OCR visibility."
        );

        return;

    }


    alert(
        newValue
            ? "OCR record published. Residents can now see it."
            : "OCR record unpublished."
    );


    await loadAdminOCRRecords();

}

/* =========================================================
   GLOBAL COMPATIBILITY
   ========================================================= */

window.runAdminOCR =
    runAdminOCR;

window.openOCRReview =
    openOCRReview;

window.closeOCRReviewModal =
    closeOCRReviewModal;

window.saveOCRReview =
    saveOCRReview;

window.openOCRRecordFile =
    openOCRRecordFile;

window.searchAdminDocuments =
    searchAdminDocuments;

window.filterAdminDocuments =
    filterAdminDocuments;

window.editDocument =
    editDocument;

window.clearDocumentForm =
    clearDocumentForm;

window.toggleDocumentPublication =
    toggleDocumentPublication;

window.deleteDocument =
    deleteDocument;

window.viewOfficialDocument =
    viewOfficialDocument;

window.downloadOfficialDocument =
    downloadOfficialDocument;