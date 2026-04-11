
import http.server
import socketserver
import webbrowser
import os
import json
import sys

def subir_productos_temporada():
    try:
        from google.cloud import firestore
        from google.oauth2 import service_account
    except ImportError:
        print("Instalando dependencias de Firestore...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "google-cloud-firestore"])
        from google.cloud import firestore
        from google.oauth2 import service_account

    cred_path = os.path.join(os.path.dirname(__file__), 'el-palomar-abed2-firebase-adminsdk-fbsvc-f2ea8d5793.json')
    data_path = os.path.join(os.path.dirname(__file__), 'nuevaVista', 'temporada_espana.json')
    credentials = service_account.Credentials.from_service_account_file(cred_path)
    db = firestore.Client(credentials=credentials, project=credentials.project_id)
    col_ref = db.collection('productos-temporada')
    docs = list(col_ref.limit(1).stream())
    if docs:
        print('Colección productos-temporada ya inicializada.')
        return
    with open(data_path, encoding='utf-8') as f:
        data = json.load(f)
    categorias = ['frutas', 'verduras', 'pescados']
    for cat in categorias:
        for prod in data.get(cat, []):
            doc_ref = col_ref.document(prod['id'])
            prod_copy = dict(prod)
            prod_copy['categoria'] = cat
            doc_ref.set(prod_copy)
    print('Datos de productos de temporada subidos a Firestore.')

# Ejecutar subida antes de arrancar el servidor
subir_productos_temporada()

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
