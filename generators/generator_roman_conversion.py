import random
from generators.generator_abstract import ProblemGenerator
from core.roman import to_roman, from_roman, is_valid_roman

class RomanConversionGenerator(ProblemGenerator):
    """Генератор задач на перевод между римскими и арабскими числами"""

    def __init__(self, latex=False):
        super().__init__(default_timeout=45, latex=latex)
        self.tags["grade"] = ["3 класс", "4 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Римские цифры", "Системы счисления"]
        self.description = "Переведите число из римской записи в арабскую или наоборот."

    def generate_problem(self, limits):
        conv_limits = limits.get('roman_conversion', {})
        min_val = conv_limits.get('min', 1)
        max_val = conv_limits.get('max', 100)

        direction = random.choice([0, 1])
        number = random.randint(min_val, max_val)

        if direction == 0:
            if self.latex:
                question = f"Число ${number}$ римскими цифрами"
            else:
                question = f"Число {number} римскими цифрами"
            answer = to_roman(number)
        else:
            roman = to_roman(number)
            if self.latex:
                question = f"Число ${roman}$ арабскими цифрами"
            else:
                question = f"Число {roman} арабскими цифрами"
            answer = str(number)

        return question, answer

    def get_section_name(self, limits=None):
        if limits and 'roman_conversion' in limits:
            a = limits['roman_conversion']['min']
            b = limits['roman_conversion']['max']
            return f"Римские цифры в диапазоне {a}–{b}"
        return "Римские цифры"

    def get_key(self):
        return "roman_conversion"
