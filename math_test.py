import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Укажите режим запуска: 'console' или 'server'")
        sys.exit(1)

    mode = sys.argv[1].lower()
    if mode == '--console':
        from console import app_console
        app_console.main()
    elif mode == '--server':
        from server import app_server
        app_server.main()
    else:
        print(f"Неизвестный режим: {mode}")
        print("Доступные режимы: 'console', 'server'")
        sys.exit(1)


if __name__ == "__main__":
    main()