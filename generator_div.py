import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class DivisionGenerator(ProblemGenerator):
    """Генератор задач на деление без остатка"""

    def __init__(self, limits, latex=False):
        super().__init__(default_timeout=45, latex=latex)
        self.limits = limits
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Деление"]


    def generate_problem(self):
        a, b, result = generate_operators("÷", self.limits)
        if self.latex:
            return f"${a} \\div {b} = $", result
        return f"{a} ÷ {b} = $", result

    def get_section_name(self):
        a = self.limits["div"]["divisor"]["min"]
        b = self.limits["div"]["divisor"]["max"]
        return f"Деление без остатка {a}-{b}"

    def get_key(self):
        return "division"

