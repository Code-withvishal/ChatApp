import * as signalR from "@microsoft/signalr";

const connection = new signalR.HubConnectionBuilder()
  .withUrl("https://chatapp-api.onrender.com/chathub", {
    withCredentials: true
  })
  .withAutomaticReconnect()
  .build();


async function startConnection() {
  if (connection.state === signalR.HubConnectionState.Disconnected) {
    await connection.start();
  }
  return connection;
}

export { connection, startConnection };
