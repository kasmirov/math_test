import json

from core import explore_static_generators, get_generator, get_generators, generate_test_plan
from db_func import get_users, get_user_profiles, create_profile, get_statistics, get_history, get_solved_problems, \
    create_session, delete_current_session, get_mistakes, delete_profile
from core import run_test


from menu_manager import MenuManager, Action


# TODO Сделать limit-ы зависящими от класса задания,
#  но так чтобы их можно было бы переопределить лимитами юзера, если они заданы
#  причем не обязаны быть заданы все, а возможно некоторые из параметров


'''
        operations = {
            '+': lambda a, b: a + b,
            '-': lambda a, b: a - b,
            '×': lambda a, b: a * b,
            '÷': lambda a, b: a // b
        }
        op_symbol = random.choice(list(operations.keys()))
        op_func = operations[op_symbol]
'''


def work_on_mistakes(profile):
    """Режим работы над ошибками"""

    # Delete existing session
    delete_current_session(profile)

    # Create_new_session
    session_uuid = create_session(profile['id'])

    # Max number of questions in section
    num_of_questions = 10

    print("\n--- Работа над ошибками ---")

    # Print mistakes in every section
    problems = get_solved_problems(profile)
    for problem_key in problems:
        mistakes = get_mistakes(profile, problem_key)
        if not mistakes:
            #print("У вас пока нет ошибок для работы!")
            continue
        print(f"\nРаздел: {get_generators().get(problem_key).get_section_name()}")
        print(f"Количество ошибок: {len(mistakes)}")

    # Selected sections for WoM
    selected_sections = get_generators().values()

    # Prepare questions for new session
    generate_test_plan(profile['id'],
                       session_uuid,
                       selected_sections,
                       num_of_questions,
                       work_on_mistakes=True)

    # Создаем корутину
    coro = run_test(profile, session_uuid, False)

    # Инициализируем корутину
    try:
        next(coro)
    except StopIteration:
        print ("На текущий момент ошибок нет")
        return

    # Run test plan
    try:
        while True:
            # Ввод данных с клавиатуры
            user_input = input(f"Ответ: ")
            if user_input.strip() == "":
                print("Пожалуйста, введите ответ!")
                continue
            coro.send(user_input)
    except StopIteration:
        pass
    except KeyboardInterrupt:
        print("\nРабота над ошибками прервана!")
        coro.close()
        return

    print("\nРабота над ошибками завершена!")


def display_profile_stats(profile):
    """Показать статистику пользователя"""
    profile_name = profile["name"]
    print(f"\nСтатистика для пользователя: {profile_name}")
    print("=" * 60)

    # Общая статистика по разделам
    print("\nОбщая статистика по разделам:")
    print("-" * 60)
    profile_stats = get_statistics(profile["id"])
    for problem_key in profile_stats:
        data = profile_stats[problem_key]
        gen = get_generator(problem_key)
        if gen is None:
            continue
        section_name = gen.get_section_name()

        print(f"\nРаздел: {section_name}")
        print(f"  Всего вопросов: {data['total_questions']}")
        print(f"  Правильных:   {data['correct_answers']} ({data['correct_percent']:.1f}%)")
        print(f"  Просрочено:   {data['timeout_answers']} ({data['timeout_percent']:.1f}%)")
        print(f"  Неправильных: {data['incorrect_answers']} ({data['incorrect_percent']:.1f}%)")
        print(f"  Среднее время ответа: {data['avg_time_sec']:.1f} сек")

    # TODO Rework needed
    print("\n\nИстория тестирования:")
    # История тестов
    for problem_key in get_solved_problems(profile):
        # Фильтруем вопросы с ошибками
        history = get_history(profile["id"], problem_key, is_correct=False)
        if history:
            print("-" * 60)
            gen = get_generator(problem_key)
            section_name = gen.get_section_name()
            print(f"  Раздел: {section_name}")
            for i, test in enumerate(reversed(history), 1):
                date_str = test["question_start_time"].strftime("%d.%m.%Y %H:%M")
                print(f"\nТест #{i} от {date_str}")
                print(f"  - Вопрос: {test['question']}")
                print(f"    Ваш ответ: {test['users_answer']}")
                print(f"    Правильный ответ: {test['correct_answer']}")
                print(f"    Время: {test['time_sec']:.1f} сек\n")

    print("=" * 60)


class MathTestApp:
    def __init__(self):
        self.menu = MenuManager()
        self.current_user_id = 0
        self.current_profile = None

        # TODO check if local user in db and create if not
        local_user_name = 'Default'
        users = get_users()
        for idx, elem in enumerate(users):
            if elem['username'] == local_user_name:
                self.current_user_id = elem['user_id']
                break

    def run(self):
        """Основной цикл приложения"""
        while True:
            # Показываем соответствующее меню в зависимости от состояния
            if not self.current_profile:
                action = self.menu.show_login_menu()
            else:
                action = self.menu.show_user_menu()

            # Обработка действий для неавторизованного состояния
            if not self.current_profile:
                if action.type == "select_profile":
                    self.select_profile()
                elif action.type == "exit":
                    print("Выход из программы...")
                    break
                elif action.type == "invalid_choice":
                    self.menu.show_error("Некорректный выбор!")

            # Обработка действий для авторизованного состояния
            else:
                if action.type == "start_test":
                    self.start_test_session()
                elif action.type == "show_stats":
                    self.show_statistics()
                elif action.type == "work_on_mistakes":
                    self.work_on_mistakes()
                elif action.type == "change_profile":
                    self.change_profile()
                elif action.type == "exit":
                    print("Выход из программы...")
                    break
                elif action.type == "invalid_choice":
                    self.menu.show_error("Некорректный выбор!")

    def change_profile(self):
        """Смена пользователя"""
        self.current_profile = None
        self.menu.current_profile_name = None

    def select_profile(self):
        """Обработка выбора пользователя"""
        profiles = get_user_profiles(self.current_user_id)

        while True:
            action = self.menu.show_profile_selection(profiles)

            if action.type == "select_profile":
                self.current_profile = profiles[action.params["user_index"]]
                self.current_profile["settings"] = json.loads(self.current_profile["settings"]) # TODO merge and validate limits
                self.menu.current_profile_name = self.current_profile["name"]
                explore_static_generators(self.current_profile["settings"]["limits"], has_text_mode=True)
                break

            elif action.type == "create_profile":
                profile_name = self.menu.prompt_new_profile_name()
                if profile_name:
                    create_profile(self.current_user_id, profile_name)
                    break

            elif action.type == "delete_profile":
                profile_pos = self.menu.prompt_delete_profile()
                try:
                    idx = int(profile_pos) - 1
                    if 0 <= idx < len(profiles):
                        profile_to_delete = profiles[idx]
                        delete_profile(profile_to_delete)
                        profiles = get_user_profiles(self.current_user_id)

                        self.menu.show_message(f"Пользователь {profile_to_delete['name']} удален!")
                        if self.current_profile == profile_to_delete:
                            self.current_profile = None
                            self.menu.current_profile_name = None
                    else:
                        self.menu.show_error("Неверный номер!")
                except ValueError:
                    self.menu.show_error("Некорректный ввод!")

            elif action.type == "back":
                break

            else:
                self.menu.show_error("Некорректный выбор!")


    def start_test_session(self):
        """
        Запуск тестовой сессии.
        ?Создается новая тестовая сессия, либо если найдена, загружается старая?
        """
        # Получение списка разделов для меню
        sections = []
        for gen in get_generators().values():
            sections.append((gen.get_section_name(), gen.default_timeout))

        # Показ меню выбора разделов с возможностью вернуться
        selected_indices = self.menu.show_section_selection(sections)

        # Если пользователь выбрал "Вернуться назад"
        if selected_indices is None:
            return

        selected_sections = []
        for idx in selected_indices:
            if 0 <= idx < len(get_generators()):
                selected_sections.append(list(get_generators().values())[idx])

        # Если не выбрано ни одного раздела (включая случай возврата)
        if not selected_sections:
            return

        # Запрос параметров теста
        num_of_questions = self.menu.prompt_questions_count()
        timeout = self.menu.prompt_timeout(selected_sections[0].default_timeout)

        # Delete existing session
        delete_current_session(self.current_profile)

        # Create_new_session
        session_uuid = create_session(self.current_profile['id'])

        # Prepare questions for new session
        generate_test_plan(self.current_profile['id'],
                           session_uuid,
                           selected_sections,
                           num_of_questions,
                           timeout)

        # Test cycle
        # Get current question index (get_current_question_idx + get)
        # Get current question by session_uuid
        # Show question and start timer
        # Story in history with start timer
        # Wait answer
        # Check result and timeout
        # Store mistakes
        # Next question? Yes - (increase_current_question_idx) then continue cycle, No - break cycle
        # Show session statistics

        # Создаем корутину
        coro = run_test(self.current_profile, session_uuid, True)
        # Инициализируем корутину
        next(coro)

        try:
            while True:
                # Ввод данных с клавиатуры
                user_input = input(f"Ответ: ")
                if user_input.strip() == "":
                    print("Пожалуйста, введите ответ!")
                    continue
                coro.send(user_input)
        except StopIteration:
            pass
        except KeyboardInterrupt:
            print("\nРабота над ошибками прервана!")
            coro.close()
            return

        test_results = get_statistics(self.current_profile["id"], session_uuid=session_uuid)
        # Показ результатов
        if test_results:
            self.menu.show_test_results(test_results)

        # TODO вернуть show_section_summary в конец секции

    def show_statistics(self):
        """Показать статистику пользователя"""
        if not self.current_profile:
            self.menu.show_error("Сначала выберите пользователя!")
            return
        display_profile_stats(self.current_profile)

    def work_on_mistakes(self):
        """Режим работы над ошибками"""
        if not self.current_profile:
            self.menu.show_error("Сначала выберите пользователя!")
            return
        work_on_mistakes(self.current_profile)


if __name__ == "__main__":
    app = MathTestApp()
    app.run()