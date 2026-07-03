import http.server
import socketserver
import socket
import webbrowser
import os
import sys
import threading
import json


def find_available_port(start=8080, end=9000):
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def log_message(self, format, *args):
        sys.stdout.write(f"\r  [{self.address_string()}] {args[1]} {args[2]}    ")
        sys.stdout.flush()

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def main():
    port = find_available_port()
    if port is None:
        print("Erro: nenhuma porta disponivel entre 8080-9000")
        input("Pressione Enter para sair...")
        return

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    server = socketserver.TCPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}"

    print()
    print("  ╔══════════════════════════════════════════╗")
    print("  ║        Fala para Texto - Servidor        ║")
    print("  ╠══════════════════════════════════════════╣")
    print(f"  ║  Local:  {url}          ║")
    print("  ║                                          ║")
    print("  ║  Pressione Ctrl+C para parar             ║")
    print("  ╚══════════════════════════════════════════╝")
    print()

    threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  Servidor encerrado.")
        server.server_close()


if __name__ == "__main__":
    main()
