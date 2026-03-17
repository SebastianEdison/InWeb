from flask import Flask, render_template
#Importamos funciones de bbdd
from databases import obtener_productos

app = Flask(__name__)

# Definimos la ruta principal (pagina de inicio)

@app.route('/')

def index():
    #Por ahhora solo cargamos la pagina leugo traemos los productos
    return render_template ('index.html')

if __name__ == '__main__':
    #debug = True sirve para que el servidor se reinicia
    app.run(debug=True)