let publicDocuments = [];

let transparencyLogs = [];

const DOCUMENT_STORAGE_BUCKET = "ocr-files";

document.addEventListener(
    "DOMContentLoaded",
    async function () {
        await checkLoginAndLoad();
    }
);

async function checkLoginAndLoad() {
    const loginRequired =
        document.getElementById("loginRequired");

    const documentsContent =
        document.getElementById("documentsContent");

    if (
        !loginRequired ||
        !documentsContent
    ) {
        return;
    }

    const {
        data: {
            session
        },
        error
    } =
        await supabaseClient.auth.getSession();

    if (error) {
        console.error(
            "Session check failed:",
            error
        );

        showLoginRequired();

        return;
    }

    if (!session) {
        showLoginRequired();

        return;
    }

    loginRequired.style.display = "none";

    documentsContent.style.display = "block";

    await loadDocuments();

    await loadTransparencyLogs();
}

function showLoginRequired() {
    const loginRequired =
        document.getElementById("loginRequired");

    const documentsContent =
        document.getElementById("documentsContent");

    if (loginRequired) {
        loginRequired.style.display = "block";
    }

    if (documentsContent) {
        documentsContent.style.display = "none";
    }
}

async function loadDocuments() {
    const documentsList =
        document.getElementById("documentsList");

    if (!documentsList) {
        return;
    }

    documentsList.innerHTML = `
        <div
            class="public-panel"
            style="grid-column:1/-1;"
        >
            <p>
                Loading documents...
            </p>
        </div>
    `;

    try {
        const {
            data: documents,
            error: documentsError
        } =
            await supabaseClient
                .from("documents")
                .select("*")
                .eq("is_public", true)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (documentsError) {
            throw new Error(
                "Unable to load official documents: " +
                documentsError.message
            );
        }

        const {
            data: ocrRecords,
            error: ocrError
        } =
            await supabaseClient
                .from("ocr_records")
                .select("*")
                .eq("is_public", true)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (ocrError) {
            throw new Error(
                "Unable to load published OCR records: " +
                ocrError.message
            );
        }

        const normalizedDocuments =
            (
                documents || []
            ).map(
                function (documentRecord) {
                    return {
                        ...documentRecord,
                        _key:
                            "document-" +
                            documentRecord.id,
                        record_type:
                            "document",
                        category:
                            documentRecord.category ||
                            "Other",
                        title:
                            documentRecord.title ||
                            "Untitled Document",
                        description:
                            documentRecord.description ||
                            "No description provided."
                    };
                }
            );

        const normalizedOCR =
            (
                ocrRecords || []
            ).map(
                function (ocr) {
                    const preferredPath =
                        ocr.corrected_pdf_path ||
                        ocr.ocr_pdf_path ||
                        ocr.original_file_path ||
                        null;

                    const preferredURL =
                        ocr.corrected_pdf_url ||
                        ocr.ocr_pdf_url ||
                        ocr.file_url ||
                        null;

                    let description =
                        ocr.review_notes ||
                        ocr.message ||
                        "";

                    if (!description) {
                        if (ocr.corrected_text) {
                            description =
                                "Reviewed and corrected OCR document.";
                        } else {
                            description =
                                "Published OCR document.";
                        }
                    }

                    return {
                        _key:
                            "ocr-" +
                            ocr.id,
                        id:
                            ocr.id,
                        source_id:
                            ocr.id,
                        record_type:
                            "ocr",
                        title:
                            ocr.file_name ||
                            "OCR Document",
                        category:
                            "OCR Record",
                        description:
                            description,
                        created_at:
                            ocr.created_at,
                        file_path:
                            preferredPath,
                        file_url:
                            preferredURL,
                        detected_vendor:
                            ocr.detected_vendor ||
                            "",
                        detected_amount:
                            ocr.detected_amount,
                        confidence:
                            ocr.confidence,
                        review_status:
                            ocr.review_status ||
                            ocr.status ||
                            "",
                        corrected_text:
                            ocr.corrected_text ||
                            "",
                        extracted_text:
                            ocr.extracted_text ||
                            ""
                    };
                }
            );

        publicDocuments = [
            ...normalizedDocuments,
            ...normalizedOCR
        ];

        publicDocuments.sort(
            function (a, b) {
                const dateA =
                    new Date(
                        a.created_at || 0
                    );

                const dateB =
                    new Date(
                        b.created_at || 0
                    );

                return dateB - dateA;
            }
        );

        renderDocuments(
            publicDocuments
        );
    } catch (error) {
        console.error(
            "Failed to load public documents:",
            error
        );

        documentsList.innerHTML = `
            <div
                class="public-panel"
                style="grid-column:1/-1;"
            >
                <p style="color:red;">
                    Failed to load documents:
                    ${escapeHTML(
                        error.message ||
                        "Unknown error."
                    )}
                </p>
            </div>
        `;
    }
}

function renderDocuments(docs) {
    const documentsList =
        document.getElementById("documentsList");

    if (!documentsList) {
        return;
    }

    if (
        !docs ||
        docs.length === 0
    ) {
        documentsList.innerHTML = `
            <div
                class="public-panel"
                style="grid-column:1/-1;"
            >
                <p>
                    No public documents found.
                </p>
            </div>
        `;

        return;
    }

    documentsList.innerHTML =
        docs
            .map(
                function (doc) {
                    const isOCR =
                        doc.record_type === "ocr";

                    let extraDetails = "";

                    if (isOCR) {
                        const vendor =
                            doc.detected_vendor
                                ? `
                                    <p>
                                        <b>
                                            Vendor:
                                        </b>
                                        ${escapeHTML(
                                            doc.detected_vendor
                                        )}
                                    </p>
                                `
                                : "";

                        const amount =
                            doc.detected_amount !== null &&
                            doc.detected_amount !== undefined &&
                            doc.detected_amount !== ""
                                ? `
                                    <p>
                                        <b>
                                            Amount:
                                        </b>
                                        ${formatPeso(
                                            doc.detected_amount
                                        )}
                                    </p>
                                `
                                : "";

                        const status =
                            doc.review_status
                                ? `
                                    <p>
                                        <b>
                                            Review Status:
                                        </b>
                                        ${escapeHTML(
                                            doc.review_status
                                        )}
                                    </p>
                                `
                                : "";

                        extraDetails =
                            vendor +
                            amount +
                            status;
                    }

                    return `
                        <div class="document-card">
                            <div class="doc-icon">
                                ${getDocumentIcon(
                                    doc.category
                                )}
                            </div>

                            <div>
                                <h3>
                                    ${escapeHTML(
                                        doc.title ||
                                        "Untitled Document"
                                    )}
                                </h3>

                                <p>
                                    Updated:
                                    ${formatDate(
                                        doc.created_at
                                    )}
                                </p>

                                <span>
                                    ${escapeHTML(
                                        doc.category ||
                                        "Other"
                                    )}
                                </span>

                                ${extraDetails}

                                <p class="document-preview">
                                    ${escapeHTML(
                                        doc.description ||
                                        "No description provided."
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                onclick="viewDocumentDetails('${escapeAttribute(
                                    doc._key
                                )}')"
                            >
                                View
                            </button>
                        </div>
                    `;
                }
            )
            .join("");
}

function searchDocuments() {
    const searchInput =
        document.getElementById("documentSearch");

    if (!searchInput) {
        return;
    }

    const keyword =
        searchInput.value
            .toLowerCase()
            .trim();

    const selectedCategory =
        document.getElementById(
            "documentFilter"
        )?.value ||
        "All";

    let filtered = [
        ...publicDocuments
    ];

    if (
        selectedCategory !==
        "All"
    ) {
        filtered =
            filtered.filter(
                function (doc) {
                    return (
                        doc.category ===
                        selectedCategory
                    );
                }
            );
    }

    if (keyword) {
        filtered =
            filtered.filter(
                function (doc) {
                    const title =
                        String(
                            doc.title ||
                            ""
                        ).toLowerCase();

                    const category =
                        String(
                            doc.category ||
                            ""
                        ).toLowerCase();

                    const description =
                        String(
                            doc.description ||
                            ""
                        ).toLowerCase();

                    const vendor =
                        String(
                            doc.detected_vendor ||
                            ""
                        ).toLowerCase();

                    const status =
                        String(
                            doc.review_status ||
                            ""
                        ).toLowerCase();

                    return (
                        title.includes(
                            keyword
                        ) ||
                        category.includes(
                            keyword
                        ) ||
                        description.includes(
                            keyword
                        ) ||
                        vendor.includes(
                            keyword
                        ) ||
                        status.includes(
                            keyword
                        )
                    );
                }
            );
    }

    renderDocuments(
        filtered
    );
}

function filterDocuments() {
    searchDocuments();
}

function viewDocumentDetails(key) {
    const doc =
        publicDocuments.find(
            function (item) {
                return (
                    String(
                        item._key
                    ) ===
                    String(
                        key
                    )
                );
            }
        );

    if (!doc) {
        alert(
            "Document not found."
        );

        return;
    }

    const modal =
        document.getElementById(
            "documentModal"
        );

    if (!modal) {
        return;
    }

    const title =
        document.getElementById(
            "documentModalTitle"
        );

    const description =
        document.getElementById(
            "documentModalDescription"
        );

    const date =
        document.getElementById(
            "documentModalDate"
        );

    const category =
        document.getElementById(
            "documentModalCategory"
        );

    const viewBtn =
        document.getElementById(
            "documentModalViewBtn"
        );

    if (title) {
        title.textContent =
            doc.title ||
            "Untitled Document";
    }

    if (description) {
        let modalDescription =
            doc.description ||
            "No description provided.";

        if (
            doc.record_type ===
            "ocr"
        ) {
            const details = [];

            if (
                doc.detected_vendor
            ) {
                details.push(
                    "Vendor: " +
                    doc.detected_vendor
                );
            }

            if (
                doc.detected_amount !==
                    null &&
                doc.detected_amount !==
                    undefined &&
                doc.detected_amount !==
                    ""
            ) {
                details.push(
                    "Amount: " +
                    formatPeso(
                        doc.detected_amount
                    )
                );
            }

            if (
                doc.review_status
            ) {
                details.push(
                    "Status: " +
                    doc.review_status
                );
            }

            if (
                details.length
            ) {
                modalDescription +=
                    "\n\n" +
                    details.join(
                        "\n"
                    );
            }
        }

        description.textContent =
            modalDescription;

        description.style.whiteSpace =
            "pre-line";
    }

    if (date) {
        date.textContent =
            "Updated: " +
            formatDate(
                doc.created_at
            );
    }

    if (category) {
        category.textContent =
            doc.category ||
            "Other";
    }

    if (viewBtn) {
        const hasFile =
            Boolean(
                doc.file_path ||
                doc.file_url
            );

        if (hasFile) {
            viewBtn.style.display =
                "inline-block";

            viewBtn.onclick =
                async function () {
                    await openResidentDocument(
                        doc
                    );
                };
        } else {
            viewBtn.style.display =
                "none";
        }
    }

    modal.classList.add(
        "active"
    );
}

async function logResidentDocumentView(doc) {
    try {
        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient.auth.getUser();

        if (
            userError ||
            !user
        ) {
            console.warn(
                "Resident audit log skipped: no logged-in user."
            );

            return;
        }

        const {
            error
        } =
            await supabaseClient
                .from("audit_logs")
                .insert([
                    {
                        user_id:
                            user.id,
                        admin_name:
                            "Resident",
                        action:
                            "Viewed Document",
                        module:
                            "Documents",
                        details:
                            "Resident viewed: " +
                            (
                                doc.title ||
                                "Untitled Document"
                            ),
                        public_visible:
                            true
                    }
                ]);

        if (error) {
            console.warn(
                "Resident document audit log failed:",
                error.message
            );
        }
    } catch (error) {
        console.warn(
            "Resident document audit log error:",
            error
        );
    }
}

async function openResidentDocument(doc) {
    let pendingWindow = null;

    try {
        let url = "";

        pendingWindow =
            window.open(
                "",
                "_blank"
            );

        if (
            doc.file_path
        ) {
            const {
                data,
                error
            } =
                await supabaseClient
                    .storage
                    .from(
                        DOCUMENT_STORAGE_BUCKET
                    )
                    .createSignedUrl(
                        doc.file_path,
                        300
                    );

            if (
                error ||
                !data?.signedUrl
            ) {
                throw new Error(
                    error?.message ||
                    "Unable to create document link."
                );
            }

            url =
                data.signedUrl;
        } else if (
            doc.file_url
        ) {
            url =
                validateDocumentURL(
                    doc.file_url
                );
        }

        if (!url) {
            throw new Error(
                "No document file is available."
            );
        }

        await logResidentDocumentView(
            doc
        );

        if (pendingWindow) {
            pendingWindow.opener =
                null;

            pendingWindow.location.href =
                url;
        } else {
            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );
        }

        await loadTransparencyLogs();
    } catch (error) {
        if (pendingWindow) {
            pendingWindow.close();
        }

        console.error(
            "Resident document open error:",
            error
        );

        alert(
            "Unable to open this document:\n\n" +
            (
                error.message ||
                "Unknown error."
            )
        );
    }
}

function closeDocumentModal() {
    const modal =
        document.getElementById(
            "documentModal"
        );

    if (modal) {
        modal.classList.remove(
            "active"
        );
    }
}

document.addEventListener(
    "click",
    function (event) {
        const modal =
            document.getElementById(
                "documentModal"
            );

        if (
            modal &&
            event.target === modal
        ) {
            modal.classList.remove(
                "active"
            );
        }
    }
);

async function loadTransparencyLogs() {
    const logsList =
        document.getElementById(
            "transparencyLogsList"
        );

    if (!logsList) {
        return;
    }

    logsList.innerHTML = `
        <div
            class="public-panel"
            style="grid-column:1/-1;"
        >
            <p>
                Loading transparency logs...
            </p>
        </div>
    `;

    const {
        data,
        error
    } =
        await supabaseClient
            .from("audit_logs")
            .select("*")
            .eq(
                "public_visible",
                true
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );

    if (error) {
        console.error(
            "Failed to load transparency logs:",
            error
        );

        logsList.innerHTML = `
            <div class="public-panel">
                <p style="color:red;">
                    Failed to load transparency logs:
                    ${escapeHTML(
                        error.message
                    )}
                </p>
            </div>
        `;

        return;
    }

    transparencyLogs =
        data || [];

    renderTransparencyLogs(
        transparencyLogs
    );
}

function renderTransparencyLogs(logs) {
    const logsList =
        document.getElementById(
            "transparencyLogsList"
        );

    if (!logsList) {
        return;
    }

    if (
        !logs ||
        logs.length === 0
    ) {
        logsList.innerHTML = `
            <div
                class="public-panel"
                style="grid-column:1/-1;"
            >
                <p>
                    No public transparency logs found.
                </p>
            </div>
        `;

        return;
    }

    logsList.innerHTML =
        logs
            .map(
                function (log) {
                    const isResident =
                        String(
                            log.admin_name ||
                            ""
                        ).toLowerCase() ===
                        "resident";

                    const actorLabel =
                        isResident
                            ? "Activity by:"
                            : "Changed by:";

                    const actorName =
                        log.admin_name ||
                        "Administrator";

                    return `
                        <div class="document-card">
                            <div class="doc-icon">
                                ${getLogIcon(
                                    log.module
                                )}
                            </div>

                            <div>
                                <h3>
                                    ${escapeHTML(
                                        log.action ||
                                        "System Activity"
                                    )}
                                </h3>

                                <p>
                                    <b>
                                        Module:
                                    </b>

                                    ${escapeHTML(
                                        log.module ||
                                        "General"
                                    )}
                                </p>

                                <p>
                                    <b>
                                        ${actorLabel}
                                    </b>

                                    ${escapeHTML(
                                        actorName
                                    )}
                                </p>

                                <p>
                                    ${escapeHTML(
                                        log.details ||
                                        "No details provided."
                                    )}
                                </p>

                                <span>
                                    ${formatDateTime(
                                        log.created_at
                                    )}
                                </span>
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}

function searchTransparencyLogs() {
    const searchInput =
        document.getElementById(
            "logSearch"
        );

    if (!searchInput) {
        return;
    }

    const keyword =
        searchInput.value
            .toLowerCase()
            .trim();

    const selectedModule =
        document.getElementById(
            "logFilter"
        )?.value ||
        "All";

    let filtered = [
        ...transparencyLogs
    ];

    if (
        selectedModule !==
        "All"
    ) {
        filtered =
            filtered.filter(
                function (log) {
                    return (
                        log.module ===
                        selectedModule
                    );
                }
            );
    }

    if (keyword) {
        filtered =
            filtered.filter(
                function (log) {
                    const adminName =
                        log.admin_name ||
                        "Administrator";

                    return (
                        String(
                            log.action ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                keyword
                            ) ||
                        String(
                            log.module ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                keyword
                            ) ||
                        String(
                            log.details ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                keyword
                            ) ||
                        String(
                            adminName ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                keyword
                            )
                    );
                }
            );
    }

    renderTransparencyLogs(
        filtered
    );
}

function filterTransparencyLogs() {
    searchTransparencyLogs();
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    const date =
        new Date(
            dateValue
        );

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

function formatDateTime(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    const date =
        new Date(
            dateValue
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function getDocumentIcon(category) {
    switch (category) {
        case "Financial Report":
            return "📊";

        case "Budget Document":
            return "💰";

        case "Receipt":
            return "🧾";

        case "Project Document":
            return "🏗️";

        case "Contract":
            return "📑";

        case "OCR Record":
            return "🔍";

        default:
            return "📄";
    }
}

function getLogIcon(module) {
    switch (module) {
        case "Projects":
            return "🏗️";

        case "Documents":
            return "📄";

        case "Expenses":
            return "💰";

        case "Feedback":
            return "📢";

        case "Budget":
            return "📊";

        case "Users":
            return "👥";

        case "Documents/OCR":
            return "🔍";

        default:
            return "📋";
    }
}

function formatPeso(value) {
    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {
        return "₱0.00";
    }

    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(
        number
    );
}

function validateDocumentURL(value) {
    try {
        const url =
            new URL(
                value,
                window.location.origin
            );

        if (
            url.protocol !==
                "http:" &&
            url.protocol !==
                "https:"
        ) {
            throw new Error(
                "Invalid document URL."
            );
        }

        return url.href;
    } catch (error) {
        throw new Error(
            "The stored document link is invalid."
        );
    }
}

function escapeHTML(value) {
    return String(
        value ?? ""
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

function escapeAttribute(value) {
    return escapeHTML(
        value
    );
}