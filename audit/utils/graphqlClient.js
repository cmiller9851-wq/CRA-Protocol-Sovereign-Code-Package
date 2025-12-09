// audit/utils/graphqlClient.js
import axios from "axios";
import { MIRROR_NODE_URL } from "../config.js";

/**
 * Execute a GraphQL query against the Hedera Mirror‑Node.
 *
 * @param {string} query      – GraphQL query string
 * @param {object} variables – Variables object (optional)
 * @returns {Promise<object>} – The `data` field of the response
 * @throws {Error}           – If the GraphQL endpoint returns errors
 */
export async function runQuery(query, variables = {}) {
  const response = await axios.post(
    MIRROR_NODE_URL,
    { query, variables },
    { headers: { "Content-Type": "application/json" } }
  );

  if (response.data.errors) {
    throw new Error(
      "GraphQL errors: " + JSON.stringify(response.data.errors)
    );
  }
  return response.data.data;
}
