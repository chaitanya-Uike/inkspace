package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/chaitanya-Uike/inkspace/pkg/ot"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Handler struct {
	manager *RoomManager
}

func NewHandler(manager *RoomManager) *Handler {
	return &Handler{manager: manager}
}

func (h *Handler) WebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

	client := &Client{
		id:      uuid.NewString(),
		conn:    conn,
		manager: h.manager,
	}
	log.Printf("client connected: %s (%s)", client.id, conn.RemoteAddr())

	defer func() {
		client.leave()
		conn.Close()
		log.Printf("client disconnected: %s", client.id)
	}()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if err := h.dispatch(client, raw); err != nil {
			log.Printf("dispatch error for %s: %v", client.id, err)
		}
	}
}

func (h *Handler) dispatch(client *Client, raw []byte) error {
	var base IncomingMessage
	if err := json.Unmarshal(raw, &base); err != nil {
		return err
	}

	switch base.Type {
	case "join":
		roomID, _ := base.Payload["roomId"].(string)
		client.handleJoin(roomID)

	case "operation":
		var msg OperationMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Printf("invalid operation message from %s: %v", client.id, err)
			return nil
		}
		op, err := ot.DeserializeOperation(msg.Payload.Operation)
		if err != nil {
			log.Printf("invalid operation data from %s: %v", client.id, err)
			return nil
		}
		client.handleOperation(op, msg.Payload.Revision)

	case "selection":
		var msg SelectionMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Printf("invalid selection message from %s: %v", client.id, err)
			return nil
		}
		client.handleSelection(&msg.Payload.Selection, msg.Payload.Revision)

	default:
		log.Printf("unknown message type %q from %s", base.Type, client.id)
	}

	return nil
}
