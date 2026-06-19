# Trivia Belgrano

Jeopardy estático en HTML, CSS y JavaScript para proyectar en clase.

## Uso

- `index.html` carga las preguntas desde `flashcards.csv`.
- Hay dos vistas: `Aula` y `La gran final`.
- Los equipos se seleccionan haciendo click en su tarjeta.
- Cada pregunta permite revelar respuesta y sumar, restar o marcar sin puntuar.
- Los avances quedan guardados en el navegador con `localStorage`.

Para probarlo localmente con el CSV, servilo desde un servidor estático:

```powershell
python -m http.server 5500
```

Luego abrir `http://localhost:5500`.
