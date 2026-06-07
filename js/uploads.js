let expensesData = [];

async function loadExpensesForOCR() {
    const response = await fetch("../data/expenses.json");
    expensesData = await response.json();
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
    const loggedIn = await isUserLoggedIn();

    if (!loggedIn) {
        redirectToLogin();
        return;
    }

    const fileInput = document.getElementById("ocrFile");
    const progressBox = document.getElementById("ocrProgress");
    const resultBox = document.getElementById("ocrResult");

    if (!fileInput.files[0]) {
        alert("Please upload a receipt image first.");
        return;
    }

    const file = fileInput.files[0];

    progressBox.innerHTML = "Starting OCR...";
    resultBox.innerHTML = "";

    const result = await Tesseract.recognize(
        file,
        "eng",
        {
            logger: message => {
                if (message.status === "recognizing text") {
                    progressBox.innerHTML =
                        "OCR Progress: " + Math.round(message.progress * 100) + "%";
                }
            }
        }
    );

    const extractedText = result.data.text;
    const confidence = result.data.confidence;

    const extractedAmount = extractAmount(extractedText);
    const detectedVendor = extractVendor(extractedText);

    const validation = validateOCRResult(
        extractedText,
        extractedAmount,
        detectedVendor,
        confidence
    );

    resultBox.innerHTML = `
        <div class="ocr-summary ${validation.className}">
            <h4>${validation.status}</h4>
            <p>${validation.message}</p>
        </div>

        <div class="ocr-details">
            <p><b>File:</b> ${file.name}</p>
            <p><b>Detected Vendor:</b> ${detectedVendor}</p>
            <p><b>Detected Amount:</b> ${extractedAmount ? formatPeso(extractedAmount) : "Not detected"}</p>
            <p><b>OCR Confidence:</b> ${confidence.toFixed(2)}%</p>
        </div>

        <h4>Extracted Text</h4>
        <pre class="ocr-text">${extractedText}</pre>
    `;

    progressBox.innerHTML = "OCR analysis completed.";
}

function extractAmount(text) {
    const amountPattern = /(?:₱|PHP)?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g;
    const matches = [...text.matchAll(amountPattern)];

    if (matches.length === 0) return null;

    const amounts = matches.map(match =>
        Number(match[1].replaceAll(",", ""))
    );

    return Math.max(...amounts);
}

function extractVendor(text) {
    const lines = text
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

    const matchedExpense = expensesData.find(expense => {
        const vendorMatch =
            text.toLowerCase().includes(expense.vendor.toLowerCase()) ||
            vendor.toLowerCase().includes(expense.vendor.toLowerCase());

        const amountMatch =
            amount && Number(expense.amount) === Number(amount);

        return vendorMatch || amountMatch;
    });

    if (matchedExpense) {
        return {
            status: "Validated Expense",
            message: `Matched with expense record: ${matchedExpense.description}.`,
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

loadExpensesForOCR();