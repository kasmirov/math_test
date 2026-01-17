import random
import math
from datetime import datetime, timedelta
from enum import Enum

from generator_abstract import ProblemGenerator


def generate_clock_svg(hour, minute, clock_style="detailed"):
    """Генерирует SVG код для аналоговых часов"""
    # Рассчитываем углы стрелок
    hour_12 = hour % 12
    hour_angle = (hour_12 + minute / 60) * 30
    minute_angle = minute * 6

    # Определяем параметры в зависимости от стиля
    show_all_numbers = clock_style == "detailed"
    show_hour_ticks = clock_style != "minimal"
    show_hour_quaters_ticks = clock_style == "minimal"
    show_minute_ticks = clock_style == "detailed"

    # Создаем SVG
    svg_width = 300
    svg_height = 300
    center_x = svg_width // 2
    center_y = svg_height // 2
    radius = 140

    svg_code = f'''<svg viewBox="0 0 {svg_width} {svg_height}" preserveAspectRatio="xMidYMid meet" 
                     style="width: 80%; height: 80%; max-height: 300px;" 
                     xmlns="http://www.w3.org/2000/svg">
        <!-- Фон часов -->
        <circle cx="{center_x}" cy="{center_y}" r="{radius}" fill="#f0f0f0" stroke="black" stroke-width="2"/>
        <!-- Центральная точка -->
        <circle cx="{center_x}" cy="{center_y}" r="4" fill="black"/>
    '''

    # Добавляем часовые риски
    if show_hour_ticks or show_hour_quaters_ticks:
        step = 1 if show_hour_ticks else 3
        for hour_num in range(1, 13, step):
            angle = (hour_num - 1) * 30 - 90
            rad = math.radians(angle)

            # Координаты начала и конца риски
            x1 = center_x + (radius - 15) * math.cos(rad)
            y1 = center_y + (radius - 15) * math.sin(rad)
            x2 = center_x + radius * math.cos(rad)
            y2 = center_y + radius * math.sin(rad)

            svg_code += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="black" stroke-width="3"/>\n'

            # Добавляем цифры
            if show_all_numbers or hour_num in [3, 6, 9, 12]:
                text_x = center_x + (radius - 35) * math.cos(rad + math.radians(360/12))
                text_y = center_y + (radius - 35) * math.sin(rad + math.radians(360/12)) + 7
                hour_text = str(hour_num)
                svg_code += f'<text x="{text_x}" y="{text_y}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">{hour_text}</text>\n'

    # Добавляем минутные риски
    if show_minute_ticks:
        step = 1 if clock_style == "detailed" else 5
        for minute_num in range(0, 60, step):
            if minute_num % 5 != 0:  # Пропускаем часовые риски
                angle = minute_num * 6 - 90
                rad = math.radians(angle)
                x1 = center_x + (radius - 8) * math.cos(rad)
                y1 = center_y + (radius - 8) * math.sin(rad)
                x2 = center_x + radius * math.cos(rad)
                y2 = center_y + radius * math.sin(rad)
                svg_code += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="black" stroke-width="1"/>\n'

    # Добавляем часовую стрелку
    hour_rad = math.radians(hour_angle - 90)
    hour_hand_length = radius * 0.5
    hour_x = center_x + hour_hand_length * math.cos(hour_rad)
    hour_y = center_y + hour_hand_length * math.sin(hour_rad)
    svg_code += f'<line x1="{center_x}" y1="{center_y}" x2="{hour_x}" y2="{hour_y}" stroke="black" stroke-width="6" stroke-linecap="round"/>\n'

    # Добавляем минутную стрелку
    minute_rad = math.radians(minute_angle - 90)
    minute_hand_length = radius * 0.7
    minute_x = center_x + minute_hand_length * math.cos(minute_rad)
    minute_y = center_y + minute_hand_length * math.sin(minute_rad)
    svg_code += f'<line x1="{center_x}" y1="{center_y}" x2="{minute_x}" y2="{minute_y}" stroke="black" stroke-width="3" stroke-linecap="round"/>\n'

    svg_code += '</svg>'
    return svg_code

def uppercase_first_letter(s):
    s = s.replace('  ', ' ')
    return s[0].upper() + s[1:]

class ClockGeneratorType(Enum):
    CLOCK_AND_TEXT = 0
    CLOCK_ONLY = 1
    TEXT_ONLY = 2

class ClockGenerator(ProblemGenerator):
    """Генератор задач на определение времени по аналоговым часам и текстовым описаниям"""

    def __init__(self, mode=ClockGeneratorType.CLOCK_AND_TEXT):
        super().__init__(default_timeout=60)
        self.clock_style = "detailed"  # "detailed", "simplified", "minimal"
        self.mode = mode
        self.tags["grade"] = ["2 класс"]
        self.tags["subject"] = ["Математика", "Окружающий мир"]
        self.tags["topic"] = ["Время", "Часы"]

        # Словари для текстовых описаний
        self.hour_words = {
            1: "час", 2: "два", 3: "три", 4: "четыре", 5: "пять",
            6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять",
            11: "одиннадцать", 12: "двенадцать", 0: "двенадцать"
        }

        # Склонение часов для родительного падежа (без ... часа)
        self.hour_words_genitive = {
            1: "первого", 2: "второго", 3: "третьего", 4: "четвертого",
            5: "пятого", 6: "шестого", 7: "седьмого", 8: "восьмого",
            9: "девятого", 10: "десятого", 11: "одиннадцатого",
            12: "двенадцатого", 0: "двенадцатого"
        }

        # Для конструкций "два часа", "три часа" (именительный падеж)
        self.hour_words_nominative = {
            1: "час", 2: "два часа", 3: "три часа", 4: "четыре часа",
            5: "пять часов", 6: "шесть часов", 7: "семь часов",
            8: "восемь часов", 9: "девять часов", 10: "десять часов",
            11: "одиннадцать часов", 12: "двенадцать часов", 0: "двенадцать часов",
            13: "тринадцать часов", 14: "четырнадцать часов", 15: "пятнадцать часов",
            16: "шестнадцать часов", 17: "семнадцать часов", 18: "восемнадцать часов",
            19: "девятнадцать часов", 20: "двадцать часов", 21: "двадцать один час",
            22: "двадцать два часа", 23: "двадцать три часа"
        }

        # Минуты в родительном падеже
        self.minute_words_genitive = {
            1: "одной минуты", 2: "двух минут", 3: "трех минут", 4: "четырех минут",
            5: "пяти минут", 6: "шести минут", 7: "семи минут", 8: "восьми минут",
            9: "девяти минут", 10: "десяти минут", 11: "одиннадцати минут",
            12: "двенадцати минут", 13: "тринадцати минут", 14: "четырнадцати минут",
            15: "пятнадцати минут", 16: "шестнадцати минут", 17: "семнадцати минут",
            18: "восемнадцати минут", 19: "девятнадцати минут", 20: "двадцати минут",
            21: "двадцати одной минуты", 22: "двадцати двух минут", 23: "двадцати трех минут",
            24: "двадцати четырех минут", 25: "двадцати пяти минут", 26: "двадцати шести минут",
            27: "двадцати семи минут", 28: "двадцати восьми минут", 29: "двадцати девяти минут"
        }

        # Минуты в именительном падеже
        self.minute_words_nominative = {
            0: "ровно",
            1: "одна минута", 2: "две минуты", 3: "три минуты",
            4: "четыре минуты", 5: "пять минут", 6: "шесть минут",
            7: "семь минут", 8: "восемь минут", 9: "девять минут",
            10: "десять минут", 11: "одиннадцать минут", 12: "двенадцать минут",
            13: "тринадцать минут", 14: "четырнадцать минут", 15: "пятнадцать минут",
            16: "шестнадцать минут", 17: "семнадцать минут", 18: "восемнадцать минут",
            19: "девятнадцать минут",
            20: "двадцать минут",
            30: "тридцать минут",
            40: "сорок минут",
            50: "пятьдесят минут"
        }
        for i in range(21, 60):
            if i % 10 == 0:
                continue
            a_i = (i // 10) * 10
            b_i = i % 10
            self.minute_words_nominative[i] = self.minute_words_nominative[a_i].split(' ')[0] + ' ' + self.minute_words_nominative[b_i]

        self.day_periods = {
            "утро": (5, 11),  # 4:00 - 11:59
            "день": (12, 17),  # 12:00 - 17:59
            "вечер": (18, 23),  # 18:00 - 23:59
            "ночь": (0, 4)  # 0:00 - 3:59
        }

    def _get_day_period(self, hour):
        """Определяет часть суток по часу"""
        for period, (start, end) in self.day_periods.items():
            if start <= hour <= end:
                return period
        return "день"

    def _generate_time_text_description(self, hour_24, minute):
        """Генерирует текстовое описание времени с правильной грамматикой"""
        # Особые случаи
        if random.random() < 0.15:
            if hour_24 == 12 and minute == 0:
                return "Полдень", "12:00"
            if hour_24 == 0 and minute == 0:
                return "Полночь", "0:00"

        # Уточнение времени суток
        period = self._get_day_period(hour_24)
        period_text = {
            "утро": "утра",
            "день": "дня",
            "вечер": "вечера",
            "ночь": "ночи"
        }[period]

        hour_12 = hour_24 % 12
        hour_12 = hour_12 if hour_12 else 12
        next_hour_12 = (hour_12 % 12) + 1

        period_text_24 = '' if hour_24 > 12 else period_text
        period_text = '' if hour_24 == hour_12 else period_text

        if random.random() < 0.15 and minute:
            return (f"{self.hour_words_nominative[hour_24]} {self.minute_words_nominative[minute]} {period_text_24}",
                    f"{hour_24}:{minute:02d}")

        if random.random() < 0.15 and minute:
            return (f"{self.hour_words_nominative[hour_12]} {self.minute_words_nominative[minute]} {period_text}",
                    f"{hour_24}:{minute:02d}")

        # Получаем правильные формы слов
        next_hour_genitive_12 = self.hour_words_genitive[next_hour_12] # первого, второго, третьего
        next_hour_nominative_12 = self.hour_words[next_hour_12] # час, два, три ... двенадцать

        templates = []

        # Базовые шаблоны
        if minute == 0:
            templates.extend([
                (f"Ровно {self.hour_words_nominative[hour_12]} {period_text}", f"{hour_24}:{minute:02d}"),
                (f"{self.hour_words_nominative[hour_12]} {period_text}", f"{hour_24}:{minute:02d}"),
                (f"Ровно {self.hour_words_nominative[hour_24]} {period_text_24}", f"{hour_24}:{minute:02d}"),
                (f"{self.hour_words_nominative[hour_24]} {period_text_24} ровно", f"{hour_24}:{minute:02d}"),
            ])
        elif minute == 15:
            templates.extend([
                (f"Четверть {next_hour_genitive_12} {period_text}", f"{hour_24}:{minute:02d}"),
                (f"Пятнадцать минут {next_hour_genitive_12} {period_text}", f"{hour_24}:{minute:02d}"),
            ])
        elif minute == 30:
            templates.extend([
                (f"Половина {next_hour_genitive_12} {period_text}", f"{hour_24}:{minute:02d}"),
            ])
        elif minute == 45:
            templates.extend([
                (f"Без четверти {next_hour_nominative_12} {period_text}", f"{hour_24}:{minute:02d}"),
                (f"Без пятнадцати {next_hour_nominative_12} {period_text}", f"{hour_24}:{minute:02d}"),
            ])
        elif minute < 30:
            # Конструкция "X минут Y-го" (до половины)
            if minute in self.minute_words_nominative:
                minute_text = self.minute_words_nominative[minute]
                templates.append(
                    (f"{minute_text} {next_hour_genitive_12} {period_text}", f"{hour_24}:{minute:02d}")
                )
            else:
                templates.append(
                    (f"{minute} минут {next_hour_genitive_12} {period_text}", f"{hour_24}:{minute:02d}")
                )
        else:
            # Конструкция "без X минут Y" (после половины)
            minutes_to_hour = 60 - minute
            if minutes_to_hour in self.minute_words_genitive:
                templates.append(
                    (f"Без {self.minute_words_genitive[minutes_to_hour]} {next_hour_nominative_12} {period_text}", f"{hour_24}:{minute:02d}")
                )
            else:
                templates.append(
                    (f"Без {minutes_to_hour} минут {next_hour_nominative_12}  {period_text}", f"{hour_24}:{minute:02d}")
                )

        # Стиль
        templates = [(uppercase_first_letter(q), a) for [q, a] in templates]
        # Убираем дубликаты и выбираем случайный
        templates = list(set(templates))
        return random.choice(templates)

    def generate_problem(self):
        """Генерирует задачу с часами или текстовым описанием"""
        # Генерируем случайное время
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)

        # Определяем тип задачи
        gen_text_description = random.choice([True, False]) if self.mode == ClockGeneratorType.CLOCK_AND_TEXT else False
        gen_text_description = True if self.mode == ClockGeneratorType.TEXT_ONLY else gen_text_description


        if gen_text_description:
            # Генерируем текстовое описание
            text, answer = self._generate_time_text_description(hour, minute)
            text_description = uppercase_first_letter(text)

            html_code = f'''
            <div style="text-align: center; margin: 5px;">
                <h4>Какое время соответствует описанию?</h4>
                <div style="font-size: 18px; padding: 5px; margin: 5px 0;">
                    <i>"{text_description}"</i>
                </div>
            </div>
            '''
        else:
            # Генерируем аналоговые часы
            hour_12 = hour % 12
            hour_12 = 12 if hour_12 == 0 else hour_12
            answer = f"{hour_12}:{minute:02d}"

            html_code = f'''
            <div style="text-align: center; margin: 10px 0;">
                <h4 style="margin-bottom: 5px;">Какое время показывают часы?</h4>
                <div style="display: inline-block; padding: 5px; max-width: 100%;">
                    <div style="width: 80%; height: auto; max-width: 300px; margin: 0 auto;">
                        {generate_clock_svg(hour, minute, clock_style=self.clock_style)}
                    </div>
                </div>
            </div>
            '''

        return html_code, answer

    def get_section_name(self):
        return "Определение времени по аналоговым часам или описанию (детальные часы)"

    def get_key(self):
        return "time_and_clock_simple"

    def get_hint(self):
        return ("Введите время в формате hh:mm, например, 1:15 или 13:15<br>"
                "Для аналоговых часов используйте 12-часовой формат (1-12)<br>"
                "Для текстовых описаний с указанием времени суток используйте 24-часовой формат (0-23)")

    def get_problems_number(self):
        return 24 * 60

    def prepare_for_speech(self, text):
        if "<svg" in text or "Какое время показывают часы?" in text:
            return "Какое время показывают часы? Посмотрите на изображение часов и введите время."
        elif "Какое время соответствует описанию?" in text:
            import re
            match = re.search(r'<strong>"([^"]+)"</strong>', text)
            if match:
                description = match.group(1)
                return f"Какое время соответствует описанию? {description}. Введите время в формате часы:минуты."
        return super().prepare_for_speech(text)

    @staticmethod
    def has_text_mode():
        return True

class ClockGeneratorSimple(ClockGenerator):
    """Генератор задач на определение времени по аналоговым часам и текстовым описаниям"""

    def __init__(self, mode=ClockGeneratorType.CLOCK_ONLY):
        super().__init__(mode=mode)
        self.tags["grade"] = ["2 класс"]

    def get_section_name(self):
        return "Определение времени по аналоговым часам (стандартный циферблат)"

    def get_key(self):
        return "time_and_clock_simple"

class ClockGeneratorHard(ClockGenerator):
    """Генератор задач на определение времени по аналоговым часам и текстовым описаниям"""

    def __init__(self, mode=ClockGeneratorType.CLOCK_AND_TEXT):
        super().__init__(mode=mode)
        self.tags["grade"] = ["3 класс"]
        self.clock_style = "minimal"

    def get_section_name(self):
        return "Определение времени по аналоговым часам или описанию (минималистичный циферблат)"

    def get_key(self):
        return "time_and_clock_hard"