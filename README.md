# Shared

Cliente-servidor para compartir objetos reactivos en tiempo real entre navegador y servidor Node.js.

## Descripción

**Shared** es una librería que permite sincronizar automáticamente objetos reactivos entre el cliente (navegador) y el servidor usando WebSocket o UDP. Cualquier cambio en una propiedad se propaga instantáneamente a través de la red, manteniendo ambos lados sincronizados.

Utiliza la librería [@seyacat/reactive](https://github.com/seyacat/reactive) para detectar cambios automáticamente y propagar actualizaciones en tiempo real.

## Características

- ✅ Sincronización bidireccional de objetos reactivos
- ✅ Soporte para WebSocket y UDP
- ✅ Validación de datos en el servidor
- ✅ Autenticación básica con UUID
- ✅ Manejo automático de desconexiones
- ✅ Detección de cambios reactivos
- ✅ Funciona en Node.js y navegadores

## Instalación

```bash
npm install @seyacat/shared
```

## Uso

### Servidor (Node.js)

```javascript
const express = require("express");
const http = require("http");
const { Shared } = require("@seyacat/shared");

const app = express();
const server = http.createServer(app);

// Definir validadores para datos del cliente (opcional)
const clientPaths = {
  test2: {
    validate: (value) => typeof value === "number",
  },
};

// Crear instancia del servidor compartido
const shared = new Shared({ server, clientPaths });

// Escuchar cambios
shared.subscribe(null, (data) => {
  console.log(`${data.path.join(".")} = ${data.value}`);
});

// Actualizar datos del servidor
shared.server.test = 1;

// Acceder a datos de clientes
setInterval(() => {
  shared.server.test += 1;
  
  // Iterar sobre clientes conectados
  Object.keys(shared.clients).forEach((clientId) => {
    shared.clients[clientId].data = "nuevo valor";
  });
}, 5000);

server.listen(3000);
```

### Cliente (Navegador)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="/shared.js"></script>
</head>
<body>
  <button onclick="shared.client.counter++">Click</button>
  
  <script>
    // Crear instancia del cliente
    window.shared = Shared();
    
    // Escuchar cambios
    shared.subscribe(null, (data) => {
      console.log(`${data.path.join(".")} = ${data.value}`);
    });
    
    // Escuchar cambios del servidor
    shared.server.subscribe(null, (data) => {
      console.log("Servidor actualizado:", data);
    });
    
    // Actualizar datos del cliente
    shared.client.counter = 0;
    shared.client.counter++;
    
    // Acceder a datos del servidor
    console.log(shared.server.test);
  </script>
</body>
</html>
```

## API

### Constructor: `Shared(options)`

#### Opciones del Servidor

```javascript
new Shared({
  server: httpServer,           // Servidor HTTP para WebSocket
  clientPaths: {                // Validadores de datos del cliente
    "propiedad": {
      validate: (value) => true
    }
  },
  address: "127.0.0.1",        // Dirección para UDP
  port: 12556                   // Puerto UDP
})
```

#### Opciones del Cliente

```javascript
Shared({
  url: "ws://localhost:3000"    // URL del servidor (opcional, por defecto la URL actual)
})
```

### Propiedades

- `shared.server` - Objeto reactivo del servidor (acceso desde cliente)
- `shared.client` - Objeto reactivo del cliente
- `shared.clients` - Objeto con todos los clientes conectados (solo servidor)

### Métodos

#### `.subscribe(path, callback, options)`

Escuchar cambios en una propiedad:

```javascript
// Escuchar todos los cambios
shared.subscribe(null, (data) => {
  console.log(data.path, data.value);
});

// Escuchar cambios de una propiedad específica
shared.server.subscribe("test", (value) => {
  console.log("Servidor.test cambió a:", value);
});

// Modo detallado (más información)
shared.subscribe(null, (data) => {
  console.log({
    path: data.path,           // Ruta de la propiedad
    value: data.value,         // Nuevo valor
    pathIds: data.pathIds,     // IDs de objetos reactivos
    pathValues: data.pathValues // Valores anteriores
  });
}, { detailed: true });
```

## Flujo de Sincronización

```
Cliente                        Servidor
---------                      --------
shared.client.x = 1
    │
    ├─── WS/UDP mensaje ────→ recibe en onmessage
    │                         valida (si está configurado)
    │                         actualiza shared.clients[uuid].x
    │                         notifica cambios
    │
    │  ← WS/UDP mensaje ───── shared.server.y = 2
    │                         transmite a todos los clientes
recibe cambios
actualiza shared.server.y
notifica cambios
```

## Validación de Datos

Puedes validar datos que envían los clientes:

```javascript
const clientPaths = {
  age: {
    validate: (value) => {
      return typeof value === "number" && value >= 0 && value <= 150;
    }
  },
  name: {
    validate: (value) => typeof value === "string" && value.length > 0
  }
};

const shared = new Shared({ server, clientPaths });
```

Si la validación falla, el servidor envía un error y rechaza el cambio.

## Autenticación

Los clientes se identifican con un UUID único. El flujo es:

1. Cliente envía `{ uuid: "_" }` para solicitar un nuevo UUID
2. Servidor genera un UUID único y lo envía al cliente
3. Cliente guarda el UUID en `sessionStorage`
4. En reconexiones, se reutiliza el mismo UUID

```javascript
// En el cliente
const uuid = window.sessionStorage.getItem("uuid");
// Automático: se envía con cada mensaje
```

## Protocolo de Mensajes

Los mensajes entre cliente y servidor son JSON:

```javascript
// Cliente → Servidor (cambio de propiedad)
{
  path: ["propiedad", "anidada"],
  value: 42
}

// Servidor → Cliente (cambio del servidor)
{
  path: ["server", "propiedad"],
  value: "nuevo valor",
  pathIds: [/* IDs de objetos reactivos */]
}

// Autenticación
{ uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }

// Error
{ error: "path rejected" }
```

## Ejemplos

Puedes encontrar ejemplos de uso en el directorio `examples/`:

- `examples/server.js` - Servidor Express con Shared
- `examples/client.html` - Cliente HTML que se sincroniza con el servidor

Para ejecutar el ejemplo:

```bash
cd examples
node server.js
# Abre http://localhost:3000 en el navegador
```

## Dependencias

- [@seyacat/reactive](https://github.com/seyacat/reactive) - Sistema de reactividad
- [ws](https://github.com/websockets/ws) - WebSocket para Node.js
- [uuid](https://github.com/uuidjs/uuid) - Generación de UUIDs

## Casos de Uso

- Aplicaciones colaborativas en tiempo real
- Sincronización de estado entre cliente y servidor
- Dashboards reactivos
- Juegos multijugador
- Aplicaciones con replicación de datos
- Sistemas IoT con sincronización de estado

## Licencia

ISC
