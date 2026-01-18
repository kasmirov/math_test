from datetime import datetime
import re
import time

from generator_add_sub import AdditionSubtractionGenerator
from generator_comparison import ComparisonGenerator
from generator_conversion import ConversionGenerator
from generator_div import DivisionGenerator
from generator_equation import EquationGenerator
from generator_mul import MultiplicationGenerator
from generator_priority import PriorityOperationsGenerator
from generator_priority_3rd_grade import PriorityOperationsGenerator3rd
from generator_yaml import YamlProblemGenerator
from generator_geom_fig_props import GeometryFigurePropertiesGenerator
from generator_fraction import FractionGenerator
from generator_clock import ClockGeneratorSimple, ClockGeneratorHard

from db_func import add_question_to_session, get_mistakes, get_history, get_questions_number, update_history, \
    get_question, update_current_question_start_time, get_current_question_start_time, increase_current_question_idx, \
    update_mistakes
from limits import base_limits
from units import Units

# Регистрация генераторов
# TODO Переделать в кэш от хэша лимитов
GENERATORS = {}
# Default timeout for questions
DEFAULT_TIMEOUT = 1000

def explore_static_generators(limits, latex=False, has_text_mode=None):
    global GENERATORS
    GENERATORS = {
        gen.get_key(): gen for gen in [
            AdditionSubtractionGenerator(limits, latex),
            MultiplicationGenerator(limits, latex),
            DivisionGenerator(limits, latex),
            EquationGenerator(limits, latex),
            PriorityOperationsGenerator(limits, latex),
            PriorityOperationsGenerator3rd(limits),
            ComparisonGenerator(limits),
            ConversionGenerator(limits),
            YamlProblemGenerator("2nd_grade.yaml"),
            YamlProblemGenerator("3rd_grade.yaml"),
            GeometryFigurePropertiesGenerator(limits),
            FractionGenerator(base_limits()),
            ClockGeneratorSimple(),
            ClockGeneratorHard()
        ] if has_text_mode is None or gen.has_text_mode() == has_text_mode
    }

def get_generators():
    return GENERATORS

def get_generator(section_key):
    return GENERATORS.get(section_key)

def get_question_blocks():
    blocks = [{"id": idx,
               "name": GENERATORS.get(key).get_section_name(),
               "description": GENERATORS.get(key).get_description(),
               "hint": GENERATORS.get(key).get_hint(),
               "question_count": GENERATORS.get(key).get_problems_number(),
               "tags": GENERATORS.get(key).get_tags(),
               "section_key": key,
               } for idx, key in enumerate(GENERATORS.keys())]
    return blocks

def generate_test_plan(profile_id,
                       session_uuid,
                       generators,
                       num_of_questions,
                       timeout: int = DEFAULT_TIMEOUT,
                       work_on_mistakes: bool = False):
    """
    Prepare questions for new session
    :param profile_id: Profile ID
    :param session_uuid: Session uuid
    :param generators: List of selected generators
    :param num_of_questions: Number of questions per section,
    :param timeout: Timeout for question, default to 1000 s
    :param work_on_mistakes: In case of True only mistakes will be filled in test plan
    :return:
    """

    if num_of_questions is None:
        num_of_questions = 1
    # TODO num of questions per section

    question_idx = 0

    for generator in generators:
        problem_key = generator.get_key()
        section_question_idx = 0
        answer_timeout = timeout
        if not timeout:
            gen_timeout = generator.get_timeout()
            answer_timeout = gen_timeout if gen_timeout else DEFAULT_TIMEOUT

        # Добавляем задачи из предыдущих ошибок
        mistakes_history = get_mistakes(profile_id, problem_key)

        while section_question_idx < num_of_questions and section_question_idx < len(mistakes_history):
            question = mistakes_history[section_question_idx]['question']
            correct_answer = mistakes_history[section_question_idx]['correct_answer']
            add_question_to_session(profile_id, session_uuid, problem_key, question_idx, question, correct_answer, answer_timeout)
            question_idx += 1
            section_question_idx += 1

        # Skip questions generation in case of work on mistakes
        if work_on_mistakes:
            continue

        # Запрос истории ранее выполнявшихся задач
        questions_history = get_history(profile_id, problem_key, num_sessions=100)
        questions_history = [item["question"] for item in questions_history]

        start_time = time.time()
        while section_question_idx < num_of_questions:
            # Generate new question
            try:
                question, answer = generator.generate_problem()
            except Exception as e:
                continue

            # Таймаут на генерацию
            timediff = time.time() - start_time
            if timediff > 5:
                break

            # Проверяем, есть ли эта задача в истории и в текущем наборе
            if question in questions_history:
                continue

            questions_history.append(question)
            add_question_to_session(profile_id, session_uuid, problem_key, question_idx, question, answer, answer_timeout)
            question_idx += 1
            section_question_idx += 1
            start_time = time.time()


def run_test(profile, session_uuid, save_history: bool = True):
    q_total = get_questions_number(session_uuid)
    prev_problem_key = ""

    while True:
        # Get current question by session_uuid
        problem_key, question_index, question, correct_answer, timeout = get_question(session_uuid)
        if not problem_key:
            break
        # Start timer
        update_current_question_start_time(session_uuid)
        # Show section
        if prev_problem_key != problem_key:
            print(f"\n--- Раздел: {get_generator(problem_key).get_section_name()} ---")
            prev_problem_key = problem_key
        # Show question
        print(f"Вопрос {question_index + 1}/{q_total}: {question}")

        # Wait user input
        user_input = yield
        user_input = user_input.strip()

        # Convert input to expected format (Units)
        if isinstance(correct_answer, Units):
            # Для генератора конвертации правильных ответов может быть несколько
            # Нормализуем ввод пользователя
            user_input = user_input.lower()
            user_input = user_input.replace(',', '.')  # Заменяем запятые на точки

            # Regexp
            pattern = r"(\d*.?\d+)\s*([a-zA-Zа-яА-Я]+)"
            match = re.match(pattern, user_input)
            if not match:
                print("Некорректный ввод")
            else:
                value = float(match.group(1).replace(' ', ''))
                units = match.group(2)
                try:
                    user_input = Units(value, units)
                except ValueError as e:
                    print("Некорректный ввод")

        # Check solution
        is_correct = user_input == correct_answer
        start_time = get_current_question_start_time(session_uuid)
        timediff = datetime.now() - datetime.fromisoformat(start_time)
        is_timeout = False

        if is_correct:
            # Check timeout
            if timediff.total_seconds() > timeout:
                is_timeout = True
                print("Время вышло! ")
            else:
                print("Правильно! ✓")
        else:
            # Store to mistakes
            print(f"Неправильно! Правильный ответ: {correct_answer}")

        # Store to history
        if save_history:
            update_history(profile, session_uuid, user_input, is_correct, is_timeout, timediff.total_seconds())

        # Update mistakes
        update_mistakes(profile, session_uuid, is_correct)

        new_idx = increase_current_question_idx(session_uuid)
        if new_idx == q_total:
            break
