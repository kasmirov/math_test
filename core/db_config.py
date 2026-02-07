# Конфигурация базы данных
import os

DEFAULT_DB = 'app.db'
db_config = {'DATABASE_PATH': os.environ.get('DATABASE_PATH') or DEFAULT_DB}
