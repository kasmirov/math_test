import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class EquationGenerator(ProblemGenerator):
    """Генератор простых уравнений"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=60, latex=latex)
        self.tags["grade"] = ["2 класс", "3 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Уравнения", "Сложение и вычитание", "Умножение", "Деление"]


    def generate_problem(self, limits):
        operations = ['+', '-', '×', '÷']
        latex_symbol = {'+': '+', '-': '-', '×': '\\times', '÷': '\\div'}

        # Выбираем случайную операцию
        op_symbol = random.choice(operations)

        # Генерируем числа
        a, b, result = generate_operators(op_symbol, limits)

        # Где разместить неизвестное (x)
        position = random.choice(['left', 'right', 'result'])

        if position == 'left':
            if self.latex:
                problem = f"$x {latex_symbol[op_symbol]} {b} = {result}$"
            else:
                problem = f"x {op_symbol} {b} = {result}"
            answer = a
        elif position == 'right':
            if self.latex:
                problem = f"${a} {latex_symbol[op_symbol]} x = {result}$"
            else:
                problem = f"{a} {op_symbol} x = {result}"
            answer = b
        else:  # result
            if self.latex:
                problem = f"${a} {latex_symbol[op_symbol]} {b} = x$"
            else:
                problem = f"{a} {op_symbol} {b} = x"
            answer = result

        return problem, answer

    def get_section_name(self, limits=None):
        return "Простые уравнения"

    def get_key(self):
        return "equations"
