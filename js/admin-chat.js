const inquiryList = document.getElementById("inquiry-list");


// =====================================================
// LOAD CHAT INQUIRIES
// =====================================================

async function loadInquiries() {

    console.log("Loading inquiries...");

    const { data, error } = await supabaseClient
        .from("chat_inquiries")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error("SUPABASE ERROR:", error);

        inquiryList.innerHTML = `
            <div class="chat-inquiry-card">
                <h3>Error loading inquiries</h3>
                <p>${error.message}</p>
            </div>
        `;

        return;
    }


    console.log("INQUIRIES:", data);


    if (!data || data.length === 0) {

        inquiryList.innerHTML = `
            <div class="chat-inquiry-card">
                <h3>No inquiries found</h3>
                <p>There are currently no chat inquiries.</p>
            </div>
        `;

        return;
    }


    inquiryList.innerHTML = "";


    data.forEach(item => {

        const isPending =
            String(item.status || "").toLowerCase() === "pending";


        inquiryList.innerHTML += `

            <div class="chat-inquiry-card">

                <!-- ================================= -->
                <!-- TOP -->
                <!-- ================================= -->

                <div class="chat-top">

                    <div class="question-area">

                        <h3>
                            ${escapeHTML(item.question || "")}
                        </h3>

                        <small>
                            ${item.created_at
                                ? new Date(item.created_at).toLocaleString()
                                : ""
                            }
                        </small>

                    </div>


                    <span class="status-badge ${escapeHTML(
                        item.status || ""
                    )}">

                        ${escapeHTML(item.status || "pending")}

                    </span>

                </div>


                <!-- ================================= -->
                <!-- AI RESPONSE -->
                <!-- ================================= -->

                <div class="response-box">

                    <h4>
                        ✨ AI Response
                    </h4>

                    <p>
                        ${escapeHTML(item.ai_response || "")}
                    </p>

                </div>


                <!-- ================================= -->
                <!-- ADMIN RESPONSE -->
                <!-- ================================= -->

                ${
                    isPending

                    ?

                    `

                    <div class="reply-section">

                        <label>
                            Admin Response
                        </label>

                        <textarea
                            class="chat-reply-box"
                            id="reply-${item.id}"
                            placeholder="Type your response to the resident..."
                        ></textarea>


                        <button
                            type="button"
                            class="chat-send-btn"
                            onclick="replyInquiry('${item.id}')"
                        >
                             Send Reply
                        </button>

                    </div>

                    `

                    :

                    `

                    <div
                        class="admin-reply"
                        id="admin-reply-${item.id}"
                    >

                        <h4>
                            ✅ Admin Reply
                        </h4>

                        <p id="admin-reply-text-${item.id}">
                            ${escapeHTML(item.admin_reply || "")}
                        </p>


                        ${
                            item.replied_at
                            ?
                            `
                            <small>
                                Replied:
                                ${new Date(
                                    item.replied_at
                                ).toLocaleString()}
                            </small>
                            `
                            :
                            ""
                        }


                        <div class="admin-reply-actions">

                            <button
                                type="button"
                                class="chat-edit-btn"
                                onclick="editInquiryReply('${item.id}')"
                            >
                                Edit Response
                            </button>

                        </div>

                    </div>

                    `

                }

            </div>

        `;

    });

}


// =====================================================
// SEND NEW ADMIN REPLY
// =====================================================

window.replyInquiry = async function(id) {

    console.log("Replying to inquiry:", id);


    const replyBox =
        document.getElementById(`reply-${id}`);


    if (!replyBox) {

        console.error(
            "Reply box not found:",
            id
        );

        return;
    }


    const reply =
        replyBox.value.trim();


    if (!reply) {

        alert(
            "Please write a reply first."
        );

        return;
    }


    const { data, error } =
        await supabaseClient

            .from("chat_inquiries")

            .update({

                admin_reply: reply,

                status: "answered",

                replied_at:
                    new Date().toISOString()

            })

            .eq("id", id)

            .select();


    if (error) {

        console.error(
            "REPLY UPDATE ERROR:",
            error
        );

        alert(
            "Failed to send reply:\n\n" +
            error.message
        );

        return;
    }


    if (!data || data.length === 0) {

        console.error(
            "No inquiry was updated."
        );

        alert(
            "The reply was not saved. " +
            "Please check your Supabase UPDATE policy."
        );

        return;
    }


    console.log(
        "UPDATED INQUIRY:",
        data
    );


    alert(
        "Reply sent successfully!"
    );


    await loadInquiries();

};


// =====================================================
// EDIT EXISTING ADMIN REPLY
// =====================================================

window.editInquiryReply = async function(id) {

    console.log(
        "Editing inquiry reply:",
        id
    );


    const { data, error } =
        await supabaseClient

            .from("chat_inquiries")

            .select(
                "id, admin_reply"
            )

            .eq("id", id)

            .single();


    if (error) {

        console.error(
            "LOAD REPLY ERROR:",
            error
        );

        alert(
            "Unable to load the admin reply."
        );

        return;
    }


    const replyContainer =
        document.getElementById(
            `admin-reply-${id}`
        );


    if (!replyContainer) {

        console.error(
            "Admin reply container not found."
        );

        return;
    }


    replyContainer.innerHTML = `

        <h4>
            ✏ Edit Admin Reply
        </h4>


        <textarea
            class="chat-reply-box"
            id="edit-reply-${id}"
        >${escapeHTML(data.admin_reply || "")}</textarea>


        <div class="admin-reply-actions">

            <button
                type="button"
                class="chat-send-btn"
                onclick="saveEditedReply('${id}')"
            >
                 Save Changes
            </button>


            <button
                type="button"
                class="chat-cancel-btn"
                onclick="loadInquiries()"
            >
                Cancel
            </button>

        </div>

    `;

};


// =====================================================
// SAVE EDITED ADMIN REPLY
// =====================================================

window.saveEditedReply = async function(id) {

    console.log(
        "Saving edited reply:",
        id
    );


    const replyBox =
        document.getElementById(
            `edit-reply-${id}`
        );


    if (!replyBox) {

        console.error(
            "Edit reply box not found."
        );

        return;
    }


    const newReply =
        replyBox.value.trim();


    if (!newReply) {

        alert(
            "Admin reply cannot be empty."
        );

        return;
    }


    const { data, error } =
        await supabaseClient

            .from("chat_inquiries")

            .update({

                admin_reply: newReply,

                replied_at:
                    new Date().toISOString(),

                status: "answered"

            })

            .eq("id", id)

            .select();


    if (error) {

        console.error(
            "EDIT REPLY ERROR:",
            error
        );

        alert(
            "Failed to update reply:\n\n" +
            error.message
        );

        return;
    }


    if (!data || data.length === 0) {

        alert(
            "No changes were saved. " +
            "Please check your Supabase UPDATE policy."
        );

        return;
    }


    console.log(
        "EDITED INQUIRY:",
        data
    );


    alert(
        "Admin reply updated successfully!"
    );


    await loadInquiries();

};


// =====================================================
// BASIC HTML ESCAPING
// =====================================================

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


// =====================================================
// START
// =====================================================

loadInquiries();