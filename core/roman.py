def to_roman(num):
    """Конвертирует арабское число (1-3999) в римскую запись."""
    if not 1 <= num <= 3999:
        raise ValueError("Число должно быть в диапазоне 1..3999")
    val = [
        (1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'),
        (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),
        (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')
    ]
    roman = ''
    for v, symbol in val:
        while num >= v:
            roman += symbol
            num -= v
    return roman

def from_roman(roman):
    """Конвертирует римскую запись в арабское число."""
    roman = roman.upper().strip()
    values = {'I':1, 'V':5, 'X':10, 'L':50, 'C':100, 'D':500, 'M':1000}
    total = 0
    prev = 0
    for ch in reversed(roman):
        cur = values[ch]
        if cur < prev:
            total -= cur
        else:
            total += cur
        prev = cur
    return total

def is_valid_roman(s):
    """Простая проверка корректности римской записи (базовая)."""
    try:
        n = from_roman(s)
        return to_roman(n) == s.upper()
    except:
        return False