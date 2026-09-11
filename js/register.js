/* =========================================================
   KATIN-AWAN
   RESIDENT REGISTRATION
   SHOPEE-STYLE ADDRESS PICKER
   CURRENTLY BOGO CITY ONLY
========================================================= */


const registerForm =
    document.getElementById(
        "registerForm"
    );


const registerButton =
    document.getElementById(
        "registerButton"
    );


/* =========================================================
   ADDRESS ELEMENTS
========================================================= */

const openAddressPickerButton =
    document.getElementById(
        "openAddressPicker"
    );


const addressPickerOverlay =
    document.getElementById(
        "addressPickerOverlay"
    );


const closeAddressPickerButton =
    document.getElementById(
        "closeAddressPicker"
    );


const addressPickerTitle =
    document.getElementById(
        "addressPickerTitle"
    );


const addressPickerSubtitle =
    document.getElementById(
        "addressPickerSubtitle"
    );


const addressBreadcrumbs =
    document.getElementById(
        "addressBreadcrumbs"
    );


const addressSearch =
    document.getElementById(
        "addressSearch"
    );


const addressOptions =
    document.getElementById(
        "addressOptions"
    );


const addressPickerText =
    document.getElementById(
        "addressPickerText"
    );


/* =========================================================
   HIDDEN ADDRESS VALUES
========================================================= */

const regionInput =
    document.getElementById(
        "region"
    );


const provinceInput =
    document.getElementById(
        "province"
    );


const cityInput =
    document.getElementById(
        "cityMunicipality"
    );


const organizationIdInput =
    document.getElementById(
        "organizationId"
    );


const barangayInput =
    document.getElementById(
        "barangay"
    );


/* =========================================================
   ADDRESS STATE
========================================================= */

let currentAddressStep =
    "region";


let availableOptions =
    [];


let selectedAddress = {

    region:
        "",

    province:
        "",

    city:
        "",

    barangayId:
        "",

    barangayName:
        "",

    organizationId:
        ""

};



/* =========================================================
   OPEN PICKER
========================================================= */

openAddressPickerButton.addEventListener(
    "click",
    function () {

        addressPickerOverlay.classList.add(
            "show"
        );


        addressPickerOverlay.setAttribute(
            "aria-hidden",
            "false"
        );


        /*
         * If an address was previously selected,
         * start again at region so user can edit it.
         */

        currentAddressStep =
            "region";


        selectedAddress = {

            region:
                "",

            province:
                "",

            city:
                "",

            barangayId:
                "",

            barangayName:
                "",

            organizationId:
                ""

        };


        renderAddressStep();

    }
);



/* =========================================================
   CLOSE PICKER
========================================================= */

function closeAddressPicker() {

    addressPickerOverlay.classList.remove(
        "show"
    );


    addressPickerOverlay.setAttribute(
        "aria-hidden",
        "true"
    );


    addressSearch.value =
        "";

}



closeAddressPickerButton.addEventListener(
    "click",
    closeAddressPicker
);



addressPickerOverlay.addEventListener(
    "click",
    function (
        event
    ) {

        if (
            event.target ===
            addressPickerOverlay
        ) {

            closeAddressPicker();

        }

    }
);



document.addEventListener(
    "keydown",
    function (
        event
    ) {

        if (
            event.key ===
            "Escape"
        ) {

            closeAddressPicker();

        }

    }
);



/* =========================================================
   RENDER ADDRESS STEP
========================================================= */

async function renderAddressStep() {

    addressSearch.value =
        "";


    addressOptions.innerHTML = `
        <div class="address-loading">
            Loading...
        </div>
    `;


    updateBreadcrumbs();


    /* =====================================================
       REGION
    ===================================================== */

    if (
        currentAddressStep ===
        "region"
    ) {

        addressPickerTitle.textContent =
            "Select Region";


        addressPickerSubtitle.textContent =
            "Choose your region.";


        availableOptions = [

            {
                value:
                    "Region VII (Central Visayas)",

                label:
                    "Region VII (Central Visayas)"
            }

        ];


        renderAddressOptions(
            availableOptions
        );


        return;

    }



    /* =====================================================
       PROVINCE
    ===================================================== */

    if (
        currentAddressStep ===
        "province"
    ) {

        addressPickerTitle.textContent =
            "Select Province";


        addressPickerSubtitle.textContent =
            "Choose your province.";


        availableOptions = [

            {
                value:
                    "Cebu",

                label:
                    "Cebu"
            }

        ];


        renderAddressOptions(
            availableOptions
        );


        return;

    }



    /* =====================================================
       CITY
    ===================================================== */

    if (
        currentAddressStep ===
        "city"
    ) {

        addressPickerTitle.textContent =
            "Select City / Municipality";


        addressPickerSubtitle.textContent =
            "Choose your city or municipality.";


        availableOptions = [

            {
                value:
                    "Bogo City",

                label:
                    "City of Bogo"
            }

        ];


        renderAddressOptions(
            availableOptions
        );


        return;

    }



    /* =====================================================
       BARANGAY
    ===================================================== */

    if (
        currentAddressStep ===
        "barangay"
    ) {

        addressPickerTitle.textContent =
            "Select Barangay";


        addressPickerSubtitle.textContent =
            "Choose your barangay in Bogo City.";


        await loadBogoBarangays();

    }

}



/* =========================================================
   RENDER OPTIONS
========================================================= */

function renderAddressOptions(
    options
) {

    addressOptions.innerHTML =
        "";


    if (
        !options.length
    ) {

        addressOptions.innerHTML = `
            <div class="address-empty">
                No results found.
            </div>
        `;


        return;

    }


    options.forEach(
        function (
            option
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "address-option";


            button.dataset.value =
                option.value;


            button.textContent =
                option.label;


            button.addEventListener(
                "click",
                function () {

                    selectAddressOption(
                        option
                    );

                }
            );


            addressOptions.appendChild(
                button
            );

        }
    );

}



/* =========================================================
   SELECT OPTION
========================================================= */

async function selectAddressOption(
    option
) {

    /* REGION */

    if (
        currentAddressStep ===
        "region"
    ) {

        selectedAddress.region =
            option.value;


        currentAddressStep =
            "province";


        await renderAddressStep();


        return;

    }



    /* PROVINCE */

    if (
        currentAddressStep ===
        "province"
    ) {

        selectedAddress.province =
            option.value;


        currentAddressStep =
            "city";


        await renderAddressStep();


        return;

    }



    /* CITY */

    if (
        currentAddressStep ===
        "city"
    ) {

        selectedAddress.city =
            option.value;


        currentAddressStep =
            "barangay";


        await renderAddressStep();


        return;

    }



    /* BARANGAY */

    if (
        currentAddressStep ===
        "barangay"
    ) {

        selectedAddress.barangayId =
            option.value;


        selectedAddress.barangayName =
            option.label;


        finishAddressSelection();

    }

}



/* =========================================================
   FIND BOGO CITY + LOAD BARANGAYS
========================================================= */

async function loadBogoBarangays() {

    addressOptions.innerHTML = `
        <div class="address-loading">
            Loading Bogo City barangays...
        </div>
    `;


    try {

        const {
            data: organizations,
            error: organizationError
        } =
            await supabaseClient

                .from(
                    "organizations"
                )

                .select(
                    "id, name"
                )

                .eq(
                    "is_active",
                    true
                )

                .ilike(
                    "name",
                    "%Bogo%"
                );


        if (
            organizationError
        ) {

            throw organizationError;

        }


        if (
            !organizations ||
            organizations.length ===
            0
        ) {

            throw new Error(
                "Bogo City was not found in the organizations table."
            );

        }


        const bogo =
            organizations.find(
                function (
                    organization
                ) {

                    const name =
                        String(
                            organization.name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    return (

                        name ===
                            "bogo city"

                        ||

                        name ===
                            "city of bogo"

                        ||

                        name ===
                            "bogo"

                    );

                }
            ) ||
            organizations[0];


        selectedAddress.organizationId =
            bogo.id;


        const {
            data: barangays,
            error: barangayError
        } =
            await supabaseClient

                .from(
                    "barangays"
                )

                .select(
                    "id, name"
                )

                .eq(
                    "organization_id",
                    bogo.id
                )

                .eq(
                    "is_active",
                    true
                )

                .order(
                    "name",
                    {
                        ascending:
                            true
                    }
                );


        if (
            barangayError
        ) {

            throw barangayError;

        }


        availableOptions =
            (
                barangays ||
                []
            )
                .map(
                    function (
                        barangay
                    ) {

                        return {

                            value:
                                barangay.id,

                            label:
                                barangay.name

                        };

                    }
                );


        renderAddressOptions(
            availableOptions
        );


    } catch (
        error
    ) {

        console.error(
            "Address loading error:",
            error
        );


        addressOptions.innerHTML = `
            <div class="address-empty">
                Unable to load barangays.
            </div>
        `;

    }

}



/* =========================================================
   SEARCH OPTIONS
========================================================= */

addressSearch.addEventListener(
    "input",
    function () {

        const query =
            this.value
                .trim()
                .toLowerCase();


        if (
            !query
        ) {

            renderAddressOptions(
                availableOptions
            );


            return;

        }


        const filtered =
            availableOptions.filter(
                function (
                    option
                ) {

                    return option.label
                        .toLowerCase()
                        .includes(
                            query
                        );

                }
            );


        renderAddressOptions(
            filtered
        );

    }
);



/* =========================================================
   BREADCRUMBS
========================================================= */

function updateBreadcrumbs() {

    const parts =
        [];


    if (
        selectedAddress.region
    ) {

        parts.push(
            selectedAddress.region
        );

    }


    if (
        selectedAddress.province
    ) {

        parts.push(
            selectedAddress.province
        );

    }


    if (
        selectedAddress.city
    ) {

        parts.push(
            "City of Bogo"
        );

    }


    if (
        !parts.length
    ) {

        addressBreadcrumbs.innerHTML =
            "";


        return;

    }


    addressBreadcrumbs.innerHTML =
        parts
            .map(
                function (
                    part
                ) {

                    return `
                        <span>
                            ${escapeHTML(part)}
                        </span>
                    `;

                }
            )
            .join(
                '<span class="address-breadcrumb-separator">›</span>'
            );

}



/* =========================================================
   FINISH ADDRESS
========================================================= */

function finishAddressSelection() {

    regionInput.value =
        selectedAddress.region;


    provinceInput.value =
        selectedAddress.province;


    cityInput.value =
        selectedAddress.city;


    organizationIdInput.value =
        selectedAddress.organizationId;


    barangayInput.value =
        selectedAddress.barangayId;


    addressPickerText.textContent =
        [
            selectedAddress.barangayName,
            "City of Bogo",
            "Cebu"
        ]
            .filter(
                Boolean
            )
            .join(
                ", "
            );


    addressPickerText.classList.remove(
        "address-picker-placeholder"
    );


    closeAddressPicker();

}



/* =========================================================
   REGISTRATION
========================================================= */

registerForm.addEventListener(
    "submit",
    async function (
        event
    ) {

        event.preventDefault();


        const fullName =
            document
                .getElementById(
                    "fullName"
                )
                .value
                .trim();


        const ageValue =
            document
                .getElementById(
                    "age"
                )
                .value
                .trim();


        const gender =
            document
                .getElementById(
                    "gender"
                )
                .value;


        const isPwdValue =
            document
                .getElementById(
                    "isPwd"
                )
                .value;


        const streetAddress =
            document
                .getElementById(
                    "streetAddress"
                )
                .value
                .trim();


        const email =
            document
                .getElementById(
                    "email"
                )
                .value
                .trim()
                .toLowerCase();


        const password =
            document
                .getElementById(
                    "password"
                )
                .value;


        const confirmPassword =
            document
                .getElementById(
                    "confirmPassword"
                )
                .value;


        const age =
            Number(
                ageValue
            );



        /* =====================================================
           VALIDATE
        ===================================================== */

        if (
            !fullName ||
            !ageValue ||
            !gender ||
            !isPwdValue ||
            !streetAddress ||
            !email ||
            !password ||
            !confirmPassword
        ) {

            alert(
                "Please complete all required fields."
            );


            return;

        }


        if (
            !regionInput.value ||
            !provinceInput.value ||
            !cityInput.value ||
            !organizationIdInput.value ||
            !barangayInput.value
        ) {

            alert(
                "Please select your residential address."
            );


            return;

        }


        if (
            !Number.isInteger(
                age
            ) ||
            age < 0 ||
            age > 120
        ) {

            alert(
                "Please enter a valid age between 0 and 120."
            );


            return;

        }


        if (
            password.length <
            6
        ) {

            alert(
                "Password must contain at least 6 characters."
            );


            return;

        }


        if (
            password !==
            confirmPassword
        ) {

            alert(
                "Passwords do not match."
            );


            return;

        }



        /* =====================================================
           SUBMIT
        ===================================================== */

        registerButton.disabled =
            true;


        registerButton.textContent =
            "Creating Account...";


        try {

            const {
                data,
                error
            } =
                await supabaseClient.auth.signUp({

                    email:
                        email,

                    password:
                        password,

                    options: {

                        data: {

                            full_name:
                                fullName,

                            age:
                                age,

                            gender:
                                gender,

                            is_pwd:
                                (
                                    isPwdValue ===
                                    "true"
                                ),

                            region:
                                regionInput.value,

                            province:
                                provinceInput.value,

                            city_municipality:
                                cityInput.value,

                            organization_id:
                                organizationIdInput.value,

                            barangay_id:
                                barangayInput.value,

                            street_address:
                                streetAddress

                        }

                    }

                });


            if (
                error
            ) {

                throw error;

            }


            if (
                !data?.user
            ) {

                throw new Error(
                    "The account could not be created."
                );

            }


            alert(
                "Account created successfully!\n\n" +
                "Your registration is now pending " +
                "barangay verification."
            );


            window.location.href =
                "login.html";


        } catch (
        error
        ) {

            console.error(
                "Registration error:",
                error
            );


            alert(
                "Registration failed:\n\n" +
                (
                    error.message ||
                    "Unable to create your account."
                )
            );


        } finally {

            registerButton.disabled =
                false;


            registerButton.textContent =
                "Create Account";

        }

    }
);



/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ??
        ""
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