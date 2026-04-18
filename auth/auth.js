// Automatically redirect if already logged in!
const existing_token = localStorage.getItem('meetingbot_token');
if (existing_token) {
    window.location.href = '../homepage/homepage.html';
}

// Identify which form we are on
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const errorDisplay = document.getElementById('error-message');
const successDisplay = document.getElementById('success-message');

const API_URL = 'http://localhost:3000/api/auth';

function showError(msg) {
    errorDisplay.classList.remove('error-hidden');
    if (successDisplay) successDisplay.style.display = 'none';
    errorDisplay.innerText = msg;
}

function showSuccess(msg) {
    errorDisplay.classList.add('error-hidden');
    if (successDisplay) {
        successDisplay.style.display = 'block';
        successDisplay.innerText = msg;
    }
}

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                // Save token and navigate
                localStorage.setItem('meetingbot_token', data.token);
                localStorage.setItem('meetingbot_user_name', data.user.name);
                window.location.href = '../homepage/homepage.html';
            } else {
                showError(data.error || 'Signup failed');
            }
        } catch (err) {
            showError('Network error. Is the backend running?');
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                // Save token and navigate
                localStorage.setItem('meetingbot_token', data.token);
                localStorage.setItem('meetingbot_user_name', data.user.name);
                window.location.href = '../homepage/homepage.html';
            } else {
                showError(data.error || 'Login failed');
            }
        } catch (err) {
            showError('Network error. Is the backend running?');
        }
    });
}

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reset-email').value;
        const newPassword = document.getElementById('reset-password').value;
        
        try {
            const res = await fetch(`${API_URL}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, newPassword })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                showSuccess(data.message || 'Password reset successfully! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                showError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            showError('Network error. Is the backend running?');
        }
    });
}
