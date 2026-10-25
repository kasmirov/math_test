import re
import os
import secrets
import json
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, redirect, abort, render_template
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies, verify_jwt_in_request
)
from werkzeug.security import generate_password_hash, check_password_hash

from core.core import get_question_blocks, explore_static_generators, generate_test_plan, get_generator
from core.db_func import create_session, get_anonymous_profile, get_user_id_by_email, \
    update_current_question_start_time, get_question, increase_current_question_idx, get_questions_number, \
    get_current_question_idx, update_history, update_mistakes, get_anonymous_user, get_current_question_start_time, \
    get_statistics, get_user_profiles, get_profile_limits, get_unsolved_problems, init_db, get_db_connection, \
    get_session_history, delete_current_session
from core.units import Units, parse_units_input

app = Flask(__name__, static_folder='static', template_folder='templates')


def env_bool(name, default=False):
    """Читает булеву настройку из переменной окружения."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ('1', 'true', 'yes', 'on')


# Каталог для постоянных секретов (рядом с базой данных)
SECRET_DIR = os.path.dirname(os.path.abspath(os.environ.get('DATABASE_PATH') or 'app.db'))


def persisted_secret(env_name, filename):
    """Возвращает секрет из переменной окружения или из постоянного файла.

    Если переменная окружения не задана, секрет создаётся один раз и
    сохраняется, чтобы токены не инвалидировались при перезапуске
    и работали при нескольких воркерах.
    """
    env_value = os.environ.get(env_name)
    if env_value:
        return env_value

    path = os.path.join(SECRET_DIR, filename)
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                value = f.read().strip()
            if value:
                return value

        value = secrets.token_urlsafe(64)
        os.makedirs(SECRET_DIR, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(value)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        return value
    except OSError:
        app.logger.warning('Не удалось сохранить %s, секрет будет только в памяти', filename)
        return secrets.token_urlsafe(64)


# Конфигурация
app.config['JWT_SECRET_KEY'] = persisted_secret('JWT_SECRET_KEY', '.jwt_secret_key')
app.config['JWT_PRIVATE_KEY'] = persisted_secret('JWT_PRIVATE_KEY', '.jwt_private_key')
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)

app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_CSRF_CHECK_FORM'] = False

# Дополнительные настройки безопасности
app.config['JWT_ALGORITHM'] = 'HS256'  # Алгоритм подписи
# Cookie с флагом Secure отправляются только по HTTPS.
# По умолчанию False (локальная разработка по HTTP, как в README),
# в проде за HTTPS обязательно JWT_COOKIE_SECURE=1.
app.config['JWT_COOKIE_SECURE'] = env_bool('JWT_COOKIE_SECURE', False)
app.config['JWT_COOKIE_HTTPONLY'] = True  # Защита от XSS
app.config['JWT_COOKIE_SAMESITE'] = 'Lax'  # Защита от CSRF: cookie не отправляются при кросс-сайтовых запросах
app.config['JWT_COOKIE_DOMAIN'] = None

jwt = JWTManager(app)


def _register_jwt_error_handlers(jwt_instance):
    """Регистрирует обработчики ошибок JWT с логированием попыток."""

    @jwt_instance.invalid_token_loader
    def invalid_token_callback(error_string):
        app.logger.warning("Invalid token attempt: %s", error_string)
        # Можно также отслеживать IP и количество попыток
        return jsonify({'error': 'Invalid token'}), 401

    @jwt_instance.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        app.logger.info("Token expired for identity: %s", jwt_payload.get('sub'))
        return jsonify({'error': 'Token has expired'}), 401


_register_jwt_error_handlers(jwt)


def validate_password(password):
    """Валидация пароля: минимальная длина 8 символов, хотя бы одна цифра и буква"""
    if len(password) < 8:
        return False
    if not re.search(r'\d', password):
        return False
    if not re.search(r'[a-zA-Z]', password):
        return False
    return True


EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

# Ограничения на параметры генерации теста
MAX_QUESTIONS_PER_BLOCK = 100
MAX_TIMEOUT_SECONDS = 3600


def validate_email(email):
    """Простая проверка формата email."""
    return bool(email) and bool(EMAIL_RE.match(email)) and len(email) <= 254


# Простой in-memory rate limiter (на процесс)
_rate_limit_store = defaultdict(deque)


def rate_limit(max_requests, window_seconds):
    """Ограничивает число запросов к эндпоинту с одного IP в окне времени."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{fn.__name__}:{request.remote_addr or 'unknown'}"
            now = time.monotonic()
            bucket = _rate_limit_store[key]
            while bucket and now - bucket[0] > window_seconds:
                bucket.popleft()
            if len(bucket) >= max_requests:
                return jsonify({'error': 'Too many requests'}), 429
            bucket.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def internal_error(exc):
    """Логирует исключение и возвращает клиенту обезличенный ответ 500."""
    app.logger.exception(f"Internal server error: {exc}")
    return jsonify({'error': 'Internal server error'}), 500


def optional_jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            # Пытаемся верифицировать токен (без исключений при optional=True)
            verify_jwt_in_request(optional=True)

            # Получаем email пользователя (будет None если токен невалиден/отсутствует)
            user_email = get_jwt_identity()

            # Проверяем, валиден ли токен через наличие user_email
            is_authenticated = user_email is not None

            return fn(*args, **kwargs,
                      is_authenticated=is_authenticated,
                      user_email=user_email)

        except Exception as e:
            # Анонимный пользователь (без валидного токена)
            return fn(*args, **kwargs,
                      is_authenticated=False,
                      user_email=None)

    return wrapper

def get_user_and_profile(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs,
                  user_id=None,
                  profile_id=None)
    return wrapper


# Эндпоинты аутентификации
@app.route('/api/auth/register', methods=['POST'])
@rate_limit(10, 60)
def register():
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400

        # Персональные данные: для публичного сайта согласие обязательно (152-ФЗ).
        personal_agreement = bool(data.get('personal_data_agreement', False))
        cookies_agreement = bool(data.get('cookies_agreement', False))
        if not MINIMAL_PAGES and not personal_agreement:
            return jsonify({
                'error': 'Требуется согласие на обработку персональных данных'
            }), 400

        now = datetime.now().isoformat(timespec='seconds')

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Проверяем существует ли пользователь
            cursor.execute('SELECT id FROM users WHERE email = ?', (data['email'],))
            if cursor.fetchone():
                return jsonify({'error': 'User already exists'}), 400

            # Проверяем пароль пользователя
            if not validate_password(data['password']):
                return jsonify({
                    'error': 'Password must be at least 8 characters long and contain letters and numbers'
                }), 400

            password_hash = generate_password_hash(data['password'])

            # Вставляем нового пользователя
            cursor.execute('''
                INSERT INTO users (email, username, password_hash, cookies_agreement,
                cookies_agreement_date, personal_data_agreement, personal_data_agreement_date,
                test_results_mailing, obligatory_mailing, service_news)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['email'],
                data.get('username', data['email']),
                password_hash,
                cookies_agreement,
                now if cookies_agreement else None,
                personal_agreement,
                now if personal_agreement else None,
                data.get('test_results_mailing', False),
                data.get('obligatory_mailing', False),
                data.get('service_news', False)
            ))
            conn.commit()

        # Создаем токены для автоматического входа после регистрации
        access_token = create_access_token(identity=data['email'])
        refresh_token = create_refresh_token(identity=data['email'])

        response = jsonify({
            'message': 'User created successfully',
            'user': {
                'email': data['email'],
                'username': data.get('username', data['email'])
            }
        })

        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)

        return response, 201
    except Exception as e:
        return internal_error(e)


@app.route('/api/auth/login', methods=['POST'])
@rate_limit(10, 60)
def login():
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE email = ?', (data['email'],))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({'error': 'Invalid credentials'}), 401

            user = dict(user_row)

            if not check_password_hash(user['password_hash'], data['password']):
                return jsonify({'error': 'Invalid credentials'}), 401

        access_token = create_access_token(identity=user['email'])
        refresh_token = create_refresh_token(identity=user['email'])

        response = jsonify({
            'message': 'Login successful',
            'user': {
                'email': user['email'],
                'username': user['username'],
                'id': user['id'],
                'cookies_agreement': bool(user['cookies_agreement']),
                'personal_data_agreement': bool(user['personal_data_agreement']),
                'test_results_mailing': bool(user['test_results_mailing']),
                'obligatory_mailing': bool(user['obligatory_mailing']),
                'service_news': bool(user['service_news']),
                'preferences': json.loads(user['preferences']) if user['preferences'] else {}
            }
        })

        set_access_cookies(response, access_token)
        set_refresh_cookies(response, refresh_token)

        return response
    except Exception as e:
        return internal_error(e)


@app.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user = get_jwt_identity()
        access_token = create_access_token(identity=current_user)

        response = jsonify({'message': 'Token refreshed'})
        set_access_cookies(response, access_token)
        return response
    except Exception as e:
        return jsonify({'error': 'Refresh failed'}), 401


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    response = jsonify({'message': 'Logout successful'})
    unset_jwt_cookies(response)
    return response


# Эндпоинты управления аккаунтом
@app.route('/api/account', methods=['GET'])
@jwt_required()
def get_account():
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE email = ?', (current_user,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({'error': 'User not found'}), 404

            user = dict(user_row)

            # Получаем профили пользователя
            user_profiles = get_user_profiles(user['id'])
            profiles_data = []
            for profile in user_profiles:
                profiles_data.append({
                    'id': profile['id'],
                    'name': profile['name'],
                    'type': profile['type'],
                    'settings': json.loads(profile['settings']) if profile['settings'] else {},
                    'created_at': profile['created_at']
                })

            return jsonify({
                'user': {
                    'email': user['email'],
                    'username': user['username'],
                    'id': user['id'],
                    'cookies_agreement': bool(user['cookies_agreement']),
                    'personal_data_agreement': bool(user['personal_data_agreement']),
                    'test_results_mailing': bool(user['test_results_mailing']),
                    'obligatory_mailing': bool(user['obligatory_mailing']),
                    'service_news': bool(user['service_news']),
                    'preferences': json.loads(user['preferences']) if user['preferences'] else {}
                },
                'profiles': profiles_data
            })
    except Exception as e:
        return internal_error(e)


@app.route('/api/account', methods=['DELETE'])
@jwt_required()
def delete_account():
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM users WHERE email = ?', (current_user,))
            conn.commit()

        response = jsonify({'message': 'Account deleted successfully'})
        unset_jwt_cookies(response)
        return response
    except Exception as e:
        return internal_error(e)


@app.route('/api/account', methods=['PUT'])
@jwt_required()
def update_account():
    try:
        current_user = get_jwt_identity()
        data = request.get_json()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Получаем текущего пользователя
            cursor.execute('SELECT * FROM users WHERE email = ?', (current_user,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({'error': 'User not found'}), 404

            # Подготавливаем данные для обновления.
            # Whitelist полей с функциями преобразования значения (None — как есть).
            allowed_fields = {
                'username': None,
                'preferences': json.dumps,
                'cookies_agreement': bool,
                'personal_data_agreement': bool,
                'test_results_mailing': bool,
                'obligatory_mailing': bool,
                'service_news': bool,
            }

            # При изменении согласий фиксируем дату их простановки/отзыва.
            consent_date_fields = {
                'cookies_agreement': 'cookies_agreement_date',
                'personal_data_agreement': 'personal_data_agreement_date',
            }

            now = datetime.now().isoformat(timespec='seconds')
            update_fields = []
            update_values = []
            for field, converter in allowed_fields.items():
                if field in data:
                    value = converter(data[field]) if converter else data[field]
                    update_fields.append(f'{field} = ?')
                    update_values.append(value)
                    if field in consent_date_fields:
                        update_fields.append(f'{consent_date_fields[field]} = ?')
                        update_values.append(now if value else None)

            if not update_fields:
                return jsonify({'error': 'No fields to update'}), 400

            update_values.append(current_user)

            # Выполняем обновление
            cursor.execute(f'''
                UPDATE users 
                SET {', '.join(update_fields)} 
                WHERE email = ?
            ''', update_values)
            conn.commit()

            # Получаем обновленные данные пользователя
            cursor.execute('SELECT * FROM users WHERE email = ?', (current_user,))
            updated_user = dict(cursor.fetchone())

        return jsonify({
            'message': 'Account updated successfully',
            'user': {
                'email': updated_user['email'],
                'username': updated_user['username'],
                'cookies_agreement': bool(updated_user['cookies_agreement']),
                'personal_data_agreement': bool(updated_user['personal_data_agreement']),
                'test_results_mailing': bool(updated_user['test_results_mailing']),
                'obligatory_mailing': bool(updated_user['obligatory_mailing']),
                'service_news': bool(updated_user['service_news']),
                'preferences': json.loads(updated_user['preferences']) if updated_user['preferences'] else {}
            }
        })
    except Exception as e:
        return internal_error(e)


# Эндпоинты управления профилями
@app.route('/api/profiles', methods=['GET'])
@jwt_required()
def get_profiles():
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM users WHERE email = ?', (current_user,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({'error': 'User not found'}), 404

            user_profiles = get_user_profiles(user_row['id'])
            profiles_data = []
            for profile in user_profiles:
                profiles_data.append({
                    'id': profile['id'],
                    'name': profile['name'],
                    'type': profile['type'],
                    'settings': json.loads(profile['settings']) if profile['settings'] else {},
                    'created_at': profile['created_at']
                })

        return jsonify(profiles_data)
    except Exception as e:
        return internal_error(e)


@app.route('/api/profiles', methods=['POST'])
@jwt_required()
def create_profile():
    try:
        current_user = get_jwt_identity()
        data = request.get_json()

        if not data or not data.get('name') or not data.get('type'):
            return jsonify({'error': 'Name and type are required'}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM users WHERE email = ?', (current_user,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({'error': 'User not found'}), 404

            cursor.execute('''
                INSERT INTO profiles (user_id, name, type, settings)
                VALUES (?, ?, ?, ?)
            ''', (
                user_row['id'],
                data['name'],
                data['type'],
                json.dumps(data.get('settings', {}))
            ))
            conn.commit()

            profile_id = cursor.lastrowid

        return jsonify({
            'message': 'Profile created successfully',
            'profile': {
                'id': profile_id,
                'name': data['name'],
                'type': data['type'],
                'settings': data.get('settings', {})
            }
        }), 201
    except Exception as e:
        return internal_error(e)


@app.route('/api/profiles/<int:profile_id>', methods=['GET'])
@jwt_required()
def get_profile(profile_id):
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.* FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = ? AND u.email = ?
            ''', (profile_id, current_user))
            profile_row = cursor.fetchone()

        if not profile_row:
            return jsonify({'error': 'Profile not found'}), 404

        profile = dict(profile_row)
        return jsonify({
            'id': profile['id'],
            'name': profile['name'],
            'type': profile['type'],
            'settings': json.loads(profile['settings']) if profile['settings'] else {},
            'created_at': profile['created_at']
        })
    except Exception as e:
        return internal_error(e)


@app.route('/api/profiles/<int:profile_id>', methods=['PUT'])
@jwt_required()
def update_profile(profile_id):
    try:
        current_user = get_jwt_identity()
        data = request.get_json()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.* FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = ? AND u.email = ?
            ''', (profile_id, current_user))
            profile_row = cursor.fetchone()

            if not profile_row:
                return jsonify({'error': 'Profile not found'}), 404

            # Подготавливаем данные для обновления
            update_fields = []
            update_values = []

            if 'name' in data:
                update_fields.append('name = ?')
                update_values.append(data['name'])
            if 'type' in data:
                update_fields.append('type = ?')
                update_values.append(data['type'])
            if 'settings' in data:
                update_fields.append('settings = ?')
                update_values.append(json.dumps(data['settings']))

            if not update_fields:
                return jsonify({'error': 'No fields to update'}), 400

            update_values.append(profile_id)
            update_values.append(current_user)

            # Выполняем обновление
            cursor.execute(f'''
                UPDATE profiles 
                SET {', '.join(update_fields)} 
                FROM users u 
                WHERE profiles.id = ? AND profiles.user_id = u.id AND u.email = ?
            ''', update_values)
            conn.commit()

        return jsonify({
            'message': 'Profile updated successfully',
            'profile': {
                'id': profile_id,
                'name': data.get('name', profile_row['name']),
                'type': data.get('type', profile_row['type']),
                'settings': data.get('settings', json.loads(profile_row['settings']) if profile_row['settings'] else {})
            }
        })
    except Exception as e:
        return internal_error(e)


@app.route('/api/profiles/<int:profile_id>', methods=['DELETE'])
@jwt_required()
def delete_profile(profile_id):
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                DELETE FROM profiles 
                WHERE id = ? AND user_id = (SELECT id FROM users WHERE email = ?)
            ''', (profile_id, current_user))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Profile not found'}), 404

        return jsonify({'message': 'Profile deleted successfully'})
    except Exception as e:
        return internal_error(e)


@app.route('/api/profiles/<int:profile_id>/clone', methods=['POST'])
@jwt_required()
def clone_profile(profile_id):
    try:
        current_user = get_jwt_identity()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.* FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.id = ? AND u.email = ?
            ''', (profile_id, current_user))
            original_profile_row = cursor.fetchone()

            if not original_profile_row:
                return jsonify({'error': 'Profile not found'}), 404

            original_profile = dict(original_profile_row)

            cursor.execute('''
                INSERT INTO profiles (user_id, name, type, settings)
                VALUES (?, ?, ?, ?)
            ''', (
                original_profile['user_id'],
                f"{original_profile['name']} (Copy)",
                original_profile['type'],
                original_profile['settings']
            ))
            conn.commit()

            new_profile_id = cursor.lastrowid

        return jsonify({
            'message': 'Profile cloned successfully',
            'profile': {
                'id': new_profile_id,
                'name': f"{original_profile['name']} (Copy)",
                'type': original_profile['type'],
                'settings': json.loads(original_profile['settings']) if original_profile['settings'] else {}
            }
        }), 201
    except Exception as e:
        return internal_error(e)


@app.route('/api/test/blocks', methods=['GET', 'POST'])
@optional_jwt_required
def get_test_blocks(is_authenticated=False, user_email=None):
    """Получить список блоков вопросов с возможностью фильтрации по тегам"""
    requested_tags = request.args.getlist('tags')

    # Get credentials
    if is_authenticated:
        _, profile_id = get_creds_from_email(user_email)
    else:
        profile_id = get_anonymous_profile()
    limits = get_profile_limits(profile_id)

    question_blocks = get_question_blocks(limits)
    # Фильтруем блоки по тегам, если указаны
    if requested_tags:
        filtered_blocks = [
            block for block in question_blocks
            if any(tag in block["tags"] for tag in requested_tags)
        ]
    else:
        filtered_blocks = question_blocks

    all_tags = list(set(tag for block in question_blocks for tag in block["tags"]))
    sorted_tags = sorted(all_tags)

    return jsonify({
        "blocks": filtered_blocks,
        "available_tags": sorted_tags
    })


@optional_jwt_required
def explore_generators(is_authenticated=False, user_email=None):
    """Получить список генераторов доступных юзеру и настроенных под выбранный профиль"""
    pass

@app.route('/api/test/session/new', methods=['POST'])
@optional_jwt_required
def create_new_session(is_authenticated=False, user_email=None):
    """Создать новую сессию тестирования"""
    num_of_questions = request.args.get('num_of_questions', type=int)
    timeout = request.args.get('timeout', type=int)
    data = request.get_json(silent=True) or {}
    work_on_mistakes = data.get('work_on_mistakes')
    block_ids = request.args.getlist('block_id', type=int)
    if not block_ids:
        return jsonify({"error": "Не выбраны блоки вопросов"}), 400

    if num_of_questions is not None and not (1 <= num_of_questions <= MAX_QUESTIONS_PER_BLOCK):
        return jsonify({"error": f"num_of_questions должен быть в диапазоне 1..{MAX_QUESTIONS_PER_BLOCK}"}), 400
    if timeout is not None and not (1 <= timeout <= MAX_TIMEOUT_SECONDS):
        return jsonify({"error": f"timeout должен быть в диапазоне 1..{MAX_TIMEOUT_SECONDS}"}), 400

    # Get credentials
    if is_authenticated:
        user_id, profile_id = get_creds_from_email(user_email)
    else:
        user_id = get_anonymous_user()
        profile_id = get_anonymous_profile()

    limits = get_profile_limits(profile_id)
    question_blocks = get_question_blocks(limits)

    # Проверяем, что все block_id существуют
    valid_block_ids = [block['id'] for block in question_blocks]
    for block_id in block_ids:
        if block_id not in valid_block_ids:
            return jsonify({"error": f"Блок с ID {block_id} не найден"}), 400

    # Убираем незавершённые сессии авторизованного профиля, чтобы не копить их в БД.
    # Для анонимного профиля (общий на всех) очистку не делаем, чтобы не
    # затрагивать сессии других анонимных пользователей.
    if is_authenticated:
        delete_current_session(profile_id)

    # Создаем сессию
    session_uuid = create_session(profile_id)

    selected_sections = [ get_generator(block['section_key']) for block in question_blocks if block['id'] in block_ids ]

    # Prepare questions for new session
    generate_test_plan(profile_id,
                       session_uuid,
                       selected_sections,
                       num_of_questions,
                       limits,
                       timeout,
                       work_on_mistakes)

    return jsonify({
        "session_uuid": session_uuid
    })


@app.route('/api/test/session/<session_uuid>', methods=['GET'])
@optional_jwt_required
def get_next_question(session_uuid, is_authenticated=False, user_email=None):
    """Получить следующий вопрос в сессии"""
    # Get credentials
    if is_authenticated:
        user_id, profile_id = get_creds_from_email(user_email)
    else:
        user_id = get_anonymous_user()
        profile_id = get_anonymous_profile()

    limits = get_profile_limits(profile_id)

    # Get current question by session_uuid
    problem_key, question_index, question, correct_answer, timeout = get_question(session_uuid)
    if not problem_key:
        return jsonify({"error": "Сессия не найдена"}), 404

    # Устанавливаем время начала вопроса
    update_current_question_start_time(session_uuid)

    # Подсчитываем номер вопроса в блоке и общее количество вопросов в блоке
    idx = get_current_question_idx(session_uuid)
    q_total = get_questions_number(session_uuid)
    if idx >= q_total:
        return jsonify({"message": "Тест завершен"}), 200

    # Возвращаем вопрос без правильного ответа
    question_data = {
        "id": question_index,
        "block_id": problem_key,
        "block_name": get_generator(problem_key).get_section_name(limits),
        "block_hint": get_generator(problem_key).get_hint(),
        "text": question,
        "time_limit": timeout,
        "current_question_number": question_index + 1,
        "total_questions_in_block": q_total
    }

    return jsonify(question_data)


def get_creds_from_email(current_user_email):
    """Получить учетные данные по email с обработкой ошибок"""
    if not current_user_email:
        return get_anonymous_user(), get_anonymous_profile()

    try:
        user_id = get_user_id_by_email(current_user_email)
        if not user_id:
            return get_anonymous_user(), get_anonymous_profile()

        profiles = get_user_profiles(user_id)
        if not profiles or len(profiles) == 0:
            return user_id, None

        # Пробуем получить profile_id из запроса
        data = request.get_json(silent=True) or {}
        requested_profile_id = data.get("profile_id")

        if requested_profile_id and requested_profile_id in [p["id"] for p in profiles]:
            return user_id, requested_profile_id

        return user_id, profiles[0]["id"]

    except Exception as e:
        app.logger.error(f"Error getting credentials for {current_user_email}: {str(e)}")
        return get_anonymous_user(), get_anonymous_profile()


@app.route('/api/test/session/<session_uuid>/answer', methods=['POST'])
@optional_jwt_required
def submit_answer(session_uuid, is_authenticated=False, user_email=None):
    """Отправить ответ на вопрос и получить результат проверки"""
    # TODO
    # Потенциальная бага, если начал как зарегистрированный пользователь,
    # а потом токен протух и ответ не запишется в историю, т.к. будет считаться анонимом

    # Get credentials
    if is_authenticated:
        _, profile_id = get_creds_from_email(user_email)
    else:
        profile_id = get_anonymous_profile()

    problem_key, question_index, question, correct_answer, timeout = get_question(session_uuid)
    if not problem_key:
        return jsonify({"error": "Не удалось найти сессию"}), 400
    q_total = get_questions_number(session_uuid)
    if question_index >= q_total:
        return jsonify({"message": "Тест завершен"}), 200

    data = request.get_json()
    if 'answer' not in data:
        return jsonify({"error": "Ответ не предоставлен"}), 400

    user_input = data['answer'].strip()

    if isinstance(correct_answer, Units):
        # Правильный ответ для генератора конвертации может быть задан в других
        # единицах измерения — разбираем ответ пользователя в Units для сравнения.
        user_input = parse_units_input(user_input)

    # Check solution
    is_correct = user_input == correct_answer
    start_time = get_current_question_start_time(session_uuid)
    timediff = datetime.now() - datetime.fromisoformat(start_time)
    is_timeout = False

    if is_correct:
        # Check timeout
        if timediff.total_seconds() > timeout:
            is_timeout = True

    if is_authenticated:
        # Store to history
        update_history(profile_id, session_uuid, user_input, is_correct, is_timeout, timediff.total_seconds())
        # Update mistakes
        update_mistakes(profile_id, session_uuid, is_correct)

    new_idx = increase_current_question_idx(session_uuid)

    return jsonify({
        "is_correct": is_correct,
        "is_timeout": is_timeout,
        "correct_answer": str(correct_answer),
        "has_next_question": new_idx != q_total
    })


@app.route('/api/test/session/<session_uuid>/results', methods=['POST'])
@optional_jwt_required
def get_session_results(session_uuid, is_authenticated=False, user_email=None):
    # Get credentials
    if is_authenticated:
        _, profile_id = get_creds_from_email(user_email)
    else:
        profile_id = get_anonymous_profile()

    current_results = get_statistics(profile_id, session_uuid=session_uuid)
    summary = current_results["summary"]
    total_questions = summary["total_questions"]

    # Суммарное время = сумма средних времён по разделам, взвешенных по числу вопросов
    total_time = sum(
        stats["avg_time_sec"] * stats["total_questions"]
        for key, stats in current_results.items() if key != "summary"
    )
    avg_time_sec = round(total_time / total_questions, 1) if total_questions else 0

    response = {
        "total_questions": summary["total_questions"],
        "correct_answers": summary["correct_answers"],
        "incorrect_answers": summary["incorrect_answers"],
        "timeout_answers": summary["timeout_answers"],
        "correct_percent": summary["correct_percent"],
        "total_time": round(total_time, 1),
    }

    if is_authenticated:
        # Get combined stats for last 3 tests + 1 current
        previous_results = get_statistics(profile_id,
                                          num_sessions=4,
                                          session_uuid=session_uuid,
                                          exclude_session_uuid=True)
        section_comparison = {}

        for problem, current_problem_stats in current_results.items():
            if problem == 'summary':
                continue
            if problem in previous_results.keys():
                previous_problem_stats = previous_results[problem]
                section_comparison[problem] = {
                    "block_name": get_generator(problem).get_section_name(),
                    "correct_delta": round(current_problem_stats["correct_percent"] - previous_problem_stats["correct_percent"], 1),
                    "incorrect_delta": round(current_problem_stats["incorrect_percent"] - previous_problem_stats["incorrect_percent"], 1),
                    "timeout_delta": round(current_problem_stats["timeout_percent"] - previous_problem_stats["timeout_percent"], 1),
                    "avg_time_sec_delta": round(current_problem_stats["avg_time_sec"] - previous_problem_stats["avg_time_sec"], 1)
                }

        response["avg_time_sec"] = avg_time_sec
        response["sections"] = section_comparison

    return jsonify(response)


@app.route('/api/stats', methods=['POST'])
@jwt_required()
def get_stats():
    """Получить статистику пользователя"""
    current_user_email = get_jwt_identity()
    user_id, profile_id = get_creds_from_email(current_user_email)

    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    block_ids = request.args.getlist('block_id', type=int)

    limits = get_profile_limits(profile_id)
    question_blocks = get_question_blocks(limits)

    # Проверяем, что все block_id существуют
    valid_block_ids = [block['id'] for block in question_blocks]
    for block_id in block_ids:
        if block_id not in valid_block_ids:
            return jsonify({"error": f"Блок с ID {block_id} не найден"}), 400
    selected_sections = [get_generator(block['section_key']) for block in question_blocks if block['id'] in block_ids]
    problem_keys = [section.get_key() for section in selected_sections]

    stats = []
    date_start = datetime.strptime(date_from, '%Y-%m-%d') if date_from else None
    date_end = datetime.strptime(f"{date_to} 23:59", '%Y-%m-%d %H:%M') if date_to else None
    profile_stats = get_statistics(profile_id,
                                   date_start=date_start,
                                   date_end=date_end,
                                   problem_keys=problem_keys
                                   )
    for problem_key in profile_stats:
        data = profile_stats[problem_key]
        gen = get_generator(problem_key)
        if gen is None:
            continue

        section_key = gen.get_key()
        try:
            block_id = next(x['id'] for x in question_blocks if x['section_key'] == section_key)
        except StopIteration:
            # Генератор есть, но соответствующего блока нет — пропускаем раздел
            continue

        stats.append({
            "block_id": block_id,
            "block_name": gen.get_section_name(limits),
            "correct_answers": data['correct_answers'],
            "correct_timeout_answers": data['timeout_answers'],
            "total_answers": data['total_questions'],
            "percentage": data['correct_percent']
        })

    return jsonify(stats)

@app.route('/api/stats/unsolved', methods=['POST'])
@jwt_required()
def get_unsolved():
    """Получить статистику пользователя"""
    current_user_email = get_jwt_identity()
    user_id, profile_id = get_creds_from_email(current_user_email)
    limits = get_profile_limits(profile_id)

    question_blocks = get_question_blocks(limits)
    unsolved = get_unsolved_problems(profile_id)
    unsolved_dict = {gen["problem_key"]: gen["count"] for gen in unsolved}

    filtered_blocks = [
        #{ "block": block, "count": unsolved_dict[block["section_key"]]} for block in question_blocks if any(block["section_key"] == gen["problem_key"] for gen in unsolved)
        block for block in question_blocks if any(block["section_key"] == gen["problem_key"] for gen in unsolved)
    ]
    for block in filtered_blocks:
        block["count"] = unsolved_dict[block["section_key"]]
    return jsonify(filtered_blocks)

@app.route('/api/history', methods=['POST'])
@optional_jwt_required
def get_history(is_authenticated=False, user_email=None):
    """Получить список сессий по выбранному блоку и периоду"""
    # Получаем данные пользователя
    if is_authenticated:
        _, profile_id = get_creds_from_email(user_email)
    else:
        profile_id = get_anonymous_profile()

    # Получаем параметры запроса
    data = request.get_json()
    block_id = data.get('block_id')
    date_from = data.get('date_from')
    date_to = data.get('date_to')

    if block_id is None:
        return jsonify({"error": "block_id is required"}), 400

    # Получаем limits для текущего профиля
    limits = get_profile_limits(profile_id)

    # Находим section_key по block_id
    question_blocks = get_question_blocks(limits)
    section_key = None
    for block in question_blocks:
        if block['id'] == block_id:
            section_key = block['section_key']
            break

    if not section_key:
        return jsonify({"error": "Block not found"}), 404

    # Преобразуем даты
    date_start = datetime.strptime(f"{date_from} 00:00", '%Y-%m-%d %H:%M') if date_from else None
    date_end = datetime.strptime(f"{date_to} 23:59", '%Y-%m-%d %H:%M') if date_to else None

    # Получаем историю сессий из БД
    sessions = get_session_history(profile_id, section_key, date_start, date_end)

    return jsonify(sessions)

# Статические файлы
# APP_PAGES_MODE=minimal — для локального/персонального запуска: без заглавной
# страницы и без футера, только приложение и инструкция.
PAGES_MODE = os.environ.get('APP_PAGES_MODE', 'full').strip().lower()
MINIMAL_PAGES = PAGES_MODE == 'minimal'


# ---------------------------------------------------------------------------
# Персональные данные: оператор и правовые страницы (152-ФЗ)
# ---------------------------------------------------------------------------

# Реквизиты оператора персональных данных берутся из окружения, чтобы их можно
# было задать при запуске боевого контейнера, не меняя образ.
OPERATOR_ENV_DEFAULTS = {
    'OPERATOR_NAME': 'Владелец сайта math_test',
    'OPERATOR_ADDRESS': 'не указан',
    'OPERATOR_EMAIL': 'не указан',
    'OPERATOR_URL': '',
}


def get_operator_info():
    """Сведения об операторе персональных данных из переменных окружения."""
    return {
        'operator_name': os.environ.get('OPERATOR_NAME') or OPERATOR_ENV_DEFAULTS['OPERATOR_NAME'],
        'operator_address': os.environ.get('OPERATOR_ADDRESS') or OPERATOR_ENV_DEFAULTS['OPERATOR_ADDRESS'],
        'operator_email': os.environ.get('OPERATOR_EMAIL') or OPERATOR_ENV_DEFAULTS['OPERATOR_EMAIL'],
        'operator_url': os.environ.get('OPERATOR_URL') or OPERATOR_ENV_DEFAULTS['OPERATOR_URL'],
        'policy_date': os.environ.get('POLICY_DATE') or '2026-01-01',
    }


@app.route('/api/legal', methods=['GET'])
def legal_config():
    """Публичная конфигурация правовых документов для фронтенда."""
    return jsonify({
        'enabled': not MINIMAL_PAGES,
        'operator_name': get_operator_info()['operator_name'],
        'policy_url': '/policy',
        'consent_url': '/consent',
    })


@app.route('/policy')
def policy():
    """Политика в отношении обработки персональных данных."""
    if MINIMAL_PAGES:
        abort(404)
    return render_template('policy.html', **get_operator_info())


@app.route('/consent')
def consent():
    """Текст согласия на обработку персональных данных."""
    if MINIMAL_PAGES:
        abort(404)
    return render_template('consent.html', **get_operator_info())


@app.route('/privacy')
def privacy():
    """Политика конфиденциальности объединена с политикой обработки ПД."""
    if MINIMAL_PAGES:
        abort(404)
    return redirect('/policy', code=301)


@app.route('/')
def index():
    if MINIMAL_PAGES:
        return redirect('/app')
    return send_from_directory('templates', 'index.html')


@app.route('/app')
def app_index():
    return send_from_directory('templates', 'app.html')


@app.route('/help')
def help():
    return send_from_directory('templates', 'help.html')

@app.route('/footer.html')
def footer():
    if MINIMAL_PAGES:
        abort(404)
    return render_template('footer.html', **get_operator_info())

@app.route('/account.html')
@jwt_required()
def account():
    return send_from_directory('templates', 'account.html')


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# Картинки для случайного показа на главной странице
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'}
SHUFFLE_IMG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img', 'shuffle')


@app.route('/api/images/shuffle', methods=['GET'])
def get_shuffle_images():
    """Список картинок для случайного показа на главной странице."""
    try:
        names = sorted(
            name for name in os.listdir(SHUFFLE_IMG_DIR)
            if os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
        )
    except OSError:
        names = []
    return jsonify({'images': [f'/img/shuffle/{name}' for name in names]})


@app.route('/img/<path:path>')
def serve_img(path):
    return send_from_directory('img', path)


@app.route('/css/<path:path>')
def serve_css(path):
    return send_from_directory('css', path)


@app.route('/js/<path:path>')
def serve_js(path):
    if MINIMAL_PAGES and path.replace('\\', '/') == 'consent.js':
        # В минимальном (локальном) образе файл не поставляется: отдаём пустой
        # скрипт, чтобы не было 404 в консоли браузера.
        return app.response_class(
            '/* consent.js не входит в минимальный образ */\n',
            mimetype='application/javascript'
        )
    return send_from_directory('js', path)

# Обработка CORS для разработки
ALLOWED_ORIGINS = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://0.0.0.0:5000',
]

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({})
        origin = request.headers.get('Origin')
        if origin:
            if origin in ALLOWED_ORIGINS or app.debug:
                response.headers.add('Access-Control-Allow-Origin', origin)
                response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

@app.after_request
def after_request(response):
    # Разрешить все origins (для разработки) или укажите конкретные
    origin = request.headers.get('Origin')
    if origin:
        if origin in ALLOWED_ORIGINS or app.debug:
            response.headers.add('Access-Control-Allow-Origin', origin)
            response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


def main():
    explore_static_generators(latex=True)
    # Инициализация базы данных при запуске
    init_db()
    app.run(host="0.0.0.0", debug=False, port=5000)


if __name__ == "__main__":
    main()