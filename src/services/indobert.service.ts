import { env } from 'cloudflare:workers';
import { HttpError } from '../middleware/error-handler.ts';
import type { Prediction } from '../types/index.ts';

/**
 * Proxies a classification request to the hosted Hugging Face endpoint.
 *
 * The endpoint URL and token are Worker secrets, so the call must stay
 * server-side — the browser never sees them.
 */
export async function classifyText(text: string): Promise<Prediction[]> {
	const endpoint = env.hf_endpoints;

	if (!endpoint) {
		throw new Error('hf_endpoints is not configured.');
	}

	const response = await fetch(endpoint, {
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${env.hf_endpoints_key}`,
			'Content-Type': 'application/json'
		},
		method: 'POST',
		body: JSON.stringify({
			inputs: text,
			parameters: {}
		})
	});

	const result: Prediction[] | { error?: string } = await response.json();

	if (!response.ok) {
		throw new HttpError(
			'error' in result && result.error ? result.error : 'IndoBERT service request failed.',
			{ status: 502, code: 'UPSTREAM_ERROR' }
		);
	}

	return result as Prediction[];
}
