workspace "Sistema de Transporte Público en Vivo" "Vista de contenedores C4 - Grupo 6" {
    model {
        gps = softwareSystem "Dispositivos GPS" "Reportan posición, velocidad y estado cada 4 segundos" {
            tags "Externo"
        }
        usuario = person "Usuario del transporte" "Consulta mapa y tiempos de llegada"
        operador = person "Operador de flota" "Monitorea buses y recibe alertas"
        gestor = person "Ente gestor" "Consulta reportes históricos"
        terceros = softwareSystem "Sistemas de terceros" "Consumen la API pública" {
            tags "Externo"
        }
        pantallas = softwareSystem "Pantallas de estación" "Muestran próximas llegadas" {
            tags "Externo"
        }

        transporte = softwareSystem "Sistema de Transporte Público en Vivo" {
            gateway = container "Gateway de ingesta" "Recibe posiciones y publica PosicionReportada" "Node.js / HTTP" 
            kafka = container "Kafka" "Log durable y distribución del evento a consumidores independientes" "Apache Kafka"
            realtime = container "Servicio de tiempo real" "Actualiza última posición y sirve el mapa" "Node.js / Redis"
            eta = container "Estimador de llegadas" "Recalcula tiempos por parada" "Node.js / Redis"
            alertas = container "Servicio de alertas" "Detecta anomalías y genera avisos al operador" "Node.js"
            historico = container "Servicio histórico" "Persiste cada posición para análisis" "Node.js / PostgreSQL"
            reportes = container "Servicio de reportes" "Consulta frecuencia y puntualidad" "Node.js / PostgreSQL"
            api = container "API pública" "Expone datos en vivo con límites de consumo" "Node.js / HTTP"
            redis = container "Redis" "Estado más reciente de buses, ETA y alertas" "Redis"
            postgres = container "PostgreSQL" "Almacenamiento histórico de posiciones" "PostgreSQL"
        }

        gps -> gateway "Envía posiciones" "HTTPS, síncrono (ACK de recepción)"
        gateway -> kafka "Publica PosicionReportada" "Kafka, publicación durable"
        kafka -> realtime "Entrega evento" "Kafka, asíncrono, al menos una vez"
        kafka -> eta "Entrega evento" "Kafka, asíncrono, al menos una vez"
        kafka -> alertas "Entrega evento" "Kafka, asíncrono, al menos una vez"
        kafka -> historico "Entrega evento" "Kafka, asíncrono, al menos una vez"
        realtime -> redis "Guarda última posición" "Redis, síncrono local"
        eta -> redis "Guarda ETA por parada" "Redis, síncrono local"
        alertas -> redis "Guarda estado de alertas" "Redis, síncrono local"
        historico -> postgres "Inserta evento (idempotente)" "SQL, síncrono local"
        reportes -> postgres "Consulta agregados históricos" "SQL/HTTP, síncrono"
        usuario -> realtime "Consulta mapa y estado" "HTTPS, síncrono"
        usuario -> eta "Consulta tiempo de llegada" "HTTPS, síncrono"
        operador -> alertas "Consulta alertas activas" "HTTPS, síncrono"
        gestor -> reportes "Solicita reportes" "HTTPS, síncrono"
        terceros -> api "Consulta datos en vivo" "HTTPS, síncrono"
        api -> realtime "Lee estado de buses" "HTTP, síncrono"
        realtime -> pantallas "Distribuye posiciones" "HTTPS/WebSocket, asíncrono"
    }

    views {
        container transporte "Contenedores" {
            include *
            autoLayout lr
            title "Sistema de Transporte Público en Vivo - Contenedores (Grupo 6)"
        }
        styles {
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "Container" {
                background #1168bd
                color #ffffff
            }
            element "Software System" {
                background #999999
                color #ffffff
            }
            element "Externo" {
                background #666666
                color #ffffff
            }
        }
    }
}
