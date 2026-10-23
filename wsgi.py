"""WSGI-точка входа для боевого запуска (gunicorn).

Использование: gunicorn --bind 127.0.0.1:8000 wsgi:app
Инициализация (регистрация генераторов и схема БД) выполняется при импорте.
"""
from server.app_server import app, explore_static_generators, init_db

explore_static_generators(latex=True)
init_db()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
