/**
 * Busca endereço completo usando apenas rua e número
 * Usa Nominatim (OpenStreetMap) que é gratuito e não precisa de API key
 */

interface AddressResult {
  success: boolean
  fullAddress?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  error?: string
}

/**
 * Extrai rua e número de uma string
 * Aceita múltiplos formatos e é tolerante a erros
 */
function extractStreetAndNumber(addressInput: string): { street: string; number: string | null } {
  // Remove espaços extras e normaliza
  let cleaned = addressInput.trim()
  
  // Normaliza abreviações comuns (tolerante a erros)
  const abbreviations: Record<string, string> = {
    'r ': 'rua ',
    'r. ': 'rua ',
    'av ': 'avenida ',
    'av. ': 'avenida ',
    'avd ': 'avenida ',
    'avd. ': 'avenida ',
    'est ': 'estrada ',
    'est. ': 'estrada ',
    'rod ': 'rodovia ',
    'rod. ': 'rodovia ',
  }
  
  // Aplica normalizações (case-insensitive)
  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`^${abbr}`, 'i')
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, full)
      break
    }
  }
  
  // Padrões aceitos (flexíveis):
  // "Rua X, 123" ou "Rua X 123" ou "Rua X - 123"
  // "123 Rua X" ou "123, Rua X"
  // "R. X, 123" ou "R. X 123"
  // "Av. X, 123" ou "Av. X 123"
  // "Rua X" (sem número também funciona)
  
  let street = cleaned
  let number: string | null = null
  
  // Tenta encontrar número no INÍCIO (ex: "123 Rua X")
  const numberAtStart = cleaned.match(/^(\d+)(?:\s*[,\s-]+\s*)(.+)/i)
  if (numberAtStart) {
    number = numberAtStart[1]
    street = numberAtStart[2].trim()
  } else {
    // Tenta encontrar número no FINAL (ex: "Rua X, 123" ou "Rua X 123")
    const numberAtEnd = cleaned.match(/(.+?)(?:[,\s-]+)(\d+)(?:\s|$)/)
    if (numberAtEnd) {
      street = numberAtEnd[1].trim()
      number = numberAtEnd[2]
    } else {
      // Tenta encontrar número em qualquer lugar (mais flexível)
      const numberAnywhere = cleaned.match(/(\d+)/)
      if (numberAnywhere) {
        number = numberAnywhere[1]
        // Remove o número da string para obter a rua
        street = cleaned.replace(new RegExp(`\\s*${number}\\s*`), ' ').trim()
      }
    }
  }
  
  // Remove vírgulas, hífens e espaços extras
  street = street.replace(/^[,\s-]+|[,\s-]+$/g, '')
  street = street.replace(/\s+/g, ' ') // Normaliza espaços múltiplos
  
  // Se a rua ficou muito curta após remover o número, tenta outra abordagem
  if (street.length < 3 && number) {
    // Talvez o número estava no meio ou formato diferente
    // Tenta extrair tudo exceto o número
    const parts = cleaned.split(/\s+/)
    const streetParts: string[] = []
    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        streetParts.push(part)
      }
    }
    if (streetParts.length > 0) {
      street = streetParts.join(' ').replace(/^[,\s-]+|[,\s-]+$/g, '')
    }
  }
  
  return { street, number }
}

/**
 * Busca endereço completo usando Nominatim (OpenStreetMap)
 */
export async function lookupFullAddress(
  addressInput: string,
  cityHint?: string,
  stateHint?: string
): Promise<AddressResult> {
  try {
    const { street, number } = extractStreetAndNumber(addressInput)
    
    if (!street || street.length < 3) {
      return {
        success: false,
        error: 'Por favor, informe pelo menos o nome da rua.',
      }
    }
    
    // Monta query de busca (tenta múltiplas variações para ser mais tolerante)
    // Nominatim funciona melhor com: "rua, número, cidade, estado, brasil"
    const queries: string[] = []
    
    // Query principal: rua + número + cidade/estado
    let mainQuery = street
    if (number) {
      mainQuery += ` ${number}`
    }
    if (cityHint) {
      mainQuery += `, ${cityHint}`
    }
    if (stateHint) {
      mainQuery += `, ${stateHint}`
    }
    mainQuery += ', Brasil'
    queries.push(mainQuery)
    
    // Query alternativa: apenas rua + número (sem cidade/estado)
    if (cityHint || stateHint) {
      let altQuery = street
      if (number) {
        altQuery += ` ${number}`
      }
      altQuery += ', Brasil'
      queries.push(altQuery)
    }
    
    // Query mais simples: apenas rua (sem número, se houver cidade)
    if (number && cityHint) {
      queries.push(`${street}, ${cityHint}, ${stateHint || 'Brasil'}, Brasil`)
    }
    
    console.log(`🔍 [address-lookup] Buscando endereço com ${queries.length} variações...`)
    
    // Tenta cada query até encontrar um resultado
    let data: any[] = []
    let lastError: string | null = null
    
    for (const query of queries) {
      console.log(`   Tentativa: "${query}"`)
      
      try {
        // Usa Nominatim (OpenStreetMap) - gratuito, sem API key
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query)}&` +
          `format=json&` +
          `addressdetails=1&` +
          `limit=3&` + // Pega mais resultados para ter opções
          `countrycodes=br`,
          {
            headers: {
              'User-Agent': 'AutoFlow/1.0', // Nominatim requer User-Agent
            },
          }
        )
        
        if (!response.ok) {
          console.warn(`   ⚠️ Erro na API: ${response.status}`)
          lastError = `Erro ${response.status} na busca`
          continue
        }
        
        const result = await response.json()
        
        if (result && result.length > 0) {
          data = result
          console.log(`   ✅ Encontrado ${result.length} resultado(s)`)
          break
        } else {
          console.log(`   ⚠️ Nenhum resultado para esta variação`)
        }
      } catch (error) {
        console.warn(`   ⚠️ Erro na requisição:`, error)
        lastError = 'Erro de conexão'
        continue
      }
    }
    
    if (!data || data.length === 0) {
      console.warn(`⚠️ [address-lookup] Nenhum resultado encontrado após ${queries.length} tentativas`)
      return {
        success: false,
        error: 'Endereço não encontrado. Por favor, verifique se a rua e número estão corretos ou informe o endereço completo.',
      }
    }
    
    // Escolhe o melhor resultado (prioriza resultados com número de casa se foi fornecido)
    let bestResult = data[0]
    if (number) {
      // Se foi fornecido um número, prioriza resultados que têm número de casa
      const resultWithNumber = data.find(r => r.address?.house_number)
      if (resultWithNumber) {
        bestResult = resultWithNumber
      }
    }
    
    const result = bestResult
    const address = result.address || {}
    
    // Extrai informações do endereço (usa o número fornecido pelo usuário se disponível)
    const fullStreet = address.road || address.street || street
    const fullNumber = number || address.house_number || '' // Prioriza número fornecido pelo usuário
    const neighborhood = address.suburb || address.neighbourhood || address.quarter || ''
    const city = address.city || address.town || address.municipality || cityHint || ''
    const state = address.state || stateHint || ''
    const zipCode = address.postcode || ''
    
    // Monta endereço completo
    const addressParts: string[] = []
    if (fullStreet) {
      addressParts.push(fullStreet)
      if (fullNumber) {
        addressParts[addressParts.length - 1] += `, ${fullNumber}`
      }
    }
    if (neighborhood) {
      addressParts.push(neighborhood)
    }
    if (city && state) {
      addressParts.push(`${city} - ${state}`)
    } else if (city) {
      addressParts.push(city)
    }
    if (zipCode) {
      addressParts.push(zipCode)
    }
    
    const fullAddress = addressParts.join(', ')
    
    console.log(`✅ [address-lookup] Endereço encontrado: "${fullAddress}"`)
    
    return {
      success: true,
      fullAddress,
      street: fullStreet,
      number: fullNumber || number,
      neighborhood,
      city,
      state,
      zipCode,
    }
  } catch (error) {
    console.error(`❌ [address-lookup] Erro ao buscar endereço:`, error)
    return {
      success: false,
      error: 'Erro ao buscar endereço. Por favor, informe o endereço completo.',
    }
  }
}

