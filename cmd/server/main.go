package main

import (
	"log"
	"net/http"

	"github.com/chaitanya-Uike/inkspace/internal/handlers"
)

func main() {
	mux := http.NewServeMux()

	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.HandleFunc("/{$}", handlers.HomeHandler)
	mux.HandleFunc("/ws", handlers.WebSocketHandler)

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}
