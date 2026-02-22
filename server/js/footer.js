document.addEventListener('DOMContentLoaded', function() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Ошибка загрузки футера');
                }
                return response.text();
            })
            .then(data => {
                placeholder.innerHTML = data;
            })
            .catch(error => {
                console.error('Не удалось загрузить футер:', error);
                // Можно показать заглушку
                placeholder.innerHTML = '<footer><div class="container"><p>© 2026 MathTest</p></div></footer>';
            });
    }
});