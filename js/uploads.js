// js/uploads.js

let expensesData = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadExpensesForOCR();
    await loadOCRHistory();
});

async function loadExpensesForOCR() {
    const { data, error } = await supabaseClient.from("expenses").select("*");
    expensesData = error ? [] : data || [];
}

async function isUserLoggedIn() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session !== null;
}

function redirectToLogin() {
    alert("Please log in first before using this feature.");
    window.location.href = "login.html?redirect=uploads.html";
}

async function runOCR() {
    if (!(await isUserLoggedIn())) {
        redirectToLogin();
        return;
    }

    const fileInput = document.getElementById("ocrFile");
    const progressBox = document.getElementById("ocrProgress");
    const resultBox = document.getElementById("ocrResult");

    if (!fileInput.files[0]) {
        alert("Please upload a file first.");
        return;
    }

    const file = fileInput.files[0];
    const isImage = file.type.startsWith("image/");
    const fileType = getFileType(file);

    progressBox.innerHTML = "Uploading original file...";
    resultBox.innerHTML = "";

    try {
        const originalUpload = await uploadFileToStorage(file, "ocr_originals");

        let extractedText = "";
        let confidence = 0;
        let extractedAmount = null;
        let detectedVendor = "Not scanned";
        let ocrPdfUrl = "";

        let validation = {
            status: "Needs Admin Review",
            message: "File uploaded successfully. Admin can review/download this document.",
            className: "ocr-warning"
        };

        if (isImage) {
            progressBox.innerHTML = "Running OCR on image...";

            const result = await Tesseract.recognize(file, "eng", {
                logger: message => {
                    if (message.status === "recognizing text") {
                        progressBox.innerHTML =
                            "OCR Progress: " + Math.round(message.progress * 100) + "%";
                    }
                }
            });

            extractedText = result.data.text || "";
            confidence = Number(result.data.confidence || 0);
            extractedAmount = extractAmount(extractedText);
            detectedVendor = extractVendor(extractedText);

            validation = validateOCRResult(
                extractedText,
                extractedAmount,
                detectedVendor,
                confidence
            );

            if (extractedText.trim()) {
                const pdfFile = createOCRPDF({
                    title: "OCR Extracted Text Report",
                    fileName: file.name,
                    fileType,
                    vendor: detectedVendor,
                    amount: extractedAmount,
                    confidence,
                    status: validation.status,
                    text: extractedText
                });

                const pdfUpload = await uploadFileToStorage(pdfFile, "ocr_pdfs");
                ocrPdfUrl = pdfUpload.publicUrl;
            }
        }

        await saveOCRRecord({
            fileName: file.name,
            fileUrl: originalUpload.publicUrl,
            fileType,
            extractedText,
            ocrPdfUrl,
            vendor: detectedVendor,
            amount: extractedAmount,
            confidence,
            validation
        });

        resultBox.innerHTML = buildOCRResultHTML({
            fileName: file.name,
            fileType,
            fileUrl: originalUpload.publicUrl,
            ocrPdfUrl,
            vendor: detectedVendor,
            amount: extractedAmount,
            confidence,
            displayText: extractedText || "No automatic OCR text extracted. Original file is saved for admin review.",
            validation,
            isCorrected: false
        });

        await loadOCRHistory();

        progressBox.innerHTML = isImage
            ? "Upload, OCR, and PDF generation completed."
            : "File uploaded. Admin review required.";

        fileInput.value = "";

    } catch (error) {
        console.error(error);
        progressBox.innerHTML = "Upload/OCR failed: " + error.message;
    }
}

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

async function saveOCRRecord(record) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient
        .from("ocr_records")
        .insert([{
            user_id: user ? user.id : null,
            file_name: record.fileName,
            file_url: record.fileUrl,
            file_type: record.fileType,
            extracted_text: record.extractedText,
            corrected_text: null,
            ocr_pdf_url: record.ocrPdfUrl,
            corrected_pdf_url: null,
            detected_vendor: record.vendor,
            detected_amount: record.amount,
            confidence: record.confidence,
            status: record.validation.status,
            message: record.validation.message
        }]);

    if (error) throw new Error(error.message);
}

async function loadOCRHistory() {
    const historyBox = document.querySelector(".ocr-history");
    if (!historyBox) return;

    const { data, error } = await supabaseClient
        .from("ocr_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);

    if (error) {
        historyBox.innerHTML = `<div class="document-card"><p>${escapeHTML(error.message)}</p></div>`;
        return;
    }

    if (!data || data.length === 0) {
        historyBox.innerHTML = `
            <div class="document-card">
                <div class="doc-icon">📄</div>
                <div>
                    <h3>No uploaded records yet</h3>
                    <p>Uploaded documents and OCR results will appear here.</p>
                    <span>Empty</span>
                </div>
            </div>
        `;
        return;
    }

    historyBox.innerHTML = data.map(record => {
        const status = record.status || "Pending";
        const icon = status.includes("Valid") ? "✅" : "⚠️";

        return `
            <div class="document-card">
                <div class="doc-icon">${icon}</div>
                <div>
                    <h3>${escapeHTML(record.file_name || "Uploaded Document")}</h3>
                    <p>Type: ${escapeHTML(record.file_type || "Unknown")}</p>
                    <p>Confidence: ${Number(record.confidence || 0).toFixed(2)}%</p>
                    <span>${escapeHTML(status)}</span>
                </div>
                <button onclick="viewOCRDetails(${record.id})">Details</button>
            </div>
        `;
    }).join("");
}

async function viewOCRDetails(id) {
    const { data, error } = await supabaseClient
        .from("ocr_records")
        .select("*")
        .eq("id", Number(id))
        .single();

    if (error) {
        alert("Could not load details.");
        return;
    }

    const displayText = data.corrected_text || data.extracted_text || "No OCR text extracted. Original file is available for review.";
    const isCorrected = Boolean(data.corrected_text);

    document.getElementById("ocrResult").innerHTML = buildOCRResultHTML({
        fileName: data.file_name || "Uploaded Document",
        fileType: data.file_type || "Unknown",
        fileUrl: data.file_url || "",
        ocrPdfUrl: data.ocr_pdf_url || "",
        correctedPdfUrl: data.corrected_pdf_url || "",
        vendor: data.detected_vendor || "Unknown",
        amount: data.detected_amount,
        confidence: data.confidence,
        displayText,
        validation: {
            status: data.status || "Pending",
            message: data.message || "No validation message.",
            className: getOCRStatusClass(data.status)
        },
        isCorrected
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildOCRResultHTML(info) {
    return `
        <div class="ocr-summary ${info.validation.className}">
            <h4>${escapeHTML(info.validation.status)}</h4>
            <p>${escapeHTML(info.validation.message)}</p>
        </div>

        <div class="ocr-details">
            <p><b>File:</b> ${escapeHTML(info.fileName)}</p>
            <p><b>File Type:</b> ${escapeHTML(info.fileType)}</p>
            ${info.fileUrl ? `<p><b>Original File:</b> <a href="${escapeHTML(info.fileUrl)}" target="_blank">View / Download</a></p>` : ""}
            ${info.ocrPdfUrl ? `<p><b>OCR PDF:</b> <a href="${escapeHTML(info.ocrPdfUrl)}" target="_blank">Download OCR PDF</a></p>` : ""}
            ${info.correctedPdfUrl ? `<p><b>Corrected PDF:</b> <a href="${escapeHTML(info.correctedPdfUrl)}" target="_blank">Download Corrected PDF</a></p>` : ""}
            <p><b>Detected Vendor:</b> ${escapeHTML(info.vendor)}</p>
            <p><b>Detected Amount:</b> ${info.amount ? formatPeso(info.amount) : "Not detected"}</p>
            <p><b>OCR Confidence:</b> ${Number(info.confidence || 0).toFixed(2)}%</p>
            ${info.isCorrected ? `<p><b>Text Version:</b> Admin-corrected text</p>` : ""}
        </div>

        <h4>${info.isCorrected ? "Corrected Text" : "Extracted Text"}</h4>
        <pre class="ocr-text">${escapeHTML(info.displayText || "No text available.")}</pre>
    `;
}

function createOCRPDF(info) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(info.title, 15, 20);

    doc.setFontSize(10);
    doc.text(`File: ${info.fileName}`, 15, 32);
    doc.text(`File Type: ${info.fileType}`, 15, 39);
    doc.text(`Detected Vendor: ${info.vendor || "N/A"}`, 15, 46);
    doc.text(`Detected Amount: ${info.amount ? formatPeso(info.amount) : "Not detected"}`, 15, 53);
    doc.text(`OCR Confidence: ${Number(info.confidence || 0).toFixed(2)}%`, 15, 60);
    doc.text(`Status: ${info.status}`, 15, 67);

    doc.setFontSize(12);
    doc.text("Extracted Text:", 15, 80);

    const lines = doc.splitTextToSize(info.text || "No text extracted.", 180);
    doc.setFontSize(10);

    let y = 90;
    lines.forEach(line => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        doc.text(line, 15, y);
        y += 6;
    });

    const fileName = makeBaseName(info.fileName) + "_OCR_Report.pdf";
    const blob = doc.output("blob");

    return new File([blob], fileName, { type: "application/pdf" });
}

function makeBaseName(fileName) {
    return fileName.replace(/\.[^/.]+$/, "").replaceAll(" ", "_");
}

function extractAmount(text) {
    const amountPattern = /(?:₱|PHP)?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g;
    const matches = [...String(text || "").matchAll(amountPattern)];

    if (matches.length === 0) return null;

    const amounts = matches.map(match => Number(match[1].replaceAll(",", "")));
    return Math.max(...amounts);
}

function extractVendor(text) {
    const lines = String(text || "")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 2);

    return lines[0] || "Unknown Vendor";
}

function validateOCRResult(text, amount, vendor, confidence) {
    if (confidence < 60) {
        return {
            status: "Flagged for Review",
            message: "OCR confidence is low. Manual checking is required.",
            className: "ocr-flagged"
        };
    }

    const cleanText = String(text || "").toLowerCase();
    const cleanVendor = String(vendor || "").toLowerCase();

    const matchedExpense = expensesData.find(expense => {
        const vendorName = expense.vendor || expense.title || "";
        const expenseAmount = Number(expense.amount || 0);

        const vendorMatch =
            vendorName &&
            (cleanText.includes(vendorName.toLowerCase()) ||
             cleanVendor.includes(vendorName.toLowerCase()));

        const amountMatch = amount && expenseAmount === Number(amount);

        return vendorMatch || amountMatch;
    });

    if (matchedExpense) {
        return {
            status: "Validated Expense",
            message: `Matched with expense record: ${matchedExpense.description || matchedExpense.title || "Existing expense"}.`,
            className: "ocr-valid"
        };
    }

    if (confidence >= 80 && amount) {
        return {
            status: "Needs Admin Review",
            message: "Text was extracted successfully, but no exact expense record match was found.",
            className: "ocr-warning"
        };
    }

    return {
        status: "Flagged for Review",
        message: "The document could not be confidently matched with existing expense records.",
        className: "ocr-flagged"
    };
}

function getFileType(file) {
    const name = file.name.toLowerCase();

    if (file.type.startsWith("image/")) return "Image Document";
    if (name.endsWith(".pdf")) return "PDF Document";
    if (name.endsWith(".doc") || name.endsWith(".docx")) return "Word Document";
    if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "Excel Document";

    return "Document";
}

function getOCRStatusClass(status) {
    if (String(status || "").includes("Valid")) return "ocr-valid";
    if (String(status || "").includes("Review")) return "ocr-warning";
    return "ocr-flagged";
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