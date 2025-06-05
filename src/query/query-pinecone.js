import "dotenv/config";
import pinecone from "../../config/pineconeConfig.js";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

async function queryPineconeData(query, topK = 20) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    // Query Pinecone
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const queryResponse = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK,
      includeMetadata: true,
    });

    console.log(`Found ${queryResponse.matches.length} matches for query: "${query}"`);
    
    // Format and display results
    queryResponse.matches.forEach((match, i) => {
      console.log(`\n${i + 1}. Score: ${match.score.toFixed(4)}`);
      console.log(`   Scope: ${match.metadata.scope}`);
      console.log(`   Nutrient: ${match.metadata.nutrient}`);
      console.log(`   Claim Type: ${match.metadata.claimType}`);
      console.log(`   Claim: ${match.metadata.claim}`);
    });

    return queryResponse.matches;
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw error;
  }
}

// Example usage - you can modify this query
const exampleQuery = "vitamin D bone health claims";
console.log("Querying Pinecone for health claims...");
await queryPineconeData(exampleQuery);
console.log("Query completed!");
