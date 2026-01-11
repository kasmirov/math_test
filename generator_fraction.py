import random
import math
from generator_abstract import ProblemGenerator


class FractionGenerator(ProblemGenerator):
    """Генератор задач на операции с дробными числами"""

    def __init__(self, limits):
        super().__init__(default_timeout=60)
        self.limits = limits
        self.tags["grade"] = ["3 класс", "4 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Дроби", "Операции с дробными числами"]
        self.description = "Примеры с дробными числами"

    def _generate_fraction(self):
        """Генерирует правильную или несократимую дробь"""
        # Определяем диапазоны для числителя и знаменателя
        min_num = self.limits.get("numerator", {}).get("min", 1)
        max_num = self.limits.get("numerator", {}).get("max", 10)
        min_denom = self.limits.get("denominator", {}).get("min", 2)
        max_denom = self.limits.get("denominator", {}).get("max", 12)

        numerator = random.randint(min_num, max_num)
        denominator = random.randint(min_denom, max_denom)

        # Убедимся, что дробь правильная (не смешанная)
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

    def _generate_operation(self, op1, op2):
        """Генерирует операцию и вычисляет результат"""
        operations = ["+", "-", "×", "÷"]
        operation = random.choice(operations)

        num1, denom1 = op1
        num2, denom2 = op2

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
            result_num = num1 * denom2
            result_denom = denom1 * num2

        # Сокращаем результат
        if result_denom != 0:
            gcd_val = math.gcd(abs(result_num), abs(result_denom))
            result_num //= gcd_val
            result_denom //= gcd_val

        # Форматируем результат
        if result_denom == 0:
            return operation, "undefined"
        elif result_denom == 1:
            return operation, str(result_num)
        elif abs(result_num) > result_denom and not self.limits.get("proper_only", True):
            # Преобразуем в смешанное число
            whole = result_num // result_denom
            remainder = abs(result_num) % result_denom
            if remainder == 0:
                return operation, str(whole)
            else:
                return operation, f"{whole} {remainder}/{result_denom}"
        else:
            return operation, f"{result_num}/{result_denom}"

    def generate_problem(self):
        """Генерирует задачу с дробями"""
        # Генерируем две дроби
        fraction1 = self._generate_fraction()
        fraction2 = self._generate_fraction()

        # Иногда заменяем вторую дробь на целое число
        if random.random() < 0.3:  # 30% вероятность целого числа
            integer = random.randint(1, self.limits.get("integer_max", 5))
            latex_expr = f"{self._fraction_to_latex(*fraction1)} {random.choice(['+', '-', '×', '÷'])} {integer} = "

            # Вычисляем результат
            num1, denom1 = fraction1
            operation = random.choice(["+", "-", "×", "÷"])

            if operation == "+":
                result_num = num1 + integer * denom1
                result_denom = denom1
            elif operation == "-":
                result_num = num1 - integer * denom1
                result_denom = denom1
            elif operation == "×":
                result_num = num1 * integer
                result_denom = denom1
            else:  # "÷"
                result_num = num1
                result_denom = denom1 * integer

            # Сокращаем
            gcd_val = math.gcd(abs(result_num), result_denom)
            result_num //= gcd_val
            result_denom //= gcd_val

            if result_denom == 1:
                result = str(result_num)
            else:
                result = f"{result_num}/{result_denom}"

            return f"${latex_expr}$", result

        else:
            # Операция с двумя дробями
            operation, result = self._generate_operation(fraction1, fraction2)
            latex_expr = f"{self._fraction_to_latex(*fraction1)} {operation} {self._fraction_to_latex(*fraction2)} = "
            return f"${latex_expr}$", result

    def get_section_name(self):
        min_denom = self.limits.get("denominator", {}).get("min", 2)
        max_denom = self.limits.get("denominator", {}).get("max", 12)
        return f"Дроби (знаменатели {min_denom}-{max_denom})"

    def get_key(self):
        return "fractions"

    def get_hint(self):
        return "Введите ответ в виде сокращенной дроби (например, 1/2) или целого числа"

    @staticmethod
    def has_text_mode():
        """Возвращает отображаемое имя раздела"""
        return False