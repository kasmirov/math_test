import os
import yaml
import json
import jsonschema
from typing import Any, Dict

# Пути к ресурсам относительно этого файла (не зависят от текущего каталога)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_YAML = os.path.join(BASE_DIR, 'default_limits.yaml')
SCHEMA_JSON = os.path.join(BASE_DIR, 'limits_schema.json')

def base_limits():
    with open(DEFAULT_YAML, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        return data['basic']


def default_limits():
    base = base_limits()
    with open(DEFAULT_YAML, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)['adv_positive']
        merged = deep_merge(base, data)
        return merged


def deep_merge(base, override):
    """Глубокое слияние словарей без мутации входных данных"""
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def get_schema():
    with open(SCHEMA_JSON, 'r', encoding='utf-8') as f:
        s = json.load(f)
        return s


# Диапазоны вида {min, max} в лимитах
_RANGE_PATHS = [
    ("sum", "add"), ("sum", "result"),
    ("mult", "factor"), ("mult", "result"),
    ("div", "dividend"), ("div", "divisor"), ("div", "result"),
    ("roman_conversion", None),
    ("roman_sum", "add"), ("roman_sum", "result"),
]


def _check_ranges(data: Dict[str, Any]) -> list:
    """Проверяет, что во всех диапазонах min <= max."""
    errors = []
    for section_key, sub_key in _RANGE_PATHS:
        section = data.get(section_key)
        if sub_key is not None:
            section = section.get(sub_key) if isinstance(section, dict) else None
        if not isinstance(section, dict):
            continue
        if "min" in section and "max" in section and section["min"] > section["max"]:
            label = f"{section_key}.{sub_key}" if sub_key else section_key
            errors.append(f"Path: {label} -> min ({section['min']}) > max ({section['max']})")
    return errors


def validate_limits(data: Dict[str, Any]) -> tuple:
    """
    Валидация объекта данных

    Args:
        data: Словарь с данными для валидации

    Returns:
        tuple: (is_valid, errors)
        - is_valid: bool, True если данные валидны
        - errors: список ошибок или None если ошибок нет
    """
    try:
        schema = get_schema()
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        return False, _format_error(e)
    except jsonschema.SchemaError as e:
        return False, [f"Schema error: {str(e)}"]

    range_errors = _check_ranges(data)
    if range_errors:
        return False, range_errors
    return True, None

def _format_error(error: jsonschema.ValidationError) -> list:
    """
    Форматирование ошибки валидации

    Args:
        error: Объект ошибки валидации

    Returns:
        list: Список строк с описанием ошибок
    """
    errors = []
    for err in error.context:
        errors.append(f"Path: {err.path} -> {err.message}")

    if not errors:
        errors.append(f"Path: {error.path} -> {error.message}")

    return errors

