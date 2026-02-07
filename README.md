# Math test generator for age 7-11

*[Русская версия](README_RU.md)*

## Purpose
This application was created to help children practice and master foundational mathematics.
It provides customizable, automatically generated exercises covering core operations, 
with progressively challenging tasks to track and support learning progress. 
While most problems are auto-generated, the system also includes a set of predefined questions.

## Targets
* For Students: To enhance mathematical skills and develop the ability to work effectively under time constraints.
* For Parents: To monitor their child's progress and performance through detailed statistics.
* For Teachers: To create custom assignments and track student completion and mastery. (Future option)

## Features
* Auto-generation of questions by topic
* Tests defined in YAML format
* Web interface
* Command-line interface
* Task time tracking and control
* Customizable test completion criteria
* Functionality for both anonymous and registered users
* Session support with pause and resume capabilities
* Test history and results
* Mistake review and correction
* Detailed testing statistics
* Ability to create custom exercise generators

## Before first start
Install requirements
```bash
pip install -r requirements.txt
```
## Start
To start web server
```bash
python math_test.py --server
```
To start console app
```bash
python math_test.py --console
```

## UI
By default, the web page will be available at http://localhost:5000

### Web page
![Главная страница](assets/main_page.png "Главная страница")
![Новый тест](assets/new_test.png "Новый тест")
![Вопрос с поддержкой LaTeX](assets/question.png "`Вопрос с поддержкой LaTeX`")
![Вопрос с поддержкой SVG](assets/question_clock.png "`Вопрос с поддержкой SVG`")
![Работа над ошибками](assets/work_on_mistakes.png "Работа над ошибками")
![Статистика](assets/statistics.png "Статистика")

### Settings
#### Profile Management
To create a new profile, navigate to the account page via the menu and create a new profile.
![Меню](assets/main_menu.png "Меню")
You can then configure limits either immediately when creating the profile or later through profile editing. 
If limits are not set, default values will be used.
![Лимиты профиля](assets/account_profile_limits.png "Лимиты профиля")
#### Test Parameter Settings
On the main page, click the "Settings" item in the menu to open the panel:
![Настройки](assets/main_settings.png "Настройки")

### Console
Most of the test functionality is available in the console (except for features requiring HTML markup).
![Консоль](assets/console.png "Консоль")

## Contribution

We welcome contributions and ideas to extend the functionality of this project!
Whether it's fixing a bug, adding a new feature, improving documentation, or suggesting a new type of math exercise. 
Feel free to:
* Fork the repository.
* Create a branch for your changes.
* Submit a Pull Request with a clear description of your improvements.
If you have any questions or want to discuss a potential feature, please open an Issue on GitHub.
Let’s make learning math more engaging together!

## License
This project is licensed under the MIT License.
You are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. 
For more details, see the *[LICENSE](LICENSE)* file in the project repository.
