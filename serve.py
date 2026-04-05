import http.server
import socketserver
import webbrowser
import os

PORT = 8080
HOST = "localhost"
ENTRY = "www/index.html"

os.chdir(os.path.dirname(os.path.abspath(__file__)))

handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer((HOST, PORT), handler) as httpd:
    url = f"http://{HOST}:{PORT}/{ENTRY}"
    print(f"Servidor iniciado en {url}")
    print("Pulsa Ctrl+C para detener.")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
