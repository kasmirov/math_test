import random

from generator_abstract import ProblemGenerator
from generate_operators import generate_operators


class GeometryFigurePropertiesGenerator(ProblemGenerator):
    """Генератор задач на площадь, периметр, объем простых фигур"""

    def __init__(self):
        super().__init__(default_timeout=30)
        self.tags["grade"] = ["3 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Свойства геометрических фигур"]

    def generate_problem(self, limits):
        # TODO добавить обратные задачи
        op = random.choice(["площадь", "периметр",])
        fig = random.choice(["прямоугольник"]) #, "квадрат"
        while True:
            try:
                if op == "периметр":
                    a, b, result = generate_operators("+", limits)
                    value = result * 2
                elif op == "площадь":
                    a, b, value = generate_operators("*", limits)
            except Exception as e:
                continue
            break
        return f"Найди {op} {fig}а со сторонами {a} и {b} ", value

    def get_section_name(self, limits=None):
        return f"Площадь и периметр геометрических фигур"

    def get_key(self):
        return "geometry_figures_properties"