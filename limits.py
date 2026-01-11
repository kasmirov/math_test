import yaml

DEFAULT_YAML = 'default_limits.yaml'

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
