// Registration handler for employee self-registration

async function handleRegisterSubmit(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const departmentInput = document.getElementById("department");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm_password");
    const submitBtn = document.getElementById("submitBtn");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const department = departmentInput ? departmentInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";
    const confirm_password = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

    // 1. Client-side validations
    if (!name || !email || !department || !password || !confirm_password) {
        showAuthAlert("Please fill in all required fields.");
        return;
    }

    if (password.length < 8) {
        showAuthAlert("Password must be at least 8 characters long.");
        return;
    }

    if (password !== confirm_password) {
        showAuthAlert("Passwords do not match. Please verify.");
        return;
    }

    // 2. Perform submission
    setButtonLoading(submitBtn, true, "Creating Account...");
    hideAuthAlert();

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
                email,
                department,
                password,
                confirm_password,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            showAuthAlert(data.error || "Registration failed. Please check your details.");
            setButtonLoading(submitBtn, false, "Create Account");
            return;
        }

        // On success (201), redirect to login page with registered query parameter
        window.location.href = data.redirect_url || "/login?registered=1";
    } catch (err) {
        console.error("Registration request error:", err);
        showAuthAlert("Unable to connect to server. Please ensure the backend is running.");
        setButtonLoading(submitBtn, false, "Create Account");
    }
}

