package handlers

import "github.com/chaitanya-Uike/inkspace/pkg/ot"

type IncomingMessage struct {
	Type    string         `json:"type"`
	Payload map[string]any `json:"payload,omitempty"`
}

type OperationMessage struct {
	Type    string `json:"type"`
	Payload struct {
		Operation ot.OperationData `json:"operation"`
		Revision  int              `json:"revision"`
	} `json:"payload"`
}

type SelectionMessage struct {
	Type    string `json:"type"`
	Payload struct {
		ClientID  string       `json:"clientId"`
		Selection ot.Selection `json:"selection"`
		Revision  int          `json:"revision"`
	} `json:"payload"`
}

type OutgoingMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}
