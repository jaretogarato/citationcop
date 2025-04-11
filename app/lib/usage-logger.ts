// app/lib/services/usageLogger.ts
// This module handles logging of API usage for different models.
// It calculates the cost based on token usage and model type.
// It is designed to be used in server-side code (API Routes, Server Actions).
// --- Interfaces ---

interface LogUsageParams {
  modelName: string
  totalTokens: number // Still useful for logging/display, though cost uses prompt/completion
  promptTokens?: number // Tokens in the input prompt
  completionTokens?: number // Tokens in the generated response
  cachedTokens?: number
  apiEndpoint: string // The API endpoint being called (for logging purposes)
}

interface TokenPricing {
  input: number // Price per single input token in USD
  output: number // Price per single output token in USD
  cached?: number // Optional: Cached price per single token in USD
}

// --- In-Memory Tracker (For Testing Only) ---
/**
 * WARNING: This variable tracks cumulative cost *only* within the current
 * server process lifecycle. It resets every time the server restarts.
 * DO NOT rely on this for persistent billing or accounting.
 */
let cumulativeCostTracker: number = 0

// --- Core Logging Function ---

/**
 * Logs API usage details and calculated cost.
 * Should be called from server-side code (API Routes, Server Actions).
 * Does not handle authentication itself; expects userId to be passed in.
 */
export async function logTokenUsage(params: LogUsageParams): Promise<void> {
  //console.log('--- Logging API Usage ---')
  //console.log('Received Params:', params)

  const userId = 'test'
  if (!userId) {
    // Decide your policy: log as anonymous or skip?
    console.warn(
      `Attempting to log usage without a User ID for endpoint ${params.apiEndpoint}. Proceeding as anonymous/system usage.`
    )
    // You might choose to return early here if userId is mandatory for all logging
    // return;
  }

  // Calculate the cost based on prompt and completion tokens
  const cost = calculateCost(
    params.promptTokens,
    params.completionTokens,
    params.modelName,
    params.cachedTokens
  )

  console.log(`Calculated Cost: $${cost.toFixed(8)}`)

  cumulativeCostTracker += cost
  console.log(
    `>>> Cumulative Cost This Session: $${cumulativeCostTracker.toFixed(8)} <<<`
  )

  try {
    // --- Database Logging (Example) ---
    // Uncomment and adapt this section when your DB is ready
    /*
      await db.apiUsageLog.create({ // Use your actual Prisma model name
        data: {
          userId: params.userId, // Can be null if your schema allows
          modelName: params.modelName,
          apiEndpoint: params.apiEndpoint,
          promptTokens: params.promptTokens ?? 0, // Default to 0 if undefined
          completionTokens: params.completionTokens ?? 0, // Default to 0 if undefined
          totalTokens: params.totalTokens, // Log the total provided
          calculatedCost: cost, // Store the calculated cost (ensure DB schema has this field, likely Decimal/Float)
          timestamp: new Date(), // Or let DB handle default timestamp
          // Add any other relevant fields from params or context
        }
      })
      console.log(`Usage logged successfully to DB for endpoint: ${params.apiEndpoint}`)
      */
    // --- Console Logging (Current Implementation) ---
    //console.log(`Usage logging simulated for endpoint: ${params.apiEndpoint}`)
    //console.log('cahced tokens: ', ${params.cached} )
    //console.log(`User ID: ${userId ?? 'Anonymous/System'}`)
    //console.log(`Model Name: ${params.modelName}`)
    //console.log(`Prompt Tokens: ${params.promptTokens ?? 'N/A'}`)
    //console.log(`Completion Tokens: ${params.completionTokens ?? 'N/A'}`)
    //console.log(`Total Tokens: ${params.totalTokens}`)
    //console.log(`Calculated Cost: $${cost.toFixed(8)}`)
  } catch (error) {
    console.error(
      `Error logging API usage for endpoint ${params.apiEndpoint}:`,
      error
    )
    // Decide how to handle logging errors (e.g., metrics, alerts)
    // Re-throwing might crash the caller; often logging is best-effort
  }
  console.log('-------------------------')
}

// --- Pricing Logic ---

/**
 * Calculates the cost of an API call based on model, prompt tokens, and completion tokens.
 *
 * @param promptTokens Number of tokens in the input prompt.
 * @param completionTokens Number of tokens in the generated response.
 * @param modelName The name of the language model used.
 * @returns The calculated cost in USD.
 */
/**
 * Calculates the cost of an API call based on model and token counts,
 * including potential cached input tokens if provided.
 *
 * @param promptTokens Number of standard (non-cached) input tokens.
 * @param completionTokens Number of generated output tokens.
 * @param modelName The name of the language model used.
 * @param cachedTokens Optional: Number of cached input tokens used.
 * @returns The calculated total cost in USD.
 */
function calculateCost(
  promptTokens: number | undefined,
  completionTokens: number | undefined,
  modelName: string,
  cachedTokens: number | undefined // Add cachedTokens parameter
): number {
  const prices = getPricePerToken(modelName)

  // Default undefined token counts to 0
  const pTokens = promptTokens ?? 0
  const cTokens = completionTokens ?? 0
  const cacheTokens = cachedTokens ?? 0 // Default cached tokens to 0

  // Calculate cost for standard input tokens
  const inputCost = pTokens * prices.input

  // Calculate cost for output tokens
  const outputCost = cTokens * prices.output

  // Calculate cost for cached input tokens
  // Use prices.cached if available, otherwise treat cached price as 0
  const cachedPricePerToken = prices.cached ?? 0
  const cachedCost = cacheTokens * cachedPricePerToken

  if (cacheTokens > 0 && cachedPricePerToken === 0) {
    console.warn(
      `Warning: Cached tokens (${cacheTokens}) were provided for model ${modelName}, but no 'cached' price is defined. Cached cost will be $0.`
    )
  }
  if (cachedTokens !== undefined && prices.cached === undefined) {
    console.warn(
      `Cached tokens provided for model ${modelName}, but no cached price defined in pricing structure.`
    )
  }

  // Return the sum of all costs
  return inputCost + outputCost + cachedCost
}

/**
 * Gets the price per single token for a given model (input and output separately).
 * Prices are based on user-provided data ($ per 1 Million Tokens initially).
 *
 * @param modelName The name of the model (e.g., 'gpt-4o', '4o-mini', 'o3-mini'). Case-insensitive.
 * @returns An object with 'input' and 'output' prices per token, or { input: 0, output: 0 } if not found.
 */
function getPricePerToken(modelName: string): TokenPricing {
  // Normalize model name to lowercase and handle potential aliases
  const normalizedModelName = modelName.toLowerCase().replace('openai ', '')

  // Define pricing ($ per 1 Million Tokens converted to $ per single token)
  const pricing: { [key: string]: TokenPricing } = {
    o1: {
      input: 15 / 1_000_000, // 0.0000011
      output: 60 / 1_000_000, // 0.0000044
      cached: 7.5 / 1_000_000
    },

    // o3-mini ($1.10 Input / $4.40 Output per 1M tokens)
    'o3-mini': {
      input: 1.1 / 1_000_000, // 0.0000011
      output: 4.4 / 1_000_000, // 0.0000044
      cached: 0.55 / 1_000_000 // 0.00000055
    },

    // GPT-4o mini ($0.150 Input / $0.600 Output per 1M tokens)
    'gpt-4o-mini': {
      input: 0.15 / 1_000_000, // 0.00000015
      output: 0.6 / 1_000_000,
      cached: 0.075 / 1_000_000 // 0.000000075
    },
    '4o-mini': {
      // Alias for gpt-4o-mini
      input: 0.15 / 1_000_000,
      output: 0.6 / 1_000_000,
      cached: 0.075 / 1_000_000 // 0.000000075
    },
    // GPT-4o ($2.50 Input / $10.00 Output per 1M tokens) - Using YOUR provided prices
    // Note: Official OpenAI pricing might differ ($5/$15 per 1M as of mid-2024)
    'gpt-4o': {
      input: 2.5 / 1_000_000, // 0.0000025
      output: 10.0 / 1_000_000, // 0.00001
      cached: 1.25 / 1_000_000 // 0.00000125
    }
    // Add other models as needed following the { input: price_per_token, output: price_per_token } structure
  }

  // Return the pricing for the normalized model name, or default to zero cost if not found
  const modelPrices = pricing[normalizedModelName]
  if (!modelPrices) {
    console.warn(
      `Pricing not found for model: ${modelName} (Normalized: ${normalizedModelName}). Returning zero cost.`
    )
    return { input: 0, output: 0 }
  }
  return modelPrices
}

// --- Helper Functions (if needed, e.g., for testing) ---
// You could add internal helper functions here if the file grows.
