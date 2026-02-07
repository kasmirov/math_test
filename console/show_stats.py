import time
import random
import os
import sys
from datetime import datetime


def print_current_result(section_stats):
    """Вывод текущего результата для раздела"""
    total = section_stats["correct"] + section_stats["incorrect"] + section_stats["timeout"]
    accuracy = section_stats["correct"] / total * 100 if total > 0 else 0

    print(f"--- Результаты раздела ---") # : {section_name}"
    print(f"Правильных ответов: {section_stats['correct']}/{total} ({accuracy:.1f}%)")
    print(f"Среднее время ответа: {section_stats['total_time'] / section_stats['count']:.1f} сек" if section_stats[
                                                                                                         'count'] > 0 else "Среднее время: -")


def find_previous_result(user_stats, section_key):
    """Поиск предыдущего результата для сравнения (игнорируя текущую дату)"""

    user_history = user_stats.get("history", [])

    filter_result = [ a for a in user_history if a['section'] == section_key]
    # Сортируем результаты по дате (новые первыми)
    filter_result.sort(key=lambda x: datetime.strptime(x["date"], "%Y-%m-%d %H:%M:%S"), reverse=True)

    # Возвращаем самый последний результат, если он есть
    if len(filter_result):
        return filter_result[0]  # Берем второй, так как первый - текущий
    return None


def print_comparison(current_stats, previous_result):
    """Сравнение текущего результата с предыдущим"""
    if not previous_result:
        return

    current_num_of_questions = current_stats["correct"] + current_stats["incorrect"] + current_stats["timeout"]
    previous_num_of_questions = previous_result["correct"] + previous_result["incorrect"] + previous_result["timeout"]

    current_accuracy = current_stats["correct"] / current_num_of_questions * 100 if current_num_of_questions > 0 else 0
    prev_accuracy = previous_result["correct"] / previous_num_of_questions * 100 if previous_num_of_questions > 0 else 0
    current_time = current_stats["total_time"] / current_stats["count"] if current_stats["count"] > 0 else current_stats["total_time"]
    prev_time = previous_result["total_time"] / previous_result["count"] if previous_result["count"] > 0 else previous_result["count"]

    print("\nСравнение с предыдущим результатом:")
    print(f"- Правильных ответов: {prev_accuracy:.0f}% -> {current_accuracy:.0f}%")
    print(f"- Время ответа: {prev_time:.1f} c -> {current_time:.1f} c")
    # TODO comp to last 10 tests
    #print("\nСравнение со средним результатом за последние 10 тестов:")

    if current_accuracy > prev_accuracy:
        improvement = current_accuracy - prev_accuracy
        print(f"✅ Результат улучшен на +{improvement:.0f}%!")
    elif current_accuracy < prev_accuracy:
        decline = prev_accuracy - current_accuracy
        print(f"⚠️ Результат снизился на -{decline:.1f}%")
    else:
        print("➖ Результат остался на том же уровне")


def get_motivational_message(accuracy):
    """Генерация мотивирующего сообщения"""
    if accuracy == 100:
        messages = [
            "Феноменально! Ты чемпион! 💯",
            "Фантастический результат! Ты гений математики! 💯",
            "Великолепно! Ты справился идеально! 💯",
            "Это рекорд! Ты превзошел все ожидания! 💯"
        ]
    elif accuracy >= 90:
        messages = [
            "Потрясающе! Одна ступень до идеала! 🏆",
            "Выдающийся результат! Ты большой молодец! 🌟",
            "Великолепно! Ты справился почти идеально! 💯",
            "Чудесно! Крепкий результат! 🚀"
        ]
    elif accuracy >= 80:
        messages = [
            "Отличная работа! Ты молодец! 👍",
            "Очень хорошо! Продолжай в том же духе! ✨",
            "Ты отлично справляешься! Так держать! 💪",
            "Замечательный результат! Ты быстро учишься! 📚"
        ]
    elif accuracy >= 60:
        messages = [
            "Хорошо! Но ты можешь еще лучше! 😊",
            "Неплохо! Продолжай тренироваться! 💪",
            "Уже хорошо, но есть куда расти! 🌱",
            "Старайся, у тебя все получится! ✨"
        ]
    else:
        messages = [
            "Не сдавайся! Ты обязательно улучшишь результат! 💪",
            "Практика - путь к успеху! Продолжай тренироваться! 📚",
            "Каждая ошибка - шаг к успеху! Не расстраивайся! 🌟",
            "Главное - не останавливайся! У тебя все получится! ✨"
        ]

    return random.choice(messages)


def show_rest_animation(duration=5):
    """Анимация отдыха с перемещением по экрану"""
    print("\nОтдохни немного перед следующим разделом...")
    print("Следи за движущимся объектом глазами 👀")

    start_time = time.time()
    width = 60
    height = 10

    # Позиция объекта
    x, y = 0, 0
    dx, dy = 1, 1

    try:
        while time.time() - start_time < duration:
            # Очистка экрана (кросс-платформенная)
            os.system('cls' if os.name == 'nt' else 'clear')

            # Отрисовка рамки
            print("+" + "-" * width + "+")

            # Отрисовка строк
            for row in range(height):
                if row == y:
                    # Строка с объектом
                    print("|" + " " * x + "👀" + " " * (width - x - 2) + "|")
                else:
                    # Пустая строка
                    print("|" + " " * width + "|")

            print("+" + "-" * width + "+")
            print(f"Осталось: {duration - int(time.time() - start_time)} сек")

            # Обновление позиции
            x += dx
            y += dy

            # Отражение от границ
            if x <= 0 or x >= width - 2:
                dx = -dx
            if y <= 0 or y >= height - 1:
                dy = -dy

            time.sleep(0.1)

    except KeyboardInterrupt:
        pass

    # Очистка экрана после анимации
    os.system('cls' if os.name == 'nt' else 'clear')
    print("Продолжаем тест!\n")


def show_section_summary(user_stats, section, section_stats):
    """Вывод сводки по разделу с анимацией отдыха"""
    #section_name = GENERATORS.get(section).get_section_name() if section in GENERATORS else section

    # 1. Текущий результат
    print_current_result(section_stats)

    # 2. Сравнение с предыдущим результатом
    previous_result = find_previous_result(user_stats, section)
    if previous_result:
        print_comparison(section_stats, previous_result)

    # 3. Мотивирующее сообщение
    accuracy = section_stats["correct"] / section_stats["count"] * 100 if section_stats["count"] > 0 else 0
    message = get_motivational_message(accuracy)
    print(f"\n💬 {message}")

    # 4. Анимация отдыха
    #rest_time = max(3, min(8, int(10 - accuracy / 10)))  # 3-8 секунд в зависимости от результата
    #show_rest_animation(rest_time)

    # 5. Пауза
    time.sleep(15)