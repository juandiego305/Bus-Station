workspace "Sistema de Transporte Público en Vivo" "Diagrama de contexto (C4 Nivel 1)" {

    model {
        gpsDispositivo = softwareSystem "Dispositivo GPS del bus" "Emite posición, velocidad y estado cada 4 segundos, vía red celular" "Hardware"

        usuarioTransporte = person "Usuario del transporte" "Consulta mapa en vivo, llegadas por parada y planea su viaje"

        operadorFlota = person "Operador de flota" "Monitorea buses y detecta desvíos o vehículos detenidos"

        enteGestor = person "Ente gestor" "Consume reportes históricos de puntualidad, frecuencia y demanda"

        sistemasTerceros = softwareSystem "Sistemas de terceros" "Aplicaciones externas que consumen datos en vivo vía API pública" "Software"

        sistemaTransporte = softwareSystem "Sistema de Transporte Público en Vivo" "Ingiere las posiciones de 350 buses, estima llegadas por parada, sirve el mapa en vivo, gestiona alertas y produce reportes históricos" "SistemaPrincipal"

        pantallasEstacion = softwareSystem "Pantallas de estación" "40 pantallas de hardware modesto que muestran próximas llegadas" "Hardware"

        # Relaciones
        gpsDispositivo -> sistemaTransporte "Reporta posición, velocidad y estado" "cada 4s - ~90 eventos/s sostenidos"
        usuarioTransporte -> sistemaTransporte "Consulta mapa en vivo y llegadas" "app móvil - HTTPS"
        operadorFlota -> sistemaTransporte "Monitorea flota y recibe alertas" "bus detenido / fuera de ruta / sin reportar"
        enteGestor -> sistemaTransporte "Consulta reportes de puntualidad y frecuencia" "por ruta y franja horaria"
        sistemasTerceros -> sistemaTransporte "Consume datos en vivo" "interfaz pública - aislada del núcleo interno"
        sistemaTransporte -> pantallasEstacion "Publica próximas llegadas por parada" "actualizado cada 15s"
    }

    views {
        systemContext sistemaTransporte "ContextoSistema" {
            include *
            autoLayout lr
            title "Sistema de Transporte Público en Vivo - Contexto"
        }

        styles {
            element "Element" {
                shape RoundedBox
            }
            element "SistemaPrincipal" {
                background #1168bd
                color #ffffff
            }
            element "Hardware" {
                background #6b7280
                color #ffffff
                shape Box
            }
            element "Software" {
                background #6b7280
                color #ffffff
                shape Box
            }
            element "Person" {
                background #1a1a3d
                color #ffffff
                shape Person
            }
        }
    }

}