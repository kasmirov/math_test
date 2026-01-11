import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators
from units import Length, Weight, Volume


class ConversionGenerator(ProblemGenerator):
    """Генератор задач на конвертацию величин"""

    def __init__(self, limits):
        super().__init__(default_timeout=120)
        self.limits = limits
        self.tags["grade"] = ["2 класс", "3 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Конвертация величин"]

    def generate_problem(self):
        # Выбираем тип величины + class
        unit_types = {
            'длина': Length,
            'масса': Weight,
            'объем': Volume
        }

        unit_type = random.choice(list(unit_types.keys()))
        type_class = unit_types[unit_type]

        # Генерируем значения
        result = type_class(random.randint(1, 100), random.choice(type_class.get_units()))
        result_str = str(result.value) + f' {result.unit} '

        # Выбираем операцию (только сложение и вычитание)
        operations = ['+', '-']

        # Генерируем 1-2 операнда
        operands = []
        for idx in range(random.randint(1, 2)):
            op = random.choice(operations)
            operands.append(op)
            value = type_class(random.randint(1, 100), random.choice(type_class.get_units()))

            # TODO добавить проверку, что величины различаются не более чем в 100 раз
            # Для вычитания убедимся, что результат не отрицательный
            if op == '-':
                while result - value < type_class():
                    value = type_class(random.randint(1, 100), random.choice(type_class.get_units()))
                result = result - value
                result_str = result_str + '- ' + str(value.value) + f' {value.unit} '
            else:
                result = result + value
                result_str = result_str + '+ ' + str(value.value) + f' {value.unit} '

        problem = result_str + '= '
        return problem, result

    def get_section_name(self):
        return "Конвертация величин"

    def get_key(self):
        return "conversion"
