from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class MultiplicationGenerator(ProblemGenerator):
    """Генератор задач на умножение"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=30, latex=latex)
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Умножение"]

    def generate_problem(self, limits):
        a, b, result = generate_operators("×", limits)
        if self.latex:
            return f"${a} \\times {b} = $", result
        return f"{a} × {b} = ", result

    def get_section_name(self, limits=None):
        if limits:
            a = limits["mult"]["factor"]["min"]
            b = limits["mult"]["factor"]["max"]
            return f"Умножение в пределах {a}-{b}"
        return f"Умножение"

    def get_key(self):
        return "multiplication"