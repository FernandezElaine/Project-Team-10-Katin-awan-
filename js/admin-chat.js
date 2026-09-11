const inquiryList = document.getElementById("inquiry-list");



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

            </div>

        `;


        return;

    }



    inquiryList.innerHTML = "";


data.forEach(item => {


inquiryList.innerHTML += `


<div class="chat-inquiry-card">


    <div class="chat-top">


        <div class="question-area">

            <h3>
                ${item.question}
            </h3>


            <small>
                ${new Date(item.created_at).toLocaleString()}
            </small>

        </div>



        <span class="status-badge ${item.status}">
            ${item.status}
        </span>


    </div>





    <div class="response-box">


        <h4>
            ✨ AI Response
        </h4>


        <p>
            ${item.ai_response}
        </p>


    </div>





    ${
        item.status === "pending"

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

                class="chat-send-btn"

                onclick="replyInquiry('${item.id}')"

            >

                Send Reply

            </button>



        </div>


        `


        :


        `

        <div class="admin-reply">


            <h4>
                ✅ Admin Reply
            </h4>


            <p>
                ${item.admin_reply ?? ""}
            </p>


        </div>


        `


    }


</div>


`;

});


}









window.replyInquiry = async function(id) {



    const replyBox = document.getElementById(

        `reply-${id}`

    );



    if (!replyBox) {

        return;

    }



    const reply = replyBox.value.trim();



    if (!reply) {


        alert("Please write a reply first.");

        return;


    }





    const { error } = await supabaseClient

        .from("chat_inquiries")

        .update({

            admin_reply: reply,

            status: "answered",

            replied_at: new Date()

        })

        .eq("id", id);





    if(error){


        console.error(

            "REPLY ERROR:",

            error

        );


        alert(error.message);

        return;


    }





    alert("Reply sent!");



    loadInquiries();



};







loadInquiries();