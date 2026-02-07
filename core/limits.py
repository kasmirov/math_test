import yaml
import json
import jsonschema
from typing import Any, Dict

DEFAULT_YAML = 'core/default_limits.yaml'
SCHEMA_JSON = 'core/limits_schema.json'

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


def deep_merge(base, override, path=None):
    """Глубокое слияние словарей с сохранением непереопределённых значений"""
    if path is None:
        path = []

    for key, value in override.items():
        if key in base:
            if isinstance(base[key], dict) and isinstance(value, dict):
                deep_merge(base[key], value, path + [str(key)])
            else:
                base[key] = value
        else:
            base[key] = value
    return base


def get_schema():
    with open(SCHEMA_JSON, 'r', encoding='utf-8') as f:
        s = json.load(f)
        return s


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
        return True, None
    except jsonschema.ValidationError as e:
        return False, _format_error(e)
    except jsonschema.SchemaError as e:
        return False, [f"Schema error: {str(e)}"]

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

