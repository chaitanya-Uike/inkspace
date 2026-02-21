document.addEventListener("DOMContentLoaded", () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

  socket.onopen = () => console.log("[ws] connected");
  socket.onclose = () => console.log("[ws] disconnected");
  socket.onmessage = (e) => console.log("[ws] message:", e.data);

  // Test: send a message 1 second after connecting
  socket.onopen = () => {
    console.log("[ws] connected");
    setTimeout(() => socket.send("hello from browser"), 1000);
  };
});
