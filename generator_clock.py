import random
import math
from datetime import datetime, timedelta
from generator_abstract import ProblemGenerator


class ClockGenerator(ProblemGenerator):
    """Генератор задач на определение времени по аналоговым часам и текстовым описаниям"""

    def __init__(self, clock_style="detailed", include_text_descriptions=True):
        super().__init__(default_timeout=45)
        self.clock_style = clock_style  # "detailed", "simplified", "minimal"
        self.include_text_descriptions = include_text_descriptions
        self.tags["grade"] = ["2 класс", "3 класс"]
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
            11: "одиннадцать часов", 12: "двенадцать часов", 0: "двенадцать часов"
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
            24: "двадцати четырех минут", 25: "двадцати пяти минут"
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
            19: "девятнадцать минут", 20: "двадцать минут", 21: "двадцать одна минута",
            22: "двадцать две минуты", 23: "двадцать три минуты",
            24: "двадцать четыре минуты", 25: "двадцать пять минут",
            26: "двадцать шесть минут", 27: "двадцать семь минут",
            28: "двадцать восемь минут", 29: "двадцать девять минут",
            30: "половина"
        }

        self.day_periods = {
            "утро": (4, 11),  # 4:00 - 11:59
            "день": (12, 17),  # 12:00 - 17:59
            "вечер": (18, 23),  # 18:00 - 23:59
            "ночь": (0, 3)  # 0:00 - 3:59
        }

    def _get_day_period(self, hour):
        """Определяет часть суток по часу"""
        for period, (start, end) in self.day_periods.items():
            if start <= hour <= end:
                return period
        return "день"

    def _generate_time_text_description(self, hour, minute):
        """Генерирует текстовое описание времени с правильной грамматикой"""
        # Особые случаи
        if hour == 12 and minute == 0:
            return "Полдень"
        if hour == 0 and minute == 0:
            return "Полночь"

        hour_12 = hour % 12
        hour_12 = 12 if hour_12 == 0 else hour_12
        next_hour_12 = (hour_12 % 12) + 1

        # Получаем правильные формы слов
        hour_genitive = self.hour_words_genitive[next_hour_12]
        hour_nominative = self.hour_words[next_hour_12]

        templates = []

        # Базовые шаблоны
        if minute == 0:
            templates.extend([
                f"Ровно {self.hour_words_nominative[hour_12]}",
                f"{self.hour_words_nominative[hour_12]} ровно"
            ])
        elif minute == 15:
            templates.extend([
                f"Четверть {hour_genitive}",
                f"Пятнадцать минут {hour_genitive}"
            ])
        elif minute == 30:
            templates.extend([
                f"Половина {hour_genitive}",
                f"Тридцать минут {hour_genitive}"
            ])
        elif minute == 45:
            templates.extend([
                f"Без четверти {hour_nominative}",
                f"Без пятнадцати {hour_nominative}"
            ])
        elif minute < 30:
            # Конструкция "X минут Y-го" (до половины)
            if minute in self.minute_words_nominative:
                minute_text = self.minute_words_nominative[minute]
                templates.append(f"{minute_text} {hour_genitive}")
            else:
                templates.append(f"{minute} минут {hour_genitive}")
        else:
            # Конструкция "без X минут Y" (после половины)
            minutes_to_hour = 60 - minute
            if minutes_to_hour in self.minute_words_genitive:
                templates.append(f"Без {self.minute_words_genitive[minutes_to_hour]} {hour_nominative}")
            else:
                templates.append(f"Без {minutes_to_hour} минут {hour_nominative}")

        # Добавляем уточнение времени суток (в 30% случаев)
        if random.random() < 0.3 and minute in [0, 15, 30, 45]:
            period = self._get_day_period(hour)
            period_text = {
                "утро": "утра",
                "день": "дня",
                "вечер": "вечера",
                "ночь": "ночи"
            }[period]

            if not (hour == 12 and minute == 0) and not (hour == 0 and minute == 0):
                if minute == 0:
                    templates.append(f"{self.hour_words_nominative[hour_12]} {period_text}")
                elif minute == 15:
                    templates.append(f"Четверть {hour_genitive} {period_text}")
                elif minute == 30:
                    templates.append(f"Половина {hour_genitive} {period_text}")
                elif minute == 45:
                    templates.append(f"Без четверти {hour_nominative} {period_text}")

        # Убираем дубликаты и выбираем случайный
        templates = list(set(templates))
        return random.choice(templates) if templates else f"{hour_12}:{minute:02d}"

    def _generate_clock_svg(self, hour, minute):
        """Генерирует SVG код для аналоговых часов"""
        # Рассчитываем углы стрелок
        hour_12 = hour % 12
        hour_angle = (hour_12 + minute / 60) * 30
        minute_angle = minute * 6

        # Определяем параметры в зависимости от стиля
        show_all_numbers = self.clock_style == "detailed"
        show_hour_ticks = self.clock_style != "minimal"
        show_minute_ticks = self.clock_style == "detailed"

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
        if show_hour_ticks:
            for hour_num in range(1, 13):
                angle = hour_num * 30 - 90
                rad = math.radians(angle)

                # Координаты начала и конца риски
                x1 = center_x + (radius - 15) * math.cos(rad)
                y1 = center_y + (radius - 15) * math.sin(rad)
                x2 = center_x + radius * math.cos(rad)
                y2 = center_y + radius * math.sin(rad)

                svg_code += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="black" stroke-width="3"/>\n'

                # Добавляем цифры
                if show_all_numbers or hour_num in [3, 6, 9, 12]:
                    text_x = center_x + (radius - 35) * math.cos(rad)
                    text_y = center_y + (radius - 35) * math.sin(rad) + 7
                    hour_text = str(hour_num)
                    svg_code += f'<text x="{text_x}" y="{text_y}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">{hour_text}</text>\n'

        # Добавляем минутные риски
        if show_minute_ticks:
            for minute_num in range(0, 60, 5):
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

    def generate_problem(self):
        """Генерирует задачу с часами или текстовым описанием"""
        # Генерируем случайное время
        hour = random.randint(0, 23)
        minute_choices = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
        minute = random.choice(minute_choices)

        # Определяем тип задачи
        use_text_description = self.include_text_descriptions and random.choice([True, False])

        if use_text_description:
            # Генерируем текстовое описание
            text_description = self._generate_time_text_description(hour, minute)

            # Определяем правильный ответ (ИСПРАВЛЕНО!)
            # Для "десять минут первого" должно быть 0:10, а не 12:10
            if "первого" in text_description and hour == 0:
                # 0 часов в текстовом описании как "первого" должно соответствовать 0:xx
                answer = f"{0:02d}:{minute:02d}"
            elif hour == 0:
                # Для 0 часов используем 00:xx
                answer = f"{0:02d}:{minute:02d}"
            elif hour == 12:
                # Для 12 часов используем 12:xx
                answer = f"{12:02d}:{minute:02d}"
            else:
                # Для остальных - преобразуем в 12-часовой формат
                hour_12 = hour % 12
                hour_12 = 12 if hour_12 == 0 else hour_12
                answer = f"{hour_12}:{minute:02d}"

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
                        {self._generate_clock_svg(hour, minute)}
                    </div>
                </div>
            </div>
            '''

        return html_code, answer

    def get_section_name(self):
        return "Определение времени по аналоговым часам или описанию"

    def get_key(self):
        return "time_and_clock"

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