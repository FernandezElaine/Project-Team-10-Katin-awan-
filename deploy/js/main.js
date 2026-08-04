// Modal Functions
function showAdminLogin() {
    document.getElementById('adminModal').classList.add('active');
    document.getElementById('signupModal').classList.remove('active');
}

function showSignup() {
    document.getElementById('signupModal').classList.add('active');
    document.getElementById('adminModal').classList.remove('active');
}

function closeModal() {
    document.querySelectorAll('.modal, .project-modal, .document-modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal') ||
        e.target.classList.contains('project-modal') ||
        e.target.classList.contains('document-modal')) {
        closeModal();
    }
});

// Admin Login
function adminLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;

    if (user === 'admin' && pass === 'admin123') {
        alert('Login successful! Redirecting to dashboard...');
        closeModal();
        window.location.href = 'pages/dashboard.html';
    } else {
        alert('Invalid credentials. Try: admin / admin123');
    }

    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
}

// Register User (Create Account)
function registerUser() {
    // Get all input values
    const inputs = document.querySelectorAll('#signupModal input');
    const name = inputs[0].value.trim();
    const email = inputs[1].value.trim();
    const password = inputs[2].value.trim();

    // Validation
    if (!name || !email || !password) {
        alert('Please fill in all fields!');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters!');
        return;
    }

    if (!email.includes('@')) {
        alert('Please enter a valid email address!');
        return;
    }

    // Success - simulate account creation
    alert(`Account created successfully! Welcome, ${name}!\n\nYou can now login to access the portal.`);

    // Clear inputs
    inputs[0].value = '';
    inputs[1].value = '';
    inputs[2].value = '';

    closeModal();
}

// Format Peso
function formatPeso(amount) {
    return "₱" + Number(amount).toLocaleString();
}

// Escape HTML for security
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}