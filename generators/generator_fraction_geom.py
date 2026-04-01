import random
import math
from generators.generator_abstract import ProblemGenerator


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def generate_fraction_circle_svg(parts, shaded, size=300):
    """Генерирует SVG круга, разделённого на parts секторов, shaded из них закрашены.
       Закрашенные сектора идут подряд, начиная с верхнего (0°), по часовой стрелке.
    """
    center = size // 2
    radius = size // 2 - 10

    # Угол одного сектора
    angle_step = 360 / parts

    svg = (f'''<svg viewBox="0 0 {size} {size}"
            style="width: 80%; height: 80%; max-height: 300px;"
            xmlns="http://www.w3.org/2000/svg">''')

    # Внешний контур (сплошная линия)
    svg += f'<circle cx="{center}" cy="{center}" r="{radius}" fill="none" stroke="black" stroke-width="2"/>'

    # Рисуем секторы: сначала все линии деления (пунктир)
    for i in range(parts):
        angle = i * angle_step
        rad = math.radians(angle - 90)  # -90 чтобы первый сектор был сверху
        x2 = center + radius * math.cos(rad)
        y2 = center + radius * math.sin(rad)
        svg += f'<line x1="{center}" y1="{center}" x2="{x2}" y2="{y2}" stroke="black" stroke-width="1" stroke-dasharray="4 4"/>'

    # Закраска закрашенных секторов (бледно-голубой)
    start_angle = -90  # начало первого сектора сверху
    for i in range(shaded):
        angle1 = start_angle + i * angle_step
        angle2 = angle1 + angle_step
        rad1 = math.radians(angle1)
        rad2 = math.radians(angle2)
        # Координаты дуги
        x1 = center + radius * math.cos(rad1)
        y1 = center + radius * math.sin(rad1)
        x2 = center + radius * math.cos(rad2)
        y2 = center + radius * math.sin(rad2)

        # Флаг большой дуги (всегда 0, так как сектор < 180°)
        large_arc = 0
        # Направление дуги (1 = по часовой стрелке)
        sweep = 1

        path = f'M {center} {center} L {x1} {y1} A {radius} {radius} 0 {large_arc} {sweep} {x2} {y2} Z'
        svg += f'<path d="{path}" fill="#b3e0ff" stroke="none" opacity="0.6"/>'

    # Тонкая сплошная линия по периметру закрашенного сектора
    # Она рисуется после заливки, чтобы не перекрываться заливкой
    if shaded > 0:
        angle1 = start_angle
        angle2 = start_angle + shaded * angle_step
        rad1 = math.radians(angle1)
        rad2 = math.radians(angle2)
        x1 = center + radius * math.cos(rad1)
        y1 = center + radius * math.sin(rad1)
        x2 = center + radius * math.cos(rad2)
        y2 = center + radius * math.sin(rad2)

        # Путь по внешней дуге и двум радиусам
        # Используем тот же формат, но рисуем только контур
        large_arc = 1 if shaded * angle_step > 180 else 0
        path = f'M {center} {center} L {x1} {y1} A {radius} {radius} 0 {large_arc} 1 {x2} {y2} Z'
        svg += f'<path d="{path}" fill="none" stroke="#333" stroke-width="1.5" stroke-dasharray="none"/>'

    # Нумерация секторов
    for i in range(parts):
        # Угол середины сектора
        mid_angle = start_angle + (i + 0.5) * angle_step
        rad = math.radians(mid_angle)
        # Радиус для текста (на полпути от центра к краю)
        text_radius = radius * 0.7
        x = center + text_radius * math.cos(rad)
        y = center + text_radius * math.sin(rad) + 5  # небольшой сдвиг для центрирования
        svg += f'<text x="{x}" y="{y}" text-anchor="middle" font-size="24" fill="black">{i+1}</text>'

    svg += '</svg>'
    return svg


def generate_fraction_square_svg(divisions, shaded, size=300):
    """Генерирует SVG квадрата, разделённого на divisions x divisions клеток.
       Закрашиваются первые shaded клеток (по строкам, слева направо).
    """
    cell_size = size // divisions
    svg = f'''<svg viewBox="0 0 {size} {size}" 
                style="width: 80%; height: 80%; max-height: 300px;"
                xmlns="http://www.w3.org/2000/svg">'''

    # Внешний контур (сплошной)
    svg += f'<rect x="0" y="0" width="{size}" height="{size}" fill="none" stroke="black" stroke-width="2"/>'

    # Линии деления (пунктир)
    for i in range(1, divisions):
        x = i * cell_size
        svg += f'<line x1="{x}" y1="0" x2="{x}" y2="{size}" stroke="black" stroke-width="1" stroke-dasharray="4 4"/>'
        svg += f'<line x1="0" y1="{x}" x2="{size}" y2="{x}" stroke="black" stroke-width="1" stroke-dasharray="4 4"/>'

    # Закраска закрашенных клеток (бледно-голубой)
    for idx in range(shaded):
        row = idx // divisions
        col = idx % divisions
        x = col * cell_size
        y = row * cell_size
        svg += f'<rect x="{x}" y="{y}" width="{cell_size}" height="{cell_size}" fill="#b3e0ff" opacity="0.6"/>'

    # Тонкая сплошная линия по периметру закрашенной области
    if shaded > 0:
        # Определяем границы закрашенной области (минимальные и максимальные индексы)
        rows = set()
        cols = set()
        for idx in range(shaded):
            rows.add(idx // divisions)
            cols.add(idx % divisions)
        min_row = min(rows)
        max_row = max(rows)
        min_col = min(cols)
        max_col = max(cols)

        # Рисуем прямоугольник, охватывающий все закрашенные клетки (он будет совпадать с внешним контуром, если они образуют прямоугольник)
        # Но для произвольного набора клеток нужна более сложная логика. Упростим: рисуем только внешний контур всей области.
        # В нашем случае клетки идут подряд по строкам, поэтому область всегда будет прямоугольной или с неполной последней строкой.
        # Значит, можно просто нарисовать прямоугольник от (min_col*cell_size, min_row*cell_size) до (max_col+1)*cell_size, (max_row+1)*cell_size
        x1 = min_col * cell_size
        y1 = min_row * cell_size
        x2 = (max_col + 1) * cell_size
        y2 = (max_row + 1) * cell_size
        svg += f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" fill="none" stroke="#333" stroke-width="1.5" stroke-dasharray="none"/>'

    # Нумерация клеток
    num = 1
    for row in range(divisions):
        for col in range(divisions):
            x = col * cell_size + cell_size / 2
            y = row * cell_size + cell_size / 2 + 5  # смещение для центрирования
            svg += f'<text x="{x}" y="{y}" text-anchor="middle" font-size="{max(12, size//divisions//2)}" fill="black">{num}</text>'
            num += 1

    svg += '</svg>'
    return svg


class FractionGeneratorGeom(ProblemGenerator):
    """Генератор задач на понимание дробей с помощью закрашенных фигур."""

    def __init__(self, max_circle_parts=12, max_square_exponent=3):
        """
        max_circle_parts: максимальное количество частей для круга (рекомендуется 12 или 16)
        max_square_exponent: максимальная степень двойки для квадрата (2^exp), например 3 => 8x8
        """
        super().__init__(default_timeout=60)
        self.max_circle_parts = max_circle_parts
        self.max_square_exponent = max_square_exponent
        self.tags["grade"] = ["3 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Дроби", "Геометрические фигуры"]
        self.description = "Определите, какая часть фигуры закрашена, и запишите её в виде несократимой дроби."

    def generate_problem(self, limits=None):
        # Определяем тип фигуры: круг или квадрат
        use_circle = random.choice([True, False])

        if use_circle:
            # Круг
            parts = random.randint(2, self.max_circle_parts)
            # Закрашиваем от 1 до parts-1 частей, чтобы не было целого
            shaded = random.randint(1, parts - 1)
            # Упрощаем дробь
            g = _gcd(shaded, parts)
            numerator = shaded // g
            denominator = parts // g
            answer = f"{numerator}/{denominator}"
            svg = generate_fraction_circle_svg(parts, shaded)

            html = f"""
            <div style="text-align: center; margin: 10px;">
                <h4 style="margin-bottom: 5px;">Определите закрашенную часть фигуры</h4>
                <div style="display: inline-block; max-width: 100%;">
                    <div style="width: 80%; height: auto; max-width: 300px; margin: 0 auto;">
                        {svg}
                    </div>
                </div>
            </div>
            """
        else:
            # Квадрат
            exponent = random.randint(1, self.max_square_exponent)
            divisions = 2 ** exponent
            total = divisions * divisions
            # Закрашиваем от 1 до total-1 клеток
            shaded = random.randint(1, total - 1)
            # Упрощаем
            g = _gcd(shaded, total)
            numerator = shaded // g
            denominator = total // g
            answer = f"{numerator}/{denominator}"
            svg = generate_fraction_square_svg(divisions, shaded)

            html = f"""
            <div style="text-align: center; margin: 10px;">
                <h4 style="margin-bottom: 5px;">Определите закрашенную часть фигуры</h4>
                <div style="display: inline-block; max-width: 100%;">
                    <div style="width: 80%; height: auto; max-width: 300px; margin: 0 auto;">
                        {svg}
                    </div>
                </div>
            </div>
            """
        return html, answer

    def get_section_name(self, limits=None):
        return "Введение в дроби"

    def get_key(self):
        return "fractions_visual"

    def get_hint(self):
        return ("Введите дробь в формате числитель/знаменатель (например, 2/3)<br>"
                "Дробь должна быть несократимой (например, 1/2 вместо 2/4)")

    @staticmethod
    def has_text_mode():
        return False