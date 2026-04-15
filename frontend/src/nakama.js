import { Client } from "@heroiclabs/nakama-js";

const useSSL = process.env.REACT_APP_NAKAMA_USE_SSL === "true";
const host = process.env.REACT_APP_NAKAMA_HOST || "127.0.0.1";
const port = process.env.REACT_APP_NAKAMA_PORT || "7350";

const client = new Client("defaultkey", host, port, useSSL);

export default client;