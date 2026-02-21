package handlers

import (
	"log"
	"net/http"

	"github.com/chaitanya-Uike/inkspace/views"
)

func HomeHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	component := views.HomePage("My Go App")
	if err := component.Render(r.Context(), w); err != nil {
		log.Printf("render error: %v", err)
		http.Error(w, "render error", http.StatusInternalServerError)
	}
}
