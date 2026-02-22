package handlers

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/chaitanya-Uike/inkspace/pkg/ot"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Client struct {
	id       string
	conn     *websocket.Conn
	document *Document
	manager  *RoomManager
}

func (c *Client) send(v any) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("marshal error: %v", err)
		return
	}
	if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("write error to %s: %v", c.id, err)
	}
}

func (c *Client) sendError(msg string) {
	c.send(OutgoingMessage{Type: "error", Payload: msg})
}

func (c *Client) leave() {
	doc := c.document
	if doc == nil {
		return
	}
	empty := doc.removeClient(c.id)
	if empty {
		c.manager.remove(doc.id)
		log.Printf("document %s deleted (empty)", doc.id)
	} else {
		doc.broadcast(OutgoingMessage{
			Type:    "client-disconnected",
			Payload: map[string]any{"clientId": c.id},
		}, c.id)
	}
	c.document = nil
}

func (c *Client) handleJoin(roomID string) {
	if roomID == "" {
		roomID = uuid.NewString()
	}
	if c.document != nil {
		c.leave()
	}

	doc := c.manager.getOrCreate(roomID)
	doc.addClient(c)
	c.document = doc

	log.Printf("client %s joined document %s", c.id, roomID)

	c.send(OutgoingMessage{
		Type: "joined-room",
		Payload: map[string]any{
			"clientId": c.id,
			"roomId":   roomID,
			"state":    doc.state,
			"revision": doc.revision,
		},
	})
}

func (c *Client) handleOperation(operation *ot.Operation, clientRevision int) {
	if c.document == nil {
		c.sendError("not in a room")
		return
	}
	doc := c.document

	doc.mu.Lock()
	defer doc.mu.Unlock()

	var err error
	for i := clientRevision; i < len(doc.history); i++ {
		historicalOp := &doc.history[i]
		_, operation, err = ot.Transform(historicalOp, operation)
		if err != nil {
			fmt.Println(err)
			c.sendError("failed to transform operation")
			return
		}
		if operation.IsNoop() {
			c.send(OutgoingMessage{Type: "ack-operation", Payload: map[string]any{"revision": doc.revision}})
			return
		}
	}

	doc.state, err = operation.Apply(doc.state)
	if err != nil {
		c.sendError("failed to apply operation to server state")
		return
	}

	doc.history = append(doc.history, *operation)
	doc.revision++

	c.send(OutgoingMessage{Type: "ack-operation", Payload: map[string]any{"revision": doc.revision}})
	doc.broadcast(OutgoingMessage{
		Type: "remote-operation",
		Payload: map[string]any{
			"operation": ot.SerializeOperation(operation),
			"revision":  doc.revision,
		},
	}, c.id)
}

func (c *Client) handleSelection(selection *ot.Selection, remoteClientRevision int) {
	if c.document == nil {
		c.sendError("not in a room")
		return
	}
	doc := c.document

	doc.mu.RLock()
	defer doc.mu.RUnlock()

	for i := remoteClientRevision; i < len(doc.history); i++ {
		historicalOp := &doc.history[i]
		selection = ot.TransformSelection(selection, historicalOp)
	}

	doc.broadcast(OutgoingMessage{
		Type: "remote-selection",
		Payload: map[string]any{
			"clientId":  c.id,
			"selection": *selection,
			"revision":  doc.revision,
		},
	}, c.id)
}
