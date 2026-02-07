import json
from abc import ABC
from typing import Dict, Any
from functools import total_ordering

CONV_TABLE = {
    'Масса': {
        'г': 1,
        'кг': 1000
    },
    'Длина': {
        'мм': 1,
        'см': 10,
        'дм': 100,
        'м': 1000
    },
    'Объем': {
        'мл': 1,
        'л': 1000
    }
}

@total_ordering
class Units(ABC):
    def __init__(self, value: float, unit: str):
        self.value = value
        self.unit = unit
        self.units_type = ''
        for units in CONV_TABLE:
            if unit in CONV_TABLE[units]:
                self.table = CONV_TABLE[units]
                self.units_type = units
                break
        self.base_type = self.get_base_type()
        self.base_value = int(self.value * self.table[self.unit])

    def __add__(self, other):
        t = type(self)
        return t((self.base_value + other.base_value) / self.table[self.unit], self.unit)

    def __sub__(self, other):
        t = type(self)
        return t((self.base_value - other.base_value) / self.table[self.unit], self.unit)

    # if isinstance(section_name, ProblemGenerator):
    def __eq__(self, other):
        if type(self) is type(other):
            return self.base_value == other.base_value
        if type(other) == Units and self.base_type == other.base_type:
                return self.base_value == other.base_value
        return False

    def __lt__(self, other):
        if type(self) is type(other):
            return self.base_value < other.base_value
        if type(other) == Units and self.base_type == other.base_type:
                return self.base_value < other.base_value
        return False

    def __gt__(self, other):
        if type(self) is type(other):
            return self.base_value > other.base_value
        if type(other) == Units and self.base_type == other.base_type:
                return self.base_value > other.base_value
        return False

    # TODO Пофиксить ветку когда не выставлено ни одного значения value
    def __str__(self):
        value = 10e10
        unit = ''
        for u in self.get_units():
            v = self.to(u)
            if v == int(v) and v < value:
                value = v
                unit = u
        return f"{value:.0f} {unit}"

    def __repr__(self):
        value = 20e10
        unit = ''
        for u in self.get_units():
            v = self.to(u)
            if v == int(v) and v < value:
                value = v
                unit = u
        return f"{value:.0f} {unit}"

    def get_base_type(self):
        '''
        Наименьшая неделимая величина измерения
        '''
        prev_name = ''
        prev_coef = 10e10
        if not hasattr(self, "table"):
            raise ValueError(f"Unknown unit")
        for name in self.table:
            if self.table[name] < prev_coef:
                prev_coef = self.table[name]
                prev_name = name
        return prev_name

    #@abstractmethod
    #@staticmethod
    def get_units(self):
        l = [k for k in CONV_TABLE[self.units_type]]
        return l

    def get_type(self):
        return self.units_type

    def to(self, unit):
        return self.base_value / self.table[unit]

    def to_base(self, unit):
        return self.base_value

    def to_dict(self) -> Dict[str, Any]:
        """Сериализация объекта в словарь"""
        return {
            'value': self.value,
            'unit': self.unit,
            # Остальные поля вычисляются автоматически при инициализации
            '__class__': self.__class__.__name__  # Для идентификации при десериализации
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Units':
        """Десериализация объекта из словаря"""
        return cls(value=data['value'], unit=data['unit'])

# Универсальный энкодер для JSON
class UnitsEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Units):
            return obj.to_dict()
        # Для других типов просто возвращаем объект
        return super().default(obj)

# Универсальный хук для десериализации
def UnitsObjectHook(dct: Dict[str, Any]) -> Any:
    if '__class__' in dct and dct['__class__'] in ['Units', 'Weight', 'Length', 'Volume' ] :
        return Units.from_dict(dct)
    return dct


class Weight(Units):
    def __init__(self, value = 0, unit = 'г'):
        super().__init__(value, unit)

    #@staticmethod
    def get_units():
        """
        Список величин
        """
        l = [k for k in CONV_TABLE['Масса']]
        return l

class Length(Units):
    def __init__(self, value = 0, unit = 'мм'):
        super().__init__(value, unit)

    #@staticmethod
    def get_units():
        """
        Список величин
        """
        l = [k for k in CONV_TABLE['Длина']]
        return l

class Volume(Units):
    def __init__(self, value = 0, unit = 'л'):
        super().__init__(value, unit)

    #@staticmethod
    def get_units():
        """
        Список величин
        """
        l = [k for k in CONV_TABLE['Объем']]
        return l