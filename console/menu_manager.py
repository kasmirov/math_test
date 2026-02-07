from core.core import get_generator


class Action:
    """Класс для представления действий профиля"""

    def __init__(self, action_type, **params):
        self.type = action_type
        self.params = params


class MenuManager:
    def __init__(self):
        self.current_profile_name = None

    def show_login_menu(self):
        """Главное меню (до входа)"""
        print("\n" + "=" * 60)
        print(" МАТЕМАТИЧЕСКИЙ ТРЕНАЖЁР ".center(60))
        print("=" * 60)
        print("1. Выбрать профиля")
        print("2. Выйти")

        choice = input("Выберите действие: ").strip()

        if choice == "1":
            return Action("select_profile")
        elif choice == "2":
            return Action("exit")
        return Action("invalid_choice")

    def show_user_menu(self):
        """Меню после входа"""
        print("\n" + "=" * 60)
        profile_info = f" [ {self.current_profile_name} ] "
        print(f" МАТЕМАТИЧЕСКИЙ ТРЕНАЖЁР{profile_info} ".center(60))
        print("=" * 60)
        print("1. Начать новый тест")
        print("2. Показать статистику")
        print("3. Работа над ошибками")
        print("4. Сменить профиль")
        print("5. Выйти")

        choice = input("Выберите действие: ").strip()

        if choice == "1":
            return Action("start_test")
        elif choice == "2":
            return Action("show_stats")
        elif choice == "3":
            return Action("work_on_mistakes")
        elif choice == "4":
            return Action("change_profile")
        elif choice == "5":
            return Action("exit")
        return Action("invalid_choice")

    def show_profile_selection(self, profiles):
        """Меню выбора профиля"""
        print("\nСписок профилей:")
        for i, profile in enumerate(profiles, 1):
            name = profile["name"]
            print(f"{i}. {name}")

        print("\nДействия:")
        print("n. Создать новый профиль")
        print("d. Удалить профиля")
        print("0. Вернуться назад")

        choice = input("Выберите действие (номер профиля или команду): ").strip().lower()

        if choice == 'n':
            return Action("create_profile")
        elif choice == 'd':
            return Action("delete_profile")
        elif choice == '0':
            return Action("back")
        elif choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(profiles):
                return Action("select_profile", user_index=idx)

        return Action("invalid_choice")

    def prompt_new_profile_name(self):
        """Запрос имени нового профиля"""
        return input("\nВведите имя нового профиля: ").strip()

    def prompt_delete_profile(self):
        """Запрос подтверждения удаления"""
        return input("Введите номер профиля для удаления: ").strip()

    def show_section_selection(self, sections):
        """Меню выбора разделов с возможностью вернуться"""
        print("\nВыберите разделы (через запятую) или 0 для возврата:")
        for i, (section_name, timeout) in enumerate(sections, 1):
            print(f"{i}. {section_name} (таймаут: {timeout} сек)")
        print("0. Вернуться назад")

        selected = input("Ваш выбор: ").replace(" ", "").split(",")

        # Обработка возврата
        if "0" in selected:
            return []

        return [int(s) - 1 for s in selected if s.isdigit()]

    def prompt_questions_count(self):
        """Запрос количества вопросов"""
        while True:
            count = input("Количество вопросов для каждого раздела: ").strip()
            if count.isdigit() and int(count) > 0:
                return int(count)
            print("Пожалуйста, введите положительное число!")

    def prompt_timeout(self, default_timeout):
        """Запрос времени на ответ"""
        timeout = input(f"Время на ответ (секунды) [по умолчанию {default_timeout}]: ").strip()
        return int(timeout) if timeout.isdigit() else default_timeout

    def show_error(self, message):
        """Отображение ошибки"""
        print(f"Ошибка: {message}")

    def show_message(self, message):
        """Отображение информационного сообщения"""
        print(message)

    def show_test_results(self, results):
        """Отображение результатов теста"""
        print("\nРезультаты теста:")
        print("=" * 60)

        for problem_key, result in results.items():
            gen = get_generator(problem_key)
            if gen is None:
                continue
            total_questions = result["total_questions"]
            correct_answers = result["correct_answers"]
            correct_percent = result["correct_percent"]
            avg_time_sec = result.get("avg_time_sec", 0)

            print(f"\n{gen.get_section_name()}:")
            print(f"  Правильно: {correct_answers}/{total_questions} ({correct_percent:.1f}%)")
            if avg_time_sec:
                print(f"  Среднее время: {avg_time_sec:.1f} сек")

        total_questions = results["summary"]["total_questions"]
        correct_answers = results["summary"]["correct_answers"]
        correct_percent = results["summary"]["correct_percent"]

        print(f"\nОбщий результат: {correct_answers}/{total_questions} ({correct_percent:.1f}%)")
        print("=" * 60)