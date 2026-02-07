import random

from generators.generator_abstract import ProblemGenerator
from generators.generate_operators import generate_operators


class AdditionSubtractionGenerator(ProblemGenerator):
    """Генератор задач на сложение/вычитание"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=30, latex=latex)
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Сложение и вычитание"]

    def generate_problem(self, limits):
        op = random.choice(["+", "-"])
        a, b, result = generate_operators(op, limits)
        b = f"({b})" if b < 0 else b
        if self.latex:
            return f"${a} {op} {b} = $", result
        return f"{a} {op} {b} = ", result

    def get_section_name(self, limits=None):
        if limits:
            a = limits["sum"]["add"]["min"]
            b = limits["sum"]["add"]["max"]
            return f"Сложение и вычитание в пределах {a}...{b}"
        return f"Сложение и вычитание"

    def get_key(self):
        return "addition_subtraction"