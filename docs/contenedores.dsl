workspace "Sistema de Transporte" {
    model {
        gps = person "Dispositivo GPS" "Emite ubicaciones a 90 evt/s sostenidos"
        pasajero = person "Pasajero / Terceros" "Consulta el mapa en vivo y ETAs"
        
        plataforma = softwareSystem "Plataforma de Transporte" {
            apiIngesta = container "API de Ingesta" "Recibe y valida coordenadas GPS" "Spring Boot / Java"
            broker = container "Broker de Eventos" "Enruta posiciones de forma masiva" "Kafka (Múltiples particiones)"
            workerCache = container "Actualizador de Mapa" "Mantiene la vista en vivo" "Python / Node.js"
            workerHist = container "Proyector Histórico" "Persiste para reportes" "Python / Java"
            cache = container "Caché de Lectura" "Almacena última posición y ETAs (TTL 60s)" "Redis"
            bdHist = container "Base de Datos Histórica" "Guarda el recorrido inmutable" "PostgreSQL"
            apiLectura = container "API Pública / Clientes" "Sirve el mapa sin tocar la ingesta" "Node.js / Spring Boot"
        }

        gps -> apiIngesta "Envía coordenadas" "HTTPS, síncrono"
        apiIngesta -> broker "Publica PosicionRecibida" "TCP, asíncrono"
        
        broker -> workerCache "Entrega evento en vivo" "TCP, al menos una vez"
        broker -> workerHist "Entrega evento para historial" "TCP, al menos una vez"
        
        workerCache -> cache "Sobrescribe ubicación" "TCP, síncrono"
        workerHist -> bdHist "Inserta registro (commit manual)" "TCP, síncrono"
        
        pasajero -> apiLectura "Consulta mapa y tiempos" "HTTPS, síncrono"
        apiLectura -> cache "Lee estado actual" "TCP, síncrono"
    }

    views {
        container plataforma "VistaContenedores" {
            include *
            autoLayout lr
        }
        theme default
    }
}