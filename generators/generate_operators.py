import random

'''
Секция переменных для того чтобы очевидные операции с 0 и 1 не генерились более одного раза
'''
mult_by_one = False
mult_by_zero = False
div_one = False
div_zero = False

def generate_operators(op, limits, left=None, right=None):
    '''
    Generate set of operators for given operand that fit the limits
    :param limits:
    :param op:
    :return:
    tuple of operators
    '''
    global mult_by_zero
    global mult_by_one
    global div_zero
    global div_one

    while True:
        if op == "+":
            # Сложение
            a = random.randint(limits["sum"]["add"]["min"], limits["sum"]["add"]["max"]) if left is None else left
            b = random.randint(limits["sum"]["add"]["min"], limits["sum"]["add"]["max"]) if right is None else right
            result = a + b
            if limits["sum"]["result"]["min"] <= result <= limits["sum"]["result"]["max"]:
                return a, b, result
            raise ValueError(f"Error")
        elif op == "-":
            # Вычитание
            a = random.randint(limits["sum"]["add"]["min"], limits["sum"]["add"]["max"]) if left is None else left
            b = random.randint(limits["sum"]["add"]["min"], limits["sum"]["add"]["max"]) if right is None else right
            #a, b = max(a, b), min(a, b)
            result = a - b
            if limits["sum"]["result"]["min"] <= result <= limits["sum"]["result"]["max"]:
                return a, b, result
            raise ValueError(f"Error")
        elif op in [ "×", "*", "x" ]:
            # Умножение
            a = random.randint(limits["mult"]["factor"]["min"], limits["mult"]["factor"]["max"]) if left is None else left
            b = random.randint(limits["mult"]["factor"]["min"], limits["mult"]["factor"]["max"]) if right is None else right
            result = a * b

            # Если левое или правое значение задано, то пропускаем проверку
            # встречалась ли операция с 0 или 1 ранее в текущей сессии
            if left is None and right is None:
                if 0 in [a, b]:
                    if mult_by_zero:
                        continue
                    mult_by_zero = True
                if 1 in [a, b]:
                    if mult_by_one:
                        continue
                    mult_by_one = True

            if limits["mult"]["result"]["min"] <= a * b <= limits["mult"]["result"]["max"]:
                return a, b, result
            raise ValueError(f"Error")
        elif op in [ "÷", "/", ":" ]:
            # Деление

            if left is None: # Делимое не задано
                # Делитель
                divisor = random.randint(limits["div"]["divisor"]["min"],
                                         limits["div"]["divisor"]["max"]) if right is None else right
                # Результат
                result = random.randint(limits["div"]["result"]["min"], limits["div"]["result"]["max"])
                # Делимое
                dividend = divisor * result
            elif right is None: # Делимое задано, делитель не задан
                dividend = left
                # Если делимое уже задано, то делитель можно выбрать из конечного ряда делителей для делимого
                divisors = set()
                # Проверяем делители от 1 до корня из n
                for i in range(1, int(dividend ** 0.5) + 1):
                    if dividend % i == 0:
                        divisors.add(i)
                        divisors.add(dividend // i)
                div_list = [x for x in divisors]
                div_list = div_list if len(div_list) < 4 else div_list[1:-1]
                if len(div_list) == 0:
                    raise ValueError(f"Error")
                divisor = random.choice(div_list)
                # Результат
                result = dividend // divisor
            else:
                dividend = left
                divisor = right
                if divisor == 0:
                    raise ValueError(f"Error")
                if dividend // divisor != dividend / divisor:
                    raise ValueError(f"Error")
                result = dividend // divisor

            # Если левое значение задано, то пропускаем проверку
            # встречалась ли операция с 0 ранее в текущей сессии
            if left is None and right is None:
                if 0 in [dividend, result]:
                    if div_zero:
                        continue
                    div_zero = True
                if 1 in [divisor, result]:
                    if div_one:
                        continue
                    div_one = True

            if limits["div"]["dividend"]["min"] <= dividend <= limits["div"]["dividend"]["max"]:
                return dividend, divisor, result
            raise ValueError(f"Error")
        else:
            return None