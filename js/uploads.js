// js/uploads.js

let expensesData = [];
let userOCRRecords = [];

const PRIVATE_OCR_BUCKET =
    "ocr-files";

const MAX_OCR_FILE_SIZE =
    5 * 1024 * 1024;

const ALLOWED_OCR_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "jpg",
    "jpeg",
    "png",
    "webp"
];

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        await loadExpensesForOCR();
        await loadOCRHistory();
    }
);

/* =====================================
   AUTHENTICATION
===================================== */

async function getCurrentUser() {
    const {
        data: { user },
        error
    } =
        await supabaseClient.auth
            .getUser();

    if (error) {
        console.warn(
            "Could not verify user:",
            error.message
        );
    }

    return user || null;
}

function redirectToLogin() {
    alert(
        "Please log in before using OCR Analysis."
    );

    window.location.href =
        "login.html?redirect=uploads.html";
}

/* =====================================
   LOAD EXPENSES FOR OCR MATCHING
===================================== */

async function loadExpensesForOCR() {
    const { data, error } =
        await supabaseClient
            .from("expenses")
            .select(`
                id,
                title,
                description,
                amount,
                status
            `);

    if (error) {
        console.warn(
            "Expenses could not be loaded for OCR matching:",
            error.message
        );

        expensesData = [];
        return;
    }

    expensesData =
        data || [];
}

/* =====================================
   RUN OCR
===================================== */

async function runOCR() {
    const user =
        await getCurrentUser();

    if (!user) {
        redirectToLogin();
        return;
    }

    const fileInput =
        document.getElementById(
            "ocrFile"
        );

    const progressBox =
        document.getElementById(
            "ocrProgress"
        );

    const resultBox =
        document.getElementById(
            "ocrResult"
        );

    const file =
        fileInput?.files?.[0];

    if (!file) {
        alert(
            "Please select a file first."
        );

        return;
    }

    const validationError =
        validateOCRFile(file);

    if (validationError) {
        alert(validationError);
        fileInput.value = "";
        return;
    }

    const isImage =
        isOCRImage(file);

    const fileType =
        getFileType(file);

    let originalFilePath = null;
    let ocrPdfPath = null;

    progressBox.textContent =
        "Uploading your original document securely...";

    resultBox.innerHTML = "";

    try {
        const originalUpload =
            await uploadPrivateOCRFile(
                file,
                user.id,
                "originals"
            );

        originalFilePath =
            originalUpload.path;

        let extractedText = "";
        let confidence = 0;
        let detectedAmount = null;
        let detectedVendor =
            "Not scanned";

        let validation = {
            status:
                "Needs Admin Review",
            message:
                "The document was uploaded securely and is waiting for administrator review.",
            className:
                "ocr-warning"
        };

        if (isImage) {
            progressBox.textContent =
                "Running OCR analysis on the image...";

            const result =
                await Tesseract.recognize(
                    file,
                    "eng",
                    {
                        logger:
                            function (message) {
                                if (
                                    message.status ===
                                    "recognizing text"
                                ) {
                                    const percentage =
                                        Math.round(
                                            message.progress *
                                            100
                                        );

                                    progressBox.textContent =
                                        `OCR Progress: ${percentage}%`;
                                }
                            }
                    }
                );

            extractedText =
                result.data.text || "";

            confidence =
                Number(
                    result.data.confidence || 0
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
                    detectedVendor,
                    confidence
                );

            if (extractedText.trim()) {
                const pdfFile =
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
                    await uploadPrivateOCRFile(
                        pdfFile,
                        user.id,
                        "ocr-reports"
                    );

                ocrPdfPath =
                    reportUpload.path;
            }
        }

        const savedRecord =
            await saveOCRRecord({
                userId:
                    user.id,
                fileName:
                    file.name,
                fileType,
                originalFilePath,
                ocrPdfPath,
                extractedText,
                detectedVendor,
                detectedAmount,
                confidence,
                validation
            });

        resultBox.innerHTML =
            buildOCRResultHTML(
                savedRecord
            );

        progressBox.textContent =
            isImage
                ? "Secure upload and OCR analysis completed."
                : "Secure upload completed. Administrator review is required.";

        fileInput.value = "";

        await loadOCRHistory();
    } catch (error) {
        console.error(
            "OCR processing error:",
            error
        );

        /*
         * Remove uploaded files when the database
         * record could not be completed.
         */
        const cleanupPaths = [
            originalFilePath,
            ocrPdfPath
        ].filter(Boolean);

        if (cleanupPaths.length > 0) {
            await removePrivateOCRFiles(
                cleanupPaths
            );
        }

        progressBox.textContent =
            "Upload or OCR analysis failed: " +
            error.message;
    }
}

/* =====================================
   PRIVATE STORAGE
===================================== */

async function uploadPrivateOCRFile(
    file,
    userId,
    folder
) {
    const safeFileName =
        createSafeFileName(
            file.name
        );

    const filePath =
        `${userId}/${folder}/` +
        `${Date.now()}-` +
        `${createRandomToken()}-` +
        safeFileName;

    const contentType =
        getUploadMimeType(file);

    const { error } =
        await supabaseClient.storage
            .from(PRIVATE_OCR_BUCKET)
            .upload(
                filePath,
                file,
                {
                    cacheControl:
                        "3600",
                    upsert:
                        false,
                    contentType
                }
            );

    if (error) {
        throw new Error(
            "Private file upload failed: " +
            error.message
        );
    }

    return {
        path:
            filePath
    };
}

async function removePrivateOCRFiles(
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
            .from(PRIVATE_OCR_BUCKET)
            .remove(validPaths);

    if (error) {
        console.warn(
            "OCR file cleanup failed:",
            error.message
        );
    }
}

/* =====================================
   SAVE DATABASE RECORD
===================================== */

async function saveOCRRecord(record) {
    const { data, error } =
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
                        record.extractedText ||
                        "",

                    corrected_text:
                        null,

                    detected_vendor:
                        record.detectedVendor,

                    detected_amount:
                        record.detectedAmount,

                    confidence:
                        record.confidence,

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

                    /*
                     * Do not create permanent public URLs.
                     */
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

/* =====================================
   OCR HISTORY
===================================== */

async function loadOCRHistory() {
    const historyBox =
        document.querySelector(
            ".ocr-history"
        );

    if (!historyBox) {
        return;
    }

    const user =
        await getCurrentUser();

    if (!user) {
        historyBox.innerHTML = `
            <div class="document-card">
                <div class="doc-icon">
                    🔒
                </div>

                <div>
                    <h3>Login required</h3>

                    <p>
                        Log in to view your OCR upload history.
                    </p>
                </div>
            </div>
        `;

        return;
    }

    const { data, error } =
        await supabaseClient
            .from("ocr_records")
            .select("*")
            .eq(
                "user_id",
                user.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(12);

    if (error) {
        historyBox.innerHTML = `
            <div class="document-card">
                <p class="red-text">
                    ${escapeHTML(
                        error.message
                    )}
                </p>
            </div>
        `;

        return;
    }

    userOCRRecords =
        data || [];

    if (
        userOCRRecords.length === 0
    ) {
        historyBox.innerHTML = `
            <div class="document-card">
                <div class="doc-icon">
                    📄
                </div>

                <div>
                    <h3>
                        No uploaded records yet
                    </h3>

                    <p>
                        Your private OCR uploads
                        will appear here.
                    </p>

                    <span>
                        Empty
                    </span>
                </div>
            </div>
        `;

        return;
    }

    historyBox.innerHTML =
        userOCRRecords
            .map(createOCRHistoryCard)
            .join("");
}

function createOCRHistoryCard(record) {
    const status =
        record.review_status ||
        record.status ||
        "Pending";

    return `
        <article class="document-card">
            <div class="doc-icon">
                ${getOCRStatusIcon(status)}
            </div>

            <div>
                <h3>
                    ${escapeHTML(
                        record.file_name ||
                        "Uploaded Document"
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
            </div>

            <button
                type="button"
                onclick="viewOCRDetails(${Number(record.id)})"
            >
                Details
            </button>
        </article>
    `;
}

/* =====================================
   VIEW OCR DETAILS
===================================== */

function viewOCRDetails(id) {
    const record =
        userOCRRecords.find(
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

    const resultBox =
        document.getElementById(
            "ocrResult"
        );

    resultBox.innerHTML =
        buildOCRResultHTML(
            record
        );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function buildOCRResultHTML(record) {
    const status =
        record.review_status ||
        record.status ||
        "Pending";

    const message =
        record.review_notes ||
        record.message ||
        "No review message available.";

    const displayText =
        record.corrected_text ||
        record.extracted_text ||
        "No automatic OCR text was extracted. The original file is available for review.";

    const hasOriginal =
        Boolean(
            record.original_file_path ||
            record.file_url
        );

    const hasOCRPdf =
        Boolean(
            record.ocr_pdf_path ||
            record.ocr_pdf_url
        );

    const hasCorrectedPdf =
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
                ${escapeHTML(message)}
            </p>
        </div>

        <div class="ocr-details">
            <p>
                <b>File:</b>
                ${escapeHTML(
                    record.file_name ||
                    "Uploaded Document"
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
                    onclick="openOCRRecordFile(
                        ${Number(record.id)},
                        'original',
                        false
                    )"
                    ${hasOriginal ? "" : "disabled"}
                >
                    View Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(
                        ${Number(record.id)},
                        'original',
                        true
                    )"
                    ${hasOriginal ? "" : "disabled"}
                >
                    Download Original
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(
                        ${Number(record.id)},
                        'ocr',
                        true
                    )"
                    ${hasOCRPdf ? "" : "disabled"}
                >
                    Download OCR PDF
                </button>

                <button
                    type="button"
                    onclick="openOCRRecordFile(
                        ${Number(record.id)},
                        'corrected',
                        true
                    )"
                    ${hasCorrectedPdf ? "" : "disabled"}
                >
                    Download Corrected PDF
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

        <pre class="ocr-text">${
            escapeHTML(displayText)
        }</pre>
    `;
}

/* =====================================
   PRIVATE FILE ACCESS
===================================== */

async function openOCRRecordFile(
    id,
    type,
    download
) {
    const record =
        userOCRRecords.find(
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
                    .from(
                        PRIVATE_OCR_BUCKET
                    )
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
                    "Temporary file link could not be created."
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

/* =====================================
   OCR PDF GENERATION
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
        info.title,
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
                ? formatPeso(info.amount)
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
        `Status: ${info.status}`,
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

    const baseName =
        makeBaseName(
            info.fileName
        );

    const blob =
        pdf.output("blob");

    return new File(
        [blob],
        `${baseName}-OCR-report.pdf`,
        {
            type:
                "application/pdf"
        }
    );
}

/* =====================================
   OCR EXTRACTION AND VALIDATION
===================================== */

function extractAmount(text) {
    const source =
        String(text || "");

    const currencyPattern =
        /(?:₱|PHP|TOTAL|AMOUNT DUE|GRAND TOTAL)\s*:?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

    const currencyMatches =
        [...source.matchAll(
            currencyPattern
        )];

    if (currencyMatches.length > 0) {
        const values =
            currencyMatches
                .map(function (match) {
                    return Number(
                        match[1]
                            .replaceAll(
                                ",",
                                ""
                            )
                    );
                })
                .filter(Number.isFinite);

        return values.length > 0
            ? Math.max(...values)
            : null;
    }

    const fallbackPattern =
        /(\d{1,3}(?:,\d{3})+\.\d{2})/g;

    const fallbackMatches =
        [...source.matchAll(
            fallbackPattern
        )];

    const values =
        fallbackMatches
            .map(function (match) {
                return Number(
                    match[1]
                        .replaceAll(
                            ",",
                            ""
                        )
                );
            })
            .filter(Number.isFinite);

    return values.length > 0
        ? Math.max(...values)
        : null;
}

function extractVendor(text) {
    const lines =
        String(text || "")
            .split("\n")
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return (
                    line.length >= 3 &&
                    !/^\d+$/.test(line)
                );
            });

    return (
        lines[0] ||
        "Unknown Vendor"
    );
}

function validateOCRResult(
    text,
    amount,
    vendor,
    confidence
) {
    if (confidence < 60) {
        return {
            status:
                "Flagged for Review",
            message:
                "OCR confidence is low. Manual administrator checking is required.",
            className:
                "ocr-flagged"
        };
    }

    const cleanText =
        String(text || "")
            .toLowerCase();

    const matchedExpense =
        expensesData.find(
            function (expense) {
                const expenseAmount =
                    Number(
                        expense.amount || 0
                    );

                const amountMatches =
                    amount !== null &&
                    Number(amount) ===
                    expenseAmount;

                const titleWords =
                    String(
                        expense.title || ""
                    )
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(function (word) {
                            return (
                                word.length >= 4
                            );
                        });

                const titleMatches =
                    titleWords.some(
                        function (word) {
                            return (
                                cleanText.includes(
                                    word
                                )
                            );
                        }
                    );

                return (
                    amountMatches &&
                    titleMatches
                );
            }
        );

    if (matchedExpense) {
        return {
            status:
                "Validated Expense",
            message:
                `The OCR result matched the amount and description of expense: ${matchedExpense.title}. Administrator confirmation is still recommended.`,
            className:
                "ocr-valid"
        };
    }

    if (
        confidence >= 80 &&
        amount !== null
    ) {
        return {
            status:
                "Needs Admin Review",
            message:
                "Text and an amount were extracted, but no reliable project expense match was found.",
            className:
                "ocr-warning"
        };
    }

    return {
        status:
            "Flagged for Review",
        message:
            "The document could not be confidently matched with an existing expense record.",
        className:
            "ocr-flagged"
    };
}

/* =====================================
   VALIDATION HELPERS
===================================== */

function validateOCRFile(file) {
    const extension =
        getFileExtension(
            file.name
        );

    if (
        !ALLOWED_OCR_EXTENSIONS.includes(
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
            "The OCR file must not be larger than 5 MB."
        );
    }

    return "";
}

function isOCRImage(file) {
    const extension =
        getFileExtension(
            file.name
        );

    return [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ].includes(extension);
}

function getFileType(file) {
    const extension =
        getFileExtension(
            file.name
        );

    if (
        isOCRImage(file)
    ) {
        return (
            "Image Document"
        );
    }

    if (extension === "pdf") {
        return (
            "PDF Document"
        );
    }

    if (
        extension === "doc" ||
        extension === "docx"
    ) {
        return (
            "Word Document"
        );
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

    const mimeTypes = {
        pdf:
            "application/pdf",

        doc:
            "application/msword",

        docx:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

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
        mimeTypes[extension] ||
        "application/octet-stream"
    );
}

/* =====================================
   DISPLAY HELPERS
===================================== */

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
        Number(amount || 0)
    );
}

function formatFileSize(bytes) {
    const size =
        Number(bytes);

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

function createSafeFileName(fileName) {
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