import random
import re
from generators.generator_abstract import ProblemGenerator


class TimeArithmeticGenerator(ProblemGenerator):
    """Генератор задач на сложение и вычитание временных интервалов."""

    def __init__(self):
        super().__init__(default_timeout=60)
        self.tags["grade"] = ["3 класс", "4 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Время", "Арифметика"]
        self.description = "Выполните сложение или вычитание времени."

    def _random_time(self):
        """Случайное время в 24-часовом формате."""
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        return hour, minute

    def _random_interval(self):
        """Случайный интервал: минуты или часы+минуты."""
        if random.choice([True, False]):
            # только минуты (1–59)
            minutes = random.randint(1, 59)
            return minutes, 0
        else:
            # часы и минуты
            hours = random.randint(1, 23)
            minutes = random.randint(0, 59)
            return minutes, hours

    def _format_interval(self, minutes, hours):
        """Возвращает строковое представление интервала."""
        if hours == 0:
            return f"{minutes} мин"
        elif minutes == 0:
            return f"{hours} ч"
        else:
            return f"{hours} ч {minutes} мин"

    def _add_minutes(self, hour, minute, minutes_to_add):
        """Прибавляет минуты к времени, возвращает (hour, minute)."""
        total = hour * 60 + minute + minutes_to_add
        total %= 1440  # сутки
        return divmod(total, 60)

    def _sub_minutes(self, hour, minute, minutes_to_sub):
        """Вычитает минуты из времени, возвращает (hour, minute)."""
        total = hour * 60 + minute - minutes_to_sub
        total %= 1440
        return divmod(total, 60)

    def generate_problem(self, limits=None):
        """Генерирует задание и возвращает (html, answer)."""
        # Выбираем операцию: + или -
        operation = random.choice(['+', '-'])

        # Исходное время
        h, m = self._random_time()

        # Интервал (минуты, часы)
        add_minutes, add_hours = self._random_interval()
        total_minutes = add_minutes + add_hours * 60

        if operation == '+':
            res_h, res_m = self._add_minutes(h, m, total_minutes)
        else:
            res_h, res_m = self._sub_minutes(h, m, total_minutes)

        # Форматируем выражения
        interval_str = self._format_interval(add_minutes, add_hours)
        expression = f"{h}:{m:02d} {operation} {interval_str}"
        answer = f"{res_h}:{res_m:02d}"

        return expression, answer

    def get_section_name(self, limits=None):
        return "Арифметические операции со временем"

    def get_key(self):
        return "time_arithmetic"

    def get_hint(self):
        return "Введите время в 24-часовом формате чч:мм, например, 1:15 или 13:15"
