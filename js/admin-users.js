// js/admin-users.js

let usersList = [];
let filteredUsers = [];

let verificationUsers = [];
let filteredVerificationUsers = [];


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await loadAdminProfile();

        await loadUsers();

        await loadVerificationUsers();

    }
);


// =====================================================
// ADMIN PROFILE
// =====================================================

async function loadAdminProfile() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    if (!user) return;

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

    if (error) {

        console.warn(
            "Profile load failed:",
            error.message
        );

        return;
    }

    const input =
        document.getElementById(
            "adminDisplayName"
        );

    if (input) {

        input.value =
            data?.full_name || "";

    }

}


// =====================================================
// SAVE ADMIN DISPLAY NAME
// =====================================================

async function saveAdminDisplayName() {

    const input =
        document.getElementById(
            "adminDisplayName"
        );

    if (!input) return;

    const name =
        input.value.trim();

    if (!name) {

        alert(
            "Please enter your display name."
        );

        return;
    }

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    if (!user) {

        alert(
            "You must be logged in."
        );

        return;
    }

    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            full_name: name
        })
        .eq("id", user.id);

    if (error) {

        alert(
            "Failed to save profile: " +
            error.message
        );

        return;
    }

    await supabaseClient
        .from("audit_logs")
        .update({
            admin_name: name
        })
        .eq("user_id", user.id)
        .or(
            "admin_name.is.null,admin_name.eq.Administrator"
        );

    alert(
        "Admin display name saved. " +
        "Future logs will show: " +
        name
    );

}


// =====================================================
// LOAD ALL USERS
// =====================================================

async function loadUsers() {

    const container =
        document.getElementById(
            "usersContainer"
        );

    if (!container) return;

    container.innerHTML = `
        <div class="document-card">
            <div>
                <h3>Loading users...</h3>
                <p>Please wait while user records are loaded.</p>
            </div>
        </div>
    `;


    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        container.innerHTML =
            `
            <p style="color:red;">
                Failed to load users:
                ${escapeHTML(error.message)}
            </p>
            `;

        console.error(
            "Users loading error:",
            error
        );

        return;
    }


    /*
     * Load readable organization and barangay names.
     *
     * We do NOT hard-code Bogo City or any barangay.
     * Names come directly from the database.
     */

    const organizationIds = [
        ...new Set(
            (data || [])
                .map(
                    user =>
                        user.organization_id
                )
                .filter(Boolean)
        )
    ];


    const barangayIds = [
        ...new Set(
            (data || [])
                .map(
                    user =>
                        user.barangay_id
                )
                .filter(Boolean)
        )
    ];


    let organizationMap = {};
    let barangayMap = {};


    // =================================================
    // LOAD ORGANIZATIONS
    // =================================================

    if (
        organizationIds.length > 0
    ) {

        const {
            data: organizations,
            error: organizationError
        } = await supabaseClient
            .from("organizations")
            .select(
                "id, name, type"
            )
            .in(
                "id",
                organizationIds
            );


        if (organizationError) {

            console.error(
                "Organization loading error:",
                organizationError.message
            );

        } else {

            (
                organizations || []
            ).forEach(
                organization => {

                    organizationMap[
                        organization.id
                    ] = organization;

                }
            );

        }

    }


    // =================================================
    // LOAD BARANGAYS
    // =================================================

    if (
        barangayIds.length > 0
    ) {

        const {
            data: barangays,
            error: barangayError
        } = await supabaseClient
            .from("barangays")
            .select(
                "id, name, organization_id"
            )
            .in(
                "id",
                barangayIds
            );


        if (barangayError) {

            console.error(
                "Barangay loading error:",
                barangayError.message
            );

        } else {

            (
                barangays || []
            ).forEach(
                barangay => {

                    barangayMap[
                        barangay.id
                    ] = barangay;

                }
            );

        }

    }


    // =================================================
    // ATTACH READABLE LOCATION NAMES
    // =================================================

    usersList =
        (data || []).map(
            user => {

                const organization =
                    organizationMap[
                        user.organization_id
                    ];


                const barangay =
                    barangayMap[
                        user.barangay_id
                    ];


                return {

                    ...user,

                    organization_name:
                        organization?.name ||
                        null,

                    organization_type:
                        organization?.type ||
                        null,

                    barangay_name:
                        barangay?.name ||
                        null

                };

            }
        );


    filteredUsers =
        [...usersList];


    renderUsers(
        filteredUsers
    );


    updateUserSummary(
        usersList
    );

}


// =====================================================
// LOAD VERIFICATION USERS
// =====================================================

async function loadVerificationUsers() {

    const container =
        document.getElementById(
            "verificationContainer"
        );

    if (!container) return;


    container.innerHTML = `
        <div class="document-card">
            <div>
                <h3>Loading verification records...</h3>
                <p>Please wait.</p>
            </div>
        </div>
    `;


    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
  .select(`
    id,
    full_name,
    role,
    organization_id,
    barangay_id,
    purok_id,
    verification_status,
    gender,
    age,
    is_pwd,
    region,
    province,
    city_municipality,
    street_address,
    verified_by,
    verified_at,
    rejection_reason,
    created_at
`)
        .eq(
            "role",
            "resident"
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {

        container.innerHTML =
            `
            <p style="color:red;">
                Failed to load verification records:
                ${escapeHTML(error.message)}
            </p>
            `;

        console.error(
            "Verification loading error:",
            error
        );

        return;
    }


    verificationUsers =
        data || [];


    // =================================================
    // LOAD BARANGAY NAMES
    // =================================================

    const barangayIds = [
        ...new Set(
            verificationUsers
                .map(
                    user =>
                        user.barangay_id
                )
                .filter(Boolean)
        )
    ];


    let barangayMap = {};


    if (
        barangayIds.length > 0
    ) {

        const {
            data: barangays,
            error: barangayError
        } = await supabaseClient
            .from("barangays")
            .select(
                "id, name, organization_id"
            )
            .in(
                "id",
                barangayIds
            );


        if (barangayError) {

            console.error(
                "Barangay loading error:",
                barangayError.message
            );

        } else {

            (
                barangays || []
            ).forEach(
                barangay => {

                    barangayMap[
                        barangay.id
                    ] = barangay;

                }
            );

        }

    }


    // =================================================
    // LOAD ORGANIZATION NAMES
    // =================================================

    const organizationIds = [
        ...new Set(
            verificationUsers
                .map(
                    user =>
                        user.organization_id
                )
                .filter(Boolean)
        )
    ];


    let organizationMap = {};


    if (
        organizationIds.length > 0
    ) {

        const {
            data: organizations,
            error: organizationError
        } = await supabaseClient
            .from("organizations")
            .select(
                "id, name, type"
            )
            .in(
                "id",
                organizationIds
            );


        if (organizationError) {

            console.error(
                "Organization loading error:",
                organizationError.message
            );

        } else {

            (
                organizations || []
            ).forEach(
                organization => {

                    organizationMap[
                        organization.id
                    ] = organization;

                }
            );

        }

    }


    // =================================================
    // ADD READABLE NAMES
    // =================================================

    verificationUsers =
        verificationUsers.map(
            user => {

                const barangay =
                    barangayMap[
                        user.barangay_id
                    ];


                const organization =
                    organizationMap[
                        user.organization_id
                    ];


                return {

                    ...user,

                    barangay_name:
                        barangay?.name ||
                        null,

                    organization_name:
                        organization?.name ||
                        null

                };

            }
        );


    filterVerificationUsers();

}


// =====================================================
// RENDER VERIFICATION USERS
// =====================================================

function renderVerificationUsers(
    list
) {

    const container =
        document.getElementById(
            "verificationContainer"
        );

    if (!container) return;


    if (
        !list ||
        list.length === 0
    ) {

        container.innerHTML = `
            <div class="document-card">
                <div>
                    <h3>
                        No residents found
                    </h3>

                    <p>
                        There are no residents matching
                        this verification filter.
                    </p>
                </div>
            </div>
        `;

        return;
    }


    container.innerHTML =
        list
            .map(
                user => {

                    const status =
                        normalizeVerificationStatus(
                            user.verification_status
                        );


                    const statusLabel =
                        getVerificationLabel(
                            status
                        );


                    const statusClass =
                        getVerificationClass(
                            status
                        );


                    const pwdText =
                        user.is_pwd
                            ? "Yes"
                            : "No";


                    /*
                     * Senior Citizen is derived from age.
                     */

                    const seniorText =
                        Number(user.age) >= 60
                            ? "Yes"
                            : "No";


                    const hasLocation =
                        Boolean(
                            user.organization_id &&
                            user.barangay_id
                        );


                    const isPending =
                        status === "pending";


                    const isVerified =
                        status === "verified";


                    const isRejected =
                        status === "rejected";


                    const isLegacy =
                        status === "legacy";


                    return `

                        <div class="document-card">

                            <div class="doc-icon">
                                🏠
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        user.full_name ||
                                        "Unnamed Resident"
                                    )}
                                </h3>


                                <p>
                                    <b>Age:</b>
                                    ${escapeHTML(
                                        user.age ??
                                        "N/A"
                                    )}
                                </p>


                                <p>
                                    <b>Gender:</b>
                                    ${escapeHTML(
                                        user.gender ||
                                        "N/A"
                                    )}
                                </p>


                                <p>
                                    <b>PWD:</b>
                                    ${pwdText}
                                </p>


                                <p>
                                    <b>Senior Citizen:</b>
                                    ${seniorText}
                                </p>
<p>
    <b>Region:</b>
    ${escapeHTML(
        user.region ||
        "Not provided"
    )}
</p>

<p>
    <b>Province:</b>
    ${escapeHTML(
        user.province ||
        "Not provided"
    )}
</p>

<p>
    <b>City / Municipality:</b>
    ${escapeHTML(
        user.city_municipality ||
        user.organization_name ||
        "Not assigned"
    )}
</p>

<p>
    <b>Barangay:</b>
    ${escapeHTML(
        user.barangay_name ||
        "Not assigned"
    )}
</p>

<p>
    <b>Street / Purok / Sitio / House No.:</b>
    ${escapeHTML(
        user.street_address ||
        "Not provided"
    )}
</p>
                                <p>
                                    <b>Verification:</b>

                                    <span
                                        class="verification-status ${statusClass}"
                                    >
                                        ${escapeHTML(
                                            statusLabel
                                        )}
                                    </span>

                                </p>


                                ${
                                    isRejected &&
                                    user.rejection_reason
                                        ? `
                                            <p>
                                                <b>
                                                    Rejection Reason:
                                                </b>

                                                ${escapeHTML(
                                                    user.rejection_reason
                                                )}
                                            </p>
                                        `
                                        : ""
                                }


                                ${
                                    user.verified_at
                                        ? `
                                            <p>
                                                <b>
                                                    Reviewed:
                                                </b>

                                                ${formatDate(
                                                    user.verified_at
                                                )}
                                            </p>
                                        `
                                        : ""
                                }


                                ${
                                    !hasLocation &&
                                    isPending
                                        ? `
                                            <p
                                                style="
                                                    color:#b45309;
                                                    font-weight:600;
                                                "
                                            >
                                                ⚠ Incomplete location
                                                information.
                                                City/Municipality and
                                                Barangay are required
                                                before verification.
                                            </p>
                                        `
                                        : ""
                                }


                                ${
                                    isLegacy
                                        ? `
                                            <p
                                                style="
                                                    color:#6b7280;
                                                    font-weight:600;
                                                "
                                            >
                                                ℹ Legacy account
                                            </p>
                                        `
                                        : ""
                                }

                            </div>


                            ${
                                isPending &&
                                hasLocation

                                    ? `

                                        <div
                                            class="admin-card-actions"
                                        >

                                            <button
                                                type="button"
                                                onclick="
                                                    verifyResident(
                                                        '${user.id}'
                                                    )
                                                "
                                            >
                                                ✓ Verify
                                            </button>


                                            <button
                                                type="button"
                                                onclick="
                                                    rejectResident(
                                                        '${user.id}'
                                                    )
                                                "
                                                class="danger-btn"
                                            >
                                                ✕ Reject
                                            </button>

                                        </div>

                                    `

                                    : ""
                            }

                        </div>

                    `;

                }
            )
            .join("");

}


// =====================================================
// FILTER VERIFICATION USERS
// =====================================================

function filterVerificationUsers() {

    const searchInput =
        document.getElementById(
            "verificationSearch"
        );


    const filterInput =
        document.getElementById(
            "verificationFilter"
        );


    const keyword =
        searchInput
            ? searchInput.value
                .toLowerCase()
                .trim()
            : "";


    const statusFilter =
        filterInput
            ? filterInput.value
            : "pending";


    filteredVerificationUsers =
        verificationUsers.filter(
            user => {

                const name =
                    String(
                        user.full_name ||
                        ""
                    ).toLowerCase();


                const barangay =
                    String(
                        user.barangay_name ||
                        ""
                    ).toLowerCase();


                const organization =
                    String(
                        user.organization_name ||
                        ""
                    ).toLowerCase();

                    const region =
    String(
        user.region ||
        ""
    ).toLowerCase();


const province =
    String(
        user.province ||
        ""
    ).toLowerCase();


const city =
    String(
        user.city_municipality ||
        ""
    ).toLowerCase();


const streetAddress =
    String(
        user.street_address ||
        ""
    ).toLowerCase();

                const gender =
                    String(
                        user.gender ||
                        ""
                    ).toLowerCase();


                const age =
                    String(
                        user.age ??
                        ""
                    ).toLowerCase();


                const verification =
                    normalizeVerificationStatus(
                        user.verification_status
                    );

const matchesSearch =
    !keyword ||
    name.includes(keyword) ||
    barangay.includes(keyword) ||
    organization.includes(keyword) ||
    region.includes(keyword) ||
    province.includes(keyword) ||
    city.includes(keyword) ||
    streetAddress.includes(keyword) ||
    gender.includes(keyword) ||
    age.includes(keyword);


                const matchesStatus =
                    statusFilter === "All" ||
                    verification ===
                        statusFilter;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    renderVerificationUsers(
        filteredVerificationUsers
    );

}


// =====================================================
// VERIFY RESIDENT
// =====================================================

async function verifyResident(
    id
) {

    const resident =
        verificationUsers.find(
            user =>
                user.id === id
        );


    if (!resident) return;


    const status =
        normalizeVerificationStatus(
            resident.verification_status
        );


    if (
        status !== "pending"
    ) {

        alert(
            "Only a pending resident can be verified."
        );

        return;
    }


    if (
        !resident.organization_id ||
        !resident.barangay_id
    ) {

        alert(
            "This resident cannot be verified yet.\n\n" +
            "City/Municipality and Barangay assignment " +
            "are required."
        );

        return;
    }


    const confirmed =
        confirm(
            `Verify ${
                resident.full_name ||
                "this resident"
            }?\n\n` +

            `City/Municipality: ${
                resident.organization_name ||
                "Not assigned"
            }\n` +

            `Barangay: ${
                resident.barangay_name ||
                "Not assigned"
            }\n\n` +

            `This will mark the resident as officially verified.`
        );


    if (!confirmed) return;


    const {
        data: {
            user: adminUser
        }
    } = await supabaseClient.auth.getUser();


    if (!adminUser) {

        alert(
            "You must be logged in as an admin."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({

            verification_status:
                "verified",

            verified_by:
                adminUser.id,

            verified_at:
                new Date().toISOString(),

            rejection_reason:
                null

        })
        .eq(
            "id",
            id
        )
        .eq(
            "role",
            "resident"
        );


    if (error) {

        alert(
            "Verification failed: " +
            error.message
        );

        console.error(
            "Verification error:",
            error
        );

        return;
    }


    await logAudit(
        "Verified resident",
        "Users",
        `Verified resident: ${
            resident.full_name ||
            id
        }. Barangay: ${
            resident.barangay_name ||
            "Not assigned"
        }`,
        false
    );


    alert(
        "Resident verified successfully."
    );


    await loadUsers();

    await loadVerificationUsers();

}


// =====================================================
// REJECT RESIDENT
// =====================================================

async function rejectResident(
    id
) {

    const resident =
        verificationUsers.find(
            user =>
                user.id === id
        );


    if (!resident) return;


    const status =
        normalizeVerificationStatus(
            resident.verification_status
        );


    if (
        status !== "pending"
    ) {

        alert(
            "Only a pending resident can be rejected."
        );

        return;
    }


    const reason =
        prompt(
            `Why are you rejecting ${
                resident.full_name ||
                "this resident"
            }'s registration?\n\n` +

            `Enter a reason:`
        );


    if (reason === null) return;


    const cleanReason =
        reason.trim();


    if (!cleanReason) {

        alert(
            "Please provide a rejection reason."
        );

        return;
    }


    const {
        data: {
            user: adminUser
        }
    } = await supabaseClient.auth.getUser();


    if (!adminUser) {

        alert(
            "You must be logged in as an admin."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({

            verification_status:
                "rejected",

            verified_by:
                adminUser.id,

            verified_at:
                new Date().toISOString(),

            rejection_reason:
                cleanReason

        })
        .eq(
            "id",
            id
        )
        .eq(
            "role",
            "resident"
        );


    if (error) {

        alert(
            "Rejection failed: " +
            error.message
        );

        console.error(
            "Rejection error:",
            error
        );

        return;
    }


    await logAudit(
        "Rejected resident",
        "Users",
        `Rejected resident: ${
            resident.full_name ||
            id
        }. Reason: ${cleanReason}`,
        false
    );


    alert(
        "Resident registration rejected."
    );


    await loadUsers();

    await loadVerificationUsers();

}


// =====================================================
// ALL USERS RENDER
// =====================================================

function renderUsers(
    list
) {

    const container =
        document.getElementById(
            "usersContainer"
        );


    if (!container) return;


    if (
        !list ||
        list.length === 0
    ) {

        container.innerHTML = `
            <div class="document-card">

                <div>

                    <h3>
                        No users found
                    </h3>

                    <p>
                        No matching user records.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    container.innerHTML =
        list
            .map(
                user => {

                    const displayName =
                        user.full_name ||
                        user.username ||
                        "Unnamed User";


                    const role =
                        user.role ||
                        "resident";


                    const accountStatus =
                        user.status ||
                        "active";


                    const verificationStatus =
                        normalizeVerificationStatus(
                            user.verification_status
                        );


                    const isPendingResident =
                        role === "resident" &&
                        verificationStatus ===
                            "pending";


                    const isVerifiedResident =
                        role === "resident" &&
                        verificationStatus ===
                            "verified";


                    const isRejectedResident =
                        role === "resident" &&
                        verificationStatus ===
                            "rejected";


                    const isLegacyResident =
                        role === "resident" &&
                        verificationStatus ===
                            "legacy";


                    let actionButtons = "";


                    // =====================================
                    // ADMIN
                    // =====================================

                    if (
                        role === "admin"
                    ) {

                        actionButtons = `

                            <button
                                type="button"
                                onclick="
                                    changeUserRole(
                                        '${user.id}',
                                        'resident'
                                    )
                                "
                            >
                                Make Resident
                            </button>

                            <button
                                type="button"
                                onclick="
                                    deleteUser(
                                        '${user.id}'
                                    )
                                "
                                class="danger-btn"
                            >
                                Delete
                            </button>

                        `;

                    }


                    // =====================================
                    // VERIFIED RESIDENT
                    // =====================================

                    else if (
                        isVerifiedResident
                    ) {

                        actionButtons = `

                            <button
                                type="button"
                                onclick="
                                    changeUserRole(
                                        '${user.id}',
                                        'admin'
                                    )
                                "
                            >
                                Make Admin
                            </button>

                            <button
                                type="button"
                                onclick="
                                    deleteUser(
                                        '${user.id}'
                                    )
                                "
                                class="danger-btn"
                            >
                                Delete
                            </button>

                        `;

                    }


                    // =====================================
                    // LEGACY RESIDENT
                    // =====================================

                    else if (
                        isLegacyResident
                    ) {

                        actionButtons = `

                            <div
                                style="
                                    padding:10px 14px;
                                    border-radius:8px;
                                    background:#f3f4f6;
                                    color:#4b5563;
                                    font-size:14px;
                                    font-weight:600;
                                "
                            >
                                ℹ Legacy account
                            </div>

                            <button
                                type="button"
                                onclick="
                                    deleteUser(
                                        '${user.id}'
                                    )
                                "
                                class="danger-btn"
                            >
                                Delete
                            </button>

                        `;

                    }


                    // =====================================
                    // REJECTED RESIDENT
                    // =====================================

                    else if (
                        isRejectedResident
                    ) {

                        actionButtons = `

                            <div
                                style="
                                    padding:10px 14px;
                                    border-radius:8px;
                                    background:#fef2f2;
                                    color:#b91c1c;
                                    font-size:14px;
                                    font-weight:600;
                                "
                            >
                                ✕ Rejected
                            </div>

                            <button
                                type="button"
                                onclick="
                                    deleteUser(
                                        '${user.id}'
                                    )
                                "
                                class="danger-btn"
                            >
                                Delete
                            </button>

                        `;

                    }


                    // =====================================
                    // PENDING RESIDENT
                    // =====================================

                    else if (
                        isPendingResident
                    ) {

                        actionButtons = `

                            <div
                                style="
                                    padding:10px 14px;
                                    border-radius:8px;
                                    background:#fff7ed;
                                    color:#9a3412;
                                    font-size:14px;
                                    font-weight:600;
                                "
                            >
                                🔒 Pending verification
                            </div>

                        `;

                    }


                    return `

                        <div class="document-card">

                            <div class="doc-icon">

                                ${
                                    role === "admin"
                                        ? "🛠️"
                                        : "🏠"
                                }

                            </div>


                            <div>

                                <h3>
                                    ${escapeHTML(
                                        displayName
                                    )}
                                </h3>


                                <p>
                                    <b>Role:</b>
                                    ${escapeHTML(
                                        role
                                    )}
                                </p>


                                <p>
                                    <b>Account Status:</b>
                                    ${escapeHTML(
                                        accountStatus
                                    )}
                                </p>


                                ${
                                    role === "resident"
                                        ? `
                                            <p>
                                                <b>Verification:</b>

                                                <span
                                                    style="
                                                        font-weight:600;
                                                        text-transform:capitalize;
                                                    "
                                                >
                                                    ${escapeHTML(
                                                        getVerificationLabel(
                                                            verificationStatus
                                                        )
                                                    )}
                                                </span>
                                            </p>
                                        `
                                        : ""
                                }


                                ${
                                    role === "resident"
                                        ? `
                                            <p>
                                                <b>Age:</b>
                                                ${escapeHTML(
                                                    user.age ??
                                                    "N/A"
                                                )}
                                            </p>

                                            <p>
                                                <b>Gender:</b>
                                                ${escapeHTML(
                                                    user.gender ||
                                                    "N/A"
                                                )}
                                            </p>

                                            <p>
                                                <b>PWD:</b>
                                                ${
                                                    user.is_pwd
                                                        ? "Yes"
                                                        : "No"
                                                }
                                            </p>

                                            <p>
                                                <b>Senior Citizen:</b>
                                                ${
                                                    Number(
                                                        user.age
                                                    ) >= 60
                                                        ? "Yes"
                                                        : "No"
                                                }
                                            </p>

                                           <p>
    <b>Address:</b>
    ${escapeHTML(
        [
            user.street_address,
            user.barangay_name,
            user.city_municipality ||
                user.organization_name,
            user.province
        ]
            .filter(Boolean)
            .join(", ") ||
        "Not provided"
    )}
</p>
                                        `
                                        : ""
                                }


                                ${
                                    role === "resident" &&
                                    verificationStatus ===
                                        "verified"
                                        ? `
                                            <p
                                                style="
                                                    color:#15803d;
                                                    font-weight:600;
                                                "
                                            >
                                                ✓ Verified resident
                                            </p>
                                        `
                                        : ""
                                }


                                ${
                                    role === "resident" &&
                                    verificationStatus ===
                                        "rejected"
                                        ? `
                                            <p
                                                style="
                                                    color:#b91c1c;
                                                    font-weight:600;
                                                "
                                            >
                                                ✕ Registration rejected
                                            </p>

                                            ${
                                                user.rejection_reason
                                                    ? `
                                                        <p>
                                                            <b>
                                                                Reason:
                                                            </b>

                                                            ${escapeHTML(
                                                                user.rejection_reason
                                                            )}
                                                        </p>
                                                    `
                                                    : ""
                                            }
                                        `
                                        : ""
                                }


                                ${
                                    role === "resident" &&
                                    verificationStatus ===
                                        "legacy"
                                        ? `
                                            <p
                                                style="
                                                    color:#6b7280;
                                                    font-weight:600;
                                                "
                                            >
                                                ℹ Legacy account
                                            </p>
                                        `
                                        : ""
                                }


                                <p>
                                    <b>Registered:</b>
                                    ${formatDate(
                                        user.created_at
                                    )}
                                </p>

                            </div>


                            <div
                                class="admin-card-actions"
                            >

                                ${actionButtons}

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


// =====================================================
// USER SEARCH
// =====================================================

function searchAdminUsers() {

    const searchInput =
        document.getElementById(
            "adminUserSearch"
        );


    const roleInput =
        document.getElementById(
            "adminUserFilter"
        );


    const keyword =
        searchInput
            ? searchInput.value
                .toLowerCase()
                .trim()
            : "";


    const roleFilter =
        roleInput
            ? roleInput.value
            : "All";


    filteredUsers =
        usersList.filter(
            user => {

                const displayName =
                    user.full_name ||
                    user.username ||
                    "";


                const role =
                    user.role ||
                    "resident";


                const status =
                    user.status ||
                    "active";


                const verification =
                    normalizeVerificationStatus(
                        user.verification_status
                    );


                const organization =
                    user.organization_name ||
                    "";


                const barangay =
                    user.barangay_name ||
                    "";


                const searchableText = [
                    displayName,
                    role,
                    status,
                    verification,
                    organization,
                    barangay,
                    user.gender,
                    user.age
                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !keyword ||
                    searchableText.includes(
                        keyword
                    );


                const matchesRole =
                    roleFilter === "All" ||
                    role === roleFilter;


                return (
                    matchesSearch &&
                    matchesRole
                );

            }
        );


    renderUsers(
        filteredUsers
    );


    updateUserSummary(
        filteredUsers
    );

}


// =====================================================
// ROLE FILTER
// =====================================================

function filterAdminUsers() {

    searchAdminUsers();

}


// =====================================================
// CHANGE ROLE
// =====================================================

async function changeUserRole(
    id,
    newRole
) {

    const userRecord =
        usersList.find(
            user =>
                String(user.id) ===
                String(id)
        );


    if (!userRecord) {

        alert(
            "User record not found."
        );

        return;
    }


    const currentRole =
        userRecord.role ||
        "resident";


    const currentVerification =
        normalizeVerificationStatus(
            userRecord.verification_status
        );


    if (
        newRole === "admin" &&
        currentRole === "resident" &&
        currentVerification !== "verified"
    ) {

        alert(
            "Only a verified resident can be promoted to administrator."
        );

        return;
    }


    if (
        newRole === "admin" &&
        currentRole === "resident" &&
        currentVerification === "legacy"
    ) {

        alert(
            "This is a legacy resident account.\n\n" +
            "The account must go through the current " +
            "resident verification process before it can " +
            "be promoted to administrator."
        );

        return;
    }


    if (
        currentRole ===
        newRole
    ) {

        alert(
            "The user already has this role."
        );

        return;
    }


    const confirmed =
        confirm(
            `Change ${
                userRecord.full_name ||
                "this user"
            }'s role from ${
                currentRole
            } to ${
                newRole
            }?`
        );


    if (!confirmed) return;


    const {
        data: {
            user: adminUser
        }
    } = await supabaseClient.auth.getUser();


    if (!adminUser) {

        alert(
            "You must be logged in as an admin."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            role: newRole
        })
        .eq(
            "id",
            id
        );


    if (error) {

        alert(
            "Role update failed: " +
            error.message
        );

        console.error(
            "Role update error:",
            error
        );

        return;
    }


    await logAudit(
        "Updated user role",
        "Users",
        `Changed ${
            userRecord.full_name ||
            id
        } role from ${
            currentRole
        } to ${
            newRole
        }`,
        false
    );


    alert(
        "User role updated."
    );


    await loadUsers();

    await loadVerificationUsers();

}


// =====================================================
// DELETE PROFILE
// =====================================================

async function deleteUser(
    id
) {

    const currentUserId =
        await getCurrentUserId();


    if (
        String(id) ===
        String(currentUserId)
    ) {

        alert(
            "You cannot delete your own administrator profile from this page."
        );

        return;
    }


    const userRecord =
        usersList.find(
            user =>
                String(user.id) ===
                String(id)
        );


    if (
        !confirm(
            "Are you sure you want to delete this user profile?\n\n" +
            "This action cannot be easily undone."
        )
    ) {

        return;
    }


    const {
        data: {
            user: adminUser
        }
    } = await supabaseClient.auth.getUser();


    if (!adminUser) {

        alert(
            "You must be logged in as an admin."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("profiles")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        alert(
            "Delete failed: " +
            error.message
        );

        console.error(
            "Delete profile error:",
            error
        );

        return;
    }


    await logAudit(
        "Deleted user profile",
        "Users",
        `Deleted user profile: ${
            userRecord
                ? userRecord.full_name ||
                  userRecord.username ||
                  id
                : id
        }`,
        false
    );


    alert(
        "User profile deleted."
    );


    await loadUsers();

    await loadVerificationUsers();

}


// =====================================================
// CURRENT USER ID
// =====================================================

async function getCurrentUserId() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    return user?.id || null;

}


// =====================================================
// SUMMARY
// =====================================================

function updateUserSummary(
    list
) {

    const safeList =
        list || [];


    const totalUsers =
        safeList.length;


    const admins =
        safeList.filter(
            user =>
                user.role ===
                "admin"
        ).length;


    const residents =
        safeList.filter(
            user =>
                user.role ===
                    "resident" ||
                !user.role
        ).length;


    const pending =
        safeList.filter(
            user =>
                user.role ===
                    "resident" &&
                normalizeVerificationStatus(
                    user.verification_status
                ) === "pending"
        ).length;


    const verified =
        safeList.filter(
            user =>
                user.role ===
                    "resident" &&
                normalizeVerificationStatus(
                    user.verification_status
                ) === "verified"
        ).length;


    const rejected =
        safeList.filter(
            user =>
                user.role ===
                    "resident" &&
                normalizeVerificationStatus(
                    user.verification_status
                ) === "rejected"
        ).length;


    setText(
        "totalUsers",
        totalUsers
    );


    setText(
        "adminUsers",
        admins
    );


    setText(
        "residentUsers",
        residents
    );


    setText(
        "pendingUsers",
        pending
    );


    setText(
        "verifiedUsers",
        verified
    );


    setText(
        "rejectedUsers",
        rejected
    );

}


// =====================================================
// VERIFICATION STATUS HELPERS
// =====================================================

function normalizeVerificationStatus(
    status
) {

    const value =
        String(
            status || ""
        )
            .trim()
            .toLowerCase();


    if (
        value === "verified"
    ) {
        return "verified";
    }


    if (
        value === "rejected"
    ) {
        return "rejected";
    }


    if (
        value === "legacy"
    ) {
        return "legacy";
    }


    return "pending";

}


function getVerificationLabel(
    status
) {

    switch (status) {

        case "verified":
            return "Verified";

        case "rejected":
            return "Rejected";

        case "legacy":
            return "Legacy";

        case "pending":
        default:
            return "Pending Verification";

    }

}


function getVerificationClass(
    status
) {

    switch (status) {

        case "verified":
            return "verified";

        case "rejected":
            return "rejected";

        case "legacy":
            return "legacy";

        case "pending":
        default:
            return "pending";

    }

}


// =====================================================
// AUDIT LOG
// =====================================================

async function logAudit(
    action,
    module,
    details,
    publicVisible = true
) {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    if (!user) {

        console.warn(
            "Audit log skipped: no logged-in user."
        );

        return;
    }


    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select(
            "full_name"
        )
        .eq(
            "id",
            user.id
        )
        .single();


    if (profileError) {

        console.warn(
            "Could not get admin profile:",
            profileError.message
        );

    }


    const adminName =
        profile?.full_name ||
        "Administrator";


    const {
        error
    } = await supabaseClient
        .from("audit_logs")
        .insert([
            {

                user_id:
                    user.id,

                admin_name:
                    adminName,

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


// =====================================================
// SET TEXT
// =====================================================

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
            String(
                value ?? ""
            );

    }

}


// =====================================================
// DATE
// =====================================================

function formatDate(
    dateValue
) {

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


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(
    value
) {

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