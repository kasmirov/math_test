import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class PriorityOperationsGenerator(ProblemGenerator):
    """Генератор примеров с приоритетами операций"""

    def __init__(self, limits, latex=False):
        super().__init__(default_timeout=90, latex=latex)
        self.limits = limits
        self.tags["grade"] = ["2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Приоритеты операций", "Сложение и вычитание", "Умножение", "Деление"]

    def generate_problem(self):
        operations = ['+', '-', '×', '÷']
        latex_symbol = {'+': '+', '-': '-', '×': '\\times', '÷': '\\div'}
        while True:
            try:
                # Генерируем выражение в скобках
                inner_op = random.choice(operations)
                inner_a, inner_b, inner_result = generate_operators(inner_op, self.limits)
                if self.latex:
                    problem = f'({inner_a} {latex_symbol[inner_op]} {inner_b})'
                else:
                    problem = f'({inner_a} {inner_op} {inner_b})'

                # Генерируем внешнее выражение
                outer_op = random.choice(operations)

                # Определяем справа или слева от внутреннего выражения будет находиться внешнее
                opt = [False, True]
                is_left = random.choice(opt)

                if is_left:
                    outer_a, outer_b, outer_result = generate_operators(outer_op, self.limits, left=inner_result)
                    if self.latex:
                        problem = f'${problem} {latex_symbol[outer_op]} {outer_b}$'
                    else:
                        problem = f'{problem} {outer_op} {outer_b}'
                else:
                    outer_a, outer_b, outer_result = generate_operators(outer_op, self.limits, right=inner_result)
                    if self.latex:
                        problem = f'${outer_a} {latex_symbol[outer_op]} {problem}$'
                    else:
                        problem = f'{outer_a} {outer_op} {problem}'
            except ValueError:
                continue
            return problem, outer_result

    def get_section_name(self):
        return "Приоритеты операций"

    def get_key(self):
        return "priority_operations"
