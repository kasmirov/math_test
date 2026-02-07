import random

from generators.generator_abstract import ProblemGenerator
from generators.generate_operators import generate_operators

operations = ['+', '-', '×', '÷']
num_of_try = 1e5

class Node:
    def __init__(self,
                 value,
                 left=None,
                 right=None,
                 ):
        self.left = left
        self.right = right
        self.value = value

def generate_node(depth):
    if depth == 0 or random.randint(1, 6) == 1:
        return Node(0)
    op = random.choice(operations)
    node = Node(op,
                generate_node(depth - 1),
                generate_node(depth - 1))
    return node


def calc_nodes_num(graph: Node):
    left = 0 if graph.left is None else calc_nodes_num(graph.left) + 1
    right = 0 if graph.right is None else calc_nodes_num(graph.right) + 1
    num = left + right
    return num

def calc_tree_depth(graph: Node):
    left = 0 if graph.left is None else calc_tree_depth(graph.left) + 1
    right = 0 if graph.right is None else calc_tree_depth(graph.right) + 1
    depth = max(left, right)
    return depth

def calc_branch(graph: Node, limits):
    global num_of_try
    if isinstance(graph.value, int):
        return graph.value
    result = 0

    while True:
        result_a = calc_branch(graph.left, limits) if not isinstance(graph.left.value, int) else None
        result_b = calc_branch(graph.right, limits) if not isinstance(graph.right.value, int) else None
        try:
            left, right, result = generate_operators(graph.value, limits, result_a, result_b)
            if isinstance(graph.left.value, int):
                graph.left.value = left
            if isinstance(graph.right.value, int):
                graph.right.value = right
            break
        except ValueError as ve:
            num_of_try -= 1
            if not num_of_try:
                num_of_try = 1e5
                raise ValueError(f"Failed to find combination for branch")
            continue
    return result

def tree_to_string(graph):
    """
    Преобразует бинарное дерево в математическое выражение с минимальным количеством скобок.
    """
    if graph is None:
        return ""

    # Если узел - число, просто возвращаем его
    if isinstance(graph.value, (int, float)):
        return str(graph.value)

    # Рекурсивно получаем выражения для левого и правого поддеревьев
    left_expr = tree_to_string(graph.left)
    left_op = graph.left.value if not isinstance(graph.left.value, int) else None
    right_expr = tree_to_string(graph.right)
    right_op = graph.right.value if not isinstance(graph.right.value, int) else None
    op = graph.value
    if right_op: # Вложенный оператор справа
        if op in ['÷', '-']: # Не ассоциативная операция
            right_expr = f"({right_expr})"
        elif right_op in ['+', '×'] and op == '+': # Текущая и вложенные операции одного приоритета
            pass
        else:
            right_expr = f"({right_expr})"

    if left_op:  # Вложенный оператор справа
        if op in ['÷', '×'] and left_op != '×':  #
            left_expr = f"({left_expr})"
        elif op in ['+', '-']:  #
            pass
        else:
            pass

    # ['+', '-', '×', '÷']
    result = f"{left_expr} {op} {right_expr}"
    return result

def generate_expr(depth: int, limits):
    while True:
        tree = generate_node(depth)
        result = 0
        try:
            result = calc_branch(tree, limits)
            if calc_nodes_num(tree) < depth * 2 or calc_tree_depth(tree) < depth:
                continue
            break
        except ValueError as ve:
            continue
    problem = tree_to_string(tree)
    return problem, result


class PriorityOperationsGenerator3rd(ProblemGenerator):
    """Генератор примеров с приоритетами операций 3 класс"""

    def __init__(self):
        super().__init__(default_timeout=90)
        self.tags["grade"] = ["3 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Приоритеты операций", "Сложение и вычитание", "Умножение", "Деление"]


    def generate_problem(self, limits):
        problem, result = generate_expr(3, limits)
        return problem, result

    def get_section_name(self, limits=None):
        return "Приоритеты операций, 3 класс"

    def get_key(self):
        return "priority_operations_3rd"

class PriorityOperationsGenerator4th(ProblemGenerator):
    """Генератор примеров с приоритетами операций 3 класс"""

    def __init__(self):
        super().__init__(default_timeout=90)
        self.tags["grade"] = ["4 класс"]
        self.tags["subject"] = ["Математика"]
        self.tags["topic"] = ["Приоритеты операций", "Сложение и вычитание", "Умножение", "Деление"]

    def generate_problem(self, limits):
        problem, result = generate_expr(5, limits)
        return problem, result

    def get_section_name(self, limits=None):
        return "Приоритеты операций, 4 класс"

    def get_key(self):
        return "priority_operations_4rd"

'''
operations = ['+', '-', '×', '÷']
expr = problem.replace('÷', '/')
expr = expr.replace('×', '*')
print(f"{expr} = {result}")
'''