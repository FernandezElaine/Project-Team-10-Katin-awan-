// js/admin-feedback.js
import { supabase } from "./supabase.js";

let feedbackList = [];

document.addEventListener("DOMContentLoaded", () => {
    loadFeedback();
});

export async function loadFeedback() {
    const container = document.getElementById("feedbackContainer");
    if (!container) return;

    const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">Failed to load feedback: ${error.message}</p>`;
        return;
    }

    feedbackList = data || [];
    renderFeedback(feedbackList);
}

function renderFeedback(list) {
    const container = document.getElementById("feedbackContainer");
    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = "<p>No feedback available.</p>";
        return;
    }

    list.forEach(fb => {
        const div = document.createElement("div");
        div.classList.add("document-card");
        div.innerHTML = `
            <div>
                <h3>${fb.subject}</h3>
                <p><b>Category:</b> ${fb.category}</p>
                <p>${fb.message}</p>
                <p><b>Status:</b> ${fb.status || "Pending"}</p>
            </div>
            <div class="admin-card-actions">
                <button onclick="resolveFeedback(${fb.id})">Mark Resolved</button>
                <button onclick="deleteFeedback(${fb.id})" class="danger-btn">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

export async function resolveFeedback(id) {
    const { error } = await supabase
        .from("feedback")
        .update({ status: "Resolved" })
        .eq("id", id);

    if (error) return alert(error.message);
    loadFeedback();
}

export async function deleteFeedback(id) {
    if (!confirm("Are you sure you want to delete this feedback?")) return;

    const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", id);

    if (error) return alert(error.message);
    loadFeedback();
}