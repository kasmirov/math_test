import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class AdditionSubtractionGenerator(ProblemGenerator):
    """Генератор задач на сложение/вычитание"""

    def __init__(self, limits, latex=False):
        super().__init__(default_timeout=30, latex=latex)
        self.limits = limits
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Сложение и вычитание"]

    def generate_problem(self):
        op = random.choice(["+", "-"])
        a, b, result = generate_operators(op, self.limits)
        if self.latex:
            return f"${a} {op} {b} = $", result
        return f"{a} {op} {b} = ", result

    def get_section_name(self):
        a = self.limits["sum"]["add"]["min"]
        b = self.limits["sum"]["add"]["max"]
        return f"Сложение и вычитание в пределах {a}-{b}"

    def get_key(self):
        return "addition_subtraction"