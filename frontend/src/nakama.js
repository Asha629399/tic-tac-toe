import { Client } from "@heroiclabs/nakama-js";

const isProduction = window.location.hostname !== "localhost";

let client;
if (isProduction) {
  client = new Client("defaultkey", "tic-tac-toe-nakama-2q2x.onrender.com", "443", true);
} else {
  client = new Client("defaultkey", "127.0.0.1", "7350", false);
}

export default client;