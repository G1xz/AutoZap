/**
 * Funções para cálculo de frete usando OpenRouteService API
 */

interface FreightResult {
  success: boolean
  distance?: number
  duration?: number
  freightPrice?: number
  error?: string
}

/**
 * Calcula o frete usando OpenRouteService API
 */
export async function calculateFrete(
  originAddress: string,
  destinationAddress: string,
  pricePerKm: number
): Promise<FreightResult> {
  try {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY
    
    if (!apiKey) {
      console.warn('⚠️ OPENROUTESERVICE_API_KEY não configurada. Usando cálculo de distância em linha reta.')
      // Fallback: cálculo simples em linha reta (menos preciso)
      return calculateFreteFallback(originAddress, destinationAddress, pricePerKm)
    }

    // Geocodifica origem
    const originResponse = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(originAddress)}&size=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )
    
    if (!originResponse.ok) {
      const errorText = await originResponse.text()
      console.error('Erro ao geocodificar endereço de origem:', errorText)
      // Tenta usar fallback se a API falhar
      console.warn('⚠️ Tentando usar fallback (Nominatim) para geocodificação...')
      return calculateFreteFallback(originAddress, destinationAddress, pricePerKm)
    }
    
    const originData = await originResponse.json()
    if (!originData.features || originData.features.length === 0) {
      console.warn('⚠️ Endereço de origem não encontrado na OpenRouteService. Tentando fallback...')
      return calculateFreteFallback(originAddress, destinationAddress, pricePerKm)
    }
    
    const originCoords = originData.features[0].geometry.coordinates // [longitude, latitude]
    
    // Geocodifica destino
    const destResponse = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(destinationAddress)}&size=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )
    
    if (!destResponse.ok) {
      const errorText = await destResponse.text()
      console.error('Erro ao geocodificar endereço de destino:', errorText)
      // Tenta usar fallback se a API falhar
      console.warn('⚠️ Tentando usar fallback (Nominatim) para geocodificação...')
      return calculateFreteFallback(originAddress, destinationAddress, pricePerKm)
    }
    
    const destData = await destResponse.json()
    if (!destData.features || destData.features.length === 0) {
      console.warn('⚠️ Endereço de destino não encontrado na OpenRouteService. Tentando fallback...')
      return calculateFreteFallback(originAddress, destinationAddress, pricePerKm)
    }
    
    const destCoords = destData.features[0].geometry.coordinates // [longitude, latitude]
    
    // Calcula distância usando Distance Matrix API
    const distanceResponse = await fetch(
      'https://api.openrouteservice.org/v2/distance-matrix/driving-car',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          locations: [originCoords, destCoords],
          metrics: ['distance', 'duration'],
          units: 'km',
        }),
      }
    )
    
    if (!distanceResponse.ok) {
      const errorText = await distanceResponse.text()
      console.error('Erro ao calcular distância:', errorText)
      return { success: false, error: 'Erro ao calcular distância' }
    }
    
    const distanceData = await distanceResponse.json()
    
    if (!distanceData.distances || !distanceData.distances[0] || !distanceData.distances[0][1]) {
      return { success: false, error: 'Resposta inválida da API de distância' }
    }
    
    // Distância em metros, converte para km
    const distanceKm = distanceData.distances[0][1] / 1000
    // Duração em segundos, converte para minutos
    const durationMinutes = distanceData.durations?.[0]?.[1] ? distanceData.durations[0][1] / 60 : 0
    
    // Calcula frete
    const freightPrice = distanceKm * pricePerKm
    
    return {
      success: true,
      distance: Math.round(distanceKm * 100) / 100, // Arredonda para 2 casas decimais
      duration: Math.round(durationMinutes),
      freightPrice: Math.round(freightPrice * 100) / 100, // Arredonda para 2 casas decimais
    }
  } catch (error) {
    console.error('Erro ao calcular frete:', error)
    return { success: false, error: 'Erro ao calcular frete' }
  }
}

/**
 * Fallback: cálculo simples de distância em linha reta (Haversine)
 * Usado quando não há API key configurada
 */
async function calculateFreteFallback(
  originAddress: string,
  destinationAddress: string,
  pricePerKm: number
): Promise<FreightResult> {
  // Tenta geocodificar usando Nominatim (gratuito, sem API key)
  try {
    const originResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': 'AutoZap-Delivery-Calculator/1.0', // Obrigatório para Nominatim
        },
      }
    )
    const originData = await originResponse.json()
    
    const destResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinationAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': 'AutoZap-Delivery-Calculator/1.0', // Obrigatório para Nominatim
        },
      }
    )
    const destData = await destResponse.json()
    
    if (originData.length === 0 || destData.length === 0) {
      return { success: false, error: 'Não foi possível encontrar um dos endereços' }
    }
    
    const originLat = parseFloat(originData[0].lat)
    const originLon = parseFloat(originData[0].lon)
    const destLat = parseFloat(destData[0].lat)
    const destLon = parseFloat(destData[0].lon)
    
    // Fórmula de Haversine para calcular distância em linha reta
    const R = 6371 // Raio da Terra em km
    const dLat = (destLat - originLat) * Math.PI / 180
    const dLon = (destLon - originLon) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distanceKm = R * c
    
    // Adiciona 20% de margem para compensar que é linha reta (não rota real)
    const adjustedDistance = distanceKm * 1.2
    
    const freightPrice = adjustedDistance * pricePerKm
    
    return {
      success: true,
      distance: Math.round(adjustedDistance * 100) / 100,
      duration: Math.round(adjustedDistance * 1.5), // Estimativa: ~1.5 min/km
      freightPrice: Math.round(freightPrice * 100) / 100,
    }
  } catch (error) {
    console.error('Erro no cálculo fallback de frete:', error)
    return { success: false, error: 'Erro ao calcular frete' }
  }
}

