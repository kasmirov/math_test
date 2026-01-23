import re
from abc import ABC, abstractmethod

UNIT_NAMES = {
    'мм': 'миллиметров',
    'см': 'сантиметров',
    'дм': 'дециметров',
    'м': 'метров',
    'км': 'километров',
    'г': 'граммов',
    'кг': 'килограммов',
    'т': 'тонн',
    'мл': 'миллилитров',
    'л': 'литров'
}

OPERATION_NAMES = {
    '+': 'плюс',
    '-': 'минус',
    '=': 'равно',
    '?': 'знак вопроса',
    '(': 'скобка открывается',
    ')': 'скобка закрывается',
    '×': 'умножить на',
    '÷': 'разделить на',
    'x': 'икс',
    'X': 'икс'
}

# TODO cross-operator?
# TODO вынести text-2-speech в отдельный класс
# TODO Нужен ли метод определяющий использование кастомного компаратора?

class ProblemGenerator(ABC):
    """Базовый класс генератора задач"""

    def __init__(self, default_timeout=30, latex=False):
        self.default_timeout = default_timeout
        self.latex = latex
        self.tags = {
            "grade": [],
            "subject": [],
            "topic":[]
        }
        self.description = ""

        # Настройки чтения вслух
        self.read_aloud = False  # Включить чтение вслух
        self.repeats = 1  # Количество повторов
        self.pause = 1.0  # Пауза между повторами (сек)
        self.voice_gender = 'female'  # 'male' или 'female'
        self.speech_rate = 150  # Скорость речи (слов в минуту)

    def prepare_for_speech(self, text):
        """Подготовка текста задания для чтения вслух"""
        # Заменяем числа и единицы измерения
        parts = re.split(r'(\d+|\s)', text)
        result = []

        for part in parts:
            if part.strip() == "":
                continue

            if part.isdigit():
                # Произносим число по цифрам для ясности
                result.append(' '.join(part))
            elif part in UNIT_NAMES:
                result.append(UNIT_NAMES[part])
            elif part in OPERATION_NAMES:
                result.append(OPERATION_NAMES[part])
            else:
                result.append(part)

        return ' '.join(result)

    def speak(self, text, engine):
        """Озвучивание текста с текущими настройками"""
        # Подготовка текста
        speech_text = self.prepare_for_speech(text)

        # Настройка голоса
        voices = engine.getProperty('voices')

        '''
        russian_voices = [v for v in voices if
                          'ru' in v.languages[0].decode().lower() or 'russian' in v.languages[0].decode().lower()]

        if russian_voices:
            if self.voice_gender == 'male' and len(russian_voices) > 0:
                engine.setProperty('voice', russian_voices[0].id)
            elif self.voice_gender == 'female' and len(russian_voices) > 1:
                engine.setProperty('voice', russian_voices[1].id)
        '''
        engine.setProperty('voice', voices[0].id)

        # Настройка скорости
        engine.setProperty('rate', self.speech_rate)

        # Озвучивание
        engine.say(speech_text)
        engine.runAndWait()

    @abstractmethod
    def generate_problem(self, limits):
        """Генерирует задачу и возвращает (текст, правильный ответ)"""
        pass

    @abstractmethod
    def get_section_name(self, limits):
        """Возвращает отображаемое имя раздела"""
        pass

    @abstractmethod
    def get_key(self):
        """Возвращает ключ раздела"""
        pass

    @staticmethod
    def has_text_mode():
        """Возвращает отображаемое имя раздела"""
        return True

    def get_problems_number(self):
        """Возвращает максимально возможное количество задач если применимо"""
        return '∞'

    def get_tags(self):
        """Возвращает тэги"""
        return self.tags["grade"] + self.tags["subject"] + self.tags["topic"]

    def get_hint(self):
        """Возвращает подсказку об ожидаемом виде ответа, например:
        одно число, число + размерность или комбинация чисел и размерностей,
        дробное число,
        отрезок, угол и т.д."""
        pass

    def get_description(self):
        """Возвращает описание задания"""
        return self.description

    def get_timeout(self):
        """Возвращает таймаут по умолчанию"""
        return self.default_timeout