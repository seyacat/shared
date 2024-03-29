if (typeof module !== "undefined") {
  var WS = require("ws");
  var { v4: uuidv4 } = require("uuid");
  var { Reactivate, Reactive } = require("@seyacat/reactive");
  var dgram = require("node:dgram");
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
    reactive.server.subscribe(
      null,
      (data) => {
        //TODO DELETE DISCONNECTED CLIENTS
        for (let [key, client] of reactive.clients) {
          //DELETE DISNONNECTED
          if (client._rel.readyState > 1) {
            delete reactive.clients[key];
            continue;
          }
          //SEND CHANGE
          const msg = JSON.stringify({
            ...data,
            path: ["server", ...data.path],
            base: null,
            pathValues: null,
            value: data.value,
            address: options.address,
            port: options.port,
          });
          if (client._rel.type === "udp4") {
            const [ip, port] = key.split(":");
            client._rel.send(msg, port, ip);
          } else {
            client._rel.send(msg);
          }
        }
      },
      { detailed: true }
    );
    reactive.clients.subscribe(
      null,
      (data) => {
        //STOP MUTTED EVENTS
        if (reactive._rel.mutted.has(["clients", ...data.path].join("."))) {
          return;
        }
        if (data.path.length <= 1) return;
        const client = reactive.clients[data.path.slice(0, 1)];
        //DELETE DISNONNECTED
        if (client._rel.readyState > 1) {
          delete reactive.clients[data.path.slice(0, 1)];
        }
        const msg = JSON.stringify({
          //...data,
          pathIds: [client._obId, ...data.pathIds.slice(1)],
          path: ["client", ...data.path.slice(1)],
          base: null,
          pathValues: null,
          value: data.value,
          address: options.address,
          port: options.port,
        });

        if (client && client._rel.type == "udp4") {
          const [ip, port] = data.path[0].split(":");
          console.log("CLIEN SEND");
          client._rel.send(msg, port, ip);
        }
        if (client && client._rel.readyState === 1) {
          client._rel.send(msg);
        }
      },
      { detailed: true }
    );
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
            value: data.value,
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
      if (this.options.server.type == "udp4") {
        this.options.server.on(
          "message",
          this.onmessage.bind({ shared: this })
        );
      } else {
        this.wss = new WS.Server({ server: this.options.server });
        this.wss.on(
          "connection",
          function connection(ws) {
            ws.on("message", this.onmessage.bind({ shared: this, ws }));
          }.bind(this)
        );
      }
    } else {
      //CLIENT
      this.url =
        (window.location + "")
          .replace("http://", "ws://")
          .replace("https://", "wss://") ?? url;
      this.wsInit();
    }
  }

  onmessage = async function (msg, info) {
    console.log("RECEIVED");
    let sender;
    let uuid;
    if (this.ws) {
      sender = this.ws;
      uuid = this.ws.id;
    }
    /*if (info) {
      console.log({ info });
      //uuid = info.address + ":" + info.port;
      //sender = this.shared.options.server;
      sender = dgram.createSocket("udp4");
    }*/
    let data;
    try {
      data = JSON.parse(msg);
      if (info) {
        console.log({ info });
        uuid = data.address + ":" + data.port;
        //sender = this.shared.options.server;
        sender = dgram.createSocket("udp4");
      }
      /*console.log(161, data);
      sender.address = data.address;
      sender.port = data.port;*/
    } catch (e) {
      console.log("error", e);
      return;
    }

    //BASIC AUTH
    if (data.uuid) {
      if (data.uuid === "_") {
        uuid = uuidv4();
        const msg = JSON.stringify({ uuid: uuid });
        sender.send(msg);
        return;
      } else {
        uuid = data.uuid;
        if (this.ws) {
          this.ws.id = uuid;
        }
      }
    }

    if (!uuid) {
      return;
    }
    //CREATE REACTIVES
    if (!this.shared.reactive.clients[uuid]) {
      this.shared.reactive.clients[uuid] = Reactivate(
        sender,
        {},
        { prefix: uuid }
      );
      //this.shared.reactive.clients[uuid].triggerChange();
    } else {
      if (this.ws) {
        this.shared.reactive.clients[uuid]._rel = sender;
      }
    }

    if (Array.isArray(data.path)) {
      //CHECK CLIENT PATHS

      if (this.shared.options.clientPaths) {
        const localPath = data.path.join(".");
        if (!this.shared.options.clientPaths[localPath]?.validate(data.value)) {
          sender.send(JSON.stringify({ error: `${data.path} rejected` }));
          return;
        }
      }
      const path = ["clients", uuid, ...data.path];
      this.shared.mutted.add(path.join("."));
      let r = this.shared.reactive;
      for (let step of path.slice(0, -1)) {
        if (!r[step]) {
          r[step] = Reactive();
        }
        r = r[step];
      }
      r[path.slice(-1)] = data.value;
      this.shared.mutted.delete(path.join("."));
    }
  };

  wsInit = () => {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = (event) => {
      this.reactive.event = event;
      const uuid = window.sessionStorage.getItem("uuid");
      this.ws.send(JSON.stringify({ uuid: uuid ?? "_" }));
    };
    this.ws.onmessage = (event) => {
      this.reactive.event = event;
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
        return;
      }

      if (data.path) {
        this.mutted.add(data.path.join("."));
        //TODO RECURSIVE CREATE REACTIVES WITH IDS
        let r = this.reactive;
        //CREATE MISSING BASE TREE
        for (let i in data.path.slice(0, -1)) {
          const prop = data.path[i];
          const obId = data.pathIds[i];
          if (!r[prop] && obId) {
            r[prop] = Reactive({}, { obId, const: true });
          }
          r = r[prop];
        }

        const prop = data.path.slice(-1);

        createChainFromDetailed(r, prop, data.value);

        this.mutted.delete(data.path.join("."));
      } else {
        this.reactive.error = data;
      }
    };

    this.ws.onclose = (event) => {
      this.reactive.event = event;
      console.log("disconnected");
      setTimeout(() => {
        this.wsInit();
      }, 1000);
    };
  };
}

const createChainFromDetailed = (base, prop, detailed) => {
  if (detailed?._obId) {
    base[prop] = Reactive({}, { obId: detailed?._obId, const: true });
    for (nextprop in detailed.value) {
      createChainFromDetailed(base[prop], nextprop, detailed.value[nextprop]);
    }
  } else {
    base[prop] = detailed;
  }
};

if (typeof module !== "undefined") {
  module.exports = {
    Shared,
  };
}
