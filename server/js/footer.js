document.addEventListener('DOMContentLoaded', function() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) {
        return;
    }

    // Футер опционален: в минимальном режиме (локальный/персональный запуск)
    // /footer.html не отдаётся, и футер просто не отображается.
    fetch('footer.html')
        .then(response => {
            if (!response.ok) {
                return '';
            }
            return response.text();
        })
        .then(data => {
            placeholder.innerHTML = data;
        })
        .catch(error => {
            console.warn('Футер недоступен:', error);
        });
});
