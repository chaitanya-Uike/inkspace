package handlers

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/chaitanya-Uike/inkspace/pkg/ot"
	"github.com/gorilla/websocket"
)

type Document struct {
	id       string
	mu       sync.RWMutex
	clients  map[string]*Client
	state    string
	revision int
	history  []ot.Operation
}

func newDocument(id string) *Document {
	return &Document{
		id:      id,
		clients: make(map[string]*Client),
	}
}

func (d *Document) addClient(c *Client) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.clients[c.id] = c
}

func (d *Document) removeClient(id string) (empty bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.clients, id)
	return len(d.clients) == 0
}

func (d *Document) broadcast(v any, excludeClientID string) {
	msg, err := json.Marshal(v)
	if err != nil {
		log.Printf("marshal error: %v", err)
		return
	}
	for id, client := range d.clients {
		if id == excludeClientID {
			continue
		}
		if err := client.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("broadcast error to %s: %v", id, err)
		}
	}
}

// RoomManager

type RoomManager struct {
	mu    sync.RWMutex
	rooms map[string]*Document
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Document),
	}
}

func (rm *RoomManager) getOrCreate(roomID string) *Document {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	if doc, ok := rm.rooms[roomID]; ok {
		return doc
	}
	doc := newDocument(roomID)
	rm.rooms[roomID] = doc
	return doc
}

func (rm *RoomManager) remove(roomID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.rooms, roomID)
}
