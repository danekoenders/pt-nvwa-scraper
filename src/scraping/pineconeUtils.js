import pinecone from '../../config/pineconeConfig.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate embeddings using OpenAI
export async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Function to prepare claim data for Pinecone
export function prepareclaimForPinecone(scope, nutrientName, claim, claimType, index) {
  // Helper function to sanitize strings for ID generation
  const sanitizeForId = (str) => {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Create a unique ID for each claim with proper sanitization
  const sanitizedScope = sanitizeForId(scope);
  const sanitizedNutrient = sanitizeForId(nutrientName);
  const sanitizedClaimType = sanitizeForId(claimType);
  
  const id = `${sanitizedScope}-${sanitizedNutrient}-${sanitizedClaimType}-${index}`;
  
  // Create text content for embedding
  const textContent = `Scope: ${scope}, Nutrient: ${nutrientName}, Claim Type: ${claimType}, Claim: ${claim}`;
  
  return {
    id,
    textContent,
    metadata: {
      scope,
      nutrient: nutrientName,
      claim,
      claimType,
    }
  };
}

// Function to store data in Pinecone
export async function storeToPinecone(indexName, vectorData) {
  try {
    const index = pinecone.Index(indexName);
    
    // Generate embeddings for the text content
    const embedding = await generateEmbedding(vectorData.textContent);
    
    // Prepare vector for upsert
    const vector = {
      id: vectorData.id,
      values: embedding,
      metadata: vectorData.metadata
    };
    
    // Upsert to Pinecone
    await index.upsert([vector]);
    console.log(`Stored vector with ID: ${vectorData.id}`);
    
  } catch (error) {
    console.error('Error storing to Pinecone:', error);
    throw error;
  }
}

// Function to batch store multiple vectors to Pinecone
export async function batchStoreToPinecone(indexName, vectorDataArray) {
  try {
    const index = pinecone.Index(indexName);
    
    // Process in batches to avoid rate limits
    const batchSize = 100;
    
    for (let i = 0; i < vectorDataArray.length; i += batchSize) {
      const batch = vectorDataArray.slice(i, i + batchSize);
      
      // Generate embeddings for all items in batch
      const vectors = [];
      for (const vectorData of batch) {
        const embedding = await generateEmbedding(vectorData.textContent);
        vectors.push({
          id: vectorData.id,
          values: embedding,
          metadata: vectorData.metadata
        });
      }
      
      // Upsert batch to Pinecone
      await index.upsert(vectors);
      console.log(`Stored batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(vectorDataArray.length/batchSize)}`);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < vectorDataArray.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Successfully stored ${vectorDataArray.length} vectors to Pinecone`);
    
  } catch (error) {
    console.error('Error batch storing to Pinecone:', error);
    throw error;
  }
} 