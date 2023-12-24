if (typeof module !== "undefined") {
  var WS = require("ws");
  var { v4: uuidv4 } = require("uuid");
  var { Reactive, Reactivate } = require("@seyacat/reactive");
} else {
  const reactive = document.createElement("script");
  reactive.setAttribute(
    "src",
    "https://seyacat.github.io/reactive/reactive.js"
  );
  document.body.appendChild(reactive);
}

function Shared(options = { port: null, server: null, url: null }) {
  return Reactivate(new SharedClass(options));
}
class SharedClass {
  constructor(options = { port: null, server: null, url: null }) {
    this.clients = {};
    this.options = { ...{ port: 12556, server: null }, ...options };

    if (this.options.server) {
      //SERVER
      this.wss = new WS.Server({ server: this.options.server });
      this.wss.on("connection", function connection(ws) {
        ws.id = uuidv4();
        this.clients[ws.id] = ws;
        ws.on("message", async function incoming(message) {
          console.log("received: %s", message);
        });
      });
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
    console.log("wsInit");
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify("it works! Yeeee! :))"));
    };
    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (data.objects) {
        for (const [key, value] of Object.entries(data.objects)) {
          objects[key] = value;
        }
        globals.redraw = true;
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
