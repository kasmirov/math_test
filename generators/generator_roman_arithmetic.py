import copy
import random
from generators.generator_abstract import ProblemGenerator
from core.roman import to_roman, from_roman, is_valid_roman
from generators.generate_operators import generate_operators


class RomanArithmeticGenerator(ProblemGenerator):
    """Генератор задач на сложение и вычитание с римскими числами"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=120, latex=latex)
        self.tags["grade"] = ["4 класс", "5 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Римские цифры", "Сложение и вычитание"]
        self.description = "Операции сложения и вычитания над римскими числами"

    def generate_problem(self, limits):
        roman_limits = copy.deepcopy(limits)
        roman_limits['sum'] = roman_limits['roman_sum']
        op = random.choice(["+", "-"])
        a, b, result = generate_operators(op, roman_limits)
        a = to_roman(a)
        b = to_roman(b)
        result = to_roman(result)
        if self.latex:
            return f"${a} {op} {b} = $", result
        return f"{a} {op} {b} = ", result

    def get_section_name(self, limits=None):
        if limits:
            a = limits["roman_sum"]["add"]["min"]
            b = limits["roman_sum"]["add"]["max"]
            return f"Сложение и вычитание римских чисел в пределах {to_roman(a)}...{to_roman(b)}"
        return f"Сложение и вычитание римских чисел"

    def get_key(self):
        return "roman_arithmetic"

    def get_hint(self):
        return "Ответ римским цифрами"