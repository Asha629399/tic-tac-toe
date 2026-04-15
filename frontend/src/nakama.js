import { Client } from "@heroiclabs/nakama-js";

const isProduction = window.location.hostname !== "localhost";
const useSSL = isProduction ? true : false;
const host = isProduction ? "tic-tac-toe-nakama-2q2x.onrender.com" : "127.0.0.1";
const port = isProduction ? "443" : "7350";

const client = new Client("defaultkey", host, port, useSSL);

export default client;