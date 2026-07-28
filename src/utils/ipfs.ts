import { config } from "../config/env.js";

// Metric tracking as required by Acceptance Criteria
export const metrics = {
  ipfs_gateway_failures_total: {} as Record<string, number>
};

const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs"
];

export async function fetchFromIPFS(cid: string): Promise<any> {
  for (const gateway of GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${gateway}/${cid}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        console.log(`[IPFS] Successfully fetched CID ${cid} using gateway: ${gateway}`);
        return await res.json();
      } else {
        // Record failure for this gateway due to non-200 response
        metrics.ipfs_gateway_failures_total[gateway] = (metrics.ipfs_gateway_failures_total[gateway] || 0) + 1;
      }
    } catch (error) {
      // Record failure for this gateway due to throw (e.g., timeout or network error)
      metrics.ipfs_gateway_failures_total[gateway] = (metrics.ipfs_gateway_failures_total[gateway] || 0) + 1;
    }
  }
  
  throw new Error(`IPFS fetch failed for CID: ${cid}`);
}
