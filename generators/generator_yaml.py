import yaml
import random

from generators.generator_abstract import ProblemGenerator

class YamlProblemGenerator(ProblemGenerator):
    """Генератор задач из YAML-файла"""

    def __init__(self, yaml_file):
        """
        :param yaml_file: Путь к YAML-файлу с задачами
        """
        super().__init__(default_timeout=180)
        self.yaml_file = yaml_file
        self.title, self.tags, self.tasks, self.count = self.load_tasks()

    def load_tasks(self):
        """Загрузка задач из YAML-файла"""
        with open(self.yaml_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data['title'], data['tags'], data['problems'], len(data['problems'])

    def generate_problem(self, limits=None):
        """Выбор случайной задачи"""
        if not self.get_problems_number():
            return None
        idx = random.randint(0, self.count - 1)
        problem = self.tasks[idx]['problem']
        answer = self.tasks[idx]['answer']
        return problem, answer

    def get_section_name(self, limits=None):
        return f"{self.title}"

    def get_key(self):
        return f"yaml_{self.yaml_file}"

    def get_problems_number(self):
        return self.count