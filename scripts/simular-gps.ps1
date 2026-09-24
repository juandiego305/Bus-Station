param(
  [string]$BaseUrl = 'http://localhost:3001',
  [int]$Cantidad = 10,
  [int]$IntervaloSegundos = 4,
  [int]$Ciclos = 0,
  [int]$CicloInicioSinRed = -1,
  [int]$CiclosSinRed = 0
)

$latitudInicial = 7.8891
$longitudInicial = -72.4967
$cicloActual = 0

Write-Host "Simulador GPS: $Cantidad posiciones cada $IntervaloSegundos segundos"
Write-Host "Destino: $BaseUrl/posiciones"
if ($CicloInicioSinRed -ge 1 -and $CiclosSinRed -gt 0) {
  Write-Host "Red simulada: ciclos $CicloInicioSinRed a $($CicloInicioSinRed + $CiclosSinRed - 1)"
}
Write-Host 'Presiona Ctrl+C para detenerlo.'

do {
  $cicloActual++
  $timestampBase = [DateTime]::UtcNow
  $enviadas = 0
  $sinRed = $CicloInicioSinRed -ge 1 -and
    $cicloActual -ge $CicloInicioSinRed -and
    $cicloActual -lt ($CicloInicioSinRed + $CiclosSinRed)

  if ($sinRed) {
    Write-Warning ("[{0}] SIN RED: no se enviaron las {1} posiciones; se conserva el ultimo estado conocido." -f $cicloActual, $Cantidad)
  } else {
    for ($indice = 1; $indice -le $Cantidad; $indice++) {
      $evento = @{
        bus_id = "bus-sim-{0:D2}" -f $indice
        ruta_id = 'ruta-1'
        timestamp = $timestampBase.AddSeconds($indice).ToString('o')
        lat = [Math]::Round($latitudInicial + ($indice * 0.0001) + ($cicloActual * 0.00001), 6)
        lon = [Math]::Round($longitudInicial - ($indice * 0.0001), 6)
        velocidad_kmh = 20 + ($indice % 10)
        estado = 'EN_RUTA'
      } | ConvertTo-Json

      try {
        $respuesta = Invoke-RestMethod `
          -Uri "$BaseUrl/posiciones" `
          -Method Post `
          -ContentType 'application/json' `
          -Body $evento

        $enviadas++
        Write-Host ("[{0}] {1}: {2}" -f $cicloActual, $respuesta.evento_id, $respuesta.recibido)
      } catch {
        Write-Warning ("[{0}] fallo al enviar bus-sim-{1:D2}: {2}" -f $cicloActual, $indice, $_.Exception.Message)
      }
    }
  }

  Write-Host "Ciclo $cicloActual terminado: $enviadas/$Cantidad aceptadas."

  if ($Ciclos -eq 0 -or $cicloActual -lt $Ciclos) {
    Start-Sleep -Seconds $IntervaloSegundos
  }
} while ($Ciclos -eq 0 -or $cicloActual -lt $Ciclos)