// login.js

function togglePassword() {
    const input = document.getElementById('input-password');
    const icon  = document.getElementById('icon-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}
