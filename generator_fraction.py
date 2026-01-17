import random
import math
from generator_abstract import ProblemGenerator


class FractionGenerator(ProblemGenerator):
    """Генератор задач на операции с дробными числами"""

    def __init__(self, limits):
        super().__init__(default_timeout=60)
        self.limits = limits
        self.tags["grade"] = ["3 класс", "4 класс", "5 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Дроби", "Операции с дробными числами"]
        self.description = "Примеры с дробными числами"

        # Определяем уровень сложности из limits
        self.complexity = self.limits.get("complexity", 1)  # 1 или 2

    def _generate_fraction(self):
        """Генерирует дробь в соответствии с ограничениями"""
        # Определяем диапазоны для числителя и знаменателя
        min_num = self.limits.get("numerator", {}).get("min", 1)
        max_num = self.limits.get("numerator", {}).get("max", 10)
        min_denom = self.limits.get("denominator", {}).get("min", 2)
        max_denom = self.limits.get("denominator", {}).get("max", 12)

        numerator = random.randint(min_num, max_num)
        denominator = random.randint(min_denom, max_denom)

        # Убедимся, что дробь правильная (не смешанная) если нужно
        if self.limits.get("proper_only", True) and numerator >= denominator:
            numerator = random.randint(min_num, denominator - 1) if denominator > min_num else 1

        # Сокращаем дробь
        gcd_val = math.gcd(numerator, denominator)
        numerator //= gcd_val
        denominator //= gcd_val

        return numerator, denominator

    def _fraction_to_latex(self, numerator, denominator):
        """Преобразует дробь в LaTeX формат"""
        return f"\\frac{{{numerator}}}{{{denominator}}}"

    def _format_result(self, numerator, denominator):
        """Форматирует результат в соответствии с уровнем сложности"""
        if denominator == 0:
            return "undefined"

        if denominator < 0:
            numerator = -numerator
            denominator = -denomimator

        gcd_val = math.gcd(abs(numerator), denominator)
        numerator //= gcd_val
        denominator //= gcd_val

        # Если знаменатель 1, возвращаем целое число
        if denominator == 1:
            return str(numerator)

        # Если числитель 0
        if numerator == 0:
            return "0"

        # Для уровня сложности 1: результат должен быть по модулю <= 1
        if self.complexity == 1:
            # Проверяем, что дробь правильная
            if abs(numerator) <= denominator:
                return f"{numerator}/{denominator}"
            else:
                return None  # Не подходит для уровня 1

        # Для уровня сложности 2: может быть смешанное число
        if abs(numerator) < denominator:
            return f"{numerator}/{denominator}"
        else:
            whole = numerator // denominator
            remainder = abs(numerator) % denominator
            if remainder == 0:
                return str(whole)
            else:
                return f"{whole} {remainder}/{denominator}"

    def _calculate_result(self, fraction1, operation, fraction2):
        """Вычисляет результат операции над двумя дробями"""
        num1, denom1 = fraction1
        num2, denom2 = fraction2

        if operation == "+":
            # Приводим к общему знаменателю
            common_denom = denom1 * denom2
            new_num1 = num1 * denom2
            new_num2 = num2 * denom1
            result_num = new_num1 + new_num2
            result_denom = common_denom

        elif operation == "-":
            common_denom = denom1 * denom2
            new_num1 = num1 * denom2
            new_num2 = num2 * denom1
            result_num = new_num1 - new_num2
            result_denom = common_denom

        elif operation == "×":
            result_num = num1 * num2
            result_denom = denom1 * denom2

        else:  # "÷"
            # Проверяем, что не делим на 0
            if num2 == 0:
                return None, None
            result_num = num1 * denom2
            result_denom = denom1 * num2

        return result_num, result_denom

    def _calculate_with_integer(self, fraction, operation, integer):
        """Вычисляет результат операции дроби с целым числом"""
        num, denom = fraction

        if operation == "+":
            result_num = num + integer * denom
            result_denom = denom

        elif operation == "-":
            result_num = num - integer * denom
            result_denom = denom

        elif operation == "×":
            result_num = num * integer
            result_denom = denom

        else:  # "÷"
            if integer == 0:
                return None, None
            result_num = num
            result_denom = denom * integer

        return result_num, result_denom

    def _check_result_value(self, result_str):
        """Проверяет, находится ли результат в заданных пределах"""
        if not self.limits.get("result"):
            return True

        result_limits = self.limits["result"]
        min_val = result_limits.get("min", 0)
        max_val = result_limits.get("max", 10)

        # Парсим строку результата в число
        try:
            if result_str == "undefined":
                return False

            if ' ' in result_str:  # смешанное число
                whole, fraction = result_str.split()
                num, denom = map(int, fraction.split('/'))
                value = int(whole) + num / denom
            elif '/' in result_str:  # дробь
                num, denom = map(int, result_str.split('/'))
                value = num / denom
            else:  # целое число
                value = int(result_str)

            return min_val <= value <= max_val
        except (ValueError, ZeroDivisionError):
            return True

    def generate_problem(self):
        """Генерирует задачу с дробями и возвращает (текст_задачи, правильный_ответ)"""
        max_attempts = 100  # Максимальное количество попыток
        for attempt in range(max_attempts):
            # Решаем, использовать ли целое число
            use_integer = random.random() < 0.3  # 30% вероятность целого числа

            if use_integer:
                # Генерируем дробь и целое число
                fraction = self._generate_fraction()
                integer = random.randint(1, self.limits.get("integer_max", 5))

                # Выбираем операцию
                operation = random.choice(["+", "-", "×", "÷"])

                # Вычисляем результат
                result_num, result_denom = self._calculate_with_integer(fraction, operation, integer)

                if result_num is None or result_denom is None:
                    continue  # Пробуем снова

                # Форматируем результат
                result_str = self._format_result(result_num, result_denom)
                if result_str is None:
                    continue  # Не подходит для уровня сложности

                # Проверяем ограничения по результату
                if not self._check_result_value(result_str):
                    continue

                # Создаем выражение в LaTeX
                latex_expr = f"{self._fraction_to_latex(*fraction)} {operation} {integer} = "

                return f"${latex_expr}$", result_str

            else:
                # Генерируем две дроби
                fraction1 = self._generate_fraction()
                fraction2 = self._generate_fraction()

                # Выбираем операцию
                operation = random.choice(["+", "-", "×", "÷"])

                # Вычисляем результат
                result_num, result_denom = self._calculate_result(fraction1, operation, fraction2)

                if result_num is None or result_denom is None:
                    continue  # Пробуем снова

                # Форматируем результат
                result_str = self._format_result(result_num, result_denom)
                if result_str is None:
                    continue  # Не подходит для уровня сложности

                # Проверяем ограничения по результату
                if not self._check_result_value(result_str):
                    continue

                # Создаем выражение в LaTeX
                latex_expr = f"{self._fraction_to_latex(*fraction1)} {operation} {self._fraction_to_latex(*fraction2)} = "

                return f"${latex_expr}$", result_str

        # Если не удалось сгенерировать подходящую задачу за max_attempts попыток
        # Возвращаем простую задачу по умолчанию
        default_expr = r"\frac{1}{2} + \frac{1}{2} = "
        default_answer = "1"
        return f"${default_expr}$", default_answer

    def get_section_name(self):
        min_denom = self.limits.get("denominator", {}).get("min", 2)
        max_denom = self.limits.get("denominator", {}).get("max", 12)
        complexity_text = "1 уровень" if self.complexity == 1 else "2 уровень"

        # Получаем ограничения для результата
        if "result" in self.limits:
            result_min = self.limits["result"].get("min", "")
            result_max = self.limits["result"].get("max", "")
            return f"Дроби ({min_denom}-{max_denom}), результат {result_min}-{result_max} - {complexity_text}"
        else:
            return f"Дроби ({min_denom}-{max_denom}) - {complexity_text}"

    def get_key(self):
        return f"fractions_level_{self.complexity}"

    def get_hint(self):
        if self.complexity == 1:
            return "Введите ответ в виде дроби (например, 1/2) или целого числа"
        else:
            return "Введите ответ в виде дроби (1/2), целого числа (3) или смешанного числа (1 1/2)"

    @staticmethod
    def has_text_mode():
        """Возвращает отображаемое имя раздела"""
        return False