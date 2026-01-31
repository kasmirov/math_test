import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class DivisionGenerator(ProblemGenerator):
    """Генератор задач на деление без остатка"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=45, latex=latex)
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Деление"]


    def generate_problem(self, limits):
        a, b, result = generate_operators("÷", limits)
        if self.latex:
            return f"${a} \\div {b} = $", result
        return f"{a} ÷ {b} = $", result

    def get_section_name(self, limits=None):
        if limits:
            a = limits["div"]["divisor"]["min"]
            b = limits["div"]["divisor"]["max"]
            return f"Деление без остатка {a}...{b}"
        return f"Деление без остатка"

    def get_key(self):
        return "division"

