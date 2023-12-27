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

function Shared(options = { port: null, server: null, url: null }) {
  let reactive;
  if (options.server) {
    //SERVER
    reactive = Reactivate(new SharedClass(options), {
      server: Reactive(null, { prefix: "server" }),
      clients: Reactive(null, { prefix: "clients" }),
    });
    reactive.server.subscribe(null, (data) => {
      //TODO DELETE DISCONNECTED CLIENTS
      for (let client of Object.values(reactive._rel.clients)) {
        client.send(
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
      //TODO DELETE DISCONNECTED CLIENTS
      if (data.path.length <= 1) return;
      const client = reactive._rel.clients[data.path.slice(0, 1)];

      if (client && client.readyState === 1) {
        client.send(
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
  constructor(options = { port: null, server: null, url: null }) {
    this.options = { ...{ port: 12556, server: null }, ...options };
    if (this.options.server) {
      //SERVER
      this.clients = {};
      this.wss = new WS.Server({ server: this.options.server });
      this.wss.on(
        "connection",
        function connection(ws) {
          ws.id = uuidv4();
          this.clients[ws.id] = ws;
          if (!this.reactive.clients[ws.id]) {
            this.reactive.clients[ws.id] = Reactivate(ws);
          }

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
              if (Array.isArray(data.path)) {
                const path = ["clients", ws.id, ...data.path];
                let r = this.reactive;
                for (let step of path.slice(0, -1)) {
                  if (!r[step]) {
                    r[step] = Reactive();
                  }
                  r = r[step];
                }
                r[path.slice(-1)] = data.value;
              }
            }.bind(this)
          );
        }.bind(this)
      );
      this.options.server.listen(this.options.port, () => {
        console.log(`server running on port ${this.options.port}`);
      });
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
      this.ws.send(JSON.stringify("it works! Yeeee! :))"));
    };
    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.log("error", e);
        return;
      }
      let r = this.reactive;
      for (let step of data.path.slice(0, -1)) {
        r = r[step];
      }
      r[data.path.slice(-1)] = data.value;
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
