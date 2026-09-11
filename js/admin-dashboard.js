/* =========================================================
   KATIN-AWAN
   ADMIN DASHBOARD
   ========================================================= */

let dashboardProjects = [];
let dashboardUsers = [];
let dashboardFeedback = [];
let dashboardOcrRecords = [];
let dashboardBarangays = [];
let dashboardOrganizations = [];

let statusChartInstance = null;
let contractorChartInstance = null;


/* =========================================================
   INITIAL LOAD
   ========================================================= */

async function loadAdminDashboardStats() {

    await Promise.all([
        loadTotalUsers(),
        loadTotalProjects(),
        loadPendingFeedback(),
        loadOcrReviews(),
        loadContractorAnalytics(),
        loadResidentAnalytics()
    ]);

}


/* =========================================================
   TOTAL USERS
   ========================================================= */

async function loadTotalUsers() {

    const el =
        document.getElementById("adminTotalUsers");

    if (!el) return;

    const { count, error } =
        await supabaseClient
            .from("profiles")
            .select("*", {
                count: "exact",
                head: true
            });

    el.textContent =
        error ? "0" : (count || 0);

}


/* =========================================================
   TOTAL PROJECTS
   ========================================================= */

async function loadTotalProjects() {

    const el =
        document.getElementById("adminTotalProjects");

    if (!el) return;

    const { count, error } =
        await supabaseClient
            .from("projects")
            .select("*", {
                count: "exact",
                head: true
            });

    el.textContent =
        error ? "0" : (count || 0);

}


/* =========================================================
   PENDING FEEDBACK
   ========================================================= */

async function loadPendingFeedback() {

    const el =
        document.getElementById("adminPendingFeedback");

    if (!el) return;

    const { count, error } =
        await supabaseClient
            .from("feedback")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("status", "Pending");

    el.textContent =
        error ? "0" : (count || 0);

}


/* =========================================================
   OCR REVIEWS
   ========================================================= */

async function loadOcrReviews() {

    const el =
        document.getElementById("adminOcrReviews");

    if (!el) return;

    const { count, error } =
        await supabaseClient
            .from("ocr_records")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("review_status", "Pending");

    el.textContent =
        error ? "0" : (count || 0);

}


/* =========================================================
   PROJECT + CONTRACTOR ANALYTICS
   ========================================================= */

async function loadContractorAnalytics() {

    const el =
        document.getElementById(
            "adminContractorAnalytics"
        );

    if (!el) return;

    const {
        data: projects,
        error
    } = await supabaseClient
        .from("projects")
        .select(
            "id, title, contractor, status, progress"
        );

    if (error || !projects) {

        console.error(
            "Project analytics error:",
            error
        );

        el.innerHTML =
            "<p>No project analytics data available.</p>";

        loadKPI([]);
        renderCharts([]);
        generateInsights([]);

        return;
    }

    dashboardProjects = projects;

    loadKPI(projects);

    if (projects.length === 0) {

        el.innerHTML =
            "<p>No project data available.</p>";

        renderCharts([]);
        generateInsights([]);

        return;
    }


    const contractorMap = {};


    projects.forEach(project => {

        const contractor =
            project.contractor &&
            String(project.contractor).trim()
                ? String(project.contractor).trim()
                : "Unassigned";


        if (!contractorMap[contractor]) {

            contractorMap[contractor] = {
                name: contractor,
                total: 0,
                completed: 0
            };

        }


        contractorMap[contractor].total++;


        if (
            String(project.status || "")
                .toLowerCase()
                .trim() === "completed"
        ) {

            contractorMap[contractor].completed++;

        }

    });


    const result =
        Object.values(contractorMap);


    /* -----------------------------------------------------
       TOP CONTRACTOR
       ----------------------------------------------------- */

    const valid =
        result.filter(
            contractor =>
                contractor.name !== "Unassigned"
        );


    let top = null;


    if (valid.length > 0) {

        top =
            [...valid].sort((a, b) => {

                const aRate =
                    a.total > 0
                        ? a.completed / a.total
                        : 0;

                const bRate =
                    b.total > 0
                        ? b.completed / b.total
                        : 0;

                return bRate - aRate;

            })[0];

    }


    const topContractorEl =
        document.getElementById(
            "topContractor"
        );


    if (topContractorEl) {

        topContractorEl.textContent =
            top
                ? top.name
                : "No Data";

    }


    /* -----------------------------------------------------
       CONTRACTOR PERFORMANCE TABLE
       ----------------------------------------------------- */

    const getPerfBadge = rate => {

        if (rate >= 80) {

            return `
                <span class="perf-badge excellent">
                    Excellent
                </span>
            `;

        }

        if (rate >= 60) {

            return `
                <span class="perf-badge good">
                    Good
                </span>
            `;

        }

        if (rate >= 40) {

            return `
                <span class="perf-badge average">
                    Average
                </span>
            `;

        }

        return `
            <span class="perf-badge poor">
                Poor
            </span>
        `;

    };


    const tableHtml = `

        <div class="contractor-table-wrapper">

            <table class="contractor-table">

                <thead>

                    <tr>

                        <th>
                            Contractor
                        </th>

                        <th>
                            Total Projects
                        </th>

                        <th>
                            Completed
                        </th>

                        <th>
                            Performance
                        </th>

                    </tr>

                </thead>

                <tbody>

                    ${
                        result.length === 0

                        ? `
                            <tr>
                                <td colspan="4">
                                    No contractor data available.
                                </td>
                            </tr>
                        `

                        :

                        result.map(contractor => {

                            const rate =
                                contractor.total > 0
                                    ? (
                                        contractor.completed /
                                        contractor.total *
                                        100
                                    ).toFixed(1)
                                    : "0.0";


                            return `

                                <tr>

                                    <td>

                                        <strong>
                                            ${escapeDashboardHTML(
                                                contractor.name
                                            )}
                                        </strong>

                                    </td>

                                    <td>
                                        ${contractor.total}
                                    </td>

                                    <td>
                                        ${contractor.completed}
                                    </td>

                                    <td>

                                        ${getPerfBadge(
                                            parseFloat(rate)
                                        )}

                                        ${rate}%

                                    </td>

                                </tr>

                            `;

                        }).join("")

                    }

                </tbody>

            </table>

        </div>

    `;


    el.innerHTML = tableHtml;

    renderCharts(projects);

    generateInsights(projects);

}


/* =========================================================
   PROJECT KPI
   ========================================================= */

function loadKPI(projects) {

    const total =
        projects.length;


    const completed =
        projects.filter(project =>
            String(project.status || "")
                .toLowerCase()
                .trim() === "completed"
        ).length;


    const ongoing =
        projects.filter(project =>
            String(project.status || "")
                .toLowerCase()
                .trim() === "ongoing"
        ).length;


    const rate =
        total > 0
            ? (
                completed /
                total *
                100
            ).toFixed(1)
            : "0.0";


    setText(
        "kpiTotal",
        total
    );

    setText(
        "kpiCompleted",
        completed
    );

    setText(
        "kpiOngoing",
        ongoing
    );

    setText(
        "kpiRate",
        rate + "%"
    );

}


/* =========================================================
   PROJECT CHARTS
   ========================================================= */

function renderCharts(projects) {

    const statusCount = {
        Planned: 0,
        Ongoing: 0,
        Completed: 0
    };


    const contractorMap = {};


    projects.forEach(project => {

        const rawStatus =
            String(project.status || "")
                .trim();


        const normalizedStatus =
            rawStatus.toLowerCase();


        let statusLabel =
            rawStatus || "Unknown";


        if (
            normalizedStatus === "planned"
        ) {

            statusLabel = "Planned";

        }
        else if (
            normalizedStatus === "ongoing"
        ) {

            statusLabel = "Ongoing";

        }
        else if (
            normalizedStatus === "completed"
        ) {

            statusLabel = "Completed";

        }


        statusCount[statusLabel] =
            (statusCount[statusLabel] || 0) + 1;


        const contractor =
            project.contractor &&
            String(project.contractor).trim()
                ? String(project.contractor).trim()
                : "Unassigned";


        contractorMap[contractor] =
            (contractorMap[contractor] || 0) + 1;

    });


    /* -----------------------------------------------------
       DESTROY PREVIOUS CHARTS
       ----------------------------------------------------- */

    if (statusChartInstance) {

        statusChartInstance.destroy();

        statusChartInstance = null;

    }


    if (contractorChartInstance) {

        contractorChartInstance.destroy();

        contractorChartInstance = null;

    }


    const statusCanvas =
        document.getElementById(
            "statusChart"
        );


    const contractorCanvas =
        document.getElementById(
            "contractorChart"
        );


    /* -----------------------------------------------------
       STATUS CHART
       ----------------------------------------------------- */

    if (statusCanvas) {

        statusChartInstance =
            new Chart(
                statusCanvas,
                {
                    type: "doughnut",

                    data: {

                        labels:
                            Object.keys(
                                statusCount
                            ),

                        datasets: [
                            {
                                data:
                                    Object.values(
                                        statusCount
                                    ),

                                backgroundColor: [
                                    "#f59e0b",
                                    "#3b82f6",
                                    "#22c55e"
                                ],

                                borderWidth: 0,

                                hoverOffset: 8
                            }
                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        plugins: {

                            legend: {

                                position:
                                    "bottom",

                                labels: {

                                    padding: 12,

                                    usePointStyle:
                                        true,

                                    font: {

                                        size: 10,

                                        weight:
                                            "600"

                                    }

                                }

                            }

                        }

                    }

                }
            );

    }


    /* -----------------------------------------------------
       CONTRACTOR CHART
       ----------------------------------------------------- */

    if (contractorCanvas) {

        contractorChartInstance =
            new Chart(
                contractorCanvas,
                {
                    type: "bar",

                    data: {

                        labels:
                            Object.keys(
                                contractorMap
                            ),

                        datasets: [
                            {

                                label:
                                    "Projects",

                                data:
                                    Object.values(
                                        contractorMap
                                    ),

                                backgroundColor:
                                    "rgba(37, 99, 235, 0.8)",

                                borderColor:
                                    "#2563eb",

                                borderWidth: 1,

                                borderRadius: 6,

                                hoverBackgroundColor:
                                    "#1d4ed8"

                            }
                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false,

                        plugins: {

                            legend: {

                                display:
                                    false

                            }

                        },

                        scales: {

                            y: {

                                beginAtZero:
                                    true,

                                ticks: {

                                    stepSize:
                                        1,

                                    font: {
                                        size: 10
                                    }

                                },

                                grid: {
                                    color:
                                        "#e5eaf2"
                                }

                            },

                            x: {

                                ticks: {

                                    font: {
                                        size: 10
                                    }

                                },

                                grid: {
                                    display:
                                        false
                                }

                            }

                        }

                    }

                }
            );

    }

}


/* =========================================================
   PROJECT INSIGHTS
   ========================================================= */

function generateInsights(projects) {

    const total =
        projects.length;


    const completed =
        projects.filter(project =>
            String(project.status || "")
                .toLowerCase()
                .trim() === "completed"
        ).length;


    const ongoing =
        projects.filter(project =>
            String(project.status || "")
                .toLowerCase()
                .trim() === "ongoing"
        ).length;


    const planned =
        projects.filter(project =>
            String(project.status || "")
                .toLowerCase()
                .trim() === "planned"
        ).length;


    const completionRate =
        total > 0
            ? (
                completed /
                total *
                100
            ).toFixed(1)
            : "0.0";


    let insightText = "";


    if (total === 0) {

        insightText =
            "No project records are currently available.";

    }
    else if (
        parseFloat(completionRate) >= 70
    ) {

        insightText =
            `Great progress! ${completionRate}% of projects are completed.`;

    }
    else if (
        parseFloat(completionRate) >= 40
    ) {

        insightText =
            `The project completion rate is ${completionRate}%. `
            +
            `Focus on completing the remaining ongoing projects.`;

    }
    else {

        insightText =
            `${ongoing} projects are ongoing and `
            +
            `${planned} are planned. `
            +
            `Prioritize ongoing projects to improve the `
            +
            `${completionRate}% completion rate.`;

    }


    const el =
        document.getElementById(
            "insightBox"
        );


    if (el) {

        el.innerHTML = `

            <h4>
                💡 Key Insights
            </h4>

            <p>
                ${escapeDashboardHTML(
                    insightText
                )}
            </p>

        `;

    }

}


/* =========================================================
   RESIDENT & BARANGAY ANALYTICS
   ========================================================= */

async function loadResidentAnalytics() {

    const container =
        document.getElementById(
            "residentAnalyticsSection"
        );

    if (!container) return;


    /* -----------------------------------------------------
       LOAD PROFILES
       ----------------------------------------------------- */

    const {
        data: profiles,
        error: profilesError
    } = await supabaseClient
        .from("profiles")
        .select(`
            id,
            full_name,
            role,
            verification_status,
            age,
            gender,
            is_pwd,
            organization_id,
            barangay_id
        `);


    if (profilesError) {

        console.error(
            "Resident analytics error:",
            profilesError
        );

        renderResidentAnalyticsError(
            container
        );

        return;
    }


    dashboardUsers =
        profiles || [];


    /* -----------------------------------------------------
       LOAD BARANGAYS
       ----------------------------------------------------- */

    const {
        data: barangays,
        error: barangaysError
    } = await supabaseClient
        .from("barangays")
        .select(`
            id,
            name,
            organization_id,
            is_active
        `)
        .eq(
            "is_active",
            true
        )
        .order(
            "name",
            {
                ascending: true
            }
        );


    if (barangaysError) {

        console.error(
            "Barangay analytics error:",
            barangaysError
        );

        dashboardBarangays = [];

    }
    else {

        dashboardBarangays =
            barangays || [];

    }


    /* -----------------------------------------------------
       ONLY RESIDENT ACCOUNTS
       ----------------------------------------------------- */

    const residents =
        dashboardUsers.filter(
            user =>
                String(user.role || "")
                    .toLowerCase()
                    .trim() === "resident"
        );


    /* -----------------------------------------------------
       OVERALL SUMMARY
       ----------------------------------------------------- */

    const totalResidents =
        residents.length;


    const verifiedResidents =
        residents.filter(
            user =>
                normalizeStatus(
                    user.verification_status
                ) === "verified"
        ).length;


    const pendingResidents =
        residents.filter(
            user =>
                normalizeStatus(
                    user.verification_status
                ) === "pending"
        ).length;


    const rejectedResidents =
        residents.filter(
            user =>
                normalizeStatus(
                    user.verification_status
                ) === "rejected"
        ).length;


    /*
       Senior citizens are derived from age >= 60.
       We count verified residents for demographic
       reporting so unverified registrations are not
       treated as confirmed population.
    */

    const verifiedOnly =
        residents.filter(
            user =>
                normalizeStatus(
                    user.verification_status
                ) === "verified"
        );


    const seniorResidents =
        verifiedOnly.filter(
            user => {

                const age =
                    Number(user.age);

                return (
                    Number.isFinite(age) &&
                    age >= 60
                );

            }
        ).length;


    const pwdResidents =
        verifiedOnly.filter(
            user =>
                user.is_pwd === true
        ).length;


    /* -----------------------------------------------------
       UPDATE SUMMARY CARDS
       ----------------------------------------------------- */

    setText(
        "residentTotal",
        totalResidents
    );

    setText(
        "residentVerified",
        verifiedResidents
    );

    setText(
        "residentPending",
        pendingResidents
    );

    setText(
        "residentRejected",
        rejectedResidents
    );

    setText(
        "residentSenior",
        seniorResidents
    );

    setText(
        "residentPwd",
        pwdResidents
    );


    /* -----------------------------------------------------
       BARANGAY TABLE
       ----------------------------------------------------- */

    renderBarangaySummary(
        residents,
        dashboardBarangays
    );

}


/* =========================================================
   BARANGAY SUMMARY TABLE
   ========================================================= */

function renderBarangaySummary(
    residents,
    barangays
) {

    const container =
        document.getElementById(
            "barangayResidentSummary"
        );

    if (!container) return;


    if (
        !barangays ||
        barangays.length === 0
    ) {

        container.innerHTML = `

            <div class="resident-empty-state">
                No active barangays available.
            </div>

        `;

        return;
    }


    /*
       Only verified residents are included in
       demographic counts.

       Pending/rejected remain visible only in
       verification columns.
    */

    const rows =
        barangays.map(barangay => {

            const barangayResidents =
                residents.filter(
                    resident =>
                        resident.barangay_id ===
                        barangay.id
                );


            const total =
                barangayResidents.length;


            const verifiedResidents =
                barangayResidents.filter(
                    resident =>
                        normalizeStatus(
                            resident.verification_status
                        ) === "verified"
                );


            const verified =
                verifiedResidents.length;


            const pending =
                barangayResidents.filter(
                    resident =>
                        normalizeStatus(
                            resident.verification_status
                        ) === "pending"
                ).length;


            const rejected =
                barangayResidents.filter(
                    resident =>
                        normalizeStatus(
                            resident.verification_status
                        ) === "rejected"
                ).length;


            /* ---------------------------------------------
               SENIOR CITIZENS
               --------------------------------------------- */

            const seniors =
                verifiedResidents.filter(
                    resident => {

                        const age =
                            Number(
                                resident.age
                            );

                        return (
                            Number.isFinite(age) &&
                            age >= 60
                        );

                    }
                ).length;


            /* ---------------------------------------------
               PWD
               --------------------------------------------- */

            const pwd =
                verifiedResidents.filter(
                    resident =>
                        resident.is_pwd === true
                ).length;


            /* ---------------------------------------------
               GENDER
               --------------------------------------------- */

            const male =
                verifiedResidents.filter(
                    resident =>
                        String(
                            resident.gender || ""
                        ).trim() === "Male"
                ).length;


            const female =
                verifiedResidents.filter(
                    resident =>
                        String(
                            resident.gender || ""
                        ).trim() === "Female"
                ).length;


            return `

                <tr>

                    <td>

                        <strong>
                            ${escapeDashboardHTML(
                                barangay.name
                            )}
                        </strong>

                    </td>


                    <td>
                        ${total}
                    </td>


                    <td>
                        ${verified}
                    </td>


                    <td>
                        ${seniors}
                    </td>


                    <td>
                        ${pwd}
                    </td>


                    <td>
                        ${male}
                    </td>


                    <td>
                        ${female}
                    </td>


                    <td>
                        ${pending}
                    </td>


                    <td>
                        ${rejected}
                    </td>

                </tr>

            `;

        }).join("");


    container.innerHTML = `

        <div class="resident-table-wrapper">

            <table class="resident-barangay-table">

                <thead>

                    <tr>

                        <th>
                            Barangay
                        </th>

                        <th>
                            Residents
                        </th>

                        <th>
                            Verified
                        </th>

                        <th>
                            Senior Citizens
                        </th>

                        <th>
                            PWD
                        </th>

                        <th>
                            Male
                        </th>

                        <th>
                            Female
                        </th>

                        <th>
                            Pending
                        </th>

                        <th>
                            Rejected
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${rows}

                </tbody>

            </table>

        </div>

    `;

}


/* =========================================================
   RESIDENT ANALYTICS ERROR
   ========================================================= */

function renderResidentAnalyticsError(
    container
) {

    container.innerHTML = `

        <div class="resident-empty-state">

            Unable to load resident statistics.

        </div>

    `;


    setText(
        "residentTotal",
        "0"
    );

    setText(
        "residentVerified",
        "0"
    );

    setText(
        "residentPending",
        "0"
    );

    setText(
        "residentRejected",
        "0"
    );

    setText(
        "residentSenior",
        "0"
    );

    setText(
        "residentPwd",
        "0"
    );

}


/* =========================================================
   GLOBAL ADMIN SEARCH
   ========================================================= */

async function handleAdminGlobalSearch() {

    const input =
        document.getElementById(
            "adminGlobalSearch"
        );

    const results =
        document.getElementById(
            "adminGlobalSearchResults"
        );

    if (!input || !results) return;


    const keyword =
        input.value
            .trim()
            .toLowerCase();


    if (!keyword) {

        results.innerHTML = "";

        results.classList.remove(
            "active"
        );

        return;
    }


    results.innerHTML = `

        <div class="search-no-results">
            Searching Katin-awan...
        </div>

    `;

    results.classList.add(
        "active"
    );


    try {

        const [
            projectsResponse,
            expensesResponse,
            usersResponse,
            documentsResponse,
            feedbackResponse,
            ocrResponse,
            auditResponse
        ] = await Promise.all([

            supabaseClient
                .from("projects")
                .select(`
                    id,
                    title,
                    description,
                    category,
                    status,
                    contractor,
                    location
                `)
                .limit(100),

            supabaseClient
                .from("expenses")
                .select(`
                    id,
                    title,
                    category,
                    description,
                    status
                `)
                .limit(100),

            supabaseClient
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    role,
                    verification_status,
                    age,
                    gender
                `)
                .limit(100),

            supabaseClient
                .from("documents")
                .select(`
                    id,
                    title,
                    category,
                    description
                `)
                .limit(100),

            supabaseClient
                .from("feedback")
                .select(`
                    id,
                    subject,
                    description,
                    category,
                    status
                `)
                .limit(100),

            supabaseClient
                .from("ocr_records")
                .select(`
                    id,
                    file_name,
                    detected_vendor,
                    detected_amount,
                    status,
                    review_status
                `)
                .limit(100),

            supabaseClient
                .from("audit_logs")
                .select(`
                    id,
                    action,
                    module,
                    details,
                    admin_name
                `)
                .limit(100)

        ]);


        const matches = [];


        /* =================================================
           SYSTEM FEATURES
           ================================================= */

        const features = [

            {
                name: "Dashboard",
                description:
                    "Admin overview, analytics, resident statistics and map",
                keywords:
                    "dashboard overview analytics resident barangay statistics map",
                url:
                    "admin-dashboard.html"
            },

            {
                name: "Projects",
                description:
                    "Manage barangay projects and project information",
                keywords:
                    "projects project infrastructure contractor progress",
                url:
                    "admin-projects.html"
            },

            {
                name: "Budget",
                description:
                    "Monitor project budgets and approved spending",
                keywords:
                    "budget budgets allocation spending financial",
                url:
                    "admin-budget.html"
            },

            {
                name: "Expenses",
                description:
                    "Manage and review barangay expenses",
                keywords:
                    "expenses expense spending receipt approved flagged",
                url:
                    "admin-expenses.html"
            },

            {
                name: "Documents / OCR",
                description:
                    "Manage documents and review OCR records",
                keywords:
                    "documents document ocr receipt file records validation",
                url:
                    "admin-documents.html"
            },

            {
                name: "Map",
                description:
                    "View project locations and barangay map information",
                keywords:
                    "map location barangay project locations",
                url:
                    "admin-map.html"
            },

            {
                name: "Feedback",
                description:
                    "Review community feedback and responses",
                keywords:
                    "feedback complaints suggestions concerns review",
                url:
                    "admin-feedback.html"
            },

            {
                name: "Users / Resident Verification",
                description:
                    "Manage users and verify resident accounts",
                keywords:
                    "users residents resident verification verified pending rejected senior pwd",
                url:
                    "admin-users.html"
            },

            {
                name: "Audit Logs",
                description:
                    "Review administrator activity records",
                keywords:
                    "audit logs activity administrator actions security",
                url:
                    "admin-audit.html"
            }

        ];


        features.forEach(feature => {

            const text = [
                feature.name,
                feature.description,
                feature.keywords
            ]
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({
                    type:
                        "Feature",
                    title:
                        feature.name,
                    description:
                        feature.description,
                    url:
                        feature.url
                });

            }

        });


        /* =================================================
           PROJECTS
           ================================================= */

        (
            projectsResponse.data || []
        ).forEach(project => {

            const text = [

                project.title,
                project.description,
                project.category,
                project.status,
                project.contractor,
                project.location

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "Project",

                    title:
                        project.title ||
                        "Untitled Project",

                    description:
                        [
                            project.status,
                            project.category,
                            project.location
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "Project record",

                    url:
                        "admin-projects.html"

                });

            }

        });


        /* =================================================
           EXPENSES
           ================================================= */

        (
            expensesResponse.data || []
        ).forEach(expense => {

            const text = [

                expense.title,
                expense.category,
                expense.description,
                expense.status

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "Expense",

                    title:
                        expense.title ||
                        "Untitled Expense",

                    description:
                        [
                            expense.category,
                            expense.status
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "Expense record",

                    url:
                        "admin-expenses.html"

                });

            }

        });


        /* =================================================
           USERS / RESIDENTS
           ================================================= */

        (
            usersResponse.data || []
        ).forEach(user => {

            const text = [

                user.full_name,
                user.role,
                user.verification_status,
                user.gender,
                user.age

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "User",

                    title:
                        user.full_name ||
                        "Unnamed User",

                    description:
                        [
                            user.role,
                            user.verification_status,
                            user.gender
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "User record",

                    url:
                        "admin-users.html"

                });

            }

        });


        /* =================================================
           DOCUMENTS
           ================================================= */

        (
            documentsResponse.data || []
        ).forEach(document => {

            const text = [

                document.title,
                document.category,
                document.description

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "Document",

                    title:
                        document.title ||
                        "Untitled Document",

                    description:
                        [
                            document.category,
                            document.description
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "Document record",

                    url:
                        "admin-documents.html"

                });

            }

        });


        /* =================================================
           FEEDBACK
           ================================================= */

        (
            feedbackResponse.data || []
        ).forEach(feedback => {

            const text = [

                feedback.subject,
                feedback.description,
                feedback.category,
                feedback.status

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "Feedback",

                    title:
                        feedback.subject ||
                        "Untitled Feedback",

                    description:
                        [
                            feedback.category,
                            feedback.status
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "Feedback record",

                    url:
                        "admin-feedback.html"

                });

            }

        });


        /* =================================================
           OCR
           ================================================= */

        (
            ocrResponse.data || []
        ).forEach(ocr => {

            const text = [

                ocr.file_name,
                ocr.detected_vendor,
                ocr.detected_amount,
                ocr.status,
                ocr.review_status

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "OCR",

                    title:
                        ocr.file_name ||
                        "OCR Record",

                    description:
                        [
                            ocr.detected_vendor,
                            ocr.status,
                            ocr.review_status
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "OCR record",

                    url:
                        "admin-documents.html"

                });

            }

        });


        /* =================================================
           AUDIT LOGS
           ================================================= */

        (
            auditResponse.data || []
        ).forEach(log => {

            const text = [

                log.action,
                log.module,
                log.details,
                log.admin_name

            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            if (
                text.includes(keyword)
            ) {

                matches.push({

                    type:
                        "Audit Log",

                    title:
                        log.action ||
                        "Audit Activity",

                    description:
                        [
                            log.module,
                            log.admin_name
                        ]
                            .filter(Boolean)
                            .join(" • ") ||
                        "Audit record",

                    url:
                        "admin-audit.html"

                });

            }

        });


        /* =================================================
           RESULTS
           ================================================= */

        if (
            matches.length === 0
        ) {

            results.innerHTML = `

                <div class="search-no-results">

                    No matching Katin-awan
                    records or features found.

                </div>

            `;

            return;
        }


        results.innerHTML =
            `

                <div class="search-results-header">

                    ${matches.length}
                    result${matches.length !== 1 ? "s" : ""}
                    found

                </div>

            `

            +

            matches
                .slice(0, 25)
                .map(match => `

                    <div
                        class="search-result-item"
                        onclick="window.location.href='${escapeAttribute(
                            match.url
                        )}'"
                    >

                        <h4>

                            <span class="result-type">

                                ${escapeDashboardHTML(
                                    match.type
                                )}

                            </span>

                            ${escapeDashboardHTML(
                                match.title
                            )}

                        </h4>

                        <p>

                            ${escapeDashboardHTML(
                                match.description
                            )}

                        </p>

                    </div>

                `)
                .join("");


    }
    catch (error) {

        console.error(
            "Global search error:",
            error
        );


        results.innerHTML = `

            <div class="search-no-results">

                Search could not be completed.

            </div>

        `;

    }

}


/* =========================================================
   CLOSE SEARCH RESULTS
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const searchSection =
            document.querySelector(
                ".search-bar-section"
            );


        const results =
            document.getElementById(
                "adminGlobalSearchResults"
            );


        if (
            searchSection &&
            results &&
            !searchSection.contains(
                event.target
            )
        ) {

            results.classList.remove(
                "active"
            );

        }

    }
);


/* =========================================================
   SEARCH KEYBOARD SUPPORT
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {
            return;
        }


        const results =
            document.getElementById(
                "adminGlobalSearchResults"
            );


        if (results) {

            results.classList.remove(
                "active"
            );

        }

    }
);


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeStatus(value) {

    return String(
        value || ""
    )
        .toLowerCase()
        .trim();

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


function escapeDashboardHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );

}


/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadAdminDashboardStats();

    }
);