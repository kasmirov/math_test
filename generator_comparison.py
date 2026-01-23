import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators
from units import Length, Weight, Volume

# TODO add to limits dict
class ComparisonGenerator(ProblemGenerator):
    """Генератор задач на сравнение величин"""

    def __init__(self):
        super().__init__(default_timeout=30)
        self.tags["grade"] = ["1 класс", "2 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Простые операции", "Сравнение величин"]


    def generate_problem(self, limits=None):
        # Выбираем тип величины + class
        unit_types = {
            'длина': Length,
            'масса': Weight,
            'объем': Volume
        }

        # Каждый 10 тест на равенство
        decision = random.randint(1, 10)
        problem = ''
        correct_answer = ''

        while True:
            unit_type = random.choice(list(unit_types.keys()))
            type_class = unit_types[unit_type]

            choices = type_class.get_units()
            if len(choices) < 2:
                continue
            type1 = random.choice(choices)
            choices.remove(type1)
            type2 = random.choice(choices)

            if decision == 10:
                # Генерируем одинаковые значения
                unit_type = random.choice(list(unit_types.keys()))
                type_class = unit_types[unit_type]
                if random.choice([True, False]):
                    value1 = type_class(random.randint(1, 100), type1)
                    value2 = type_class(value1.to(type2), type2)
                else:
                    value2 = type_class(random.randint(1, 100), type2)
                    value1 = type_class(value2.to(type1), type1)
                diff1 = abs(value2.to(type1) / value1.value)
                diff2 = abs(value1.to(type2) / value2.value)
                if diff1 > 1000 or diff2 > 1000 or \
                        int(value1.value) == 0 or \
                        int(value2.value) == 0 or \
                        value1.value % int(value1.value) > 0 or \
                        value2.value % int(value2.value) > 0:
                    continue
                problem = f"{value1.value:.0f} {value1.unit} ? {value2.value:.0f} {value2.unit}"
                correct_answer = '='
                break

            else:
                # Генерируем значения так, чтобы разница между величинами в минимальной единице измерения не была более 500
                value1 = type_class(random.randint(1, 500), type1)
                value2 = type_class(random.randint(1, 500), type2)
                diff1 = abs(value2.to(type1) / value1.value)
                diff2 = abs(value1.to(type2) / value2.value)
                if diff1 > 10 or diff2 > 10:
                    continue

                # Определяем правильный знак сравнения
                if value1 > value2:
                    correct_answer = '>'
                elif value1 < value2:
                    correct_answer = '<'
                else:
                    correct_answer = '='
                problem = f"{value1.value} {value1.unit} ? {value2.value} {value2.unit}"
                break

        return problem, correct_answer

    def get_section_name(self, limits=None):
        return "Сравнение величин"

    def get_key(self):
        return "comparison"
