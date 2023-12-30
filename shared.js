if (typeof module !== "undefined") {
  var WS = require("ws");
  var { v4: uuidv4 } = require("uuid");
  var { Reactivate, Reactive } = require("@seyacat/reactive");
} else {
  const reactive = document.createElement("script");
  reactive.setAttribute(
    "src",
    "https://seyacat.github.io/reactive/reactive.js"
  );
  document.head.appendChild(reactive);
}

function Shared(
  options = { port: null, server: null, url: null, clienPaths: null }
) {
  let reactive;
  if (options.server) {
    //SERVER
    reactive = Reactivate(new SharedClass(options), {
      server: Reactive(null, { prefix: "server" }),
      clients: Reactive(null, { prefix: "clients" }),
    });
    reactive.server.subscribe(null, (data) => {
      //TODO DELETE DISCONNECTED CLIENTS
      for (let [key, client] of reactive.clients) {
        //DELETE DISNONNECTED
        if (client._rel.readyState > 1) {
          delete reactive.clients[key];
          continue;
        }
        //SEND CHANGE
        client._rel.send(
          JSON.stringify({
            ...data,
            path: ["server", ...data.path],
            base: null,
            pathValues: null,
          })
        );
      }
    });
    reactive.clients.subscribe(null, (data) => {
      //STOP MUTTED EVENTS
      if (reactive._rel.mutted.has(["clients", ...data.path].join("."))) {
        console.log("mutted");
        return;
      }
      //TODO DELETE DISCONNECTED CLIENTS
      if (data.path.length <= 1) return;
      const client = reactive.clients[data.path.slice(0, 1)];
      //DELETE DISNONNECTED
      if (client._rel.readyState > 1) {
        delete reactive.clients[data.path.slice(0, 1)];
      }
      if (client && client._rel.readyState === 1) {
        client._rel.send(
          JSON.stringify({
            ...data,
            path: ["client", ...data.path.slice(1)],
            base: null,
            pathValues: null,
          })
        );
      }
    });
  } else {
    //CLIENT
    reactive = Reactivate(new SharedClass(options), {
      server: Reactive(),
      client: Reactive(),
    });
    reactive.client.subscribe(null, (data) => {
      if (reactive._rel.ws.readyState == 1) {
        if (reactive._rel.mutted.has(["client", ...data.path].join("."))) {
          return;
        }
        //OPEN
        reactive._rel.ws.send(
          JSON.stringify({
            ...data,
            base: null,
            pathValues: null,
          })
        );
      }
    });
  }
  return reactive;
}
class SharedClass {
  constructor(
    options = { port: null, server: null, url: null, clienPaths: null }
  ) {
    this.mutted = new Set();
    this.options = { ...{ port: 12556, server: null }, ...options };
    if (this.options.server) {
      //SERVER
      this.wss = new WS.Server({ server: this.options.server });
      this.wss.on(
        "connection",
        function connection(ws) {
          ws.on(
            "message",
            async function (msg) {
              let data;
              try {
                data = JSON.parse(msg);
              } catch (e) {
                console.log("error", e);
                return;
              }
              //BASIC AUTH
              if (data.uuid) {
                if (data.uuid === "_") {
                  ws.id = uuidv4();
                } else {
                  ws.id = data.uuid;
                }
                if (!this.reactive.clients[ws.id]) {
                  this.reactive.clients[ws.id] = Reactivate(ws);
                }
                this.reactive.clients[ws.id].triggerChange();
                ws.send(JSON.stringify({ uuid: ws.id }));
              }
              //REJECT NO AUTH
              if (!ws.id) {
                return;
              }
              if (Array.isArray(data.path)) {
                //CHECK CLIENT PATHS

                if (this.options.clientPaths) {
                  const localPath = data.path.join(".");
                  console.log(this.options.clientPaths[localPath]);
                  if (
                    !this.options.clientPaths[localPath]?.validation(data.value)
                  ) {
                    ws.send(JSON.stringify({ error: `${data.path} rejected` }));
                    return;
                  }
                }
                const path = ["clients", ws.id, ...data.path];
                this.mutted.add(path.join("."));
                let r = this.reactive;
                for (let step of path.slice(0, -1)) {
                  if (!r[step]) {
                    r[step] = Reactive();
                  }
                  r = r[step];
                }
                r[path.slice(-1)] = data.value;
                this.mutted.delete(path.join("."));
              }
            }.bind(this)
          );
        }.bind(this)
      );
    } else {
      //CLIENT
      this.url =
        (window.location + "")
          .replace("http://", "ws://")
          .replace("https://", "wss://") ?? url;
      this.wsInit();
    }
  }

  wsInit = () => {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      const uuid = window.sessionStorage.getItem("uuid");
      this.ws.send(JSON.stringify({ uuid: uuid ?? "_" }));
    };
    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        this.reactive.error = e;
        console.log("error", e);
        return;
      }
      if (data.uuid) {
        window.sessionStorage.setItem("uuid", data.uuid);
      }
      if (data.path) {
        this.mutted.add(data.path.join("."));
        let r = this.reactive;
        for (let step of data.path.slice(0, -1)) {
          r = r[step];
        }
        r[data.path.slice(-1)] = data.value;
        this.mutted.delete(data.path.join("."));
      } else {
        this.reactive.error = data;
      }
    };

    this.ws.onclose = () => {
      console.log("disconnected");
      setTimeout(() => {
        this.wsInit();
      }, 1000);
    };
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    Shared,
  };
}
