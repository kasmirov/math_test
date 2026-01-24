import json
import sqlite3
import random
from contextlib import contextmanager
from datetime import datetime
from json import JSONDecodeError
from typing import List, Dict

from limits import default_limits
from db_config import db_config
from units import Units

ANONYMOUS = 'anonymous@localhost'


@contextmanager
def get_db_connection():
    """Контекстный менеджер для подключения к БД"""
    conn = sqlite3.connect(db_config['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# desktop use only
def get_users():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Загружаем всех пользователей и их профили
        cursor.execute('''
            SELECT u.id as user_id, u.username, u.email
            FROM users u
        ''')
        users = cursor.fetchall()
        return [dict(user) for user in users]


def get_user_id_by_email(email):
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Загружаем всех пользователей и их профили
        cursor.execute('''
            SELECT id
            FROM users
            WHERE email = ?
        ''', (email,))
        row = cursor.fetchone()
        return row['id']


# desktop use only
def get_user_profiles(user_id):
    """Получение профилей пользователя"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM profiles WHERE user_id = ?', (user_id,))
        profiles = cursor.fetchall()
        return [dict(profile) for profile in profiles]


# desktop use only
def get_profile_data(profile_id):
    """Получение данных профиля"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM profiles WHERE id = ?', (profile_id,))
        profile = cursor.fetchone()
        return dict(profile)


def get_profile_limits(profile_id):
    settings = json.loads(get_profile_data(profile_id)["settings"])
    return settings['limits']


# desktop use only
def create_profile(user_id, profile_name):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        user_row = cursor.fetchone()

        if not user_row:
            return

        default_settings = dict()
        default_settings["limits"] = default_limits()

        cursor.execute('''
            INSERT INTO profiles (user_id, name, type, settings)
            VALUES (?, ?, ?, ?)
        ''', (
            user_row['id'],
            profile_name,
            'personal',
            json.dumps(default_settings)
        ))
        conn.commit()


def delete_profile(profile):
    profile_id = profile["id"]
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            DELETE FROM profiles
            WHERE id = ?
        ''', (profile_id,)
        )
        conn.commit()


def get_solved_problems(profile_id):
    """
    Получить список решаемых ранее генераторов задач (разделов)

    :param profile_id:
    :return: Список problem_key для найденных генераторов
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
             SELECT DISTINCT problem_key 
             FROM history 
             WHERE profile_id = ? 
             ORDER BY problem_key
         ''', (profile_id,))
        return [row['problem_key'] for row in cursor.fetchall()]


def get_statistics(profile_id: int = None, problem_keys: List[str] = None,
                   date_start: datetime = None, date_end: datetime = None,
                   num_sessions: int = None,
                   session_uuid: int = None,
                   exclude_session_uuid: bool = False) -> Dict[str, Dict]:
    """
    Получить статистику по problem_key для указанного пользователя и профиля

    Args:
        profile_id: Профиль
        problem_keys: список problem_key для фильтрации (если None - все ключи)
        date_start: начальная дата периода (если None - с начала)
        date_end: конечная дата периода (если None - до конца)
        num_sessions: количество последних сессий для анализа (если None - все сессии)

    Returns:
        Словарь с статистикой по каждому problem_key
    """
    if profile_id is None:
        return {}

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Если указано ограничение по количеству сессий, находим последние N session_id
        session_filter = ""
        session_params = []
        if num_sessions is not None:
            cursor.execute('''
                SELECT DISTINCT session_id 
                FROM history 
                WHERE profile_id = ? 
                ORDER BY question_start_time DESC 
                LIMIT ?
            ''', (profile_id, num_sessions))

            session_ids = [row['session_id'] for row in cursor.fetchall()]
            if session_ids:
                placeholders = ','.join(['?' for _ in session_ids])
                session_filter = f" AND session_id IN ({placeholders})"
                session_params = session_ids

        # Базовый запрос
        query = """
            SELECT 
                problem_key,
                COUNT(*) as total_questions,
                SUM(CASE WHEN is_correct = 1 AND is_timeout = 0 THEN 1 ELSE 0 END) as correct_answers,
                SUM(CASE WHEN is_timeout = 1 THEN 1 ELSE 0 END) as timeout_answers,
                SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as incorrect_answers,
                AVG(time_sec) as avg_time_sec
            FROM history
            WHERE profile_id = ?
        """

        params = [profile_id]

        # Добавляем фильтр по сессиям
        if session_filter:
            query += session_filter
            params.extend(session_params)

        # Добавляем условия фильтрации по problem_keys
        if problem_keys:
            placeholders = ','.join(['?' for _ in problem_keys])
            query += f" AND problem_key IN ({placeholders})"
            params.extend(problem_keys)

        # Добавляем условия фильтрации по датам
        if date_start:
            query += " AND question_start_time >= ?"
            params.append(date_start.isoformat())

        if session_uuid is not None:
            # Получаем текущий индекс
            cursor.execute('''
                SELECT id FROM sessions 
                WHERE session_uuid = ?
            ''', (session_uuid,))
            session_id = cursor.fetchone()[0]
            if session_id is None:
                return {}
            query += " AND session_id = ?" if not exclude_session_uuid else " AND NOT session_id = ?"
            params.append(session_id)

        if date_end:
            query += " AND question_start_time <= ?"
            params.append(date_end.isoformat())

        # Группируем по problem_key
        query += " GROUP BY problem_key"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Формируем результат
        statistics = {
            'summary': {
                'total_questions': 0,
                'correct_answers': 0,
                'timeout_answers': 0,
                'incorrect_answers': 0,
                'correct_percent': 0,
                'timeout_percent': 0,
                'incorrect_percent': 0
            }
        }
        for row in rows:
            problem_key = row['problem_key']
            total = row['total_questions']
            correct = row['correct_answers']
            timeout = row['timeout_answers']
            incorrect = row['incorrect_answers']
            avg_time = row['avg_time_sec'] or 0

            # Рассчитываем проценты
            correct_percent = round((correct / total) * 100, 2) if total > 0 else 0
            timeout_percent = round((timeout / total) * 100, 2) if total > 0 else 0
            incorrect_percent = round((incorrect / total) * 100, 2) if total > 0 else 0

            statistics[problem_key] = {
                'total_questions': total,
                'correct_answers': correct,
                'timeout_answers': timeout,
                'incorrect_answers': incorrect,
                'avg_time_sec': round(avg_time, 2),
                'correct_percent': correct_percent,
                'timeout_percent': timeout_percent,
                'incorrect_percent': incorrect_percent
            }
            statistics['summary']['total_questions'] += total
            statistics['summary']['correct_answers'] += correct
            statistics['summary']['timeout_answers'] += timeout
            statistics['summary']['incorrect_answers'] += incorrect

        total = statistics['summary']['total_questions']
        statistics['summary']['correct_percent'] = round(statistics['summary']['correct_answers'] / total * 100, 2)  if total > 0 else 0
        statistics['summary']['timeout_percent'] = round(statistics['summary']['timeout_answers'] / total * 100, 2)  if total > 0 else 0
        statistics['summary']['incorrect_percent'] = round(statistics['summary']['incorrect_answers'] / total * 100, 2)  if total > 0 else 0

        return statistics


def get_history(profile_id,
                problem_key: str,
                date_start: datetime = None,
                date_end: datetime = None,
                num_sessions: int = None,
                is_correct: bool = None,
                is_timeout: bool = None) -> List[Dict]:
    """
    Получить историю задач для указанного problem_key

    Args:
        profile: Профиль
        problem_key: problem_key для фильтрации
        date_start: начальная дата периода (если None - с начала)
        date_end: конечная дата периода (если None - до конца)
        num_sessions: количество последних сессий для анализа (если None - все сессии)

    Returns:
        Список словарей с историей задач, отсортированный по session_id и question_index
    """
    if not profile_id:
        return []

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Если указано ограничение по количеству сессий, находим последние N session_id
        session_filter = ""
        session_params = []
        if num_sessions is not None:
            cursor.execute('''
                SELECT DISTINCT session_id 
                FROM history 
                WHERE profile_id = ? AND problem_key = ?
                ORDER BY session_id DESC 
                LIMIT ?
            ''', (profile_id, problem_key, num_sessions))

            session_ids = [row['session_id'] for row in cursor.fetchall()]
            if session_ids:
                placeholders = ','.join(['?' for _ in session_ids])
                session_filter = f" AND session_id IN ({placeholders})"
                session_params = session_ids

        # Базовый запрос
        query = """
            SELECT 
                id,
                problem_key,
                question_start_time,
                session_id,
                question_index,
                total_questions,
                question,
                correct_answer,
                users_answer,
                is_correct,
                is_timeout,
                time_sec
            FROM history
            WHERE profile_id = ? AND problem_key = ?
        """

        params = [profile_id, problem_key]

        # Добавляем фильтр по сессиям
        if session_filter:
            query += session_filter
            params.extend(session_params)

        # Добавляем условия фильтрации по датам
        if date_start:
            query += " AND question_start_time >= ?"
            params.append(date_start.isoformat())

        if date_end:
            query += " AND question_start_time <= ?"
            params.append(date_end.isoformat())

        if is_correct is not None:
            query += " AND is_correct = ?"
            params.append(is_correct)

        if is_timeout is not None:
            query += " AND is_timeout = ?"
            params.append(is_timeout)

        # Сортируем по session_id (новые сессии first) и номеру вопроса
        query += " ORDER BY session_id DESC, question_index"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Формируем результат - простой список задач
        history_data = []
        for row in rows:
            history_data.append({
                'id': row['id'],
                'problem_key': row['problem_key'],
                'question_start_time': datetime.fromisoformat(row['question_start_time']),
                'session_id': row['session_id'],
                'question_index': row['question_index'],
                'total_questions': row['total_questions'],
                'question': row['question'],
                'correct_answer': deserialize_answer(row['correct_answer']),
                'users_answer': deserialize_answer(row['users_answer']),
                'is_correct': bool(row['is_correct']),
                'is_timeout': bool(row['is_timeout']),
                'time_sec': row['time_sec']
            })

        return history_data


def get_anonymous_user():
    return get_user_id_by_email(ANONYMOUS)


def get_anonymous_profile():
    user_id = get_user_id_by_email(ANONYMOUS)
    profile_id = get_user_profiles(user_id)[0]['id']
    return profile_id


def create_session(profile_id):
    """
    Create new session
    :param profile_id: Profile Id, if none specified, using anonymous
    :return:
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if profile_id:
            # Проверяем существующую сессию если указан профиль
            cursor.execute('''
                SELECT session_uuid FROM sessions 
                WHERE profile_id = ?
            ''', (profile_id,))

            existing = cursor.fetchone()
            #if existing:
            #    conn.close()
            #    return existing[0]
        else:
            # profile_id not provided, need to specify anonymous user
            profile_id = get_anonymous_profile()

        # Создаем новую сессию
        session_uuid = random.randint(1, 2 ** 32 - 1)  # Генерируем случайный UUID
        cursor.execute('''
            INSERT INTO sessions (profile_id, session_uuid, current_question_index)
            VALUES (?, ?, ?)
        ''', (profile_id, session_uuid, 0))

        conn.commit()
        return session_uuid


def get_current_session(profile):
    if profile is None:
        return None
    profile_id = profile["id"]

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT session_uuid FROM sessions 
            WHERE profile_id = ?
        ''', (profile_id,))

        result = cursor.fetchone()
        return result[0] if result else None


def delete_current_session(profile_id):
    if profile_id is None:
        return {}

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем текущий индекс
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE profile_id = ?
        ''', (profile_id,))
        result = cursor.fetchone()
        if result is None:
            return
        session_id = result[0]

        # Удаляем записи в test_plan
        cursor.execute('''
            DELETE FROM test_plan 
            WHERE profile_id = ? AND session_id = ?
        ''', (profile_id, session_id))

        # Удаляем запись в sessions
        cursor.execute('''
            DELETE FROM sessions 
            WHERE profile_id = ?
        ''', (profile_id,))
        conn.commit()


def get_current_question_idx(session_uuid):
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем текущий индекс
        cursor.execute('''
            SELECT current_question_index FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))

        current_index = cursor.fetchone()
        if not current_index:
            return None
        return current_index[0]


def increase_current_question_idx(session_uuid):
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Обновляем индекс
        cursor.execute('''
            UPDATE sessions 
            SET current_question_index = current_question_index + 1 
            WHERE session_uuid = ?
            RETURNING current_question_index
        ''', (session_uuid,))
        new_index = cursor.fetchone()[0]
        conn.commit()

        return new_index

def get_questions_number(session_uuid):
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))
        session_id = cursor.fetchone()[0]

        cursor.execute('''
            SELECT * FROM test_plan
            WHERE session_id = ?
        ''', (session_id,))

        return len(cursor.fetchall())


def add_question_to_session(profile_id, session_uuid, problem_key, question_index, question, correct_answer, timeout):
    if not profile_id:
        profile_id = get_anonymous_profile()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        correct_answer = serialize_answer(correct_answer)

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))
        session_id = cursor.fetchone()[0]

        # Вставляем запись в test_plan
        cursor.execute('''
            INSERT INTO test_plan 
            (profile_id, session_id, problem_key, question_index, question, correct_answer, timeout)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (profile_id, session_id, problem_key, question_index, question, correct_answer, timeout))

        conn.commit()


def serialize_answer(answer):
    """
    Сериализует ответ в строку для хранения в базе данных.
    Возвращает
    """
    # Простые типы - сохраняем в исходном виде
    if isinstance(answer, (str, int, float, bool)):
        return answer

    if isinstance(answer, Units):
        return str(answer.to_dict())


def deserialize_answer(answer):
    """
    Десериализует ответ из строки хранения в базе данных в объект
    Возвращает объект
    """
    try:
        tmp = json.loads(answer.replace("'", "\""))
        if isinstance(tmp, dict) and '__class__' in tmp and tmp['__class__'] in ['Units', 'Weight', 'Length', 'Volume']:
            return Units.from_dict(tmp)
    except JSONDecodeError as e:
        pass
    return answer

def get_question(session_uuid):
    question_index = get_current_question_idx(session_uuid)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))

        session_id = cursor.fetchone()[0]

        cursor.execute('''
            SELECT 
                problem_key,
                question_index,
                question,
                correct_answer,
                timeout
            FROM test_plan
            WHERE 
                session_id = ? AND
                question_index = ?
        ''', (session_id, question_index))
        row = cursor.fetchone()
        if not row:
            return None, None, None, None, None
        problem_key = row['problem_key']
        question_index = row['question_index']
        question = row['question']
        correct_answer = deserialize_answer(row['correct_answer'])
        timeout = row['timeout']
        return problem_key, question_index, question, correct_answer, timeout


def update_current_question_start_time(session_uuid):
    question_index = get_current_question_idx(session_uuid)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))

        session_id = cursor.fetchone()[0]
        start_date = datetime.now()

        # Проверяем текущее время старта вопроса на NULL
        cursor.execute('''
            SELECT question_start_time FROM test_plan
            WHERE session_id = ? AND question_index = ?
        ''', (session_id, question_index))
        current_time = cursor.fetchone()[0]
        if current_time is not None:
            return

        # Обновляем время старта вопроса
        cursor.execute('''
            UPDATE test_plan 
            SET question_start_time = ? 
            WHERE session_id = ? AND question_index = ?
        ''', (start_date.isoformat(), session_id, question_index))
        conn.commit()


def get_current_question_start_time(session_uuid):
    question_index = get_current_question_idx(session_uuid)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))
        session_id = cursor.fetchone()[0]

        # Обновляем время старта вопроса
        cursor.execute('''
            SELECT question_start_time
            FROM test_plan 
            WHERE session_id = ? AND question_index = ?
        ''', (session_id, question_index))
        return cursor.fetchone()[0]


def update_history(profile_id, session_uuid, users_answer, is_correct, is_timeout, time_sec):
    """
    Отправить задачу в историю
    """
    if not profile_id:
        return

    problem_key, question_index, question, correct_answer, _ = get_question(session_uuid)
    if not problem_key:
        return
    question_start_time = get_current_question_start_time(session_uuid)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Получаем session_id
        cursor.execute('''
            SELECT id FROM sessions 
            WHERE session_uuid = ?
        ''', (session_uuid,))
        session_id = cursor.fetchone()[0]

        # Получаем кол-во вопросов в сессии
        cursor.execute('''
            SELECT id FROM test_plan 
            WHERE session_id = ?
        ''', (session_id,))
        total_questions = len(cursor.fetchall())

        correct_answer = serialize_answer(correct_answer)
        users_answer = serialize_answer(users_answer)

        cursor.execute('''
            INSERT INTO history (
                profile_id, 
                session_id,
                problem_key,
                question_index,
                total_questions,
                question_start_time,
                question,
                correct_answer,
                users_answer,
                is_correct,
                is_timeout,
                time_sec)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            profile_id,
            session_id,
            problem_key,
            question_index,
            total_questions,
            question_start_time,
            question,
            correct_answer,
            users_answer,
            is_correct,
            is_timeout,
            time_sec
        ))
        conn.commit()


def update_mistakes(profile_id, session_uuid, is_correct):
    """
    Отправить задачу в историю
    """
    problem_key, _, question, correct_answer, _ = get_question(session_uuid)
    if not problem_key:
        return

    with get_db_connection() as conn:
        cursor = conn.cursor()
        is_old_record = False

        # Find the same problem/question previously asked
        cursor.execute('''
            SELECT 
                profile_id, 
                problem_key,
                question,
                correct_answer
            FROM mistakes
            WHERE problem_key = ? AND question = ?
        ''', (
            problem_key,
            question
        ))

        if cursor.fetchone():
            is_old_record = True

        if is_correct and is_old_record:
            # Need to remove old record from mistakes
            cursor.execute('''
                DELETE FROM mistakes
                WHERE problem_key = ? AND question = ?
            ''', (
                problem_key,
                question
            ))
            conn.commit()
            return
        elif is_correct and not is_old_record:
            # Just new correctly answered question. Nothing to see here
            return
        elif is_old_record:
            # No need to duplicate old record
            return

        correct_answer = serialize_answer(correct_answer)

        # Insert mistake
        cursor.execute('''
            INSERT INTO mistakes (
                profile_id, 
                problem_key,
                question,
                correct_answer)
            VALUES (?, ?, ?, ?)
        ''', (
            profile_id,
            problem_key,
            question,
            correct_answer
        ))
        conn.commit()


def get_mistakes(profile_id, problem_key) -> List[Dict]:
    """
    Получить список нерешенных задач для указанного problem_key
    Returns:
        Список словарей с историей задач, отсортированный по session_id и question_index
    """
    # Return empty list for anonymous user
    if not profile_id:
        return []

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Базовый запрос
        cursor.execute("""
            SELECT 
                question,
                correct_answer
            FROM mistakes
            WHERE profile_id = ? AND problem_key = ?
        """, (
            profile_id, problem_key
        ))
        rows = cursor.fetchall()
        mistakes_data = []
        for row in rows:
            mistakes_data.append({
                'question': row['question'],
                'correct_answer': deserialize_answer(row['correct_answer'])
            })
        return mistakes_data